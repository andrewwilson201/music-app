// Album artwork and album search. Uses Spotify when you're logged in to it,
// and the iTunes Search API (no key needed, via JSONP) otherwise or as a fallback.

import * as spotify from './spotify.js?v=7';

let seq = 0;
function jsonp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cb = `__itunes_${Date.now()}_${seq++}`;
    const script = document.createElement('script');
    const done = (fn, v) => {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
      fn(v);
    };
    const timer = setTimeout(() => done(reject, new Error('timeout')), timeout);
    window[cb] = (json) => done(resolve, json);
    script.onerror = () => done(reject, new Error('network'));
    script.src = `${url}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

export const norm = (t = '') =>
  String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and').replace(/^the /, '').replace(/[^a-z0-9]/g, '');

const big = (u) => (u || '').replace(/\/\d+x\d+bb\./, '/600x600bb.');

export async function searchAlbums(term, limit = 10) {
  if (spotify.connected()) {
    try {
      const list = await spotify.searchAlbums(term, limit);
      if (list.length) return list;
    } catch (e) {
      if (e.message === 'rate limited') throw e;
    }
  }
  return searchItunes(term, limit);
}

export const searchSpotify = (term, limit) => spotify.searchAlbums(term, limit);

async function searchItunes(term, limit = 10) {
  const q = encodeURIComponent(term.trim());
  const json = await jsonp(`https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=${limit}`);
  return (json.results || []).map((r) => ({
    artist: r.artistName,
    title: r.collectionName.replace(/ - (Single|EP)$/, ''),
    art: big(r.artworkUrl100),
    year: (r.releaseDate || '').slice(0, 4),
    tracks: r.trackCount,
  }));
}

// Similarity 0..1 that tolerates typos, "the", punctuation and extra words
// ("fontaines dc" ~ "Fontaines D.C.", "vol ii" ~ "Vol. II (Deluxe)").
function sim(x, y) {
  x = norm(x); y = norm(y);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const gx = grams(x), gy = grams(y);
  let hit = 0;
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) || 0);
  return (2 * hit) / (x.length - 1 + y.length - 1);
}
const stripEdition = (t) => t.replace(/\s*[([].*?(deluxe|edition|remaster|expanded|version|bonus).*?[)\]]/gi, '');

function score(album, r) {
  const as = sim(album.artist, r.artist);
  if (as < 0.6) return 0;
  if (!album.title) return as;
  const ts = Math.max(sim(album.title, r.title), sim(album.title, stripEdition(r.title)));
  if (ts < 0.55) return 0;
  return (as + ts) / 2;
}

function bestMatch(album, results) {
  let best = null, bestScore = 0;
  for (const r of results) {
    const s = score(album, r);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  return best && bestScore >= 0.7 ? best : null;
}

function searchTerms(album) {
  const terms = [`${album.artist} ${album.title || ''}`.trim()];
  if (album.title && album.title.length > 3) terms.push(album.title);
  terms.push(album.artist);
  return [...new Set(terms)];
}

// Best match for a stored album: { art, spotify } (empty strings when not found).
// Tries Spotify first when connected, then iTunes; for each it searches
// "artist album", then the album name alone, then the artist alone.
export async function findArt(album) {
  const sources = [];
  if (spotify.connected()) sources.push((term, n) => spotify.searchAlbums(term, n));
  sources.push(searchItunes);
  let found = null;
  for (const search of sources) {
    for (const term of searchTerms(album)) {
      let results;
      try { results = await search(term, term === album.artist ? 50 : 15); }
      catch (e) { if (search === searchItunes || e.message === 'rate limited') throw e; break; }
      const hit = bestMatch(album, results);
      if (hit) { found = hit; break; }
    }
    if (found) break;
  }
  return { art: found?.art || '', spotify: found?.spotify || '' };
}

// Exact Spotify album link for an album, or '' if none matches.
export async function findSpotifyLink(album) {
  if (!spotify.connected()) return '';
  for (const term of searchTerms(album)) {
    const hit = bestMatch(album, await spotify.searchAlbums(term, term === album.artist ? 50 : 15));
    if (hit) return hit.spotify;
  }
  return '';
}

// Bump when matching improves so earlier misses get another try.
// Logging in to Spotify counts as an improvement.
export const artVersion = () => (spotify.connected() ? 3 : 2);

// ---- throttled queue so we stay well under the API's rate limit ----
const queue = [];
const pending = new Map();
let running = false;
let gap = 450;

export function queueArt(album) {
  const key = album.id;
  if (pending.has(key)) return pending.get(key);
  const p = new Promise((resolve) => queue.push({ album, resolve }));
  pending.set(key, p);
  run();
  return p;
}

export function prioritise(ids) {
  const set = new Set(ids);
  queue.sort((x, y) => set.has(y.album.id) - set.has(x.album.id));
}

async function run() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      job.resolve(await findArt(job.album));
      gap = Math.max(450, gap * 0.9);
    } catch {
      job.resolve(null); // unknown; try again another time
      gap = Math.min(10000, gap * 2);
    }
    pending.delete(job.album.id);
    await new Promise((r) => setTimeout(r, gap));
  }
  running = false;
}

// ---- Spotify ----
export function spotifyUrl(album) {
  if (album.spotify) return album.spotify;
  return `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title || ''}`.trim())}/albums`;
}
export function spotifyArtistUrl(name) {
  return `https://open.spotify.com/search/${encodeURIComponent(name)}`;
}

// Deterministic warm gradient placeholder for albums without artwork.
export function placeholder(album) {
  let h = 0;
  for (const c of `${album.artist}${album.title}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 55% 18%))`;
}
