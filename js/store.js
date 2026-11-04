// Data store: loads data/music.json, keeps a local copy, and syncs edits
// back to the GitHub repo through the contents API when a token is set.

const LOCAL_KEY = 'music-log:data';
const DIRTY_KEY = 'music-log:dirty';
const CONFIG_KEY = 'music-log:github';
const DATA_PATH = 'data/music.json';

const listeners = new Set();
let data = null;
let sha = null;
let saveTimer = null;
let saving = false;
let status = 'idle'; // idle | local | saving | saved | error
let lastError = '';

function ls(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { return null; }
}

export function getConfig() {
  let cfg = {};
  try { cfg = JSON.parse(ls(CONFIG_KEY) || '{}'); } catch {}
  // Sensible defaults when hosted at <owner>.github.io/<repo>/
  const host = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return {
    owner: cfg.owner || (host ? host[1] : 'andrewwilson201'),
    repo: cfg.repo || (host && repo ? repo : 'music-app'),
    branch: cfg.branch || 'main',
    token: cfg.token || '',
  };
}

export function setConfig(cfg) {
  ls(CONFIG_KEY, JSON.stringify(cfg));
}

export const canSync = () => !!getConfig().token;
export const getStatus = () => ({ status, lastError });
export const getData = () => data;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());
const setStatus = (s, err = '') => { status = s; lastError = err; emit(); };

function api(path, opts = {}) {
  const { owner, repo } = getConfig();
  const token = getConfig().token.replace(/[^\x21-\x7e]/g, ''); // drop stray spaces/newlines from pasting
  const url = `https://api.github.com/repos/${owner.trim()}/${repo.trim()}${path ? `/${path}` : ''}`;
  return fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
}

const b64decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function fetchRemote() {
  const { branch } = getConfig();
  const res = await api(`contents/${DATA_PATH}?ref=${encodeURIComponent(branch)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub said ${res.status} ${res.statusText}`);
  const body = await res.json();
  let text;
  if (body.content) text = b64decode(body.content);
  else { // files over 1MB come without inline content
    const raw = await api(`git/blobs/${body.sha}`, { headers: { Accept: 'application/vnd.github.raw' } });
    text = await raw.text();
  }
  return { json: JSON.parse(text), sha: body.sha };
}

export async function load() {
  const dirty = ls(DIRTY_KEY) === '1';
  const local = ls(LOCAL_KEY);
  if (dirty && local) {
    data = JSON.parse(local);
    setStatus(canSync() ? 'saving' : 'local');
    if (canSync()) {
      try { sha = (await fetchRemote()).sha; scheduleSave(0); }
      catch (e) { setStatus('error', e.message); }
    }
    return data;
  }
  if (canSync()) {
    try {
      const r = await fetchRemote();
      data = r.json; sha = r.sha;
      ls(LOCAL_KEY, JSON.stringify(data));
      setStatus('saved');
      return data;
    } catch (e) { setStatus('error', e.message); }
  }
  try {
    const res = await fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    data = await res.json();
  } catch (e) {
    if (!local) throw e;
    data = JSON.parse(local);
  }
  return data;
}

// Call after mutating `data`. Saves locally at once and pushes to GitHub shortly after.
export function commit({ quiet = false, delay = 1200 } = {}) {
  ls(LOCAL_KEY, JSON.stringify(data));
  ls(DIRTY_KEY, '1');
  if (!quiet) emit();
  if (canSync()) scheduleSave(delay);
  else setStatus('local');
}

function scheduleSave(delay) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, delay);
}

async function save() {
  if (saving) return scheduleSave(800);
  saving = true;
  setStatus('saving');
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!sha) sha = (await fetchRemote()).sha;
      const res = await api(`contents/${DATA_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Update listening log (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
          content: b64encode(JSON.stringify(data, null, 1) + '\n'),
          sha,
          branch: getConfig().branch,
        }),
      });
      if (res.ok) {
        sha = (await res.json()).content.sha;
        ls(DIRTY_KEY, null);
        setStatus('saved');
        return;
      }
      if (res.status === 409 || res.status === 422) { sha = null; continue; } // stale sha: refetch once
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg.message || `GitHub said ${res.status}`);
    }
    throw new Error('The file changed on GitHub while saving. Try again.');
  } catch (e) {
    setStatus('error', e.message);
  } finally {
    saving = false;
  }
}

export async function testConnection() {
  let res;
  try { res = await api(''); }
  catch { throw new Error("Couldn't reach GitHub. Check your connection, then try again."); }
  if (res.status === 401) throw new Error('That token was rejected.');
  if (res.status === 404) throw new Error('Repo not found, or the token has no access to it.');
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const repo = await res.json();
  if (!repo.permissions?.push) throw new Error('The token can read the repo but not write to it.');
  return repo;
}

// After connecting: pull the repo copy unless this device has unsaved edits.
export async function reloadFromRemote() {
  if (ls(DIRTY_KEY) === '1') { sha = null; scheduleSave(0); return; }
  const r = await fetchRemote();
  data = r.json; sha = r.sha;
  ls(LOCAL_KEY, JSON.stringify(data));
  setStatus('saved');
}

export function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `listening-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- helpers for the data model ----------

export const uid = () => 'a' + Math.random().toString(36).slice(2, 12);

export function years() {
  return Object.keys(data.years).sort((a, b) => b - a);
}

export function ensureYear(y) {
  y = String(y);
  if (!data.years[y]) data.years[y] = { albums: [], favourites: [] };
  return data.years[y];
}

export function findAlbum(id) {
  for (const [year, y] of Object.entries(data.years)) {
    const album = y.albums.find((a) => a.id === id);
    if (album) return { year, album, yearData: y };
  }
  return null;
}

export function favRank(yearData, id) {
  const i = yearData.favourites.findIndex((f) => f.albumId === id);
  return i < 0 ? 0 : i + 1;
}
