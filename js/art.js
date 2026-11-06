// Album artwork and album search. Uses Spotify when you're logged in to it,
// and the iTunes Search API (no key needed, via JSONP) otherwise or as a fallback.

import * as spotify from './spotify.js?v=21';

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

// Used by the artwork picker when editing an album.
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

const itunesAlbum = (r) => {
  const tag = / - (Single|EP)$/.exec(r.collectionName || '');
  return {
    id: r.collectionId,
    artist: r.artistName,
    artists: [{ id: r.artistId, name: r.artistName }],
    title: (r.collectionName || '').replace(/ - (Single|EP)$/, ''),
    art: big(r.artworkUrl100),
    year: (r.releaseDate || '').slice(0, 4),
    tracks: r.trackCount,
    type: tag ? tag[1].toLowerCase() : r.collectionType === 'Compilation' ? 'compilation' : r.trackCount && r.trackCount <= 3 ? 'single' : 'album',
  };
};

async function searchItunes(term, limit = 10) {
  const q = encodeURIComponent(term.trim());
  const json = await jsonp(`https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=${limit}`);
  return (json.results || []).map(itunesAlbum);
}

// ---- Add album search ----
// A plain album search for an artist's name mostly returns their singles, and
// Spotify only hands back 10 results at a time in development mode, so the
// album you want is easily missed. So when the search names an artist (alone,
// or followed by an album title), we also fetch that artist's own albums, and
// then rank everything: results that match every word first, albums before
// singles and EPs.

const words = (t = '') => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['’]/g, '').replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean);

function queryWords(term) {
  const q = words(term);
  return q.length > 1 ? q.filter((t) => t !== 'the') : q;
}

// Share of the search words found in a result's artist and title (0..1).
function coverage(r, q) {
  if (!q.length) return 1;
  const hay = words(`${r.artist} ${r.title}`);
  const joined = hay.join('');
  const hit = q.filter((t) => hay.some((w) => w === t || w.startsWith(t)) || (t.length >= 2 && joined.includes(t))).length;
  return hit / q.length;
}

// The artist the search names, if any: { id, name, rest }, where rest is the
// search words left over once the artist's name is taken out (the album title).
function pickArtist(candidates, term, q) {
  const whole = norm(term);
  let best = null;
  for (const a of candidates) {
    if (!a?.id || !a.name) continue;
    const name = words(a.name).filter((t) => t !== 'the');
    if (!name.length) continue;
    let rest = null;
    const left = q.slice();
    if (name.every((t) => { const i = left.indexOf(t); if (i < 0) return false; left.splice(i, 1); return true; })) rest = left;
    else if (whole.length >= 4 && norm(a.name).startsWith(whole)) rest = [];
    if (rest && (!best || name.length > best.size)) best = { id: a.id, name: a.name, rest, size: name.length };
  }
  return best;
}

const artistsOf = (albums) => albums.flatMap((r) => (r.artists || []).slice(0, 1));

const artistCache = new Map();
function cachedAlbums(key, load) {
  if (!artistCache.has(key)) artistCache.set(key, load().catch((e) => { artistCache.delete(key); throw e; }));
  return artistCache.get(key);
}

async function findIn(source, term, q) {
  const first = await source.search(term);
  let artist = pickArtist(first.artists, term, q) || pickArtist(artistsOf(first.albums), term, q);
  // "artist album" can find nothing at all, so look for the artist on their own
  // using the first few words of the search.
  const raw = term.trim().split(/\s+/);
  for (let k = raw.length - 1; !artist && k >= 1 && k >= raw.length - 3; k--) {
    const more = await source.search(raw.slice(0, k).join(' '));
    artist = pickArtist(more.artists, term, q) || pickArtist(artistsOf(more.albums), term, q);
  }
  let theirs = [];
  if (artist) {
    try {
      const all = await cachedAlbums(`${source.name}:${artist.id}`, () => source.albums(artist.id));
      const match = artist.rest.length ? all.filter((r) => coverage({ artist: '', title: r.title }, artist.rest) >= 0.5) : all;
      theirs = match.length ? match : all;
    } catch (e) {
      if (e.message === 'rate limited') throw e;
    }
  }
  const same = (r) => artist && (r.artists || []).some((a) => a.id === artist.id);
  return first.albums.concat(theirs).map((r) => ({ ...r, byArtist: !!same(r) }));
}

const spotifySource = {
  name: 'spotify',
  search: (term) => spotify.searchCatalog(term),
  albums: (id) => spotify.artistAlbums(id),
};

const itunesSource = {
  name: 'itunes',
  async search(term) {
    const q = encodeURIComponent(term.trim());
    const [albums, artists] = await Promise.all([
      jsonp(`https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=50`),
      jsonp(`https://itunes.apple.com/search?term=${q}&media=music&entity=musicArtist&limit=5`).catch(() => ({ results: [] })),
    ]);
    return {
      albums: (albums.results || []).map(itunesAlbum),
      artists: (artists.results || []).map((a) => ({ id: a.artistId, name: a.artistName })),
    };
  },
  async albums(id) {
    const json = await jsonp(`https://itunes.apple.com/lookup?id=${id}&entity=album&limit=200`);
    return (json.results || []).filter((r) => r.wrapperType === 'collection').map(itunesAlbum)
      .filter((r) => r.type === 'album').sort((a, b) => b.year - a.year);
  },
};

const TYPE_BONUS = { album: 15, ep: 5, compilation: 2, single: 0 };

function rank(list, q) {
  const seen = new Set();
  let out = [];
  for (const r of list) {
    const key = `${norm(r.artists?.[0]?.name || r.artist)}|${norm(stripEdition(r.title))}|${r.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cov = coverage(r, q);
    out.push({ r, cov, s: cov * 100 + (TYPE_BONUS[r.type] ?? 10) + (r.byArtist ? 8 : 0) });
  }
  if (out.some((x) => x.cov === 1)) out = out.filter((x) => x.cov >= 0.5);
  return out.sort((a, b) => b.s - a.s).map((x) => x.r);
}

// Albums for the Add album search, best first.
export async function findAlbums(term, limit = 20) {
  const q = queryWords(term);
  let list = [];
  let failed = null;
  if (spotify.connected()) {
    try { list = await findIn(spotifySource, term, q); } catch (e) { failed = e; }
  }
  // Fill in from iTunes when Spotify is off, failing, or hasn't got it.
  if (!list.some((r) => coverage(r, q) === 1)) {
    try { list = list.concat(await findIn(itunesSource, term, q)); } catch (e) { if (!list.length) throw failed || e; }
  }
  return rank(list, q).slice(0, limit);
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

// Best match for a stored album, or null. Tries Spotify first when connected,
// then iTunes; for each it searches "artist album", then the album name alone,
// then the artist alone.
export async function findRelease(album) {
  const sources = [];
  if (spotify.connected()) sources.push((term, n) => spotify.searchAlbums(term, n));
  sources.push(searchItunes);
  for (const search of sources) {
    for (const term of searchTerms(album)) {
      let results;
      try { results = await search(term, term === album.artist ? 50 : 15); }
      catch (e) { if (search === searchItunes || e.message === 'rate limited') throw e; break; }
      const hit = bestMatch(album, results);
      if (hit) return hit;
    }
  }
  return null;
}

// { art, spotify } for a stored album (empty strings when not found).
export async function findArt(album) {
  const found = await findRelease(album);
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

// ---- songs, for playlists ----
const stripSong = (t) => t
  .replace(/\s+-\s+.*(remaster|version|edit|mix|live|mono|stereo|demo|feat).*$/i, '')
  .replace(/\s*[([](feat|ft|with|remaster|live|mono|stereo|demo|radio|single|album).*?[)\]]/gi, '')
  .trim();

function trackScore(album, song, t) {
  const as = sim(album.artist, t.artist);
  if (as < 0.6) return 0;
  const ns = Math.max(sim(song, t.name), sim(stripSong(song), stripSong(t.name)));
  if (ns < 0.75) return 0;
  // Prefer the version from the album itself over live cuts and compilations.
  const al = album.title ? Math.max(sim(album.title, t.album), sim(album.title, stripEdition(t.album))) : 0;
  return ns * 2 + as + (al >= 0.8 ? 0.5 : 0);
}

// Spotify track for one song on an album: { uri, name, artist } or null.
export async function findTrack(album, song) {
  const q = (s) => s.replace(/"/g, '');
  const queries = [
    `track:"${q(stripSong(song))}" artist:"${q(album.artist)}"`,
    `${stripSong(song)} ${album.artist}`,
  ];
  for (const query of queries) {
    let best = null, bestScore = 0;
    for (const t of await spotify.searchTracks(query, 10)) {
      const s = trackScore(album, song, t);
      if (s > bestScore) { best = t; bestScore = s; }
    }
    if (best) return best;
  }
  return null;
}

// ---- tracklists, for picking best songs ----
// The name to show for a track: no "- 2011 Remaster" or "(feat. X)".
export const cleanSong = (t = '') => stripSong(String(t)) || String(t).trim();

const tracklists = new Map();

// An album's tracks in order: [{ name, disc, no, ms }], or [] if it can't be
// found. Spotify when logged in, iTunes otherwise or if Spotify hasn't got it.
export function findTracklist(album) {
  const key = album.id || `${album.artist}|${album.title}`;
  if (!tracklists.has(key)) {
    tracklists.set(key, loadTracklist(album).then((list) => {
      if (!list.length) tracklists.delete(key);
      return list;
    }, (e) => { tracklists.delete(key); throw e; }));
  }
  return tracklists.get(key);
}

async function loadTracklist(album) {
  let failed = null;
  if (spotify.connected()) {
    try {
      const link = /open\.spotify\.com\/album\/([A-Za-z0-9]+)/.test(album.spotify || '') ? album.spotify : await findSpotifyLink(album);
      const id = /album\/([A-Za-z0-9]+)/.exec(link || '')?.[1];
      if (id) {
        const list = await spotify.albumTracks(id);
        if (list.length) return list;
      }
    } catch (e) { failed = e; }
  }
  try {
    for (const term of searchTerms(album)) {
      const hit = bestMatch(album, await searchItunes(term, term === album.artist ? 50 : 15));
      if (!hit?.id) continue;
      const json = await jsonp(`https://itunes.apple.com/lookup?id=${hit.id}&entity=song&limit=200`);
      const list = (json.results || []).filter((r) => r.wrapperType === 'track' && r.trackName)
        .map((r) => ({ name: r.trackName, disc: r.discNumber || 1, no: r.trackNumber, ms: r.trackTimeMillis }))
        .sort((a, b) => a.disc - b.disc || a.no - b.no);
      if (list.length) return list;
    }
  } catch (e) { if (failed) throw failed; throw e; }
  return [];
}

// A favourite's best song field can hold more than one song: "A; B" or "A / B".
export const bestSongs = (text = '') => String(text).split(/\s*;\s*|\s+\/\s+|\n/).map((s) => s.trim()).filter(Boolean);

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
  return `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title || ''}`.trim())}`;
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
