// Spotify Web API with the PKCE login flow (no client secret, safe for a static site).
// Only search is used, so no special scopes are requested.

import { SPOTIFY_CLIENT_ID } from './config.js?v=6';

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

export const configured = () => !!SPOTIFY_CLIENT_ID;
export const connected = () => configured() && !!tokens?.refresh_token;

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  ls(VERIFIER_KEY, JSON.stringify({ verifier, hash: location.hash }));
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
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
  };
  ls(TOKEN_KEY, JSON.stringify(tokens));
}

async function tokenRequest(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || `Spotify said ${res.status}`);
  saveTokens(json);
}

// Call on page load: finishes a login redirect if there is one.
// Returns true if this load was a Spotify callback.
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  let saved = {};
  try { saved = JSON.parse(ls(VERIFIER_KEY) || '{}'); } catch {}
  ls(VERIFIER_KEY, null);
  history.replaceState(null, '', location.pathname + (saved.hash || ''));
  if (q.has('error')) throw new Error(q.get('error') === 'access_denied' ? 'Spotify login was cancelled.' : q.get('error'));
  await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier });
  return true;
}

async function accessToken() {
  if (!connected()) throw new Error('Spotify not connected');
  if (Date.now() > tokens.expires_at) await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  return tokens.access_token;
}

export async function searchAlbums(term, limit = 10) {
  const res = await fetch(`https://api.spotify.com/v1/search?type=album&limit=${Math.min(limit, 50)}&q=${encodeURIComponent(term)}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (res.status === 401) { tokens.expires_at = 0; throw new Error('Spotify session expired'); }
  if (res.status === 429) throw new Error('rate limited');
  if (!res.ok) throw new Error(`Spotify said ${res.status}`);
  const json = await res.json();
  return (json.albums?.items || []).filter(Boolean).map((a) => ({
    artist: a.artists.map((x) => x.name).join(', '),
    title: a.name,
    art: a.images?.[0]?.url || '',
    year: (a.release_date || '').slice(0, 4),
    tracks: a.total_tracks,
    spotify: a.external_urls?.spotify || '',
  }));
}
