// Turns Spotify "recently played" items into per-album listening totals.
// Pure functions, so they can be tested without Firebase or Spotify.
//
// Spotify only lists plays longer than 30 seconds and doesn't say how much of
// a track was heard. played_at is when the play ended, so a play can't have
// lasted longer than the gap since the previous one ended: each play counts
// as min(track length, that gap), and never less than 30 seconds.

const MIN_PLAY = 30 * 1000;

// Monday of the play's week (UTC), as YYYY-MM-DD. Used for the weekly chart.
export function weekOf(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// items: Spotify play-history objects. cursor: played_at (ms) of the last play
// already counted, or 0. Returns { cursor, plays, albums } where albums maps a
// Spotify album id to the totals to add for that album.
export function tally(items, cursor = 0) {
  const plays = (items || [])
    .filter((it) => it?.track?.album?.id && it.played_at)
    .map((it) => ({ at: Date.parse(it.played_at), track: it.track }))
    .filter((p) => p.at > cursor)
    .sort((a, b) => a.at - b.at);
  const albums = {};
  let prev = cursor;
  for (const { at, track } of plays) {
    const length = track.duration_ms || 0;
    const ms = prev ? Math.max(Math.min(length, at - prev), Math.min(length, MIN_PLAY)) : length;
    prev = at;
    const al = track.album;
    const a = albums[al.id] ||= {
      albumId: al.id,
      title: al.name || '',
      artist: (al.artists || []).map((x) => x.name).join(', '),
      art: al.images?.[0]?.url || '',
      spotify: al.external_urls?.spotify || `https://open.spotify.com/album/${al.id}`,
      ms: 0, plays: 0, first: at, last: at, weeks: {}, tracks: {},
    };
    a.ms += ms;
    a.plays += 1;
    a.first = Math.min(a.first, at);
    a.last = Math.max(a.last, at);
    const wk = weekOf(at);
    a.weeks[wk] = (a.weeks[wk] || 0) + ms;
    const t = a.tracks[track.id] ||= { name: track.name || '', n: track.track_number || 0, ms: 0, plays: 0, weeks: {}, wplays: {} };
    t.ms += ms;
    t.plays += 1;
    t.weeks[wk] = (t.weeks[wk] || 0) + ms;
    t.wplays[wk] = (t.wplays[wk] || 0) + 1;
  }
  return { cursor: prev, plays: plays.length, albums };
}
