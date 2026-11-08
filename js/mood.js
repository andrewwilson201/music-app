// Mood tags for albums, for "Pick for me".
//
// Spotify's audio features (valence, energy) are closed to apps like this one,
// so moods come from the tags listeners give albums and artists:
//   - Last.fm (album.getTopTags, then artist.getTopTags), when LASTFM_API_KEY
//     is set in config.js. Richest source, with mood words like "chill" or
//     "melancholy" alongside genres. ~5 requests a second allowed.
//   - MusicBrainz otherwise: release-group and artist tags and genres. No key,
//     but one request a second, and mostly genre words.
// Tag words are then scored against each mood's word list below.
//
// Every lookup is cached on this device (music-log:tags) for 90 days, failures
// for a day, so each album is looked up once, and nothing here touches the
// Spotify or iTunes limits that album search needs.
import { LASTFM_API_KEY } from './config.js?v=37';
import { norm } from './art.js?v=37';

export const MOODS = [
  { id: 'chill', label: 'Chill', emoji: '🌿', words: 'chill, chillout, chill out, relax, relaxing, mellow, calm, laid back, soothing, peaceful, downtempo, lounge, trip hop, easy listening, bossa nova, lo fi, lofi, smooth:.7, soft, soft rock:.7, yacht rock, acoustic:.5, folk:.4, ambient:.6' },
  { id: 'happy', label: 'Happy', emoji: '☀️', words: 'happy, upbeat, feel good, feelgood, fun, cheerful, uplifting, summer, sunny, joyful, optimistic, party:.6, power pop, indie pop:.7, pop:.3, disco, funk:.7, soul:.3, twee, jangle pop, dance pop, synthpop:.5, synth pop:.5, sunshine pop, afrobeat:.6, ska' },
  { id: 'sad', label: 'Sad', emoji: '🌧️', words: 'sad, melancholy, melancholic, melancholia, depressing, depressive, heartbreak, heartbroken, breakup, bittersweet, emotional:.7, lonely, loneliness, introspective:.7, sadcore, slowcore, grief, mournful, somber, sombre, singer songwriter:.5, folk:.3, chamber pop:.4, emo:.6' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡', words: 'energetic, energy, upbeat:.6, party, workout, driving, dance:.8, dance punk, house, techno, drum and bass, dnb, edm, electro, garage rock, punk:.8, post punk:.6, pop punk, hip hop:.6, rap:.6, rock:.4, big beat, fast' },
  { id: 'intense', label: 'Intense', emoji: '🔥', words: 'aggressive, angry, anger, rage, intense, heavy, loud, metal, heavy metal, hardcore, post hardcore, metalcore, thrash, post punk:.5, doom, sludge, noise, noise rock, industrial, grindcore, black metal, death metal, dark:.6, brutal' },
  { id: 'dreamy', label: 'Dreamy', emoji: '☁️', words: 'dreamy, dream pop, shoegaze, ethereal, atmospheric:.8, psychedelic:.7, psych:.6, space rock, hypnagogic, chillwave, ethereal wave, haunting:.6, lush, hazy, reverb' },
  { id: 'focus', label: 'Focus', emoji: '🎧', words: 'instrumental, study, focus, concentration, ambient:.8, post rock, minimal, minimalism, modern classical, neoclassical, classical:.8, contemporary classical, piano, jazz:.6, drone, krautrock, idm:.7, electronic:.3, soundtrack:.5, score:.5' },
  { id: 'night', label: 'Late night', emoji: '🌙', words: 'late night, night, nocturnal, midnight, night drive, sensual, sexy, seductive, smooth:.6, r&b:.7, rnb:.7, neo soul, quiet storm, trip hop:.6, jazz:.5, dark:.3, slow jams' },
];

// Lower case, with dashes, underscores and runs of spaces as single spaces.
const tagKey = (t) => String(t).toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

const PHRASES = new Map(); // "dream pop" → { dreamy: 1 }
for (const m of MOODS) {
  for (const term of m.words.split(',')) {
    const [w, weight] = term.split(':');
    const k = tagKey(w);
    PHRASES.set(k, { ...PHRASES.get(k), [m.id]: weight ? Number(weight) : 1 });
  }
}

// How strongly one tag says each mood: the whole tag as a known word or phrase
// first ("dream pop"), else its longest known part ("uk dream pop", "indie pop").
function tagMoods(tag) {
  const t = tagKey(tag);
  if (PHRASES.has(t)) return PHRASES.get(t);
  const words = t.split(/[\s/]+/);
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const hit = PHRASES.get(words.slice(i, i + n).join(' '));
      // A single generic word inside a longer tag counts for less.
      if (hit) return n === words.length ? hit : Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, v * (n === 1 ? 0.7 : 0.9)]));
    }
  }
  return null;
}

// tags: [{ name, w }] with w in 0..1 → { scores: { moodId: n }, why: { moodId: [tag names] } }
export function scoreTags(tags) {
  const scores = {};
  const why = {};
  for (const { name, w } of tags || []) {
    const hit = tagMoods(name);
    if (!hit) continue;
    for (const [id, weight] of Object.entries(hit)) {
      scores[id] = (scores[id] || 0) + w * weight;
      (why[id] ||= []).push(name);
    }
  }
  return { scores, why };
}

// Does this album fit the mood? Strong enough on its own, and not clearly a
// better fit for something else.
export function fits(tags, moodId) {
  const { scores, why } = scoreTags(tags);
  const s = scores[moodId] || 0;
  const best = Math.max(0, ...Object.values(scores));
  return s >= 0.45 && s >= best * 0.5 ? { score: s, why: [...new Set(why[moodId])].slice(0, 3) } : null;
}

// ------------------------------------------------------------------ cache

const CACHE_KEY = 'music-log:tags';
const DAY = 86400000;
let cache = null;
function store() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }
  const now = Date.now();
  for (const [k, v] of Object.entries(cache)) if (!v || v.x < now) delete cache[k];
  return cache;
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} }, 800);
}
const keyOf = (album) => `${norm(album.artist)}|${norm(album.title || '')}`;
const remember = (k, tags, days) => { store()[k] = { t: tags, x: Date.now() + days * DAY }; save(); };

// Cached tags for an album: an array (maybe empty), or undefined when it hasn't
// been looked up yet.
export function cachedTags(album) {
  return store()[keyOf(album)]?.t;
}

export const source = () => (LASTFM_API_KEY ? 'Last.fm' : 'MusicBrainz');

// ------------------------------------------------------------------ lookups

// Spaced-out request queue for one service.
function pacer(gapMs) {
  let next = 0;
  return async (fn) => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + gapMs;
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
    return fn();
  };
}
const mbPace = pacer(1100);
const lfPace = pacer(220);
let pausedUntil = 0; // after a 429/503, give the service a rest

async function getJson(url, pace) {
  if (Date.now() < pausedUntil) throw new Error('busy');
  const res = await pace(() => fetch(url, { headers: { Accept: 'application/json' } }));
  if (res.status === 429 || res.status === 503) {
    pausedUntil = Date.now() + 20000;
    throw new Error('busy');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Counts → weights in 0..1 (top tag = 1), dropping tags nobody much agrees on.
function weigh(list, scale = 1, max = 10) {
  const items = (list || []).map((t) => ({ name: String(t.name || '').trim(), c: Number(t.count) || 0 })).filter((t) => t.name);
  const top = Math.max(1, ...items.map((t) => t.c));
  return items.sort((a, b) => b.c - a.c).slice(0, max)
    .map((t) => ({ name: t.name.toLowerCase(), w: Math.round((top > 1 ? Math.max(0.15, t.c / top) : 1) * scale * 100) / 100 }))
    .filter((t) => t.w >= 0.15 * scale);
}

function merge(...lists) {
  const out = new Map();
  for (const t of lists.flat()) {
    const k = tagKey(t.name);
    out.set(k, { name: k, w: Math.max(out.get(k)?.w || 0, t.w) });
  }
  return [...out.values()].sort((a, b) => b.w - a.w).slice(0, 14);
}

const artistCache = new Map(); // this session: artist → Promise of tags

async function lastfm(album) {
  const base = `https://ws.audioscrobbler.com/2.0/?format=json&autocorrect=1&api_key=${encodeURIComponent(LASTFM_API_KEY)}`;
  let albumTags = [];
  if (album.title) {
    const j = await getJson(`${base}&method=album.gettoptags&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}`, lfPace);
    if (j.error && j.error !== 6) throw new Error(j.message || 'Last.fm error'); // 6 = not found
    albumTags = weigh(j.toptags?.tag, 1);
  }
  if (albumTags.length >= 4) return albumTags;
  const ak = norm(album.artist);
  if (!artistCache.has(ak)) {
    artistCache.set(ak, getJson(`${base}&method=artist.gettoptags&artist=${encodeURIComponent(album.artist)}`, lfPace)
      .then((j) => weigh(j.toptags?.tag, 0.7))
      .catch((e) => { artistCache.delete(ak); throw e; }));
  }
  return merge(albumTags, await artistCache.get(ak));
}

const MB = 'https://musicbrainz.org/ws/2';
const luceneEsc = (s) => String(s).replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');

async function musicbrainz(album) {
  let albumTags = [];
  let artistId = '';
  if (album.title) {
    const q = `releasegroup:"${luceneEsc(album.title)}" AND artist:"${luceneEsc(album.artist)}"`;
    const j = await getJson(`${MB}/release-group/?fmt=json&limit=3&query=${encodeURIComponent(q)}`, mbPace);
    const rg = (j['release-groups'] || []).find((r) => r.score >= 85);
    if (rg) {
      albumTags = weigh(rg.tags, 1);
      artistId = rg['artist-credit']?.[0]?.artist?.id || '';
    }
  }
  const ak = artistId || norm(album.artist);
  if (!artistCache.has(ak)) {
    artistCache.set(ak, (async () => {
      let id = artistId;
      if (!id) {
        const j = await getJson(`${MB}/artist/?fmt=json&limit=1&query=${encodeURIComponent(`artist:"${luceneEsc(album.artist)}"`)}`, mbPace);
        const a = (j.artists || [])[0];
        if (!a || a.score < 90) return [];
        id = a.id;
      }
      const a = await getJson(`${MB}/artist/${id}?fmt=json&inc=tags+genres`, mbPace);
      return merge(weigh(a.genres, 0.75), weigh(a.tags, 0.7));
    })().catch((e) => { artistCache.delete(ak); throw e; }));
  }
  return merge(albumTags, await artistCache.get(ak));
}

const inFlight = new Map();

// Tags for an album, looked up once and cached. Rejects with 'busy' while the
// service is asking us to slow down (nothing is cached then).
export function tagsFor(album) {
  const k = keyOf(album);
  const hit = store()[k];
  if (hit) return Promise.resolve(hit.t);
  if (inFlight.has(k)) return inFlight.get(k);
  const p = (LASTFM_API_KEY ? lastfm(album) : musicbrainz(album))
    .then((tags) => { remember(k, tags, 90); return tags; })
    .catch((e) => {
      if (e.message !== 'busy') remember(k, [], 1);
      throw e;
    })
    .finally(() => inFlight.delete(k));
  inFlight.set(k, p);
  return p;
}
