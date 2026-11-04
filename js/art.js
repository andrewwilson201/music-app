// Album artwork and album search through the iTunes Search API (no key needed).
// Uses JSONP so it works from any static host regardless of CORS.

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

function score(album, r) {
  const a = norm(album.artist), ra = norm(r.artist);
  const t = norm(album.title), rt = norm(r.title);
  let s = 0;
  if (a && (ra === a)) s += 3;
  else if (a && (ra.includes(a) || a.includes(ra))) s += 2;
  if (t) {
    if (rt === t) s += 3;
    else if (rt.startsWith(t) || t.startsWith(rt) || rt.includes(t)) s += 2;
  }
  return s;
}

// Best-guess artwork for a stored album. Resolves to a URL or '' (not found).
export async function findArt(album) {
  const term = `${album.artist} ${album.title || ''}`.trim();
  const results = await searchAlbums(term, 8);
  let best = null, bestScore = 0;
  for (const r of results) {
    const s = score(album, r);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  const needed = album.title ? 4 : 3; // artist + title, or artist alone when no title
  return best && bestScore >= needed ? best.art : '';
}

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
      const url = await findArt(job.album);
      job.resolve(url);
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
