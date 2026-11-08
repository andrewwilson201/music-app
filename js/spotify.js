// Spotify Web API with the PKCE login flow (no client secret, safe for a static site).
// Search needs no scopes. Making playlists asks for the playlist scopes the
// first time it's used, then picks up where it left off after the redirect.

import { SPOTIFY_CLIENT_ID } from './config.js?v=40';

const TOKEN_KEY = 'music-log:spotify';
const VERIFIER_KEY = 'music-log:spotify-verifier';
const redirectUri = () => location.origin + location.pathname;

function ls(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { return null; }
}

let tokens = null;
try { tokens = JSON.parse(ls(TOKEN_KEY) || 'null'); } catch {}

export let lastError = '';

// When Spotify says "too many requests" (429), stay off it for as long as it
// asks (Retry-After, or a minute when that header can't be read), and remember
// that across reloads. Calling again while blocked only extends the block.
const BLOCK_KEY = 'music-log:spotify-blocked-until';
let blockedUntil = Number(ls(BLOCK_KEY)) || 0;
export const blockedFor = () => Math.max(0, blockedUntil - Date.now());
function block(res, fallback = 60) {
  const secs = Number(res?.headers.get('Retry-After'));
  blockedUntil = Date.now() + (secs > 0 ? secs : fallback) * 1000;
  ls(BLOCK_KEY, String(blockedUntil));
}
const rateLimited = () => Object.assign(new Error('rate limited'), { status: 429 });
export const configured = () => !!SPOTIFY_CLIENT_ID;
export const connected = () => configured() && !!tokens?.refresh_token;

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const PLAYLIST_SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'];
const granted = () => new Set((tokens?.scope || '').split(' ').filter(Boolean));
export const hasScopes = (scopes) => connected() && scopes.every((s) => granted().has(s));

// `then` is remembered through the redirect and handed back by handleRedirect,
// so the app can carry on with whatever needed the login.
// `separate` asks for a sign-in whose tokens are handed back to the caller
// instead of replacing this browser's own (used to give listening tracking
// its own refresh token, so the two never trip over each other).
export async function login({ scopes = [], then = '', separate = false } = {}) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  ls(VERIFIER_KEY, JSON.stringify({ verifier, hash: location.hash, then, separate }));
  const scope = [...new Set([...(separate ? [] : granted()), ...scopes])].join(' ');
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  if (scope) params.set('scope', scope);
  location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export function logout() {
  tokens = null;
  ls(TOKEN_KEY, null);
}

function saveTokens(json) {
  tokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || tokens?.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000,
    scope: json.scope ?? tokens?.scope ?? '',
  };
  ls(TOKEN_KEY, JSON.stringify(tokens));
}

async function tokenRequest(body, { keep = true } = {}) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || `Spotify said ${res.status}`);
  if (keep) saveTokens(json);
  return json;
}

export const TRACKING_SCOPES = ['user-read-recently-played'];
export const loginForTracking = () => login({ scopes: TRACKING_SCOPES, then: 'listening', separate: true });
export const clientId = () => SPOTIFY_CLIENT_ID;

// Call on page load: finishes a login redirect if there is one.
// Returns the login's `then` value (or true) if this load was a Spotify callback.
// A `separate` login returns { then, refreshToken } and leaves this browser's
// own Spotify session as it was.
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  let saved = {};
  try { saved = JSON.parse(ls(VERIFIER_KEY) || '{}'); } catch {}
  ls(VERIFIER_KEY, null);
  history.replaceState(null, '', location.pathname + (saved.hash || ''));
  if (q.has('error')) throw new Error(q.get('error') === 'access_denied' ? 'Spotify login was cancelled.' : q.get('error'));
  const json = await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier }, { keep: !saved.separate });
  if (saved.separate) return { then: saved.then, refreshToken: json.refresh_token, scope: json.scope || '' };
  return saved.then || true;
}

async function accessToken() {
  if (!connected()) throw new Error('Spotify not connected');
  if (Date.now() > tokens.expires_at) await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  return tokens.access_token;
}

// One Web API call. Throws with Spotify's message; err.status holds the HTTP code.
async function api(path, { method = 'GET', body } = {}) {
  if (blockedFor()) throw rateLimited();
  const token = await accessToken();
  let res;
  try {
    res = await fetch(`https://api.spotify.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Spotify's "too many requests" answer can come without the headers a
    // browser needs to read it, so it looks like a network failure. When the
    // phone is online, treat it as one and back off for a bit.
    if (navigator.onLine !== false) { block(null, 30); throw rateLimited(); }
    throw e;
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    lastError = `${res.status} ${json.error?.message || res.statusText}`.trim();
    console.warn(`Spotify ${method} ${path.split('?')[0]} failed:`, lastError);
    if (res.status === 401) tokens.expires_at = 0;
    if (res.status === 429) block(res);
    const err = new Error(res.status === 401 ? 'Spotify session expired' : res.status === 429 ? 'rate limited' : `Spotify said ${lastError}`);
    err.status = res.status;
    throw err;
  }
  lastError = '';
  return res.status === 204 ? {} : res.json().catch(() => ({}));
}

const albumOf = (a) => ({
  artist: a.artists.map((x) => x.name).join(', '),
  artists: a.artists.map((x) => ({ id: x.id, name: x.name })),
  title: a.name,
  art: a.images?.[0]?.url || '',
  year: (a.release_date || '').slice(0, 4),
  tracks: a.total_tracks,
  type: a.album_type === 'single' ? (a.total_tracks > 3 ? 'ep' : 'single') : a.album_type || 'album',
  spotify: a.external_urls?.spotify || '',
});

export async function searchAlbums(term, limit = 10) {
  const json = await api(`/search?type=album&limit=${Math.min(limit, 10)}&q=${encodeURIComponent(term)}`);
  return (json.albums?.items || []).filter(Boolean).map(albumOf);
}

// Albums and artists in one call: { albums, artists: [{ id, name }] }.
export async function searchCatalog(term) {
  const json = await api(`/search?type=album,artist&limit=10&q=${encodeURIComponent(term)}`);
  return {
    albums: (json.albums?.items || []).filter(Boolean).map(albumOf),
    artists: (json.artists?.items || []).filter(Boolean).map((a) => ({ id: a.id, name: a.name })),
  };
}

// An artist's own albums (no singles or compilations), newest first.
// Development mode pages these 10 at a time.
export async function artistAlbums(id, max = 50) {
  const out = [];
  for (let offset = 0; offset < max; offset += 10) {
    const page = await api(`/artists/${id}/albums?include_groups=album&limit=10&offset=${offset}`);
    out.push(...(page.items || []).filter(Boolean).map(albumOf));
    if (!page.next) break;
  }
  return out;
}

// An album's tracks in order: [{ name, disc, no, ms }]. Asks for 50 a page,
// and drops to 10 if development mode refuses that.
export async function albumTracks(id) {
  const out = [];
  let size = 50;
  for (let offset = 0; offset < 300;) {
    let page;
    try { page = await api(`/albums/${id}/tracks?limit=${size}&offset=${offset}`); }
    catch (e) { if (e.status === 400 && size > 10) { size = 10; continue; } throw e; }
    out.push(...(page.items || []).filter(Boolean).map((t) => ({ name: t.name, disc: t.disc_number || 1, no: t.track_number, ms: t.duration_ms })));
    if (!page.next) break;
    offset += size;
  }
  return out;
}

export async function searchTracks(q, limit = 10) {
  const json = await api(`/search?type=track&limit=${Math.min(limit, 10)}&q=${encodeURIComponent(q)}`);
  return (json.tracks?.items || []).filter(Boolean).map((t) => ({
    uri: t.uri,
    name: t.name,
    artist: (t.artists || []).map((x) => x.name).join(', '),
    album: t.album?.name || '',
  }));
}

// Creates the playlist called `name` in the user's account, or reuses the one
// they already own with that name, and sets its songs to `uris` in order.
// Returns { url, created }.
export async function upsertPlaylist(name, description, uris) {
  let me = null;
  try { me = await api('/me'); } catch (e) { if (e.status === 401) throw e; }
  let playlist = null;
  for (let offset = 0; offset < 500 && !playlist; offset += 50) {
    const page = await api(`/me/playlists?limit=50&offset=${offset}`);
    playlist = (page.items || []).find((p) => p && p.name === name && (!me || p.owner?.id === me.id));
    if (!page.next) break;
  }
  const created = !playlist;
  if (!playlist) playlist = await api('/me/playlists', { method: 'POST', body: { name, description, public: false } });
  // The first 100 replace whatever was there; any more are appended.
  await api(`/playlists/${playlist.id}/items`, { method: 'PUT', body: { uris: uris.slice(0, 100) } });
  for (let i = 100; i < uris.length; i += 100) {
    await api(`/playlists/${playlist.id}/items`, { method: 'POST', body: { uris: uris.slice(i, i + 100) } });
  }
  return { url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`, created };
}
