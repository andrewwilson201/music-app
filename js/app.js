import * as store from './store.js?v=11';
import * as spotify from './spotify.js?v=11';
import { queueArt, prioritise, searchAlbums, findSpotifyLink, spotifyUrl, spotifyArtistUrl, placeholder, norm, artVersion } from './art.js?v=11';

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
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="5" height="5" rx="1"/><rect x="3.5" y="14.5" width="5" height="5" rx="1"/><path d="M11.5 6h9M11.5 8.5h6M11.5 16h9M11.5 18.5h6"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M4 6h12M4 11h12M4 16h7"/><path d="m15 14 5 3-5 3z" fill="currentColor"/></svg>',
  grip: '<svg viewBox="0 0 24 24" class="fill"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

let data;
let ui = { sort: 'latest', filter: '', view: 'grid' };
try { ui.view = localStorage.getItem('music-log:view') || 'grid'; } catch {}
let sortable = null;

// ------------------------------------------------------------------ boot

async function boot() {
  app.innerHTML = '<div class="loading"><span class="spin"></span>Loading your records…</div>';
  let spotifyMsg = '';
  try { if (await spotify.handleRedirect()) spotifyMsg = 'Logged in to Spotify'; }
  catch (e) { spotifyMsg = `Spotify login failed: ${e.message}`; }
  if (spotifyMsg) setTimeout(() => toast(spotifyMsg, spotifyMsg.includes('failed') ? 'error' : ''), 300);
  if (!store.configured()) return renderNotConfigured();
  let user;
  try { user = await store.init(); }
  catch (e) { return renderSignIn(e.message); }
  if (!user) return renderSignIn();
  await startSession();
}

async function startSession() {
  document.body.classList.remove('signed-out');
  app.innerHTML = '<div class="loading"><span class="spin"></span>Loading your records…</div>';
  try {
    data = await store.load();
  } catch (e) {
    app.innerHTML = `<div class="empty"><h2>Couldn't load your log</h2><p>${esc(e.message)}</p>
      <button class="btn" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  if (!data) return renderFirstRun();
  started();
}

let isStarted = false;
function started() {
  data = store.getData();
  if (isStarted) return render();
  isStarted = true;
  store.subscribe(onStoreChange);
  onStoreChange();
  normaliseQueue();
  migrateArtCache();
  setTimeout(backfillArt, 4000);
  window.addEventListener('hashchange', () => {
    [...modalRoot.children].forEach((w) => closeModal(w, true));
    ui.filter = '';
    render();
  });
  // Save before the page is hidden, and pick up edits made on other devices on return.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); store.flush(); return; }
    if (Date.now() - hiddenAt < 30000 || modalRoot.children.length) return;
    try { if (await store.refresh()) { data = store.getData(); render(); } } catch {}
  });
  render();
}

// ------------------------------------------------------------------ sign in

const GOOGLE_ICON = '<svg viewBox="0 0 24 24" class="g-icon" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.7 14a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 9.9L5.7 14Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4Z"/></svg>';

function renderSignedOutShell() {
  document.body.classList.add('signed-out');
  $('#nav').innerHTML = '';
}

function renderNotConfigured() {
  renderSignedOutShell();
  app.innerHTML = `<div class="empty"><h2>Almost ready</h2>
    <p>This app needs its Firebase settings before anyone can sign in. Add them to <code>js/config.js</code>.</p></div>`;
}

function renderSignIn(error = '') {
  renderSignedOutShell();
  let mode = 'signin';
  app.innerHTML = `<section class="auth">
    <div class="auth-hero">
      <span class="brand-disc big" aria-hidden="true"></span>
      <h1>Your listening log</h1>
      <p>Log the albums you listen to each year, pick your favourites, and play them on Spotify. Your log is private to you.</p>
    </div>
    <div class="auth-card">
      <button class="btn google" id="googleBtn">${GOOGLE_ICON}Continue with Google</button>
      <div class="auth-or"><span>or use email</span></div>
      <form class="form" id="emailForm" novalidate>
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required minlength="6"></label>
        <p class="warn" id="authErr" ${error ? '' : 'hidden'}>${esc(error)}</p>
        <p class="ok-note" id="authNote" hidden></p>
        <button class="btn primary" id="emailBtn">Sign in</button>
        <div class="auth-links">
          <button type="button" class="link" id="modeBtn">New here? Create an account</button>
          <button type="button" class="link" id="resetBtn">Forgot password?</button>
        </div>
      </form>
    </div>
  </section>`;
  const form = $('#emailForm');
  const err = $('#authErr');
  const note = $('#authNote');
  const show = (msg) => { err.hidden = !msg; err.textContent = msg; if (msg) note.hidden = true; };
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };
  $('#modeBtn').addEventListener('click', () => {
    mode = mode === 'signin' ? 'create' : 'signin';
    $('#emailBtn').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    $('#modeBtn').textContent = mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in';
    form.password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    $('#resetBtn').hidden = mode === 'create';
    show('');
  });
  $('#googleBtn').addEventListener('click', async (e) => {
    show(''); busy(e.currentTarget, true);
    try { if (await store.signInGoogle()) await startSession(); }
    catch (ex) { show(ex.message); }
    finally { busy(e.currentTarget, false); }
  });
  $('#resetBtn').addEventListener('click', async () => {
    if (!form.email.value.trim()) { show('Enter your email first, then tap “Forgot password?” again.'); form.email.focus(); return; }
    try {
      await store.resetPassword(form.email.value);
      show('');
      note.hidden = false;
      note.textContent = `If there's an account for ${form.email.value.trim()}, a reset link is on its way.`;
    } catch (ex) { show(ex.message); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.email.value.trim()) return show('Enter your email.');
    if (!form.password.value) return show('Enter your password.');
    const btn = $('#emailBtn');
    show(''); busy(btn, true);
    try { await store.signInEmail(form.email.value, form.password.value, mode === 'create'); await startSession(); }
    catch (ex) { show(ex.message); }
    finally { busy(btn, false); }
  });
}

function renderFirstRun() {
  renderSignedOutShell();
  const user = store.currentUser();
  const name = (user.displayName || '').split(' ')[0];
  const legacy = store.hasLegacyLog();
  app.innerHTML = `<section class="auth">
    <div class="auth-hero">
      <span class="brand-disc big" aria-hidden="true"></span>
      <h1>Welcome${name ? `, ${esc(name)}` : ''}</h1>
      <p>Signed in as ${esc(user.email || 'you')}. Your log is empty, so how would you like to start?</p>
    </div>
    <div class="auth-card choices">
      ${legacy ? `<button class="choice primary" data-start="legacy"><b>Bring over my existing log</b><small>Copies the log this device was saving to GitHub into your account.</small></button>` : ''}
      <button class="choice ${legacy ? '' : 'primary'}" data-start="fresh"><b>Start a new log</b><small>Begin with an empty ${new Date().getFullYear()}.</small></button>
      <label class="choice" data-start="file"><b>Restore a backup file</b><small>A .json file from “Download backup”.</small><input type="file" accept="application/json,.json" hidden></label>
      <p class="warn" id="startErr" hidden></p>
      <button type="button" class="link" id="signOutBtn">Not you? Sign out</button>
    </div>
  </section>`;
  const err = $('#startErr');
  const run = async (fn) => {
    err.hidden = true;
    app.querySelectorAll('.choice').forEach((b) => b.classList.add('busy'));
    try { await fn(); started(); document.body.classList.remove('signed-out'); toast('Your log is ready'); }
    catch (ex) { err.hidden = false; err.textContent = ex.message; }
    finally { app.querySelectorAll('.choice').forEach((b) => b.classList.remove('busy')); }
  };
  $('[data-start="legacy"]')?.addEventListener('click', () => run(store.importLegacyLog));
  $('[data-start="fresh"]').addEventListener('click', () => run(store.startFresh));
  $('[data-start="file"] input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) run(async () => store.replaceAll(JSON.parse(await file.text())));
  });
  $('#signOutBtn').addEventListener('click', async () => { await store.signOut(); location.reload(); });
}

function onStoreChange() {
  data = store.getData();
  const { status, lastError } = store.getStatus();
  const dot = $('#syncDot');
  dot.className = `sync-dot ${status}`;
  $('#settingsBtn').title = {
    saved: 'Saved to your account',
    saving: 'Saving…',
    error: `Sync problem: ${lastError}`,
    idle: 'Settings and account',
  }[status] || 'Settings';
  if (status === 'error') toast(`Couldn't save: ${lastError}`, 'error');
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
  if (page === 'up-next' || page === 'to-listen') return renderUpNext();
  if (page === 'always') return renderAlways();
  if (page === 'search') return renderSearch(a || '');
  location.hash = '#/';
}

function renderNav(active) {
  const years = store.years();
  $('#nav').innerHTML =
    years.map((y) => `<a href="#/year/${y}" class="${active === y ? 'on' : ''}">${y}</a>`).join('') +
    `<span class="nav-sep"></span>` +
    `<a href="#/always" class="${active === 'always' ? 'on' : ''}">always</a>`;
  const on = $('#nav .on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ------------------------------------------------------------------ artwork

const artCacheKey = 'music-log:art';
let artCache = {};
try { artCache = JSON.parse(localStorage.getItem(artCacheKey) || '{}'); } catch {}

// URL, '' (looked and found nothing) or undefined (not looked yet, or an
// older, stricter lookup missed it and it's worth another try).
function artFor(album) {
  if (album.art) return album.art;
  if (album.art === '' && (album.artTry || 1) >= artVersion()) return '';
  const c = artCache[album.id];
  if (c) return c.startsWith('miss:') ? (+c.slice(5) >= artVersion() ? '' : undefined) : c;
  return undefined;
}

function coverHtml(album, cls = '') {
  const art = artFor(album);
  const initials = esc((album.title || album.artist).slice(0, 1).toUpperCase());
  return `<div class="cover ${cls}" data-art-id="${album.id}" style="background:${placeholder(album)}">
    <span class="cover-initial">${initials}</span>
    ${art ? `<img src="${esc(art)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
  </div>`;
}

// An album in a year's log, or an item in the Up next queue.
const findItem = (id) => store.findAlbum(id)?.album || (data.toListen || []).find((x) => x.id === id);

const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target.dataset.artId);
  visible.forEach((id) => {
    const item = findItem(id);
    if (item) requestArt(item);
  });
  prioritise(visible);
}, { rootMargin: '300px' });

function watchCovers(root = app) {
  $$('.cover[data-art-id]', root).forEach((el) => {
    const item = findItem(el.dataset.artId);
    if (item && artFor(item) === undefined) observer.observe(el);
  });
}

// Artwork found before the log has loaded lives only in this browser.
// Once connected, copy it into the data so it's saved for every device.
let artSinceSave = 0;
function migrateArtCache() {
  if (!store.canSync()) return;
  let moved = 0;
  for (const [id, url] of Object.entries(artCache)) {
    const item = findItem(id);
    if (item && !item.art && url && !url.startsWith('miss:')) { item.art = url; moved++; }
  }
  artCache = {};
  try { localStorage.removeItem(artCacheKey); } catch {}
  if (moved) store.commit({ quiet: true, delay: 3000 });
}

// When synced and logged in to Spotify, quietly fetch covers for every album
// still missing one (newest years first), so they're saved once for good.
function backfillArt() {
  if (!store.canSync() || !spotify.connected()) return;
  for (const y of store.years()) {
    for (const album of data.years[y].albums.slice().reverse()) {
      if (artFor(album) === undefined) requestArt(album);
    }
  }
}

async function requestArt(album) {
  if (artFor(album) !== undefined) return;
  const found = await queueArt(album);
  if (!found) return; // lookup failed (network), try another time
  setArt(album, found.art, found.spotify);
}

function setArt(album, url, spotifyLink = '') {
  if (store.canSync()) {
    album.art = url;
    if (url) delete album.artTry; else album.artTry = artVersion();
    if (spotifyLink && !album.spotify) album.spotify = spotifyLink;
    delete artCache[album.id];
    // Save in batches: a long backfill would otherwise keep pushing the save back.
    artSinceSave = (artSinceSave + 1) % 20;
    store.commit({ quiet: true, delay: artSinceSave === 0 ? 0 : 6000 });
  } else {
    artCache[album.id] = url || `miss:${artVersion()}`;
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

function rowHtml(album, yearData, showYear = '') {
  const rank = yearData ? store.favRank(yearData, album.id) : 0;
  const songs = (album.songs || []).join(', ');
  return `<div class="row-item">
    <button class="row-open" data-open="${album.id}">
      ${coverHtml(album, 'sm')}
      <span class="row-meta">
        <span class="row-title">${esc(album.title || album.artist)}</span>
        <span class="row-artist">${album.title ? esc(album.artist) : '<i>no album noted</i>'}${showYear ? ` · ${showYear}` : ''}</span>
        ${songs ? `<span class="row-songs">♪ ${esc(songs)}</span>` : ''}
      </span>
      ${rank ? `<span class="row-rank" title="#${rank} favourite">${ICON.heart}${rank}</span>` : ''}
    </button>
    <a class="icon-btn spot" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener" title="Play on Spotify" aria-label="Play ${esc(album.title || album.artist)} on Spotify">${ICON.spotify}</a>
  </div>`;
}

function albumsHtml(list, yearData, showYear = '') {
  return ui.view === 'list'
    ? `<div class="rows">${list.map((a) => rowHtml(a, yearData, showYear)).join('')}</div>`
    : `<div class="grid">${list.map((a) => cardHtml(a, yearData, showYear)).join('')}</div>`;
}

const viewToggleHtml = () => `<div class="view-toggle" role="group" aria-label="View">
  <button type="button" data-view="grid" class="${ui.view === 'grid' ? 'on' : ''}" aria-pressed="${ui.view === 'grid'}" title="Grid view">${ICON.grid}</button>
  <button type="button" data-view="list" class="${ui.view === 'list' ? 'on' : ''}" aria-pressed="${ui.view === 'list'}" title="List view">${ICON.list}</button>
</div>`;

function bindViewToggle(root, redraw) {
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    ui.view = b.dataset.view;
    try { localStorage.setItem('music-log:view', ui.view); } catch {}
    root.querySelectorAll('[data-view]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    redraw();
  }));
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
      ${viewToggleHtml()}
    </div>
    <div id="grid"></div>`;
  if (year === store.years()[0]) body.insertAdjacentHTML('afterbegin', upNextHtml());
  $('#sort').value = ui.sort;
  const draw = () => {
    const list = sortedAlbums(y);
    $('#grid').innerHTML = list.length
      ? albumsHtml(list, y)
      : y.albums.length
        ? `<p class="muted pad">Nothing in ${year} matches “${esc(ui.filter)}”.</p>`
        : `<div class="empty"><h2>Nothing logged for ${year} yet</h2><p>Add the first album you listen to.</p><button class="btn primary" data-add="${year}">${ICON.plus} Add album</button></div>`;
    watchCovers();
  };
  $('#filter').addEventListener('input', (e) => { ui.filter = e.target.value; draw(); });
  $('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; draw(); });
  bindViewToggle(body, draw);
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
  if (!album.spotify && spotify.connected()) {
    findSpotifyLink(album).then((link) => {
      if (!link) return;
      $('.btn.spotify', m)?.setAttribute('href', link);
      if (store.canSync()) { album.spotify = link; store.commit({ quiet: true, delay: 6000 }); }
    }).catch(() => {});
  }
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
      <div class="form-cover"><div id="editCover">${coverHtml(album, 'md')}</div><button type="button" class="btn small" id="refetch">Choose artwork</button></div>
      <div class="art-picker" id="artPicker" hidden></div>
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
  $('#refetch', m).addEventListener('click', async () => {
    const picker = $('#artPicker', m);
    const artist = $('[name=artist]', m).value.trim();
    const title = $('[name=title]', m).value.trim();
    picker.hidden = false;
    picker.innerHTML = '<p class="muted pad-sm"><span class="spin"></span> Looking for covers…</p>';
    try {
      const seen = new Set();
      const list = [];
      for (const term of [`${artist} ${title}`.trim(), artist, title].filter(Boolean)) {
        for (const r of await searchAlbums(term, 25)) {
          if (r.art && !seen.has(r.art)) { seen.add(r.art); list.push(r); }
        }
        if (list.length >= 24) break;
      }
      picker.innerHTML = list.length
        ? `<p class="muted pick-hint">Tap the right cover</p><div class="art-grid">${list.slice(0, 24).map((r) => `
            <button type="button" class="art-opt" data-art="${esc(r.art)}" data-spotify="${esc(r.spotify || '')}" title="${esc(`${r.title} · ${r.artist}`)}">
              <img src="${esc(r.art.replace('600x600', '200x200'))}" alt="" loading="lazy">
              <span>${esc(r.title)}</span><small>${esc(r.artist)}</small></button>`).join('')}</div>`
        : '<p class="muted pad-sm">Apple Music has nothing under that name. You can paste an image link in Artwork URL below.</p>';
    } catch { picker.innerHTML = '<p class="muted pad-sm">Artwork search is unavailable right now.</p>'; }
  });
  $('#artPicker', m).addEventListener('click', (e) => {
    const b = e.target.closest('.art-opt');
    if (!b) return;
    $('[name=art]', m).value = b.dataset.art;
    if (b.dataset.spotify) $('[name=spotify]', m).value = b.dataset.spotify;
    m.querySelectorAll('.art-opt').forEach((x) => x.classList.toggle('chosen', x === b));
    $('#editCover', m).innerHTML = coverHtml({ ...album, art: b.dataset.art }, 'md');
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

function addAlbum({ year, query = '', mode = 'log', fromQueue = null } = {}) {
  const [page, a] = route();
  year = year || (page === 'year' ? a : null) || String(new Date().getFullYear());
  let chosen = null;
  const m = openModal(`
    <div class="modal-head"><h2>Add an album</h2>${closeBtn()}</div>
    <div class="seg add-mode" role="tablist">
      <button type="button" role="tab" data-mode="log">${ICON.check} I've listened</button>
      <button type="button" role="tab" data-mode="queue">${ICON.queue} Up next</button>
    </div>
    <label class="search-field big"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="addQ" type="search" placeholder="Search for an album or artist…" autocomplete="off" value="${esc(query)}"></label>
    <div class="results" id="results"></div>
    <form id="addForm" class="form">
      <div class="form-cover"><div id="addCover"></div></div>
      <label class="field"><span>Artist</span><input name="artist" required autocomplete="off"></label>
      <label class="field"><span>Album</span><input name="title" autocomplete="off"></label>
      <div class="log-only">
        <label class="field"><span>Standout songs <small>optional, comma separated</small></span><input name="songs" autocomplete="off"></label>
        <div class="row">
          <label class="field"><span>Release year</span><select name="year">${yearOptions(year)}</select></label>
          <label class="check"><input type="checkbox" name="fav"> ${ICON.heart} Favourite</label>
        </div>
      </div>
      <p class="muted queue-only queue-hint">Just an artist is fine too. It'll wait in Up next until you've heard it.</p>
      <p class="warn" id="dupWarn" hidden></p>
      <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="addSubmit">Add album</button></div>
    </form>`, 'wide');
  const form = $('#addForm', m);
  const F = form.elements;
  const q = $('#addQ', m);
  const results = $('#results', m);
  const setMode = (next) => {
    mode = next;
    m.querySelector('.modal').dataset.mode = mode;
    $$('[data-mode]', m).forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    $('.modal-head h2', m).textContent = mode === 'queue' ? 'Add to Up next' : 'Add an album';
    $('#addSubmit', m).textContent = mode === 'queue' ? 'Add to Up next' : 'Add to log';
    checkDup();
  };
  $$('[data-mode]', m).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  const coverPreview = () => {
    const al = { id: 'preview', artist: F.artist.value, title: F.title.value };
    $('#addCover', m).innerHTML = `<div class="cover md" style="background:${placeholder(al)}"><span class="cover-initial">${esc((al.title || al.artist || '?').slice(0, 1).toUpperCase())}</span>${chosen?.art ? `<img src="${esc(chosen.art)}" alt="">` : ''}</div>`;
    checkDup();
  };
  const checkDup = () => {
    const w = $('#dupWarn', m);
    if (mode === 'queue') {
      const inQueue = data.toListen.find((x) => queueMatches(x, { artist: F.artist.value, title: F.title.value }));
      w.hidden = !inQueue || !F.artist.value;
      if (!w.hidden) w.textContent = "That's already in Up next.";
      return;
    }
    const y = data.years[F.year.value];
    const dup = y && y.albums.find((x) => norm(x.artist) === norm(F.artist.value) && norm(x.title) === norm(F.title.value));
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
    if (mode === 'log') F.songs.focus();
  });
  F.artist.addEventListener('input', () => { chosen = null; coverPreview(); });
  F.title.addEventListener('input', () => { chosen = null; coverPreview(); });
  F.year.addEventListener('change', checkDup);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (mode === 'queue') {
      const item = { id: store.uid(), artist: F.artist.value.trim(), title: F.title.value.trim(), added: new Date().toISOString().slice(0, 10) };
      if (chosen?.art) item.art = chosen.art;
      if (chosen?.spotify) item.spotify = chosen.spotify;
      data.toListen.unshift(item);
      store.commit();
      closeModal(m, true);
      toast('Added to Up next');
      render();
      if (!item.art) requestArt(item);
      return;
    }
    const y = store.ensureYear(F.year.value);
    const album = { id: store.uid(), artist: F.artist.value.trim(), title: F.title.value.trim(), songs: splitSongs(F.songs.value) };
    if (chosen?.art) album.art = chosen.art;
    if (chosen?.spotify) album.spotify = chosen.spotify;
    y.albums.push(album);
    if (F.fav.checked) y.favourites.push({ albumId: album.id, song: album.songs[0] || '' });
    const cleared = clearFromQueue(album, fromQueue);
    store.commit();
    closeModal(m, true);
    toast(cleared ? `Added to ${F.year.value} and ticked off Up next` : `Added to ${F.year.value}`);
    if (location.hash !== `#/year/${F.year.value}`) location.hash = `#/year/${F.year.value}`;
    else render();
    if (!album.art) requestArt(album);
  });
  setMode(mode);
  coverPreview();
  if (query) search();
  q.focus();
}

// ------------------------------------------------------------------ to listen / always

// ---- Up next (the "to listen" queue) ----
// Items are { id, artist, title, art?, spotify?, added? }. Older data stored
// plain strings, which are converted on load.

function normaliseQueue() {
  let changed = false;
  data.toListen = (data.toListen || []).map((x) => {
    if (typeof x !== 'string') return x;
    changed = true;
    const m = x.match(/^(.+?)['’]s\s+["“](.+?)\.?["”]$/); // Artist's "Album"
    // Stable id from the text, so covers cached on this device still line up
    // on the next load even before the converted queue is saved.
    let h = 0;
    for (const ch of x) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const id = `q${h.toString(36)}`;
    return m ? { id, artist: m[1].trim(), title: m[2].trim() } : { id, artist: x.trim(), title: '' };
  });
  if (changed && store.canSync()) store.commit({ quiet: true, delay: 3000 });
}

// Does a queued item refer to this album? A queued artist with no album
// matches any album by that artist.
function queueMatches(item, album) {
  const ia = norm(item.artist), aa = norm(album.artist);
  if (!ia || !aa || !(ia === aa || (ia.length > 3 && aa.includes(ia)) || (aa.length > 3 && ia.includes(aa)))) return false;
  if (!item.title) return true;
  const it = norm(item.title), at = norm(album.title);
  return !!at && (it === at || it.includes(at) || at.includes(it));
}

// Remove the queue item this album came from, plus any that match it.
function clearFromQueue(album, fromId) {
  const before = data.toListen.length;
  data.toListen = data.toListen.filter((x) => x.id !== fromId && !queueMatches(x, album));
  return before - data.toListen.length;
}

const queueName = (x) => x.title || x.artist;
const queueSub = (x) => (x.title ? x.artist : 'artist');

function upNextHtml() {
  const items = data.toListen;
  return `<section class="upnext">
    <div class="upnext-head">
      <h2>Up next${items.length ? ` <span>${items.length}</span>` : ''}</h2>
      <div class="upnext-actions">
        <button class="link-btn" data-queue-add>${ICON.plus} Add</button>
        ${items.length ? '<a class="link-btn" href="#/up-next">See all</a>' : ''}
      </div>
    </div>
    ${items.length ? `<div class="upnext-strip">${items.slice(0, 15).map((x) => `
      <button class="q-card" data-queue="${x.id}">
        ${coverHtml(x)}
        <span class="q-title">${esc(queueName(x))}</span>
        <span class="q-sub">${esc(queueSub(x))}</span>
      </button>`).join('')}
      ${items.length > 15 ? `<a class="q-more" href="#/up-next">+${items.length - 15}<small>more</small></a>` : ''}
    </div>` : '<p class="muted upnext-empty">Nothing queued. Add an album or artist you want to hear.</p>'}
  </section>`;
}

function openQueueItem(id) {
  const item = data.toListen.find((x) => x.id === id);
  if (!item) return;
  const m = openModal(`
    ${closeBtn('floating')}
    <div class="detail">
      ${coverHtml(item, 'xl')}
      <div class="detail-info">
        <p class="eyebrow">up next${item.added ? ` · added ${esc(item.added)}` : ''}</p>
        <h2 class="detail-title">${esc(queueName(item))}</h2>
        <p class="detail-artist">${item.title ? esc(item.artist) : 'Artist to check out'}</p>
        <div class="detail-actions">
          <a class="btn spotify" href="${esc(item.title ? spotifyUrl(item) : (item.spotify || spotifyArtistUrl(item.artist)))}" target="_blank" rel="noopener">${ICON.spotify} Play on Spotify</a>
          <button class="btn primary" id="heardIt">${ICON.check} I've listened</button>
        </div>
        <p class="muted small-print">“I've listened” moves it into your log and takes it off Up next.</p>
        <div class="detail-foot">
          <button class="link-btn danger" id="dropIt">${ICON.trash} Remove from Up next</button>
        </div>
      </div>
    </div>`, 'detail-modal');
  watchCovers(m);
  requestArt(item);
  $('#heardIt', m).addEventListener('click', () => {
    closeModal(m, true);
    addAlbum({ query: `${item.artist} ${item.title}`.trim(), fromQueue: item.id, year: String(new Date().getFullYear()) });
  });
  $('#dropIt', m).addEventListener('click', () => {
    data.toListen = data.toListen.filter((x) => x.id !== id);
    store.commit();
    closeModal(m);
    toast('Removed from Up next');
  });
  m.onClose = () => render();
}

function renderUpNext() {
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">to listen</p><h1>up next</h1>
      <p class="hero-stats"><b>${data.toListen.length}</b> waiting to be heard</p></div>
      <button class="btn primary" data-queue-add>${ICON.plus} Add to Up next</button></section>
    ${data.toListen.length ? `<div class="rows">${data.toListen.map((x) => `
      <div class="row-item">
        <button class="row-open" data-queue="${x.id}">
          ${coverHtml(x, 'sm')}
          <span class="row-meta"><span class="row-title">${esc(queueName(x))}</span><span class="row-artist">${x.title ? esc(x.artist) : '<i>artist</i>'}</span></span>
        </button>
        <button class="btn small" data-heard="${x.id}" title="Log it as listened">${ICON.check}<span class="hide-sm"> Listened</span></button>
        <button class="icon-btn subtle" data-drop="${x.id}" title="Remove">${ICON.close}</button>
      </div>`).join('')}</div>`
      : '<div class="empty"><h2>Nothing queued</h2><p>Add albums or artists you want to hear, and tick them off when you have.</p></div>'}`;
  watchCovers();
  app.querySelector('.rows')?.addEventListener('click', (e) => {
    const drop = e.target.closest('[data-drop]');
    const heard = e.target.closest('[data-heard]');
    if (drop) {
      data.toListen = data.toListen.filter((x) => x.id !== drop.dataset.drop);
      store.commit();
      renderUpNext();
      toast('Removed from Up next');
    }
    if (heard) {
      const item = data.toListen.find((x) => x.id === heard.dataset.heard);
      addAlbum({ query: `${item.artist} ${item.title}`.trim(), fromQueue: item.id, year: String(new Date().getFullYear()) });
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
    <div class="search-tools">${viewToggleHtml()}</div>
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
      return hits.length ? `<h3 class="group-title"><a href="#/year/${y}">${y}</a></h3>${albumsHtml(hits, yd)}` : '';
    }).join('');
    $('#gres').innerHTML = total ? html : `<p class="muted pad">No albums match “${esc(input.value)}”.</p>`;
    watchCovers();
  };
  input.addEventListener('input', draw);
  bindViewToggle(app, draw);
  draw();
  input.focus();
}

// ------------------------------------------------------------------ settings

function openSettings() {
  if (!data) return;
  const user = store.currentUser();
  const { status, lastError } = store.getStatus();
  const statusText = {
    saved: 'Every change is saved to your account, so it shows up wherever you sign in.',
    saving: 'Saving…',
    error: `The last save failed: ${lastError}. Your edits are kept on this device and will be saved again.`,
  }[status] || 'Every change is saved to your account, so it shows up wherever you sign in.';
  const m = openModal(`
    <div class="modal-head"><h2>Settings</h2>${closeBtn()}</div>
    <div class="account-box">
      ${user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((user.displayName || user.email || '?').slice(0, 1).toUpperCase())}</span>`}
      <div><b>${esc(user.displayName || user.email || 'Signed in')}</b>${user.displayName && user.email ? `<small>${esc(user.email)}</small>` : ''}</div>
      <button type="button" class="btn small" id="signOutBtn">Sign out</button>
    </div>
    ${spotify.configured() ? `<div class="spotify-box">
      ${ICON.spotify}
      <div><b>Spotify</b><small>${spotify.connected()
        ? 'Logged in. Artwork and exact album links come from Spotify.'
        : 'Log in so artwork and exact album links come from Spotify.'}${spotify.lastError ? `<br>Last Spotify error: ${esc(spotify.lastError)}` : ''}</small></div>
      <button type="button" class="btn ${spotify.connected() ? '' : 'spotify'} small" id="spotifyBtn">${spotify.connected() ? 'Log out' : 'Log in'}</button>
    </div>` : ''}
    <p class="status-line ${status}"><span class="sync-dot ${status}"></span>${esc(statusText)}</p>
    <p class="warn" id="cfgErr" hidden></p>
    <div class="form-actions">
      <label class="btn" id="restore">Restore backup<input type="file" accept="application/json,.json" hidden></label>
      <button type="button" class="btn" id="export">Download backup</button>
    </div>`);
  $('#export', m).addEventListener('click', store.exportJson);
  $('#spotifyBtn', m)?.addEventListener('click', () => {
    if (spotify.connected()) { spotify.logout(); closeModal(m); toast('Logged out of Spotify'); }
    else spotify.login();
  });
  $('#signOutBtn', m).addEventListener('click', async () => {
    store.flush();
    await store.signOut();
    location.hash = '';
    location.reload();
  });
  $('#restore input', m).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !confirm('Replace your whole log with this backup? Download a backup of the current one first if you might want it back.')) return;
    const err = $('#cfgErr', m);
    err.hidden = true;
    try {
      await store.replaceAll(JSON.parse(await file.text()));
      data = store.getData();
      closeModal(m);
      toast('Backup restored');
      render();
    } catch (ex) { err.hidden = false; err.textContent = ex.message; }
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
  const q = e.target.closest('[data-queue]');
  if (q) openQueueItem(q.dataset.queue);
  if (e.target.closest('[data-queue-add]')) addAlbum({ mode: 'queue' });
});
$('#addBtn').addEventListener('click', () => data && addAlbum());
$('#searchBtn').addEventListener('click', () => (location.hash = '#/search'));
$('#settingsBtn').addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const last = modalRoot.lastElementChild; if (last) closeModal(last); return; }
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (modalRoot.children.length || !isStarted) return;
  if (e.key === 'n') { e.preventDefault(); addAlbum(); }
  if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
});

boot();
