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
// Deploy: firebase deploy --only functions (needs the Blaze plan).

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { tally } from './listening.js';

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

export async function syncUser(uid, stateRef, state) {
  const tok = await refresh(state);
  const items = (await api(tok.access_token, '/me/player/recently-played?limit=50')).items || [];
  const cursor = state.cursor || 0;
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
      const n = await syncUser(user.id, stateRef, state);
      if (n) logger.info(`${user.id}: ${n} new plays`);
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
