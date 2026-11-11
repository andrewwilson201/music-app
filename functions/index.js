// Listening tracking. Every 30 minutes, for each person who switched it on in
// Settings, read their last 50 Spotify plays and add any new ones to
// users/{uid}/listening/{spotifyAlbumId}. 50 plays is roughly three hours of
// music, so checking every half hour doesn't miss anything.
//
// users/{uid}/private/spotify  { enabled, refreshToken, clientId, since,
//                                cursor, lastRun, lastError, plays, gapAt }
// users/{uid}/listening/{id}   { albumId, title, artist, art, spotify, albumMs,
//                                ms, plays, first, last, weeks{}, tracks{} }
//   tracks{id} = { name, n, ms, plays, weeks{week: ms}, wplays{week: plays} }
//
// Deployed by .github/workflows/deploy-firebase.yml when functions/ changes on main.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import { tally } from './listening.js';
import { pickArtists, newAlbums, matchArtist } from './releases.js';

initializeApp();
const db = getFirestore();

class SpotifyError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function refresh(state) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: state.refreshToken, client_id: state.clientId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SpotifyError(json.error_description || json.error || `token ${res.status}`, json.error === 'invalid_grant' ? 401 : res.status);
  return json; // { access_token, refresh_token? }
}

async function api(token, path) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new SpotifyError(`${res.status} ${json.error?.message || ''}`.trim(), res.status);
  }
  return res.json();
}

// Total running time of an album, so the app can say how many times it's
// been played front to back. One request per album, the first time it's heard.
async function albumLength(token, id) {
  try {
    const a = await api(token, `/albums/${id}`);
    return { albumMs: (a.tracks?.items || []).reduce((n, t) => n + (t.duration_ms || 0), 0), tracksTotal: a.total_tracks || 0 };
  } catch (e) {
    logger.warn(`album ${id}: ${e.message}`);
    return {};
  }
}

export async function syncUser(uid, stateRef, state, tok) {
  const items = (await api(tok.access_token, '/me/player/recently-played?limit=50')).items || [];
  // Before the first run, start from when tracking was switched on: plays from
  // before then belong to the imported history, not to live tracking.
  const cursor = state.cursor || state.since || 0;
  const result = tally(items, cursor);
  // A full page whose oldest play is newer than the cursor means some plays
  // fell off the end of the list before we looked.
  const oldest = Math.min(...items.map((i) => Date.parse(i.played_at)));
  const gap = cursor && items.length >= 50 && oldest > cursor ? oldest : 0;

  const batch = db.batch();
  for (const add of Object.values(result.albums)) {
    const ref = db.doc(`users/${uid}/listening/${add.albumId}`);
    const snap = await ref.get();
    const old = snap.exists ? snap.data() : null;
    const length = old?.albumMs ? {} : await albumLength(tok.access_token, add.albumId);
    const weeks = { ...(old?.weeks || {}) };
    for (const [w, ms] of Object.entries(add.weeks)) weeks[w] = (weeks[w] || 0) + ms;
    const tracks = { ...(old?.tracks || {}) };
    for (const [id, t] of Object.entries(add.tracks)) {
      const o = tracks[id] || { name: t.name, n: t.n, ms: 0, plays: 0 };
      const add = (from = {}, more) => {
        const out = { ...from };
        for (const [w, v] of Object.entries(more)) out[w] = (out[w] || 0) + v;
        return out;
      };
      tracks[id] = {
        name: t.name || o.name, n: t.n || o.n, ms: o.ms + t.ms, plays: o.plays + t.plays,
        weeks: add(o.weeks, t.weeks), wplays: add(o.wplays, t.wplays),
      };
    }
    batch.set(ref, {
      albumId: add.albumId, title: add.title, artist: add.artist, art: add.art || old?.art || '', spotify: add.spotify,
      ...length,
      ms: (old?.ms || 0) + add.ms,
      plays: (old?.plays || 0) + add.plays,
      first: Math.min(old?.first || add.first, add.first),
      last: Math.max(old?.last || 0, add.last),
      weeks, tracks,
    }, { merge: true });
  }
  batch.set(stateRef, {
    ...(tok.refresh_token ? { refreshToken: tok.refresh_token } : {}),
    cursor: Math.max(cursor, result.cursor),
    plays: FieldValue.increment(result.plays),
    lastRun: Date.now(),
    lastError: '',
    ...(gap ? { gapAt: gap } : {}),
  }, { merge: true });
  await batch.commit();
  return result.plays;
}

export const syncListening = onSchedule({ schedule: 'every 30 minutes', timeoutSeconds: 300, memory: '256MiB' }, async () => {
  const users = await db.collection('users').listDocuments();
  for (const user of users) {
    const stateRef = user.collection('private').doc('spotify');
    const snap = await stateRef.get();
    const state = snap.exists ? snap.data() : null;
    if (!state?.enabled || !state.refreshToken || !state.clientId) continue;
    try {
      const tok = await refresh(state);
      // Spotify hands over a new sign-in with each refresh and can retire the
      // old one. Keep the new one straight away: if reading the plays fails
      // after this, the next run must still be able to sign in.
      if (tok.refresh_token && tok.refresh_token !== state.refreshToken) {
        await stateRef.set({ refreshToken: tok.refresh_token }, { merge: true });
      }
      const n = await syncUser(user.id, stateRef, state, tok);
      if (n) logger.info(`${user.id}: ${n} new plays`);
      if (state.newReleases && Date.now() - (state.releasesAt || 0) > RELEASES_EVERY) {
        try {
          const added = await checkReleases(user.id, stateRef, tok.access_token);
          if (added) logger.info(`${user.id}: ${added} new releases`);
        } catch (e) {
          logger.warn(`${user.id} releases: ${e.message}`);
          await stateRef.set({ releasesAt: Date.now(), releasesError: e.message }, { merge: true });
        }
      }
    } catch (e) {
      logger.warn(`${user.id}: ${e.message}`);
      const lost = e.status === 401 || e.status === 403;
      await stateRef.set({
        lastRun: Date.now(),
        lastError: lost ? 'Spotify access was removed. Switch tracking off and on again.' : e.message,
        ...(lost ? { enabled: false } : {}),
      }, { merge: true });
    }
  }
});

// ---------- new releases
//
// Once a week, for people who switched on "New releases" in Settings (stored as
// newReleases in users/{uid}/private/spotify), check the artists they've logged
// most and add albums released in the last three weeks to their Up next. Runs
// inside syncListening so it shares that run's Spotify sign-in (refreshing the
// token twice could invalidate it). Spotify artist ids and the albums already
// suggested are remembered in users/{uid}/private/releases.

const RELEASES_EVERY = 7 * 864e5 - 20 * 60e3; // weekly, give or take a run
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function checkReleases(uid, stateRef, token) {
  const userRef = db.doc(`users/${uid}`);
  const memoRef = db.doc(`users/${uid}/private/releases`);
  const years = {};
  (await userRef.collection('years').get()).forEach((s) => { years[s.id] = s.data(); });
  const memo = (await memoRef.get()).data() || {};
  const ids = { ...(memo.artists || {}) };
  const found = [];
  for (const name of pickArtists(years)) {
    let id = ids[name];
    if (id === undefined) {
      const res = await api(token, `/search?type=artist&limit=5&q=${encodeURIComponent(name)}`);
      id = matchArtist(res.artists?.items, name)?.id || '';
      ids[name] = id;
      await pause(250);
    }
    if (!id) continue;
    const res = await api(token, `/artists/${id}/albums?include_groups=album&limit=10`);
    found.push(...(res.items || []));
    await pause(250);
  }
  // Read Up next and add to it in one transaction, so an edit made in the app
  // at the same moment isn't lost (the app merges with this on its next save).
  const added = await db.runTransaction(async (tx) => {
    const head = (await tx.get(userRef)).data() || {};
    const toListen = head.toListen || [];
    const fresh = newAlbums(found, { years, toListen, seen: memo.seen || [] });
    if (fresh.length) {
      const today = new Date().toISOString().slice(0, 10);
      const items = fresh.map(({ spotifyId, ...x }) => ({ ...x, added: today }));
      // updatedAt tells the app's other devices that the log changed (store.js, refresh).
      tx.set(userRef, { toListen: [...items, ...toListen], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    tx.set(memoRef, { artists: ids, seen: [...(memo.seen || []), ...fresh.map((x) => x.spotifyId)].slice(-500) }, { merge: true });
    return fresh.length;
  });
  await stateRef.set({ releasesAt: Date.now(), releasesError: '', releasesAdded: added }, { merge: true });
  return added;
}

// ---------- notifications for recommendations
//
// The sender's app calls this right after writing users/{to}/recs/{id}. If the
// recipient turned notifications on (tokens in users/{to}/private/push), each
// of their devices gets a push, shown by sw.js. Each recommendation notifies
// once, and only its sender can trigger it.

const APP_URL = 'https://andrewwilson201.github.io/music-app/';
const DEAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

// Pushes to every device the person turned notifications on for. Expired
// devices are removed, and the outcome is kept in the push doc as `last` so a
// missing notification can be explained.
export async function pushTo(db, messaging, uid, data) {
  const pushRef = db.doc(`users/${uid}/private/push`);
  const tokens = Object.keys((await pushRef.get()).get('tokens') || {});
  if (!tokens.length) return { sent: 0, devices: 0, errors: [] };
  const res = await messaging.sendEachForMulticast({
    tokens,
    webpush: { headers: { Urgency: 'high', TTL: String(7 * 24 * 3600) }, data },
  });
  const errors = [];
  const dead = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || 'unknown';
    errors.push(code);
    if (DEAD_TOKEN.has(code)) dead.push(tokens[i]);
    logger.warn(`push to ${uid} failed: ${code} ${r.error?.message || ''}`);
  });
  const last = { at: Date.now(), title: data.title, sent: res.successCount, devices: tokens.length, errors };
  await pushRef.update('last', last, ...dead.flatMap((t) => [new FieldPath('tokens', t), FieldValue.delete()]));
  return { sent: res.successCount, devices: tokens.length, errors };
}

export async function notifyRecommendation(db, messaging, sender, to, id) {
  const recRef = db.doc(`users/${to}/recs/${id}`);
  const rec = await db.runTransaction(async (tx) => {
    const snap = await tx.get(recRef);
    if (!snap.exists || snap.get('from') !== sender || snap.get('notified')) return null;
    tx.update(recRef, { notified: true });
    return snap.data();
  });
  if (!rec) {
    logger.warn(`notifyRec ${to}/${id}: not found, not from ${sender}, or already notified`);
    return { sent: 0, devices: 0, errors: ['no-rec'] };
  }
  const album = rec.title ? `${rec.title} by ${rec.artist}` : rec.artist;
  const what = rec.song && rec.title ? `${rec.song}, from ${album}` : album;
  return pushTo(db, messaging, to, {
    title: `${rec.fromName || 'A friend'} recommends`,
    body: rec.note ? `${what}: “${rec.note}”` : what,
    url: `${APP_URL}#/rec/${id}`,
    tag: `rec-${id}`,
    icon: rec.art || `${APP_URL}icons/icon-192.png`,
  });
}

export const notifyRec = onCall({ memory: '256MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const { to, id } = req.data || {};
  if (typeof to !== 'string' || typeof id !== 'string' || !/^[\w-]{1,128}$/.test(to + id)) throw new HttpsError('invalid-argument', 'Bad request');
  return notifyRecommendation(db, getMessaging(), req.auth.uid, to, id);
});

// Settings › Notifications › Send a test: pushes to your own devices.
export const testPush = onCall({ memory: '256MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  return pushTo(db, getMessaging(), req.auth.uid, {
    title: 'Notifications are working',
    body: 'You’ll get one like this when a friend recommends an album.',
    url: APP_URL,
    tag: 'test',
    icon: `${APP_URL}icons/icon-192.png`,
  });
});
