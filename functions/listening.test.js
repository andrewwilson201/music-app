import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tally, weekOf } from './listening.js';

const album = { id: 'A1', name: 'Night Swims', artists: [{ name: 'The Lanterns' }], images: [{ url: 'x.jpg' }] };
const play = (at, id, len, al = album) => ({ played_at: new Date(at).toISOString(), track: { id, name: id, duration_ms: len, track_number: 1, album: al } });
const T = Date.parse('2026-11-05T10:00:00Z');

test('first play counts its full length, later ones are capped by the gap', () => {
  const r = tally([play(T + 100000, 't2', 200000), play(T, 't1', 180000)]);
  assert.equal(r.plays, 2);
  assert.equal(r.cursor, T + 100000);
  assert.equal(r.albums.A1.ms, 180000 + 100000);
  assert.equal(r.albums.A1.tracks.t2.ms, 100000);
});

test('skips plays at or before the cursor', () => {
  const r = tally([play(T, 't1', 180000), play(T + 200000, 't2', 150000)], T);
  assert.equal(r.plays, 1);
  assert.equal(r.albums.A1.ms, 150000);
});

test('a skip still counts at least 30 seconds', () => {
  const r = tally([play(T + 5000, 't2', 150000)], T);
  assert.equal(r.albums.A1.ms, 30000);
});

test('nothing new leaves the cursor alone', () => {
  const r = tally([play(T, 't1', 1000)], T);
  assert.deepEqual(r, { cursor: T, plays: 0, albums: {} });
});

test('splits by album and week', () => {
  const other = { ...album, id: 'B2', name: 'Other' };
  const r = tally([play(T, 't1', 60000), play(T + 60000, 'u1', 60000, other)]);
  assert.deepEqual(Object.keys(r.albums).sort(), ['A1', 'B2']);
  assert.equal(weekOf(T), '2026-11-02');
  assert.deepEqual(r.albums.A1.weeks, { '2026-11-02': 60000 });
});

test('tracks keep weekly time and plays', () => {
  const r = tally([play(T, 't1', 60000), play(T + 60000, 't1', 60000)]);
  assert.deepEqual(r.albums.A1.tracks.t1.weeks, { '2026-11-02': 120000 });
  assert.deepEqual(r.albums.A1.tracks.t1.wplays, { '2026-11-02': 2 });
});
