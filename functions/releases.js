// New releases: once a week, for people who switched it on in Settings, look
// up the artists they've logged most and put albums released in the last few
// weeks into their Up next, tagged "new release". Pure helpers here (tested in
// releases.test.js); the Spotify calls and Firestore writes are in index.js.

export const MAX_ARTISTS = 40;
export const WINDOW_DAYS = 21;

const key = (s) => String(s || '').toLowerCase()
  .replace(/\s*[([].*?(deluxe|edition|remaster|expanded|anniversary|version).*?[)\]]/g, '')
  .replace(/^the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');

const SKIP = new Set(['variousartists', 'various', 'va', 'soundtrack', 'originalsoundtrack']);

// The artists worth checking, most logged first. Albums from the last two years
// count double, so current favourites come before old ones.
export function pickArtists(years, now = new Date()) {
  const recent = now.getFullYear() - 2;
  const score = new Map();
  for (const [y, yd] of Object.entries(years || {})) {
    for (const a of yd.albums || []) {
      for (const name of String(a.artist || '').split(/\s*(?:,|&| and | x | with )\s*/i)) {
        const k = key(name);
        if (!k || SKIP.has(k)) continue;
        const s = score.get(k) || { name: name.trim(), score: 0 };
        s.score += +y >= recent ? 2 : 1;
        score.set(k, s);
      }
    }
  }
  return [...score.values()].sort((a, b) => b.score - a.score).slice(0, MAX_ARTISTS).map((s) => s.name);
}

const releaseTime = (album) => {
  const d = album.release_date || '';
  const p = album.release_date_precision;
  if (p === 'year' || /^\d{4}$/.test(d)) return 0; // too vague to call it new
  return Date.parse(p === 'month' ? `${d}-01` : d) || 0;
};

// Albums from Spotify's /artists/{id}/albums that are new to this person:
// released in the window, not logged, not already in Up next, not suggested before.
export function newAlbums(items, { years, toListen, seen = [], now = Date.now() }) {
  const since = now - WINDOW_DAYS * 864e5;
  const have = new Set();
  for (const yd of Object.values(years || {})) for (const a of yd.albums || []) have.add(`${key(a.artist)}|${key(a.title)}`);
  for (const q of toListen || []) have.add(`${key(q.artist)}|${key(q.title)}`);
  const seenSet = new Set(seen);
  const out = [];
  for (const al of items || []) {
    if (!al?.id || seenSet.has(al.id) || (al.album_type && al.album_type !== 'album')) continue;
    const t = releaseTime(al);
    if (!t || t < since || t > now + 864e5) continue;
    const artist = al.artists?.[0]?.name || '';
    const k = `${key(artist)}|${key(al.name)}`;
    if (have.has(k)) continue;
    have.add(k);
    out.push({
      id: `new-${al.id}`,
      spotifyId: al.id,
      artist: artist.toLowerCase(),
      title: String(al.name || '').toLowerCase(),
      art: al.images?.[0]?.url || '',
      spotify: al.external_urls?.spotify || `https://open.spotify.com/album/${al.id}`,
      year: String(al.release_date || '').slice(0, 4),
      released: String(al.release_date || ''),
      tag: 'new release',
    });
  }
  return out;
}

// The artist from a Spotify artist search that is really the one logged.
export function matchArtist(items, name) {
  const k = key(name);
  return (items || []).find((a) => key(a.name) === k) || null;
}
