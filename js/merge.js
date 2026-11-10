// Three-way merge of the documents the app saves, so edits made on two devices
// (or two tabs) both survive instead of the last save wiping out the other.
//
//   base   = the document as this device last saw it on the server
//   local  = this device's copy, with its unsaved edits
//   remote = what's on the server now (maybe changed by another device)
//
// Lists are merged item by item (albums and Up next by id, favourites by
// album), and items field by field. When both sides changed the same field,
// this device wins. An item deleted on one side stays deleted, unless the
// other side edited it after that.
//
// Plain functions with no Firebase in them: tested in tests/merge.test.js.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function mergeValue(base, local, remote) {
  if (same(local, remote) || same(remote, base)) return local;
  if (same(local, base)) return remote;
  if (isObj(local) && isObj(remote)) {
    const out = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const b = isObj(base) ? base[k] : undefined;
      // A field only one side has: added there, or removed by the other.
      if (!(k in remote)) { if (!same(local[k], b)) out[k] = local[k]; continue; }
      if (!(k in local)) { if (!same(remote[k], b)) out[k] = remote[k]; continue; }
      out[k] = mergeValue(b, local[k], remote[k]);
    }
    return out;
  }
  return local; // both changed it differently: this device wins
}

export function mergeList(base = [], local = [], remote = [], key = (x) => x.id) {
  if (same(local, remote) || same(remote, base)) return local;
  if (same(local, base)) return remote;
  const B = new Map(base.map((x) => [key(x), x]));
  const L = new Map(local.map((x) => [key(x), x]));
  const R = new Map(remote.map((x) => [key(x), x]));
  const out = [];
  for (const item of local) {
    const k = key(item);
    if (R.has(k)) out.push(mergeValue(B.get(k), item, R.get(k)));
    else if (!B.has(k)) out.push(item); // added here
    else if (!same(item, B.get(k))) out.push(item); // deleted there, but edited here since
    // else: deleted on the other device
  }
  // Added on the other device (or deleted here but edited there). Placed after the item it followed there, so a
  // favourites ranking or an album list keeps the other device's order.
  remote.forEach((item, i) => {
    const k = key(item);
    if (L.has(k)) return; // already placed
    if (B.has(k) && same(item, B.get(k))) return; // deleted here, untouched there
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const pos = out.findIndex((x) => key(x) === key(remote[j]));
      if (pos >= 0) { at = pos + 1; break; }
    }
    out.splice(at, 0, item);
  });
  return out;
}

// A year: { albums[], favourites[] }. Favourites of albums that no longer
// exist after the merge are dropped.
export function mergeYear(base = {}, local = {}, remote = {}) {
  const albums = mergeList(base.albums, local.albums, remote.albums, (a) => a.id);
  const ids = new Set(albums.map((a) => a.id));
  const favourites = mergeList(base.favourites, local.favourites, remote.favourites, (f) => f.albumId)
    .filter((f) => ids.has(f.albumId));
  return { albums, favourites };
}

// The user document: { version, toListen[], always[] }.
export function mergeHead(base = {}, local = {}, remote = {}) {
  return {
    ...mergeValue(base, local, remote),
    toListen: mergeList(base.toListen, local.toListen, remote.toListen, (x) => x.id),
    always: mergeList(base.always, local.always, remote.always, (x) => JSON.stringify(x)),
  };
}

// Picks the right merge for a Firestore path.
export function mergeDoc(path, base, local, remote) {
  return /\/years\/[^/]+$/.test(path) ? mergeYear(base || {}, local || {}, remote || {}) : mergeHead(base || {}, local || {}, remote || {});
}
