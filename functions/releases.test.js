import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickArtists, newAlbums, matchArtist } from './releases.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');

test('artists are ranked by albums logged, recent years counting double', () => {
  const years = {
    2018: { albums: [{ artist: 'old band' }, { artist: 'old band' }, { artist: 'old band' }] },
    2026: { albums: [{ artist: 'big thief' }, { artist: 'big thief' }, { artist: 'Various Artists' }, { artist: 'geese & someone' }] },
  };
  assert.deepEqual(pickArtists(years, new Date(NOW)).slice(0, 2), ['big thief', 'old band']);
  assert.ok(!pickArtists(years, new Date(NOW)).includes('Various Artists'));
  assert.ok(pickArtists(years, new Date(NOW)).includes('geese'));
});

const album = (id, name, date, extra = {}) => ({ id, name, release_date: date, release_date_precision: 'day', album_type: 'album', artists: [{ name: 'Big Thief' }], images: [{ url: 'x.jpg' }], ...extra });

test('only recent, unlogged, unqueued, unseen albums come through', () => {
  const items = [
    album('n1', 'New One', '2026-11-01'),
    album('old', 'Old One', '2026-01-01'),
    album('logged', 'Double Infinity', '2026-11-02'),
    album('queued', 'Queued Up', '2026-11-03'),
    album('seen', 'Seen Before', '2026-11-04'),
    album('single', 'A Single', '2026-11-05', { album_type: 'single' }),
    album('vague', 'Vague', '2026', { release_date_precision: 'year' }),
  ];
  const out = newAlbums(items, {
    years: { 2026: { albums: [{ artist: 'big thief', title: 'double infinity' }] } },
    toListen: [{ artist: 'big thief', title: 'queued up' }],
    seen: ['seen'],
    now: NOW,
  });
  assert.deepEqual(out.map((x) => x.spotifyId), ['n1']);
  assert.equal(out[0].title, 'new one');
  assert.equal(out[0].artist, 'big thief');
  assert.equal(out[0].year, '2026');
  assert.equal(out[0].tag, 'new release');
});

test('deluxe editions of logged albums are not new', () => {
  const out = newAlbums([album('d', 'Double Infinity (Deluxe Edition)', '2026-11-02')], {
    years: { 2026: { albums: [{ artist: 'big thief', title: 'double infinity' }] } }, now: NOW,
  });
  assert.equal(out.length, 0);
});

test('artist search keeps only the exact artist', () => {
  assert.equal(matchArtist([{ name: 'Big Thief Tribute' }, { name: 'Big Thief', id: 'x' }], 'big thief').id, 'x');
  assert.equal(matchArtist([{ name: 'Someone Else' }], 'big thief'), null);
});
