// One-off: copy one person's library (years + Up next) into a friend's account.
// Merge: the source's albums win; the target keeps albums the source doesn't have.
// MODE=plan only reads and prints counts. MODE=write backs up the target's
// documents to adminBackups/{stamp} first, then writes and checks the result.
// The repo is public, so this prints counts and short uid prefixes only.
import admin from '../../functions/node_modules/firebase-admin/lib/index.js';

const MODE = (process.env.MODE || 'plan').trim();
const SRC_NAME = /^andrew\b/i;
const DST_NAME = /^tess\b/i;

admin.initializeApp({ projectId: 'music-app-d0f3f' });
const db = admin.firestore();
const short = (u) => `${u.slice(0, 5)}…`;

// ---- find the two people
const users = (await db.collection('users').listDocuments()).map((d) => d.id);
const info = {};
for (const uid of users) info[uid] = { names: new Set(), friends: [] };
for (const s of (await db.collection('shares').get()).docs) {
  const { uid, name } = s.data();
  if (info[uid] && name) info[uid].names.add(String(name));
}
for (const uid of users) {
  const f = await db.doc(`users/${uid}/meta/friends`).get();
  info[uid].friends = (f.exists && f.data().list) || [];
  for (const fr of info[uid].friends) if (info[fr.uid] && fr.name) info[fr.uid].names.add(String(fr.name));
}
try {
  for (const uid of users) {
    const u = await admin.auth().getUser(uid).catch(() => null);
    if (u?.displayName) info[uid].names.add(u.displayName);
  }
} catch {}
const match = (re) => users.filter((u) => [...info[u].names].some((n) => re.test(n.trim())));
const srcs = match(SRC_NAME), dsts = match(DST_NAME);
console.log(`Accounts: ${users.length}. Name matches: source ${srcs.map(short).join(', ') || 'none'}, target ${dsts.map(short).join(', ') || 'none'}`);
if (srcs.length !== 1 || dsts.length !== 1 || srcs[0] === dsts[0]) { console.log('Not exactly one of each: stopping.'); process.exit(1); }
const [SRC] = srcs, [DST] = dsts;
const linked = info[SRC].friends.some((f) => f.uid === DST) || info[DST].friends.some((f) => f.uid === SRC);
console.log(`Friends with each other: ${linked}`);
if (process.env.EXPECT_SRC && !SRC.startsWith(process.env.EXPECT_SRC)) { console.log('Source changed since the plan: stopping.'); process.exit(1); }
if (process.env.EXPECT_DST && !DST.startsWith(process.env.EXPECT_DST)) { console.log('Target changed since the plan: stopping.'); process.exit(1); }

// ---- read both libraries
async function library(uid) {
  const head = await db.doc(`users/${uid}`).get();
  const years = {};
  for (const s of (await db.collection(`users/${uid}/years`).get()).docs) {
    const v = s.data();
    years[s.id] = { albums: v.albums || [], favourites: v.favourites || [] };
  }
  const h = head.exists ? head.data() : {};
  return { exists: head.exists, head: h, years, toListen: h.toListen || [], always: h.always || [] };
}
const A = await library(SRC), T = await library(DST);

const norm = (s) => String(s || '').toLowerCase()
  .replace(/\s*[([][^)\]]*(deluxe|remaster|edition|expanded|anniversary|bonus)[^)\]]*[)\]]/g, '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/^the /, '')
  .replace(/[^a-z0-9]+/g, '');
const key = (a) => `${norm(a.artist)}|${norm(a.title)}`;
const spot = (a) => (a.spotify || '').match(/album[/:]([A-Za-z0-9]+)/)?.[1];

const aKeys = new Set(), aSpot = new Set(), aIds = new Set();
for (const y of Object.values(A.years)) for (const a of y.albums) { aKeys.add(key(a)); if (spot(a)) aSpot.add(spot(a)); aIds.add(a.id); }
const inA = (a) => aKeys.has(key(a)) || (spot(a) && aSpot.has(spot(a)));

const count = (L) => Object.values(L.years).reduce((n, y) => n + y.albums.length, 0);
const favCount = (L) => Object.values(L.years).reduce((n, y) => n + y.favourites.length, 0);

// ---- merge
const out = {};
let kept = 0, dupes = 0, droppedFavs = 0, reIds = 0;
const yearsAll = [...new Set([...Object.keys(A.years), ...Object.keys(T.years)])].sort();
const rows = [];
for (const y of yearsAll) {
  const a = A.years[y] || { albums: [], favourites: [] };
  const t = T.years[y] || { albums: [], favourites: [] };
  const albums = [...a.albums];
  const ids = new Set(albums.map((x) => x.id));
  const remap = {};
  let k = 0, d = 0;
  for (const al of t.albums) {
    if (inA(al)) { d++; continue; }
    let item = al;
    if (ids.has(al.id) || aIds.has(al.id)) { const id = `${al.id}t`; remap[al.id] = id; item = { ...al, id }; reIds++; }
    ids.add(item.id); albums.push(item); k++;
  }
  const favIds = new Set(a.favourites.map((f) => f.albumId));
  const favourites = [...a.favourites];
  for (const f of t.favourites) {
    const id = remap[f.albumId] || f.albumId;
    const al = t.albums.find((x) => x.id === f.albumId);
    if (!al || inA(al) || favIds.has(id) || !ids.has(id)) { droppedFavs++; continue; }
    favourites.push({ ...f, albumId: id });
  }
  kept += k; dupes += d;
  out[y] = { albums, favourites };
  rows.push(`${y}: you ${a.albums.length}, Tess ${t.albums.length} (${d} same, ${k} hers only) -> ${albums.length} albums, ${favourites.length} favourites`);
}

const merged = new Set(); for (const y of Object.values(out)) for (const a of y.albums) merged.add(key(a));
const qKeys = new Set(A.toListen.map(key));
let qKept = 0, qDupe = 0, qLogged = 0;
const toListen = [...A.toListen];
for (const q of T.toListen) {
  if (qKeys.has(key(q))) { qDupe++; continue; }
  if (merged.has(key(q))) { qLogged++; continue; }
  toListen.push(q); qKept++;
}
const alwaysSeen = new Set(A.always.map((x) => JSON.stringify(x)));
const always = [...A.always, ...T.always.filter((x) => !alwaysSeen.has(JSON.stringify(x)))];

console.log(`\nSource ${short(SRC)}: ${Object.keys(A.years).length} years, ${count(A)} albums, ${favCount(A)} favourites, ${A.toListen.length} Up next`);
console.log(`Target ${short(DST)}: ${T.exists ? '' : '(no library yet) '}${Object.keys(T.years).length} years, ${count(T)} albums, ${favCount(T)} favourites, ${T.toListen.length} Up next`);
console.log(`\nPer year:\n  ${rows.join('\n  ')}`);
console.log(`\nAlbums: ${dupes} of Tess's are also in yours (yours kept), ${kept} only hers (kept), ${reIds} re-numbered`);
console.log(`Favourites of hers dropped because the album is yours now: ${droppedFavs}`);
console.log(`Up next: yours ${A.toListen.length} + ${qKept} of hers (${qDupe} same as yours, ${qLogged} now logged)`);
const total = Object.values(out).reduce((n, y) => n + y.albums.length, 0);
console.log(`Result: ${Object.keys(out).length} years, ${total} albums, ${Object.values(out).reduce((n, y) => n + y.favourites.length, 0)} favourites, ${toListen.length} Up next`);

if (MODE !== 'write') { console.log('\nPlan only: nothing written.'); process.exit(0); }

// ---- back up every document under the target's user
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bk = db.collection(`adminBackups/${stamp}/docs`);
async function walk(ref, list) {
  const snap = await ref.get();
  if (snap.exists) list.push({ path: ref.path, data: snap.data() });
  for (const col of await ref.listCollections()) for (const d of await col.listDocuments()) await walk(d, list);
}
const all = []; await walk(db.doc(`users/${DST}`), all);
let w = db.batch(), n = 0;
for (const [i, d] of all.entries()) { w.set(bk.doc(String(i).padStart(5, '0')), d); if (++n === 400) { await w.commit(); w = db.batch(); n = 0; } }
await db.doc(`adminBackups/${stamp}`).set({ uid: DST, docs: all.length, at: admin.firestore.FieldValue.serverTimestamp() });
if (n) await w.commit();
const back = await bk.count().get();
if (back.data().count !== all.length) { console.log('Backup incomplete: stopping.'); process.exit(1); }
console.log(`\nBacked up ${all.length} documents to adminBackups/${stamp}`);

// ---- write
w = db.batch();
for (const [y, v] of Object.entries(out)) w.set(db.doc(`users/${DST}/years/${y}`), v);
w.set(db.doc(`users/${DST}`), { version: T.head.version || A.head.version || 1, toListen, always, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
await w.commit();

const after = await library(DST);
const ok = count(after) === total && after.toListen.length === toListen.length;
console.log(`Written. Check: ${count(after)} albums, ${after.toListen.length} Up next -> ${ok ? 'OK' : 'MISMATCH'}`);
process.exit(ok ? 0 : 1);
