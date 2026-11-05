// Data store: each person signs in with Firebase Auth and their log lives in
// Firestore under users/{uid}, readable and writable only by them (see
// firestore.rules). A copy is kept in localStorage so edits survive a closed
// tab or a dropped connection, and are pushed again on the next visit.
//
// Firestore layout:
//   users/{uid}              { version, toListen[], always[], updatedAt }
//   users/{uid}/years/{YYYY} { albums[], favourites[] }

import {
  initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signOut as fbSignOut, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  memoryLocalCache, connectAuthEmulator, connectFirestoreEmulator, doc, getDoc, getDocs, collection, writeBatch, serverTimestamp,
} from '../vendor/firebase.js?v=15';
import { FIREBASE_CONFIG } from './config.js?v=15';

// Left over from the GitHub-token version of the app, used to offer an import.
const LEGACY_DATA_KEY = 'music-log:data';
const LEGACY_DIRTY_KEY = 'music-log:dirty';
const LEGACY_CONFIG_KEY = 'music-log:github';
const LEGACY_DATA_PATH = 'data/music.json';

const listeners = new Set();
let auth = null;
let db = null;
let user = null;
let data = null;
let written = {}; // doc path -> JSON last saved, so a save only sends what changed
let saveTimer = null;
let saving = false;
let status = 'idle'; // idle | saving | saved | error
let lastError = '';

function ls(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { return null; }
}
const dataKey = () => `music-log:data:${user.uid}`;
const dirtyKey = () => `music-log:dirty:${user.uid}`;

export const configured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
export const currentUser = () => user;
export const canSync = () => !!user && !!data;
export const getStatus = () => ({ status, lastError });
export const getData = () => data;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());
const setStatus = (s, err = '') => { status = s; lastError = err; emit(); };

// ---------- auth

// Resolves with the signed-in user (or null) once Firebase knows.
export async function init() {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  let cache;
  try { cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() }); }
  catch { cache = memoryLocalCache(); }
  db = initializeFirestore(app, { localCache: cache, ignoreUndefinedProperties: true });
  // Local testing against the Firebase emulators: http://localhost:8000/?emulator
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('emulator')) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
  }
  let redirectError = null;
  try { await getRedirectResult(auth); } catch (e) { redirectError = e; }
  user = await new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });
  onAuthStateChanged(auth, (u) => {
    // Signed out in another tab, or the session was revoked.
    if (user && (!u || u.uid !== user.uid)) location.reload();
  });
  if (redirectError && !user) throw new Error(authMessage(redirectError));
  return user;
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    user = (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider); // page navigates away
      return null;
    }
    throw new Error(authMessage(e));
  }
  return user;
}

export async function signInEmail(email, password, create = false) {
  try {
    const fn = create ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
    user = (await fn(auth, email.trim(), password)).user;
    return user;
  } catch (e) { throw new Error(authMessage(e)); }
}

export async function resetPassword(email) {
  try { await sendPasswordResetEmail(auth, email.trim()); }
  catch (e) { throw new Error(authMessage(e)); }
}

export async function signOut() {
  if (user && ls(dirtyKey()) !== '1') ls(dataKey(), null);
  await fbSignOut(auth);
}

function authMessage(e) {
  return {
    'auth/invalid-email': "That doesn't look like an email address.",
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email. Create one instead?',
    'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/missing-password': 'Enter your password.',
    'auth/too-many-requests': 'Too many tries. Wait a minute, then try again.',
    'auth/network-request-failed': "Couldn't reach the server. Check your connection.",
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
    'auth/cancelled-popup-request': 'The sign-in window was closed before finishing.',
    'auth/unauthorized-domain': 'This site is not on the Firebase authorized domains list yet.',
    'auth/operation-not-allowed': 'That sign-in method is not turned on in Firebase yet.',
  }[e.code] || e.message || String(e);
}

// ---------- loading and saving

const userDoc = () => doc(db, 'users', user.uid);
const yearsCol = () => collection(db, 'users', user.uid, 'years');
const clean = (x) => JSON.parse(JSON.stringify(x));

function toDocs(d) {
  const out = { [`users/${user.uid}`]: { version: d.version || 1, toListen: d.toListen || [], always: d.always || [] } };
  for (const [y, v] of Object.entries(d.years || {})) {
    out[`users/${user.uid}/years/${y}`] = { albums: v.albums || [], favourites: v.favourites || [] };
  }
  return clean(out);
}

// Returns the log, or null for a new account that has nothing saved yet.
export async function load() {
  const local = ls(dataKey());
  const snap = await getDoc(userDoc());
  if (!snap.exists()) {
    written = {};
    if (local && ls(dirtyKey()) === '1') { data = JSON.parse(local); scheduleSave(0); return data; }
    return null;
  }
  const head = snap.data();
  const years = {};
  (await getDocs(yearsCol())).forEach((s) => {
    const v = s.data();
    years[s.id] = { albums: v.albums || [], favourites: v.favourites || [] };
  });
  const remote = { version: head.version || 1, years, toListen: head.toListen || [], always: head.always || [] };
  written = Object.fromEntries(Object.entries(toDocs(remote)).map(([p, v]) => [p, JSON.stringify(v)]));
  if (local && ls(dirtyKey()) === '1') {
    data = JSON.parse(local); // unsaved edits from last time win
    scheduleSave(0);
  } else {
    data = remote;
    ls(dataKey(), JSON.stringify(data));
    setStatus('saved');
  }
  ensureYear(new Date().getFullYear());
  return data;
}

// Re-read from Firestore (another device may have saved). Skipped while this
// device has edits that haven't been saved yet.
export async function refresh() {
  if (!canSync() || saving || saveTimer || ls(dirtyKey()) === '1') return false;
  const before = JSON.stringify(data);
  await load();
  return JSON.stringify(data) !== before;
}

// Call after mutating `data`. Saves locally at once and to Firestore shortly after.
export function commit({ quiet = false, delay = 1200 } = {}) {
  ls(dataKey(), JSON.stringify(data));
  ls(dirtyKey(), '1');
  if (!quiet) emit();
  scheduleSave(delay);
}

function scheduleSave(delay) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, delay);
}

export function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; save(); }
}

async function save() {
  if (saving) return scheduleSave(800);
  saving = true;
  setStatus('saving');
  try {
    const docs = toDocs(data);
    const batch = writeBatch(db);
    const next = {};
    let changes = 0;
    for (const [path, value] of Object.entries(docs)) {
      const json = JSON.stringify(value);
      next[path] = json;
      if (written[path] === json) continue;
      const isHead = path === `users/${user.uid}`;
      batch.set(doc(db, path), isHead ? { ...value, updatedAt: serverTimestamp() } : value);
      changes++;
    }
    for (const path of Object.keys(written)) {
      if (!(path in docs)) { batch.delete(doc(db, path)); changes++; }
    }
    if (changes) await batch.commit();
    written = next;
    if (!saveTimer) ls(dirtyKey(), null);
    setStatus('saved');
  } catch (e) {
    setStatus('error', e.code === 'permission-denied'
      ? 'Firestore refused the save. Check the security rules in the Firebase console.'
      : e.message);
  } finally {
    saving = false;
  }
}

// Replace the whole log (new account, or restoring a backup).
export async function replaceAll(next) {
  if (!next || typeof next.years !== 'object') throw new Error("That file isn't a music library backup.");
  data = {
    version: next.version || 1,
    years: next.years,
    toListen: Array.isArray(next.toListen) ? next.toListen : [],
    always: Array.isArray(next.always) ? next.always : [],
  };
  ensureYear(new Date().getFullYear());
  ls(dataKey(), JSON.stringify(data));
  ls(dirtyKey(), '1');
  clearTimeout(saveTimer); saveTimer = null;
  await save();
  if (status === 'error') throw new Error(lastError);
  return data;
}

export const startFresh = () => replaceAll({ years: {} });

// ---------- bringing over the old GitHub-saved log

// True on a device that used the earlier GitHub-token version of the app.
export function hasLegacyLog() {
  return !!(ls(LEGACY_DATA_KEY) || legacyToken());
}

function legacyToken() {
  try { return (JSON.parse(ls(LEGACY_CONFIG_KEY) || '{}').token || '').replace(/[^\x21-\x7e]/g, ''); }
  catch { return ''; }
}

export async function importLegacyLog() {
  let log = null;
  const local = ls(LEGACY_DATA_KEY);
  if (local && ls(LEGACY_DIRTY_KEY) === '1') log = JSON.parse(local); // unsaved edits on this device
  const token = legacyToken();
  if (!log && token) {
    try {
      const res = await fetch(`https://api.github.com/repos/andrewwilson201/music-app/contents/${LEGACY_DATA_PATH}?ref=main`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github.raw', Authorization: `Bearer ${token}` },
      });
      if (res.ok) log = await res.json();
    } catch {}
  }
  if (!log) {
    try {
      const res = await fetch(`${LEGACY_DATA_PATH}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) log = await res.json();
    } catch {}
  }
  if (!log && local) log = JSON.parse(local);
  if (!log) throw new Error("Couldn't find the old log.");
  await replaceAll(log);
  // The GitHub token isn't needed any more.
  ls(LEGACY_CONFIG_KEY, null); ls(LEGACY_DATA_KEY, null); ls(LEGACY_DIRTY_KEY, null);
  return data;
}

export function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `music-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- helpers for the data model

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
