// Cleans data that someone else wrote before the app shows it: a friend's
// shared library, and the albums friends recommend. Their text ends up in the
// page, so ids are limited to letters, numbers, "-" and "_", years to four
// digits, links to https, and everything else to plain strings of sane length.
// (The app also escapes these where it writes them; this is the first lock.)
//
// Plain functions with no Firebase in them: tested in tests/safe.test.js.

const ID = /^[\w-]{1,80}$/;
export const safeId = (v) => (typeof v === 'string' && ID.test(v) ? v : '');
const text = (v, max = 300) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');

// An https link, or '' for anything else ("javascript:" links, data, junk).
export function safeUrl(v) {
  if (typeof v !== 'string' || v.length > 600) return '';
  try { return new URL(v).protocol === 'https:' ? v : ''; } catch { return ''; }
}

// years: { YYYY: { albums[], favourites[] } } as read from a friend's account.
export function cleanYears(years) {
  const out = {};
  for (const [year, v] of Object.entries(years && typeof years === 'object' ? years : {})) {
    if (!/^\d{4}$/.test(year) || !v || typeof v !== 'object') continue;
    const ids = new Map(); // their id -> the id used here
    const albums = [];
    (Array.isArray(v.albums) ? v.albums : []).forEach((a, i) => {
      if (!a || typeof a !== 'object') return;
      let id = safeId(a.id);
      if (!id || [...ids.values()].includes(id)) id = `f${year}x${i}`;
      if (typeof a.id === 'string') ids.set(a.id, id);
      const album = {
        id,
        artist: text(a.artist),
        title: text(a.title),
        songs: (Array.isArray(a.songs) ? a.songs : []).map((s) => text(s, 200)).filter(Boolean).slice(0, 50),
      };
      const art = safeUrl(a.art);
      const spotify = safeUrl(a.spotify);
      if (art) album.art = art;
      if (spotify) album.spotify = spotify;
      if (album.artist || album.title) albums.push(album);
    });
    const have = new Set(albums.map((a) => a.id));
    const favourites = [];
    for (const f of Array.isArray(v.favourites) ? v.favourites : []) {
      const albumId = f && typeof f === 'object' ? ids.get(f.albumId) : '';
      if (!albumId || !have.has(albumId) || favourites.some((x) => x.albumId === albumId)) continue;
      favourites.push({ albumId, song: text(f.song, 1000) });
    }
    out[year] = { albums, favourites };
  }
  return out;
}

// A recommendation from users/{me}/recs, or null if it isn't usable.
export function cleanRec(id, r) {
  if (!safeId(id) || !r || typeof r !== 'object') return null;
  const out = { id, from: text(r.from, 128), fromName: text(r.fromName, 60), artist: text(r.artist, 200), title: text(r.title, 200), sentAt: r.sentAt, notified: !!r.notified };
  if (!out.artist && !out.title) return null;
  if (/^\d{4}$/.test(r.year || '')) out.year = r.year;
  for (const k of ['art', 'spotify', 'songSpotify']) { const u = safeUrl(r[k]); if (u) out[k] = u; }
  if (text(r.note)) out.note = text(r.note, 300);
  if (text(r.song)) out.song = text(r.song, 200);
  return out;
}
