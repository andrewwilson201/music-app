// node --test tests/  — the three-way merge used when saving (js/merge.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeList, mergeYear, mergeHead, mergeValue } from '../js/merge.js';

const A = (id, extra = {}) => ({ id, artist: `artist ${id}`, title: `title ${id}`, ...extra });

test('albums added on two devices are both kept', () => {
  const base = { albums: [A('a')], favourites: [] };
  const phone = { albums: [A('a'), A('p')], favourites: [] };
  const laptop = { albums: [A('a'), A('l1'), A('l2')], favourites: [] };
  assert.deepEqual(mergeYear(base, phone, laptop).albums.map((a) => a.id), ['a', 'l1', 'l2', 'p']);
});

test('an untouched side just takes the other side', () => {
  const base = { albums: [A('a')], favourites: [] };
  const other = { albums: [A('a'), A('b')], favourites: [{ albumId: 'b', song: 'x' }] };
  assert.deepEqual(mergeYear(base, base, other), other);
  assert.deepEqual(mergeYear(base, other, base), other);
});

test('a delete on one device survives an unrelated edit on the other', () => {
  const base = { albums: [A('a'), A('b')], favourites: [] };
  const phone = { albums: [A('a')], favourites: [] }; // deleted b
  const laptop = { albums: [A('a', { art: 'x' }), A('b')], favourites: [] }; // cover for a
  assert.deepEqual(mergeYear(base, phone, laptop).albums, [A('a', { art: 'x' })]);
});

test('an album deleted on one device but edited on the other is kept', () => {
  const base = { albums: [A('a'), A('b')], favourites: [] };
  const phone = { albums: [A('a')], favourites: [] };
  const laptop = { albums: [A('a'), A('b', { songs: ['s'] })], favourites: [] };
  assert.deepEqual(mergeYear(base, phone, laptop).albums.map((a) => a.id), ['a', 'b']);
});

test('different fields of one album merge; the same field goes to this device', () => {
  const base = A('a');
  const local = A('a', { art: 'mine', title: 'fixed' });
  const remote = A('a', { spotify: 'link', title: 'theirs' });
  assert.deepEqual(mergeValue(base, local, remote), A('a', { art: 'mine', title: 'fixed', spotify: 'link' }));
});

test('favourites of deleted albums are dropped', () => {
  const base = { albums: [A('a'), A('b')], favourites: [{ albumId: 'a' }] };
  const phone = { albums: [A('a'), A('b')], favourites: [{ albumId: 'a' }, { albumId: 'b' }] };
  const laptop = { albums: [A('a')], favourites: [{ albumId: 'a' }] };
  assert.deepEqual(mergeYear(base, phone, laptop).favourites, [{ albumId: 'a' }]);
});

test('a favourite added elsewhere lands after the one it followed there', () => {
  const k = (f) => f.albumId;
  const base = [{ albumId: 'a' }, { albumId: 'b' }];
  const local = [{ albumId: 'a' }, { albumId: 'b' }, { albumId: 'c' }];
  const remote = [{ albumId: 'a' }, { albumId: 'x' }, { albumId: 'b' }];
  assert.deepEqual(mergeList(base, local, remote, k).map(k), ['a', 'x', 'b', 'c']);
});

test('Up next items from both devices are kept, ticked-off ones stay gone', () => {
  const base = { version: 1, toListen: [{ id: 'q1' }, { id: 'q2' }], always: [] };
  const phone = { version: 1, toListen: [{ id: 'q2' }, { id: 'q3' }], always: [] }; // ticked q1, added q3
  const laptop = { version: 1, toListen: [{ id: 'q1' }, { id: 'q2' }, { id: 'q4' }], always: [] };
  assert.deepEqual(mergeHead(base, phone, laptop).toListen.map((x) => x.id), ['q2', 'q4', 'q3']);
});

test('with no base at all, both sides are combined', () => {
  const merged = mergeYear({}, { albums: [A('a')], favourites: [] }, { albums: [A('b')], favourites: [] });
  assert.deepEqual(merged.albums.map((a) => a.id).sort(), ['a', 'b']);
});
