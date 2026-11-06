// Spotify "Extended streaming history" import. Everything happens in the
// browser: the zip (or its JSON files) is read here, the plays are added up
// per album and per song, and the result is saved, gzipped, in a couple of
// Firestore documents (see store.saveHistory).
//
// Each album entry looks like the live totals the scheduled function writes
// (users/{uid}/listening), so the rest of the app treats them the same:
//   { t: title, a: artist, ms, p: plays, f: first, l: last, w: {period: ms},
//     tr: { trackName: { ms, p, w: {period: ms}, wp: {period: plays} } } }
// Periods are the Monday of the week (YYYY-MM-DD) for the last half year, and
// the first of the month (YYYY-MM-01) before that, to keep the data small.

const MIN_PLAY = 30 * 1000; // Spotify only counts a play after 30 seconds
const WEEKLY_FOR = 27 * 7 * 864e5; // keep weekly detail for about half a year

export function weekOf(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// ---------- reading the export

const isHistoryFile = (name) => /Streaming_History_Audio_[^/]*\.json$/i.test(name) && !/Kids/i.test(name);

// Rows from a list of picked files: a Spotify zip and/or its JSON files.
export async function readExport(files, onProgress = () => {}) {
  const rows = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      for (const { name, text } of await unzip(file, isHistoryFile, onProgress)) rows.push(...parseJson(text, name));
    } else if (/\.json$/i.test(file.name)) {
      rows.push(...parseJson(await file.text(), file.name));
    }
  }
  return rows;
}

function parseJson(text, name) {
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${name} isn't valid JSON`); }
  return Array.isArray(json) ? json : [];
}

// A small zip reader: finds the files we want in the central directory and
// inflates them with the browser's own DecompressionStream.
async function unzip(file, want, onProgress) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("That file doesn't look like a zip");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('The zip looks damaged');
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (want(name)) entries.push({ name, method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!entries.length) throw new Error("No streaming history files in that zip. It should contain Streaming_History_Audio files.");
  const out = [];
  for (const [i, e] of entries.entries()) {
    onProgress(`Reading ${i + 1} of ${entries.length} files…`);
    const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
    const raw = buf.subarray(start, start + e.size);
    let bytes;
    if (e.method === 0) bytes = raw;
    else if (e.method === 8) bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`Can't read ${e.name} (compression ${e.method})`);
    out.push({ name: e.name, text: new TextDecoder().decode(bytes) });
  }
  return out;
}

// ---------- adding it up

// before: only count plays before this time (when live tracking started), so
// nothing is counted twice. Returns { albums: [entry], info }.
export function aggregate(rows, { before = Infinity, now = Date.now() } = {}) {
  const weeklyFrom = weekOf(now - WEEKLY_FOR);
  const period = (ms) => {
    const w = weekOf(ms);
    return w >= weeklyFrom ? w : new Date(ms).toISOString().slice(0, 7) + '-01';
  };
  const albums = new Map();
  let plays = 0;
  let from = Infinity;
  let to = 0;
  for (const r of rows) {
    const title = r.master_metadata_album_album_name;
    const artist = r.master_metadata_album_artist_name;
    const track = r.master_metadata_track_name;
    if (!r.spotify_track_uri || !title || !artist || !track) continue; // podcasts, audiobooks, local files
    const at = Date.parse(r.ts);
    const ms = r.ms_played || 0;
    if (!(at < before) || !ms) continue;
    const counted = ms >= MIN_PLAY ? 1 : 0;
    const key = `${artist}\u0000${title}`;
    let a = albums.get(key);
    if (!a) albums.set(key, (a = { t: title, a: artist, ms: 0, p: 0, f: at, l: at, w: {}, tr: {} }));
    const k = period(at);
    a.ms += ms;
    a.p += counted;
    a.f = Math.min(a.f, at);
    a.l = Math.max(a.l, at);
    a.w[k] = (a.w[k] || 0) + ms;
    const t = a.tr[track] ||= { ms: 0, p: 0, w: {}, wp: {} };
    t.ms += ms;
    t.p += counted;
    t.w[k] = (t.w[k] || 0) + ms;
    if (counted) t.wp[k] = (t.wp[k] || 0) + 1;
    plays += counted;
    from = Math.min(from, at);
    to = Math.max(to, at);
  }
  // Albums with under a minute in total are just skips; leave them out.
  const list = [...albums.values()].filter((a) => a.ms >= 60000);
  return { albums: list, info: { plays, albums: list.length, from: from === Infinity ? 0 : from, to } };
}

// ---------- packing for Firestore (gzip + base64, split under the 1 MB limit)

const PART = 700 * 1024;

export async function pack(albums) {
  const gz = new Uint8Array(await new Response(new Blob([JSON.stringify(albums)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let b64 = '';
  for (let i = 0; i < gz.length; i += 0x8000) b64 += String.fromCharCode(...gz.subarray(i, i + 0x8000));
  b64 = btoa(b64);
  const parts = [];
  for (let i = 0; i < b64.length; i += PART) parts.push(b64.slice(i, i + PART));
  return parts;
}

export async function unpack(parts) {
  const bin = atob(parts.join(''));
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

// Turns stored entries into the same shape as the live listening documents.
export function toListening(albums) {
  const out = {};
  albums.forEach((a, i) => {
    const tracks = {};
    for (const [name, t] of Object.entries(a.tr)) tracks[name] = { name, ms: t.ms, plays: t.p, weeks: t.w, wplays: t.wp };
    out[`h:${i}`] = { albumId: `h:${i}`, title: a.t, artist: a.a, art: '', spotify: '', ms: a.ms, plays: a.p, first: a.f, last: a.l, weeks: a.w, tracks, hist: true };
  });
  return out;
}
