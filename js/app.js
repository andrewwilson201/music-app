import * as store from './store.js';
import { queueArt, prioritise, searchAlbums, findArt, spotifyUrl, spotifyArtistUrl, placeholder, norm } from './art.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const modalRoot = $('#modalRoot');

const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" class="fill"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.3.9Zm1.2-2.7a.8.8 0 0 1-1 .3c-2.7-1.7-6.9-2.2-10.2-1.2a.8.8 0 1 1-.4-1.5c3.7-1.1 8.3-.6 11.4 1.4.3.2.4.7.2 1Zm.1-2.8C14.7 9 9.3 8.8 6.2 9.8a.9.9 0 1 1-.5-1.8c3.6-1.1 9.6-.9 13.3 1.3a.9.9 0 0 1-1.1 1.6Z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  grip: '<svg viewBox="0 0 24 24" class="fill"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

let data;
let ui = { sort: 'latest', filter: '' };
let sortable = null;

// ------------------------------------------------------------------ boot

async function boot() {
  app.innerHTML = '<div class="loading"><span class="spin"></span>Loading your records…</div>';
  try {
    data = await store.load();
  } catch (e) {
    app.innerHTML = `<div class="empty"><h2>Couldn't load your data</h2><p>${esc(e.message)}</p></div>`;
    return;
  }
  store.subscribe(onStoreChange);
  onStoreChange();
  window.addEventListener('hashchange', () => {
    [...modalRoot.children].forEach((w) => closeModal(w, true));
    ui.filter = '';
    render();
  });
  render();
}

function onStoreChange() {
  data = store.getData();
  const { status, lastError } = store.getStatus();
  const dot = $('#syncDot');
  dot.className = `sync-dot ${status}`;
  $('#settingsBtn').title = {
    saved: 'Synced to GitHub',
    saving: 'Saving to GitHub…',
    local: 'Changes saved on this device only. Connect GitHub to sync.',
    error: `Sync problem: ${lastError}`,
    idle: 'Settings and sync',
  }[status] || 'Settings';
  if (status === 'error') toast(`Couldn't save to GitHub: ${lastError}`, 'error');
}

// ------------------------------------------------------------------ routing

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return parts;
}

function render() {
  const [page, a, b] = route();
  const years = store.years();
  if (sortable) { sortable.destroy(); sortable = null; }
  renderNav(page === 'year' ? a : page || years[0]);
  if (!page) return renderYear(years[0], 'listened');
  if (page === 'year' && data.years[a]) return renderYear(a, b || 'listened');
  if (page === 'to-listen') return renderToListen();
  if (page === 'always') return renderAlways();
  if (page === 'search') return renderSearch(a || '');
  location.hash = '#/';
}

function renderNav(active) {
  const years = store.years();
  $('#nav').innerHTML =
    years.map((y) => `<a href="#/year/${y}" class="${active === y ? 'on' : ''}">${y}</a>`).join('') +
    `<span class="nav-sep"></span>` +
    `<a href="#/to-listen" class="${active === 'to-listen' ? 'on' : ''}">to listen</a>` +
    `<a href="#/always" class="${active === 'always' ? 'on' : ''}">always</a>`;
  const on = $('#nav .on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ------------------------------------------------------------------ artwork

const artCacheKey = 'music-log:art';
let artCache = {};
try { artCache = JSON.parse(localStorage.getItem(artCacheKey) || '{}'); } catch {}

function artFor(album) {
  if (album.art !== undefined) return album.art;
  return artCache[album.id];
}

function coverHtml(album, cls = '') {
  const art = artFor(album);
  const initials = esc((album.title || album.artist).slice(0, 1).toUpperCase());
  return `<div class="cover ${cls}" data-art-id="${album.id}" style="background:${placeholder(album)}">
    <span class="cover-initial">${initials}</span>
    ${art ? `<img src="${esc(art)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
  </div>`;
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target.dataset.artId);
  visible.forEach((id) => {
    const found = store.findAlbum(id);
    if (found) requestArt(found.album);
  });
  prioritise(visible);
}, { rootMargin: '300px' });

function watchCovers(root = app) {
  $$('.cover[data-art-id]', root).forEach((el) => {
    const found = store.findAlbum(el.dataset.artId);
    if (found && artFor(found.album) === undefined) observer.observe(el);
  });
}

async function requestArt(album) {
  if (artFor(album) !== undefined) return;
  const url = await queueArt(album);
  if (url === null) return; // lookup failed (network), try another time
  setArt(album, url);
}

function setArt(album, url) {
  if (store.canSync()) {
    album.art = url;
    delete artCache[album.id];
    store.commit({ quiet: true, delay: 6000 });
  } else {
    artCache[album.id] = url;
    try { localStorage.setItem(artCacheKey, JSON.stringify(artCache)); } catch {}
  }
  $$(`.cover[data-art-id="${album.id}"]`).forEach((el) => {
    observer.unobserve(el);
    el.querySelector('img')?.remove();
    if (url) el.insertAdjacentHTML('beforeend', `<img src="${esc(url)}" alt="" onerror="this.remove()">`);
  });
}

// ------------------------------------------------------------------ year view

function sortedAlbums(yearData) {
  let list = yearData.albums.map((a, i) => ({ a, i }));
  const q = norm(ui.filter);
  if (q) list = list.filter(({ a }) => norm(`${a.artist} ${a.title} ${(a.songs || []).join(' ')}`).includes(q));
  if (ui.sort === 'latest') list.reverse();
  if (ui.sort === 'artist') list.sort((x, y) => norm(x.a.artist).localeCompare(norm(y.a.artist)));
  if (ui.sort === 'favs') list.sort((x, y) => (store.favRank(yearData, x.a.id) || 999) - (store.favRank(yearData, y.a.id) || 999));
  return list.map(({ a }) => a);
}

function cardHtml(album, yearData, showYear = '') {
  const rank = yearData ? store.favRank(yearData, album.id) : 0;
  return `<button class="card" data-open="${album.id}">
    ${coverHtml(album)}
    ${rank ? `<span class="rank-badge" title="#${rank} favourite">${rank}</span>` : ''}
    <span class="card-meta">
      <span class="card-title">${esc(album.title || album.artist)}</span>
      <span class="card-artist">${album.title ? esc(album.artist) : '<i>no album noted</i>'}${showYear ? ` · ${showYear}` : ''}</span>
    </span>
  </button>`;
}

function renderYear(year, tab) {
  const y = data.years[year];
  const favCount = y.favourites.length;
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">albums released in</p>
        <h1>${year}</h1>
        <p class="hero-stats"><b>${y.albums.length}</b> listened · <b>${favCount}</b> in your top list</p>
      </div>
      <div class="seg" role="tablist">
        <a role="tab" href="#/year/${year}" class="${tab === 'listened' ? 'on' : ''}">Listened</a>
        <a role="tab" href="#/year/${year}/favourites" class="${tab === 'favourites' ? 'on' : ''}">${ICON.heart} Favourites</a>
      </div>
    </section>
    <div id="yearBody"></div>`;
  if (tab === 'favourites') renderFavourites(year);
  else renderListened(year);
}

function renderListened(year) {
  const y = data.years[year];
  const body = $('#yearBody');
  body.innerHTML = `
    <div class="toolbar">
      <label class="search-field">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="filter" type="search" placeholder="Filter ${year}…" value="${esc(ui.filter)}" autocomplete="off">
      </label>
      <select id="sort" aria-label="Sort">
        <option value="latest">Latest first</option>
        <option value="order">Listening order</option>
        <option value="artist">Artist A–Z</option>
        <option value="favs">Favourites first</option>
      </select>
    </div>
    <div class="grid" id="grid"></div>`;
  $('#sort').value = ui.sort;
  const draw = () => {
    const list = sortedAlbums(y);
    $('#grid').innerHTML = list.length
      ? list.map((a) => cardHtml(a, y)).join('')
      : y.albums.length
        ? `<p class="muted pad">Nothing in ${year} matches “${esc(ui.filter)}”.</p>`
        : `<div class="empty"><h2>Nothing logged for ${year} yet</h2><p>Add the first album you listen to.</p><button class="btn primary" data-add="${year}">${ICON.plus} Add album</button></div>`;
    watchCovers();
  };
  $('#filter').addEventListener('input', (e) => { ui.filter = e.target.value; draw(); });
  $('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; draw(); });
  draw();
}

function renderFavourites(year) {
  const y = data.years[year];
  const body = $('#yearBody');
  const byId = Object.fromEntries(y.albums.map((a) => [a.id, a]));
  const favs = y.favourites.filter((f) => byId[f.albumId]);
  body.innerHTML = `
    <div class="fav-head">
      <p class="muted">${favs.length ? 'Drag to reorder. Add the best song from each record if you like.' : ''}</p>
      <button class="btn" id="addFav">${ICON.plus} Add from ${year}</button>
    </div>
    ${favs.length ? `<ol class="favs" id="favList">${favs.map((f, i) => favRowHtml(byId[f.albumId], f, i)).join('')}</ol>`
      : `<div class="empty"><h2>No favourites for ${year} yet</h2>
         <p>Open any album and tap the heart, or pick from this year's list.</p></div>`}`;
  $('#addFav').addEventListener('click', () => pickFavourite(year));
  watchCovers();
  const list = $('#favList');
  if (!list) return;
  sortable = Sortable.create(list, {
    handle: '.grip', animation: 160, ghostClass: 'ghost',
    onEnd: () => {
      const order = $$('.fav', list).map((li) => li.dataset.id);
      y.favourites.sort((a, b) => order.indexOf(a.albumId) - order.indexOf(b.albumId));
      $$('.fav-rank', list).forEach((el, i) => (el.textContent = i + 1));
      store.commit({ quiet: true });
    },
  });
  list.addEventListener('change', (e) => {
    if (!e.target.matches('.song-input')) return;
    const f = y.favourites.find((x) => x.albumId === e.target.closest('.fav').dataset.id);
    f.song = e.target.value.trim();
    store.commit({ quiet: true });
    toast('Best song saved');
  });
  list.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-unfav]');
    if (!rm) return;
    e.stopPropagation();
    const id = rm.dataset.unfav;
    y.favourites = y.favourites.filter((f) => f.albumId !== id);
    store.commit();
    renderFavourites(year);
    toast('Removed from favourites');
  });
}

function favRowHtml(album, fav, i) {
  return `<li class="fav" data-id="${album.id}">
    <span class="grip" title="Drag to reorder">${ICON.grip}</span>
    <span class="fav-rank">${i + 1}</span>
    <button class="fav-cover" data-open="${album.id}">${coverHtml(album)}</button>
    <div class="fav-main">
      <button class="fav-title" data-open="${album.id}">${esc(album.title || album.artist)}</button>
      <span class="fav-artist">${esc(album.artist)}</span>
      <input class="song-input" value="${esc(fav.song || '')}" placeholder="Best song…" aria-label="Best song" list="songs-${album.id}">
      <datalist id="songs-${album.id}">${(album.songs || []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    </div>
    <a class="icon-btn spot" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener" title="Play on Spotify">${ICON.spotify}</a>
    <button class="icon-btn subtle" data-unfav="${album.id}" title="Remove from favourites">${ICON.close}</button>
  </li>`;
}

function toggleFavourite(year, album, on) {
  const y = data.years[year];
  const has = y.favourites.some((f) => f.albumId === album.id);
  if (on && !has) y.favourites.push({ albumId: album.id, song: (album.songs || [])[0] || '' });
  if (!on && has) y.favourites = y.favourites.filter((f) => f.albumId !== album.id);
  store.commit();
}

function pickFavourite(year) {
  const y = data.years[year];
  const favSet = new Set(y.favourites.map((f) => f.albumId));
  const m = openModal(`
    <div class="modal-head"><h2>Add to your ${year} favourites</h2>${closeBtn()}</div>
    <label class="search-field big"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="pickQ" type="search" placeholder="Search ${y.albums.length} albums…" autocomplete="off"></label>
    <div class="pick-list" id="pickList"></div>`, 'wide');
  const draw = () => {
    const q = norm($('#pickQ', m).value);
    const list = y.albums.slice().reverse().filter((a) => !q || norm(`${a.artist} ${a.title}`).includes(q));
    $('#pickList', m).innerHTML = list.map((a) => `
      <button class="pick ${favSet.has(a.id) ? 'chosen' : ''}" data-pick="${a.id}">
        ${coverHtml(a, 'sm')}
        <span><b>${esc(a.title || a.artist)}</b><small>${a.title ? esc(a.artist) : 'no album noted'}</small></span>
        <span class="pick-state">${favSet.has(a.id) ? ICON.check : ICON.plus}</span>
      </button>`).join('');
    watchCovers(m);
  };
  $('#pickQ', m).addEventListener('input', draw);
  $('#pickList', m).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const album = y.albums.find((a) => a.id === b.dataset.pick);
    const on = !favSet.has(album.id);
    on ? favSet.add(album.id) : favSet.delete(album.id);
    toggleFavourite(year, album, on);
    b.classList.toggle('chosen', on);
    b.querySelector('.pick-state').innerHTML = on ? ICON.check : ICON.plus;
  });
  m.onClose = () => render();
  draw();
  $('#pickQ', m).focus();
}

// ------------------------------------------------------------------ album detail

function openAlbum(id) {
  const found = store.findAlbum(id);
  if (!found) return;
  const { year, album, yearData } = found;
  const rank = store.favRank(yearData, id);
  const fav = yearData.favourites.find((f) => f.albumId === id);
  const m = openModal(`
    ${closeBtn('floating')}
    <div class="detail">
      ${coverHtml(album, 'xl')}
      <div class="detail-info">
        <p class="eyebrow"><a href="#/year/${year}">${year}</a>${rank ? ` · <span class="accent">#${rank} favourite</span>` : ''}</p>
        <h2 class="detail-title">${esc(album.title || album.artist)}</h2>
        <p class="detail-artist">${album.title ? esc(album.artist) : 'No album noted. Tap Edit to add one.'}</p>
        ${(album.songs || []).length ? `<div class="chips">${album.songs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
        <div class="detail-actions">
          <a class="btn spotify" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener">${ICON.spotify} Play on Spotify</a>
          <button class="btn heart ${rank ? 'on' : ''}" id="favToggle" aria-pressed="${!!rank}">${ICON.heart}<span>${rank ? 'Favourite' : 'Add to favourites'}</span></button>
        </div>
        ${rank ? `<label class="field"><span>Best song</span>
          <input id="bestSong" value="${esc(fav.song || '')}" placeholder="Which track stood out?" list="detailSongs">
          <datalist id="detailSongs">${(album.songs || []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>` : ''}
        <div class="detail-foot">
          <button class="link-btn" id="editAlbum">${ICON.edit} Edit</button>
          <button class="link-btn danger" id="deleteAlbum">${ICON.trash} Delete</button>
        </div>
      </div>
    </div>`, 'detail-modal');
  watchCovers(m);
  requestArt(album);
  $('#favToggle', m).addEventListener('click', () => {
    toggleFavourite(year, album, !rank);
    toast(rank ? 'Removed from favourites' : `Added to your ${year} favourites`);
    closeModal(m, true);
    openAlbum(id);
  });
  $('#bestSong', m)?.addEventListener('change', (e) => {
    fav.song = e.target.value.trim();
    store.commit({ quiet: true });
    toast('Best song saved');
  });
  $('#editAlbum', m).addEventListener('click', () => { closeModal(m, true); editAlbum(id); });
  $('#deleteAlbum', m).addEventListener('click', () => {
    if (!confirm(`Delete “${album.title || album.artist}” from ${year}?`)) return;
    yearData.albums = yearData.albums.filter((a) => a.id !== id);
    yearData.favourites = yearData.favourites.filter((f) => f.albumId !== id);
    store.commit();
    closeModal(m);
    toast('Album deleted');
  });
  m.onClose = () => render();
}

function editAlbum(id) {
  const { year, album, yearData } = store.findAlbum(id);
  const m = openModal(`
    <div class="modal-head"><h2>Edit album</h2>${closeBtn()}</div>
    <form id="editForm" class="form">
      <div class="form-cover">${coverHtml(album, 'md')}<button type="button" class="link-btn" id="refetch">Find artwork again</button></div>
      <label class="field"><span>Artist</span><input name="artist" value="${esc(album.artist)}" required></label>
      <label class="field"><span>Album</span><input name="title" value="${esc(album.title)}"></label>
      <label class="field"><span>Standout songs <small>comma separated</small></span><input name="songs" value="${esc((album.songs || []).join(', '))}"></label>
      <div class="row">
        <label class="field"><span>Release year</span><select name="year">${yearOptions(year)}</select></label>
      </div>
      <label class="field"><span>Spotify link <small>optional, paste from Share › Copy link</small></span><input name="spotify" value="${esc(album.spotify || '')}" placeholder="https://open.spotify.com/album/…"></label>
      <label class="field"><span>Artwork URL <small>optional</small></span><input name="art" value="${esc(artFor(album) || '')}"></label>
      <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div>
    </form>`);
  $('#refetch', m).addEventListener('click', async (e) => {
    e.target.textContent = 'Searching…';
    try {
      const url = await findArt({ artist: $('[name=artist]', m).value, title: $('[name=title]', m).value });
      $('[name=art]', m).value = url;
      e.target.textContent = url ? 'Found it' : 'No match found';
    } catch { e.target.textContent = 'Search failed'; }
  });
  $('#editForm', m).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    album.artist = f.get('artist').trim();
    album.title = f.get('title').trim();
    album.songs = splitSongs(f.get('songs'));
    const sp = f.get('spotify').trim();
    sp ? (album.spotify = sp) : delete album.spotify;
    album.art = f.get('art').trim();
    const newYear = f.get('year');
    if (newYear !== year) {
      const favWas = yearData.favourites.some((x) => x.albumId === id);
      yearData.albums = yearData.albums.filter((a) => a.id !== id);
      yearData.favourites = yearData.favourites.filter((x) => x.albumId !== id);
      store.ensureYear(newYear).albums.push(album);
      if (favWas) toast(`Moved to ${newYear}. It was removed from the ${year} favourites.`);
    }
    store.commit();
    closeModal(m, true);
    openAlbum(id);
  });
}

const splitSongs = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function yearOptions(selected) {
  const now = new Date().getFullYear();
  const set = new Set([...store.years(), String(now), String(now + 1)]);
  return [...set].sort((a, b) => b - a).map((y) => `<option ${y === String(selected) ? 'selected' : ''}>${y}</option>`).join('');
}

// ------------------------------------------------------------------ add album

function addAlbum({ year, query = '', onSaved } = {}) {
  const [page, a] = route();
  year = year || (page === 'year' ? a : null) || String(new Date().getFullYear());
  let chosen = null;
  const m = openModal(`
    <div class="modal-head"><h2>Add an album</h2>${closeBtn()}</div>
    <label class="search-field big"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="addQ" type="search" placeholder="Search for an album or artist…" autocomplete="off" value="${esc(query)}"></label>
    <div class="results" id="results"></div>
    <form id="addForm" class="form">
      <div class="form-cover"><div id="addCover"></div></div>
      <label class="field"><span>Artist</span><input name="artist" required autocomplete="off"></label>
      <label class="field"><span>Album</span><input name="title" autocomplete="off"></label>
      <label class="field"><span>Standout songs <small>optional, comma separated</small></span><input name="songs" autocomplete="off"></label>
      <div class="row">
        <label class="field"><span>Release year</span><select name="year">${yearOptions(year)}</select></label>
        <label class="check"><input type="checkbox" name="fav"> ${ICON.heart} Favourite</label>
      </div>
      <p class="warn" id="dupWarn" hidden></p>
      <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Add album</button></div>
    </form>`, 'wide');
  const form = $('#addForm', m);
  const F = form.elements;
  const q = $('#addQ', m);
  const results = $('#results', m);
  const coverPreview = () => {
    const al = { id: 'preview', artist: F.artist.value, title: F.title.value };
    $('#addCover', m).innerHTML = `<div class="cover md" style="background:${placeholder(al)}"><span class="cover-initial">${esc((al.title || al.artist || '?').slice(0, 1).toUpperCase())}</span>${chosen?.art ? `<img src="${esc(chosen.art)}" alt="">` : ''}</div>`;
    checkDup();
  };
  const checkDup = () => {
    const y = data.years[F.year.value];
    const dup = y && y.albums.find((x) => norm(x.artist) === norm(F.artist.value) && norm(x.title) === norm(F.title.value));
    const w = $('#dupWarn', m);
    w.hidden = !dup;
    if (dup) w.textContent = `You've already logged this in ${F.year.value}.`;
  };
  let timer, ticket = 0;
  const search = () => {
    clearTimeout(timer);
    const term = q.value.trim();
    if (term.length < 2) { results.innerHTML = ''; return; }
    results.innerHTML = '<p class="muted pad-sm"><span class="spin"></span> Searching…</p>';
    timer = setTimeout(async () => {
      const t = ++ticket;
      try {
        const list = await searchAlbums(term, 8);
        if (t !== ticket) return;
        results.innerHTML = list.length ? list.map((r, i) => `
          <button type="button" class="result" data-i="${i}">
            <img src="${esc(r.art.replace('600x600', '120x120'))}" alt="">
            <span><b>${esc(r.title)}</b><small>${esc(r.artist)} · ${r.year}</small></span>
          </button>`).join('') : '<p class="muted pad-sm">No matches. Fill in the details below instead.</p>';
        results._list = list;
      } catch {
        if (t === ticket) results.innerHTML = '<p class="muted pad-sm">Search is unavailable right now. Fill in the details below.</p>';
      }
    }, 320);
  };
  q.addEventListener('input', search);
  results.addEventListener('click', (e) => {
    const b = e.target.closest('.result');
    if (!b) return;
    chosen = results._list[b.dataset.i];
    F.artist.value = chosen.artist.toLowerCase();
    F.title.value = chosen.title.toLowerCase();
    if (chosen.year && [...F.year.options].some((o) => o.value === chosen.year)) F.year.value = chosen.year;
    else if (chosen.year) { F.year.insertAdjacentHTML('afterbegin', `<option>${chosen.year}</option>`); F.year.value = chosen.year; }
    $$('.result', results).forEach((x) => x.classList.toggle('chosen', x === b));
    coverPreview();
    F.songs.focus();
  });
  F.artist.addEventListener('input', () => { chosen = null; coverPreview(); });
  F.title.addEventListener('input', () => { chosen = null; coverPreview(); });
  F.year.addEventListener('change', checkDup);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const y = store.ensureYear(F.year.value);
    const album = { id: store.uid(), artist: F.artist.value.trim(), title: F.title.value.trim(), songs: splitSongs(F.songs.value) };
    if (chosen?.art) album.art = chosen.art;
    y.albums.push(album);
    if (F.fav.checked) y.favourites.push({ albumId: album.id, song: album.songs[0] || '' });
    store.commit();
    closeModal(m, true);
    onSaved?.(album);
    toast(`Added to ${F.year.value}`);
    if (location.hash !== `#/year/${F.year.value}`) location.hash = `#/year/${F.year.value}`;
    else render();
    if (!album.art) requestArt(album);
  });
  coverPreview();
  if (query) search();
  q.focus();
}

// ------------------------------------------------------------------ to listen / always

function renderToListen() {
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">queue</p><h1>to listen</h1>
      <p class="hero-stats"><b>${data.toListen.length}</b> things to check out</p></div></section>
    <form class="inline-add" id="tlForm"><input name="item" placeholder="Add an artist or album to check out…" autocomplete="off" required><button class="btn primary">${ICON.plus} Add</button></form>
    <ul class="simple-list" id="tl">${data.toListen.map((t, i) => `
      <li><span class="sl-name">${esc(t)}</span>
        <a class="icon-btn spot" href="${esc(spotifyArtistUrl(t))}" target="_blank" rel="noopener" title="Find on Spotify">${ICON.spotify}</a>
        <button class="btn small" data-heard="${i}" title="Log it as listened">${ICON.check} Listened</button>
        <button class="icon-btn subtle" data-rm="${i}" title="Remove">${ICON.close}</button></li>`).join('')}</ul>`;
  $('#tlForm').addEventListener('submit', (e) => {
    e.preventDefault();
    data.toListen.unshift(e.target.item.value.trim());
    store.commit();
    renderToListen();
    $('#tlForm input').focus();
  });
  $('#tl').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    const heard = e.target.closest('[data-heard]');
    if (rm) { data.toListen.splice(+rm.dataset.rm, 1); store.commit(); renderToListen(); }
    if (heard) {
      const item = data.toListen[+heard.dataset.heard];
      addAlbum({
        query: item, year: String(new Date().getFullYear()),
        onSaved: () => { const i = data.toListen.indexOf(item); if (i >= 0) data.toListen.splice(i, 1); store.commit(); },
      });
    }
  });
}

function renderAlways() {
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">all-time</p><h1>always</h1>
      <p class="hero-stats">The ones that never leave.</p></div></section>
    <form class="inline-add" id="alForm"><input name="item" placeholder="Add an all-time favourite…" autocomplete="off" required><button class="btn primary">${ICON.plus} Add</button></form>
    <ol class="always" id="al">${data.always.map((t, i) => `
      <li><span class="al-n">${String(i + 1).padStart(2, '0')}</span><span class="al-name">${esc(t)}</span>
        <a class="icon-btn spot" href="${esc(spotifyArtistUrl(t))}" target="_blank" rel="noopener" title="Play on Spotify">${ICON.spotify}</a>
        <button class="icon-btn subtle" data-rm="${i}" title="Remove">${ICON.close}</button></li>`).join('')}</ol>`;
  $('#alForm').addEventListener('submit', (e) => {
    e.preventDefault();
    data.always.push(e.target.item.value.trim());
    store.commit();
    renderAlways();
  });
  $('#al').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm && confirm(`Remove “${data.always[+rm.dataset.rm]}”?`)) { data.always.splice(+rm.dataset.rm, 1); store.commit(); renderAlways(); }
  });
}

// ------------------------------------------------------------------ search

function renderSearch(initial) {
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">every year</p><h1>search</h1></div></section>
    <label class="search-field big"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="gq" type="search" placeholder="Artist, album or song…" value="${esc(initial)}" autocomplete="off"></label>
    <div id="gres"></div>`;
  const input = $('#gq');
  const draw = () => {
    const q = norm(input.value);
    history.replaceState(null, '', `#/search/${encodeURIComponent(input.value)}`);
    if (q.length < 2) { $('#gres').innerHTML = ''; return; }
    let total = 0;
    const html = store.years().map((y) => {
      const yd = data.years[y];
      const hits = yd.albums.filter((a) => norm(`${a.artist} ${a.title} ${(a.songs || []).join(' ')}`).includes(q));
      total += hits.length;
      return hits.length ? `<h3 class="group-title"><a href="#/year/${y}">${y}</a></h3><div class="grid">${hits.map((a) => cardHtml(a, yd)).join('')}</div>` : '';
    }).join('');
    $('#gres').innerHTML = total ? html : `<p class="muted pad">No albums match “${esc(input.value)}”.</p>`;
    watchCovers();
  };
  input.addEventListener('input', draw);
  draw();
  input.focus();
}

// ------------------------------------------------------------------ settings

function openSettings() {
  const cfg = store.getConfig();
  const { status, lastError } = store.getStatus();
  const statusText = {
    saved: 'Connected. Every change is saved to your GitHub repo, so it shows up on all your devices.',
    saving: 'Saving to GitHub…',
    error: `Connected, but the last save failed: ${lastError}`,
  }[status] || 'Not connected. You can browse everything, and edits stay on this device until you connect.';
  const m = openModal(`
    <div class="modal-head"><h2>Sync with GitHub</h2>${closeBtn()}</div>
    <p class="status-line ${status}"><span class="sync-dot ${status}"></span>${esc(statusText)}</p>
    <form class="form" id="cfgForm">
      <div class="row">
        <label class="field"><span>Owner</span><input name="owner" value="${esc(cfg.owner)}"></label>
        <label class="field"><span>Repo</span><input name="repo" value="${esc(cfg.repo)}"></label>
        <label class="field narrow"><span>Branch</span><input name="branch" value="${esc(cfg.branch)}"></label>
      </div>
      <label class="field"><span>Access token</span><input name="token" type="password" value="${esc(cfg.token)}" placeholder="github_pat_…" autocomplete="off"></label>
      <details class="help"><summary>How to get a token</summary>
        <ol>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub › New fine-grained token</a>.</li>
          <li>Under <b>Repository access</b> choose <i>Only select repositories</i> and pick <b>${esc(cfg.repo)}</b>.</li>
          <li>Under <b>Permissions › Repository › Contents</b> choose <i>Read and write</i>.</li>
          <li>Generate it, copy it and paste it above. It stays in this browser only.</li>
        </ol></details>
      <p class="warn" id="cfgErr" hidden></p>
      <div class="form-actions">
        ${cfg.token ? '<button type="button" class="btn" id="disconnect">Disconnect</button>' : ''}
        <button type="button" class="btn" id="export">Download backup</button>
        <button class="btn primary">${cfg.token ? 'Save' : 'Connect'}</button>
      </div>
    </form>`);
  $('#export', m).addEventListener('click', store.exportJson);
  $('#disconnect', m)?.addEventListener('click', () => {
    store.setConfig({ ...cfg, token: '' });
    closeModal(m);
    toast('Disconnected from GitHub');
    location.reload();
  });
  $('#cfgForm', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const next = Object.fromEntries([...f.entries()].map(([k, v]) => [k, v.trim()]));
    const err = $('#cfgErr', m);
    err.hidden = true;
    store.setConfig(next);
    try {
      await store.testConnection();
      await store.reloadFromRemote();
      closeModal(m);
      toast('Connected to GitHub');
      data = store.getData();
      render();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message;
      store.setConfig(cfg);
    }
  });
}

// ------------------------------------------------------------------ modal + toast

const closeBtn = (cls = '') => `<button class="icon-btn modal-close ${cls}" data-close aria-label="Close">${ICON.close}</button>`;

function openModal(html, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  modalRoot.appendChild(wrap);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => wrap.classList.add('in'));
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(wrap); });
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(wrap); });
  return wrap;
}

function closeModal(wrap, silent = false) {
  if (!wrap?.isConnected) return;
  wrap.remove();
  if (!modalRoot.children.length) document.body.classList.remove('modal-open');
  if (!silent) wrap.onClose?.();
}

let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), kind === 'error' ? 6000 : 2400);
}

// ------------------------------------------------------------------ global events

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open && !e.target.closest('input')) {
    $$('.modal-wrap').forEach((w) => closeModal(w, true));
    openAlbum(open.dataset.open);
  }
  const add = e.target.closest('[data-add]');
  if (add) addAlbum({ year: add.dataset.add });
});
$('#addBtn').addEventListener('click', () => addAlbum());
$('#searchBtn').addEventListener('click', () => (location.hash = '#/search'));
$('#settingsBtn').addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const last = modalRoot.lastElementChild; if (last) closeModal(last); return; }
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (modalRoot.children.length) return;
  if (e.key === 'n') { e.preventDefault(); addAlbum(); }
  if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
});

boot();
