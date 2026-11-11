// A friend's library and their recommendations are cleaned before they're shown.
//   cd tests && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanYears, cleanRec, safeUrl, safeId } from '../js/safe.js';

const NASTY = 'x"><img src=x onerror="window.__ran=1">';

test('ids with markup are replaced, and favourites still point at their album', () => {
  const out = cleanYears({
    2025: {
      albums: [{ id: NASTY, artist: 'a', title: 't', songs: ['one', 7, null] }, { id: 'ok-1', artist: 'b', title: 'u' }],
      favourites: [{ albumId: NASTY, song: 'one' }, { albumId: 'gone', song: '' }, { albumId: 'ok-1' }],
    },
  });
  const y = out['2025'];
  assert.equal(y.albums.length, 2);
  assert.ok(safeId(y.albums[0].id), 'the id is safe now');
  assert.equal(y.albums[1].id, 'ok-1');
  assert.deepEqual(y.albums[0].songs, ['one', '7']);
  assert.deepEqual(y.favourites.map((f) => f.albumId), [y.albums[0].id, 'ok-1']);
  assert.ok(!JSON.stringify(out).includes('<img'));
});

test('years that are not four digits are left out', () => {
  const out = cleanYears({ '<b>2025</b>': { albums: [{ id: 'a', artist: 'a' }] }, 1999: { albums: [{ id: 'a', artist: 'a' }] }, 20255: {} });
  assert.deepEqual(Object.keys(out), ['1999']);
});

test('only https links survive', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('http://example.com/a.jpg'), '');
  assert.equal(safeUrl('https://i.scdn.co/image/abc'), 'https://i.scdn.co/image/abc');
  const out = cleanYears({ 2024: { albums: [{ id: 'a', artist: 'a', spotify: 'javascript:alert(1)', art: 'https://x.test/a.jpg' }] } });
  assert.equal(out['2024'].albums[0].spotify, undefined);
  assert.equal(out['2024'].albums[0].art, 'https://x.test/a.jpg');
});

test('odd shapes do not throw', () => {
  assert.deepEqual(cleanYears(null), {});
  assert.deepEqual(cleanYears({ 2020: 'nope', 2021: { albums: 'x', favourites: 3 } }), { 2021: { albums: [], favourites: [] } });
  assert.equal(cleanYears({ 2020: { albums: [{ id: 'same', artist: 'a' }, { id: 'same', artist: 'b' }] } })['2020'].albums[1].id, 'f2020x1');
});

test('recommendations: bad ids are refused, links and text are cleaned', () => {
  assert.equal(cleanRec(NASTY, { artist: 'a', title: 't' }), null);
  assert.equal(cleanRec('abc', { }), null);
  const r = cleanRec('abc123', { from: 'u1', fromName: 'Tessa', artist: 'a', title: 't', year: '<i>', spotify: 'javascript:1', songSpotify: 'https://open.spotify.com/track/1', song: 's', note: { x: 1 } });
  assert.deepEqual({ ...r, sentAt: 0 }, { id: 'abc123', from: 'u1', fromName: 'Tessa', artist: 'a', title: 't', sentAt: 0, notified: false, songSpotify: 'https://open.spotify.com/track/1', song: 's' });
});
