// Data store: each person signs in with Firebase Auth and their log lives in
// Firestore under users/{uid}, readable and writable only by them (see
// firestore.rules). A copy is kept in localStorage so edits survive a closed
// tab or a dropped connection, and are pushed again on the next visit.
//
// Firestore layout:
//   users/{uid}              { version, toListen[], always[], updatedAt }
//   users/{uid}/years/{YYYY} { albums[], favourites[] }
//   users/{uid}/meta/share   { token }   this person's current share code, if sharing
//   users/{uid}/meta/friends { list: [{ uid, token, name }] }   libraries they follow
//   shares/{token}           { uid, name, createdAt }   lets a code be looked up
//   shares/{token}/viewers/{viewerUid} { name, addedAt }  who added that code
//   users/{uid}/private/spotify   listening tracking: { enabled, refreshToken, clientId, since, cursor, lastRun, lastError, plays }
//   users/{uid}/listening/{spotifyAlbumId}  time spent on that album, written by functions/index.js
//   users/{uid}/meta/listening   { hidden[], history: { plays, albums, from, to, parts, importedAt } }
//   users/{uid}/history/{0..n}   { data }  imported Spotify history, gzipped JSON in base64 (see js/history.js)
//   users/{uid}/private/push {tokens: {token: {at, device}}}  phones that asked for notifications
//   users/{uid}/recs/{id}    { from, fromName, artist, title, year?, art?, spotify?, note?, sentAt, notified? }
//                            albums friends recommended, waiting to be moved into Up next
//                            by the recipient's app. Anyone can send one only while the
//                            two of you follow each other's current share codes.
//
// Sharing: a friend can read your years (not Up next) only while your
// meta/share token points at a share whose viewers include them. Turning
// sharing off, or making a new code, cuts off everyone who had the old one.

import {
  initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signOut as fbSignOut, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  memoryLocalCache, connectAuthEmulator, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, serverTimestamp,
  getMessaging, getToken, deleteToken, messagingSupported, getFunctions, httpsCallable, connectFunctionsEmulator,
} from '../vendor/firebase.js';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from './config.js';
import { pack, unpack, toListening } from './history.js';
import { mergeDoc } from './merge.js';

const listeners = new Set();
let auth = null;
let db = null;
let fbApp = null;
let functions = null;
let user = null;
let data = null;
let viewing = null; // { uid, name, data } while looking at a friend's library
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
// The documents as this device last saw them on the server: the common base
// for merging this device's edits with another device's (see js/merge.js).
const baseKey = () => `music-log:base:${user.uid}`;

export const configured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
export const currentUser = () => user;
export const canSync = () => !!user && !!data;
export const getStatus = () => ({ status, lastError });
export const getData = () => (viewing ? viewing.data : data); // the library on screen
export const ownData = () => data;
export const viewingFriend = () => viewing && { uid: viewing.uid, name: viewing.name };
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());
const setStatus = (s, err = '') => { status = s; lastError = err; emit(); };

// ---------- auth

// Resolves with the signed-in user (or null) once Firebase knows.
export async function init() {
  const app = fbApp = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  functions = getFunctions(app);
  let cache;
  try { cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() }); }
  catch { cache = memoryLocalCache(); }
  db = initializeFirestore(app, { localCache: cache, ignoreUndefinedProperties: true });
  // Local testing against the Firebase emulators: http://localhost:8000/?emulator
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('emulator')) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
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
  if (user && ls(dirtyKey()) !== '1') { ls(dataKey(), null); ls(baseKey(), null); }
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

function fromDocs(docs) {
  const head = docs[`users/${user.uid}`] || {};
  const years = {};
  for (const [path, v] of Object.entries(docs)) {
    const m = path.match(/\/years\/([^/]+)$/);
    if (m) years[m[1]] = { albums: v.albums || [], favourites: v.favourites || [] };
  }
  return { version: head.version || 1, years, toListen: head.toListen || [], always: head.always || [] };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const parse = (json) => (json === undefined ? undefined : JSON.parse(json));

function setWritten(next) {
  written = next;
  ls(baseKey(), JSON.stringify(written));
}

// A server document as the app stores it (without the save time).
function serverDoc(snap) {
  if (!snap.exists()) return undefined;
  const { updatedAt, ...v } = snap.data();
  return clean(v);
}

// Merges this device's documents with the server's, path by path. `base` is
// the JSON last seen on the server for each path (may be missing).
function mergeAll(base, local, remote) {
  const out = {};
  for (const p of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const b = parse(base[p]);
    if (!(p in remote)) {
      // Only here: new on this device, or deleted on the server since. A doc
      // deleted there and untouched here stays deleted.
      if (b === undefined || !same(local[p], b)) out[p] = local[p];
    } else if (!(p in local)) {
      // Only on the server: new there, or deleted here. Edited there since? Keep it.
      if (b === undefined || !same(remote[p], b)) out[p] = remote[p];
    } else {
      out[p] = mergeDoc(p, b, local[p], remote[p]);
    }
  }
  return out;
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
  const remoteDocs = toDocs(remote);
  if (local && ls(dirtyKey()) === '1') {
    // Unsaved edits from last time, merged with whatever other devices saved since.
    let base = {};
    try { base = JSON.parse(ls(baseKey()) || '{}'); } catch {}
    data = fromDocs(mergeAll(base, toDocs(JSON.parse(local)), remoteDocs));
    setWritten(Object.fromEntries(Object.entries(remoteDocs).map(([p, v]) => [p, JSON.stringify(v)])));
    ls(dataKey(), JSON.stringify(data));
    scheduleSave(0);
  } else {
    data = remote;
    setWritten(Object.fromEntries(Object.entries(remoteDocs).map(([p, v]) => [p, JSON.stringify(v)])));
    ls(dataKey(), JSON.stringify(data));
    setStatus('saved');
  }
  ensureYear(new Date().getFullYear());
  return data;
}

// Re-read from Firestore (another device may have saved). Skipped while this
// device has edits that haven't been saved yet: saving merges those instead.
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

// Offline: edits stay on this device (localStorage) and are merged and saved
// once the connection is back.
if (typeof window !== 'undefined') window.addEventListener('online', () => { if (canSync() && ls(dirtyKey()) === '1') scheduleSave(0); });
const offline = () => Object.assign(new Error('offline'), { code: 'unavailable' });

// Saves the documents that changed on this device. Each one is first compared
// with the server: if another device changed it since this one last looked,
// the two are merged (js/merge.js) so neither device's edits are lost.
// `overwrite` skips that, for restoring a backup or starting fresh.
async function save({ overwrite = false } = {}) {
  if (saving) return scheduleSave(800);
  saving = true;
  setStatus('saving');
  try {
    const sent = toDocs(data);
    const docs = { ...sent };
    const changed = Object.keys(docs).filter((p) => written[p] !== JSON.stringify(docs[p]));
    const removed = Object.keys(written).filter((p) => !(p in docs));
    const mergedPaths = [];
    if (!overwrite && (changed.length || removed.length)) {
      const paths = [...changed, ...removed];
      const snaps = await Promise.all(paths.map((p) => getDoc(doc(db, p))));
      if (snaps.some((s) => s.metadata.fromCache)) throw offline();
      snaps.forEach((s, i) => {
        const p = paths[i];
        const remote = serverDoc(s);
        const base = parse(written[p]);
        if (same(remote, base)) return; // nobody else touched it
        const out = mergeAll(base === undefined ? {} : { [p]: written[p] }, p in docs ? { [p]: docs[p] } : {}, remote === undefined ? {} : { [p]: remote });
        if (p in out) docs[p] = out[p]; else delete docs[p];
        mergedPaths.push(p);
      });
    }
    const batch = writeBatch(db);
    const next = {};
    let changes = 0;
    for (const [path, value] of Object.entries(docs)) {
      const json = JSON.stringify(value);
      next[path] = json;
      if (written[path] === json && !mergedPaths.includes(path)) continue;
      const isHead = path === `users/${user.uid}`;
      batch.set(doc(db, path), isHead ? { ...value, updatedAt: serverTimestamp() } : value);
      changes++;
    }
    for (const path of Object.keys(written)) {
      if (!(path in docs)) { batch.delete(doc(db, path)); changes++; }
    }
    if (changes) await batch.commit();
    setWritten(next);
    if (mergedPaths.length) {
      // Show what the other device added. Anything edited here while saving
      // is merged on top, and saved by the save that edit scheduled.
      const now = toDocs(data);
      const out = { ...now };
      for (const p of mergedPaths) {
        const n = now[p];
        const merged = docs[p];
        if (merged === undefined) { if (same(n, sent[p])) delete out[p]; continue; }
        out[p] = n === undefined || same(n, sent[p]) ? merged : mergeDoc(p, sent[p], n, merged);
      }
      Object.assign(data, fromDocs(out));
      ls(dataKey(), JSON.stringify(data));
    }
    if (!saveTimer) ls(dirtyKey(), null);
    setStatus('saved');
  } catch (e) {
    if (e.code === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      setStatus('offline', "You're offline. Your edits are kept on this device and will be saved when you're back online.");
    } else {
      setStatus('error', e.code === 'permission-denied'
        ? 'Firestore refused the save. Check the security rules in the Firebase console.'
        : e.message);
    }
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
  await save({ overwrite: true });
  if (status === 'error' || status === 'offline') throw new Error(lastError);
  return data;
}

export const startFresh = () => replaceAll({ years: {} });

// ---------- sharing

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O, 1/I
const shareMeta = () => doc(db, 'users', user.uid, 'meta', 'share');
const friendsMeta = () => doc(db, 'users', user.uid, 'meta', 'friends');
const shareDoc = (token) => doc(db, 'shares', token);
const viewersCol = (token) => collection(db, 'shares', token, 'viewers');

// 10 random characters (50 bits): too many to guess, short enough to read out.
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => CODE_CHARS[b % 32]).join('');
}
export const normaliseCode = (s) => String(s || '').trim()
  .replace(/^.*#\/friend\//, '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
export const formatCode = (c) => (c && c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c || '');
export const shareLink = (c) => `${location.origin}${location.pathname}#/friend/${c}`;
export const defaultShareName = () => (user.displayName || (user.email || '').split('@')[0] || 'A friend').trim();

// { token, name, viewers: [{ uid, name, addedAt }] } or null when not sharing.
export async function getShare() {
  const meta = await getDoc(shareMeta());
  const token = meta.exists() && meta.data().token;
  if (!token) return null;
  const share = await getDoc(shareDoc(token));
  if (!share.exists()) return null;
  const viewers = [];
  (await getDocs(viewersCol(token))).forEach((v) => viewers.push({ uid: v.id, ...v.data() }));
  return { token, name: share.data().name, viewers };
}

export async function startSharing(name = defaultShareName()) {
  const token = newCode();
  const batch = writeBatch(db);
  batch.set(shareDoc(token), { uid: user.uid, name: String(name).slice(0, 60), createdAt: serverTimestamp() });
  batch.set(shareMeta(), { token });
  await batch.commit();
  return { token, name, viewers: [] };
}

export async function stopSharing() {
  const meta = await getDoc(shareMeta());
  const token = meta.exists() && meta.data().token;
  const batch = writeBatch(db);
  if (token) {
    const share = await getDoc(shareDoc(token));
    if (share.exists() && share.data().uid === user.uid) {
      (await getDocs(viewersCol(token))).forEach((v) => batch.delete(v.ref));
      batch.delete(shareDoc(token));
    }
  }
  batch.delete(shareMeta());
  await batch.commit();
}

// A new code: everyone who had the old one loses access until given the new one.
export async function newShareCode(name) {
  await stopSharing();
  return startSharing(name);
}

export async function renameShare(token, name) {
  await setDoc(shareDoc(token), { name: String(name).slice(0, 60) }, { merge: true });
}

export async function friends() {
  const snap = await getDoc(friendsMeta());
  return (snap.exists() && snap.data().list) || [];
}

const saveFriends = (list) => setDoc(friendsMeta(), { list });

// Look up a code and add it to my libraries. Returns { uid, token, name }.
export async function addFriend(code) {
  const token = normaliseCode(code);
  if (token.length !== 10) throw new Error('A share code has 10 letters and numbers, like ABCDE-FGH23.');
  let share;
  try { share = await getDoc(shareDoc(token)); }
  catch (e) { throw new Error(e.code === 'permission-denied' ? 'Sharing needs the new Firestore rules published first.' : e.message); }
  if (!share.exists()) throw new Error("That code doesn't match a shared library. It may have been turned off or replaced.");
  const { uid: owner, name } = share.data();
  if (owner === user.uid) throw new Error("That's your own code. Send it to a friend instead.");
  await setDoc(doc(db, 'shares', token, 'viewers', user.uid), {
    name: (user.displayName || user.email || 'Someone').slice(0, 80), addedAt: serverTimestamp(),
  });
  const friend = { uid: owner, token, name: name || 'A friend' };
  const list = (await friends()).filter((f) => f.uid !== owner);
  list.push(friend);
  await saveFriends(list);
  return friend;
}

export async function removeFriend(uid) {
  const list = await friends();
  const f = list.find((x) => x.uid === uid);
  if (f) {
    try { await deleteDoc(doc(db, 'shares', f.token, 'viewers', user.uid)); } catch {}
  }
  await saveFriends(list.filter((x) => x.uid !== uid));
  if (viewing?.uid === uid) viewOwn();
}

// Load a friend's years (read only) and put them on screen.
export async function viewFriend(uid) {
  const f = (await friends()).find((x) => x.uid === uid);
  if (!f) throw new Error("You haven't added that library.");
  let name = f.name;
  try {
    const share = await getDoc(shareDoc(f.token));
    if (!share.exists() || share.data().uid !== uid) throw Object.assign(new Error(), { code: 'permission-denied' });
    name = share.data().name || name;
    const years = {};
    (await getDocs(collection(db, 'users', uid, 'years'))).forEach((s) => {
      const v = s.data();
      years[s.id] = { albums: v.albums || [], favourites: v.favourites || [] };
    });
    const now = String(new Date().getFullYear());
    if (!years[now]) years[now] = { albums: [], favourites: [] };
    viewing = { uid, name, data: { years, toListen: [], always: [] } };
  } catch (e) {
    if (e.code === 'permission-denied') {
      throw Object.assign(new Error(`${name} has stopped sharing or made a new code. Ask for the new one.`), { gone: true });
    }
    throw e;
  }
  if (name !== f.name) saveFriends((await friends()).map((x) => (x.uid === uid ? { ...x, name } : x))).catch(() => {});
  emit();
  return viewing;
}

// ---------- recommendations between friends who share with each other

const recsCol = (uid) => collection(db, 'users', uid, 'recs');

// Friends I can send to: I follow their library and they follow mine.
export async function mutualFriends() {
  const [share, list] = await Promise.all([getShare(), friends()]);
  if (!share) return { sharing: false, list: [] };
  const viewers = new Set(share.viewers.map((v) => v.uid));
  return { sharing: true, list: list.filter((f) => viewers.has(f.uid)) };
}

export async function sendRec(toUid, album, note = '') {
  const share = await getDoc(shareMeta());
  const token = share.exists() && share.data().token;
  const name = (token && (await getDoc(shareDoc(token))).data()?.name) || defaultShareName();
  const rec = {
    from: user.uid, fromName: String(name).slice(0, 60),
    artist: String(album.artist || '').slice(0, 200), title: String(album.title || '').slice(0, 200),
    sentAt: serverTimestamp(),
  };
  if (album.year) rec.year = String(album.year).slice(0, 4);
  if (album.art) rec.art = String(album.art).slice(0, 500);
  if (album.spotify) rec.spotify = String(album.spotify).slice(0, 300);
  if (note.trim()) rec.note = note.trim().slice(0, 300);
  const ref = doc(recsCol(toUid));
  try { await setDoc(ref, rec); }
  catch (e) {
    if (e.code === 'permission-denied') throw new Error("Couldn't send it. You can only recommend to friends while you both have each other's current code.");
    throw e;
  }
  // Ping their phone if they turned notifications on (functions/index.js). Best effort.
  httpsCallable(functions, 'notifyRec')({ to: toUid, id: ref.id }).catch(() => {});
}

// Albums friends sent me, newest first.
export async function recs() {
  if (!user) return [];
  const out = [];
  (await getDocs(recsCol(user.uid))).forEach((s) => out.push({ id: s.id, ...s.data() }));
  const ms = (r) => r.sentAt?.toMillis?.() || 0;
  return out.sort((a, b) => ms(b) - ms(a));
}

export const dismissRec = (id) => deleteDoc(doc(recsCol(user.uid), id));

// ---------- notifications on this phone (for recommendations)

const pushDoc = () => doc(db, 'users', user.uid, 'private', 'push');
const tokenKey = () => `music-log:push:${user.uid}`;

// 'on' | 'off' | 'blocked' (said no in the browser) | 'unsupported' | 'home-screen' (iPhone, not installed)
export async function pushState() {
  if (!FIREBASE_VAPID_KEY) return 'unsupported';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !(await messagingSupported().catch(() => false))) {
    return ios && !installed ? 'home-screen' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && ls(tokenKey()) ? 'on' : 'off';
}

export async function enablePush() {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them for this app in your phone’s settings, then try again.');
  const token = await getToken(getMessaging(fbApp), { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
  const device = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer';
  await setDoc(pushDoc(), { tokens: { [token]: { at: Date.now(), device } } }, { merge: true });
  ls(tokenKey(), token);
}

export async function disablePush() {
  const token = ls(tokenKey());
  ls(tokenKey(), null);
  try { await deleteToken(getMessaging(fbApp)); } catch {}
  const snap = await getDoc(pushDoc());
  const tokens = { ...(snap.exists() && snap.data().tokens) };
  delete tokens[token];
  await setDoc(pushDoc(), { tokens });
}

export function viewOwn() {
  if (!viewing) return;
  viewing = null;
  emit();
}

// ---------- listening tracking (the counting is done by functions/index.js)

const trackingDoc = () => doc(db, 'users', user.uid, 'private', 'spotify');
let listening = null; // spotify album id -> totals, once loaded

// { enabled, since, lastRun, lastError, plays, gapAt } (never the token itself)
export async function trackingState() {
  const snap = await getDoc(trackingDoc());
  if (!snap.exists()) return { enabled: false };
  const { refreshToken, clientId, ...rest } = snap.data();
  return { ...rest, enabled: !!(rest.enabled && refreshToken) };
}

export async function startTracking(refreshToken, clientId) {
  const snap = await getDoc(trackingDoc());
  const since = snap.exists() && snap.data().since;
  await setDoc(trackingDoc(), { enabled: true, refreshToken, clientId, since: since || Date.now(), lastError: '' }, { merge: true });
}

// New releases into Up next, checked weekly by functions/index.js (needs tracking on).
// Clearing releasesAt makes the next run check straight away.
export async function setNewReleases(on) {
  await setDoc(trackingDoc(), { newReleases: !!on, ...(on ? { releasesAt: 0 } : {}) }, { merge: true });
}

export async function stopTracking() {
  await setDoc(trackingDoc(), { enabled: false, refreshToken: '' }, { merge: true });
}

const listenMetaDoc = () => doc(db, 'users', user.uid, 'meta', 'listening');
const historyPart = (i) => doc(db, 'users', user.uid, 'history', String(i));
let listenMeta = {};
let history = { stamp: 0, entries: {} };

// All of this person's listening totals: the live ones keyed by Spotify album
// id, plus any imported history keyed h:0, h:1...
export async function loadListening() {
  if (!user || viewing) return listening || {};
  const out = {};
  const [live, meta] = await Promise.all([getDocs(collection(db, 'users', user.uid, 'listening')), getDoc(listenMetaDoc())]);
  live.forEach((s) => { out[s.id] = s.data(); });
  listenMeta = meta.exists() ? meta.data() : {};
  const h = listenMeta.history;
  if (!h?.parts) history = { stamp: 0, entries: {} };
  else if (h.importedAt !== history.stamp) {
    const parts = await Promise.all(Array.from({ length: h.parts }, (_, i) => getDoc(historyPart(i))));
    history = { stamp: h.importedAt, entries: toListening(await unpack(parts.map((p) => p.data()?.data || ''))) };
  }
  listening = { ...out, ...history.entries };
  return listening;
}
export const getListening = () => (viewing ? null : listening);
export const listeningMeta = () => listenMeta;

// Saves an import (from history.aggregate), replacing any earlier one.
export async function saveHistory(albums, info) {
  const parts = await pack(albums);
  const old = listenMeta.history?.parts || 0;
  const batch = writeBatch(db);
  parts.forEach((data, i) => batch.set(historyPart(i), { data }));
  for (let i = parts.length; i < old; i++) batch.delete(historyPart(i));
  batch.set(listenMetaDoc(), { history: { ...info, parts: parts.length, importedAt: Date.now() } }, { merge: true });
  await batch.commit();
}

export async function removeHistory() {
  const batch = writeBatch(db);
  for (let i = 0; i < (listenMeta.history?.parts || 0); i++) batch.delete(historyPart(i));
  batch.set(listenMetaDoc(), { history: null }, { merge: true });
  await batch.commit();
}

// Settings for the "Heard, not logged" suggestions.
export async function setListenMeta(fields) {
  listenMeta = { ...listenMeta, ...fields };
  await setDoc(listenMetaDoc(), fields, { merge: true });
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
  return Object.keys(getData().years).sort((a, b) => b - a);
}

export function ensureYear(y) {
  y = String(y);
  if (!data.years[y]) data.years[y] = { albums: [], favourites: [] };
  return data.years[y];
}

export function findAlbum(id) {
  for (const [year, y] of Object.entries(getData().years)) {
    const album = y.albums.find((a) => a.id === id);
    if (album) return { year, album, yearData: y };
  }
  return null;
}

export function favRank(yearData, id) {
  const i = yearData.favourites.findIndex((f) => f.albumId === id);
  return i < 0 ? 0 : i + 1;
}
