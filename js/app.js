import * as store from './store.js?v=21';
import * as spotify from './spotify.js?v=21';
import { queueArt, prioritise, searchAlbums, findAlbums, findRelease, findSpotifyLink, spotifyUrl, spotifyArtistUrl, placeholder, norm, artVersion, findTrack, bestSongs, findTracklist, cleanSong } from './art.js?v=21';

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
  sort: '<svg viewBox="0 0 24 24"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M4 6h12M4 11h12M4 16h7"/><path d="m15 14 5 3-5 3z" fill="currentColor"/></svg>',
  grip: '<svg viewBox="0 0 24 24" class="fill"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

// True while a friend's library is on screen: everything is read only.
const ro = () => !!store.viewingFriend();
const friendName = () => store.viewingFriend()?.name || 'A friend';
const possessive = (name) => `${name}’${/s$/i.test(name) ? '' : 's'}`;

let data;
let ui = { sort: 'latest', filter: '', view: 'grid' };
try { ui.view = localStorage.getItem('music-log:view') || 'grid'; } catch {}
let sortable = null;
let resumePlaylist = ''; // year whose playlist to make once we're back from a Spotify login

// ------------------------------------------------------------------ boot

async function boot() {
  app.innerHTML = '<div class="loading"><span class="spin"></span>Loading your records…</div>';
  let spotifyMsg = '';
  try {
    const back = await spotify.handleRedirect();
    if (typeof back === 'string' && back.startsWith('playlist:')) resumePlaylist = back.slice(9);
    else if (back) spotifyMsg = 'Logged in to Spotify';
  }
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
    try {
      if (ro()) { await store.viewFriend(store.viewingFriend().uid); render(); }
      else if (await store.refresh()) { data = store.getData(); render(); }
    } catch {}
  });
  render();
  if (resumePlaylist && !ro()) {
    const year = resumePlaylist;
    resumePlaylist = '';
    if (data.years[year]) makePlaylist(year);
  }
}

// ------------------------------------------------------------------ sign in

const GOOGLE_ICON = '<svg viewBox="0 0 24 24" class="g-icon" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.7 14a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 9.9L5.7 14Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4Z"/></svg>';

function renderSignedOutShell() {
  document.body.classList.add('signed-out');
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
      <h1>Your music library</h1>
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
  const friend = store.viewingFriend();
  document.body.classList.toggle('viewing', !!friend);
  const bar = $('#viewBar');
  bar.hidden = !friend;
  if (friend) {
    bar.innerHTML = `<span>You're looking at <b>${esc(possessive(friend.name))}</b> library</span>
      <button type="button" class="btn small" data-view-own>Back to mine</button>`;
  }
}

// ------------------------------------------------------------------ routing

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return parts;
}

function render() {
  const [page, a, b] = route();
  const years = shownYears();
  if (sortable) { sortable.destroy(); sortable = null; }
  closeYearMenu();
  navActive = page === 'year' ? a : page ? page : years[0];
  if (!page) return renderYear(years[0], 'listened');
  if (page === 'year' && data.years[a]) return renderYear(a, b || 'listened');
  if ((page === 'up-next' || page === 'to-listen') && !ro()) return renderUpNext();
  if (page === 'search') return renderSearch(a || '');
  if (page === 'friend' && a) return acceptCode(a);
  location.hash = '#/';
}

// Years worth showing: any with albums, plus this year so there's always
// somewhere to land. Adding an album files it under its release year, which
// creates that year if it's new.
function shownYears() {
  const now = String(new Date().getFullYear());
  return store.years().filter((y) => y === now || data.years[y].albums.length || data.years[y].favourites.length)
    .concat(data.years[now] ? [] : [now]).sort((a, b) => b - a);
}

// The page heading ("2026 ▾") is the one and only year switcher.
let navActive = '';
const yearMenuBtn = (label) => `<button type="button" class="hero-year" data-year-menu aria-haspopup="true" aria-expanded="false" title="Switch year">${esc(label)}${ICON.chevron}</button>`;

function openYearMenu(btn) {
  if (closeYearMenu()) return;
  const now = String(new Date().getFullYear());
  const queued = (data.toListen || []).length;
  const menu = document.createElement('div');
  menu.className = 'year-menu';
  menu.id = 'yearMenu';
  menu.innerHTML = shownYears().map((y) => {
    const n = data.years[y]?.albums.length || 0;
    return `<a href="#/year/${y}" class="${y === navActive ? 'on' : ''}"><b>${y}</b><small>${n ? `${n} album${n === 1 ? '' : 's'}` : y === now ? 'nothing yet' : ''}</small></a>`;
  }).join('') + (ro() ? '' : `<span class="menu-sep"></span><a href="#/up-next" class="${navActive === 'up-next' || navActive === 'to-listen' ? 'on' : ''}"><b>Up next</b><small>${queued ? `${queued} waiting` : 'empty'}</small></a>`);
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top = `${r.bottom + scrollY + 8}px`;
  menu.style.left = `${Math.max(12, Math.min(r.left, innerWidth - menu.offsetWidth - 12))}px`;
  btn.setAttribute('aria-expanded', 'true');
  menu.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => menu.classList.add('in'));
}

function closeYearMenu() {
  const menu = $('#yearMenu');
  if (!menu) return false;
  menu.remove();
  $$('[data-year-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  return true;
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
  if (!store.canSync() || !spotify.connected() || ro()) return;
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
  if (ro()) {
    album.art = url; // this visit only; a friend's library is never saved from here
  } else if (store.canSync()) {
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

// One button that flips between grid and list; it shows the view you'd switch to.
const viewBtnInner = () => (ui.view === 'grid' ? ICON.list : ICON.grid);
const viewLabel = () => (ui.view === 'grid' ? 'Show as list' : 'Show as grid');
const viewToggleHtml = () => `<button type="button" class="tool-btn" data-view-toggle title="${viewLabel()}" aria-label="${viewLabel()}">${viewBtnInner()}</button>`;

function bindViewToggle(root, redraw) {
  const b = root.querySelector('[data-view-toggle]');
  b?.addEventListener('click', () => {
    ui.view = ui.view === 'grid' ? 'list' : 'grid';
    try { localStorage.setItem('music-log:view', ui.view); } catch {}
    b.innerHTML = viewBtnInner();
    b.title = viewLabel();
    b.setAttribute('aria-label', viewLabel());
    redraw();
  });
}

function renderYear(year, tab) {
  const y = data.years[year];
  const favCount = y.favourites.length;
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">${ro() ? `${esc(possessive(friendName()))} albums from` : 'albums released in'}</p>
        <h1>${yearMenuBtn(year)}</h1>
      </div>
    </section>
    <nav class="tabs" role="tablist">
      <a role="tab" href="#/year/${year}" class="${tab === 'listened' ? 'on' : ''}" aria-selected="${tab === 'listened'}">Listened <span>${y.albums.length}</span></a>
      <a role="tab" href="#/year/${year}/favourites" class="${tab === 'favourites' ? 'on' : ''}" aria-selected="${tab === 'favourites'}">Favourites <span>${favCount}</span></a>
    </nav>
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
        ${ICON.search}
        <input id="filter" type="search" placeholder="Filter albums" aria-label="Filter ${year}" value="${esc(ui.filter)}" autocomplete="off">
      </label>
      <label class="tool-btn" title="Sort">
        ${ICON.sort}
        <select id="sort" aria-label="Sort">
          <option value="latest">Latest first</option>
          <option value="order">Listening order</option>
          <option value="artist">Artist A–Z</option>
          <option value="favs">Favourites first</option>
        </select>
      </label>
      ${viewToggleHtml()}
    </div>
    <div id="grid"></div>`;
  if (!ro() && year === store.years()[0] && data.toListen.length) body.insertAdjacentHTML('afterbegin', upNextHtml());
  $('#sort').value = ui.sort;
  const sortTitle = () => { $('#sort').parentElement.title = `Sort: ${$('#sort').selectedOptions[0].text}`; };
  sortTitle();
  const draw = () => {
    const list = sortedAlbums(y);
    $('#grid').innerHTML = list.length
      ? albumsHtml(list, y)
      : y.albums.length
        ? `<p class="muted pad">Nothing in ${year} matches “${esc(ui.filter)}”.</p>`
        : ro()
          ? `<div class="empty"><h2>Nothing logged for ${year} yet</h2><p>${esc(friendName())} hasn't added any albums from ${year}.</p></div>`
          : `<div class="empty"><h2>Nothing logged for ${year} yet</h2><p>Add the first album you listen to.</p><button class="btn primary" data-add="${year}">${ICON.plus} Add album</button></div>`;
    watchCovers();
  };
  $('#filter').addEventListener('input', (e) => { ui.filter = e.target.value; draw(); });
  $('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; sortTitle(); draw(); toast(e.target.selectedOptions[0].text); });
  bindViewToggle(body, draw);
  draw();
}

function renderFavourites(year) {
  const y = data.years[year];
  const body = $('#yearBody');
  const byId = Object.fromEntries(y.albums.map((a) => [a.id, a]));
  const favs = y.favourites.filter((f) => byId[f.albumId]);
  if (ro()) {
    body.innerHTML = favs.length
      ? `<ol class="favs read-only" id="favList">${favs.map((f, i) => favRowHtml(byId[f.albumId], f, i)).join('')}</ol>`
      : `<div class="empty"><h2>No favourites for ${year} yet</h2><p>${esc(friendName())} hasn't picked any yet.</p></div>`;
    watchCovers();
    return;
  }
  const canPlaylist = spotify.configured() && favs.some((f) => bestSongs(f.song).length);
  body.innerHTML = `
    <div class="fav-head">
      <p class="muted">${favs.length ? 'Drag to reorder' : ''}</p>
      <div class="fav-actions">
        ${canPlaylist ? `<button class="btn small" id="makePlaylist" title="Put every best song from these albums into a Spotify playlist">${ICON.spotify} Make playlist</button>` : ''}
        <button class="btn small" id="addFav">${ICON.plus} Add</button>
      </div>
    </div>
    ${favs.length ? `<ol class="favs" id="favList">${favs.map((f, i) => favRowHtml(byId[f.albumId], f, i)).join('')}</ol>`
      : `<div class="empty"><h2>No favourites for ${year} yet</h2>
         <p>Open any album and tap the heart, or pick from this year's list.</p></div>`}`;
  $('#addFav').addEventListener('click', () => pickFavourite(year));
  $('#makePlaylist')?.addEventListener('click', () => makePlaylist(year));
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
  bindSongPicker(list, (el) => y.favourites.find((x) => x.albumId === el.closest('.fav').dataset.id));
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
  if (ro()) {
    return `<li class="fav" data-id="${album.id}">
    <span class="fav-rank">${i + 1}</span>
    <button class="fav-cover" data-open="${album.id}">${coverHtml(album)}</button>
    <div class="fav-main">
      <button class="fav-title" data-open="${album.id}">${esc(album.title || album.artist)}</button>
      <span class="fav-artist">${esc(album.artist)}</span>
      ${bestSongs(fav.song).length ? `<ul class="song-chips">${songChipsHtml(fav, false)}</ul>` : ''}
    </div>
    <a class="icon-btn spot" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener" title="Play on Spotify">${ICON.spotify}</a>
  </li>`;
  }
  return `<li class="fav" data-id="${album.id}">
    <span class="grip" title="Drag to reorder">${ICON.grip}</span>
    <span class="fav-rank">${i + 1}</span>
    <button class="fav-cover" data-open="${album.id}">${coverHtml(album)}</button>
    <div class="fav-main">
      <button class="fav-title" data-open="${album.id}">${esc(album.title || album.artist)}</button>
      <span class="fav-artist">${esc(album.artist)}</span>
      ${songPickerHtml(album, fav, `songs-${album.id}`)}
    </div>
    <a class="icon-btn spot" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener" title="Play on Spotify">${ICON.spotify}</a>
    <button class="icon-btn subtle" data-unfav="${album.id}" title="Remove from favourites">${ICON.close}</button>
  </li>`;
}

// ------------------------------------------------------------------ playlists

// Finds every best song from a year's favourites on Spotify and puts them, in
// favourites order, into a "YYYY Favourite Songs" playlist in the user's own
// account. Running it again updates the same playlist.
async function makePlaylist(year) {
  if (!spotify.hasScopes(spotify.PLAYLIST_SCOPES)) {
    const m = openModal(`
      <div class="modal-head"><h2>Make a Spotify playlist</h2>${closeBtn()}</div>
      <p>${spotify.connected()
        ? 'Spotify needs one more permission first, so the app can create and update playlists in your account.'
        : 'Log in to Spotify first, so the app can create the playlist in your account.'}
        You'll come straight back here and the playlist will be made.</p>
      <div class="form-actions"><button type="button" class="btn spotify" id="goSpotify">${ICON.spotify} Continue to Spotify</button></div>`);
    $('#goSpotify', m).addEventListener('click', () => spotify.login({ scopes: spotify.PLAYLIST_SCOPES, then: `playlist:${year}` }));
    return;
  }
  const y = data.years[year];
  const byId = Object.fromEntries(y.albums.map((a) => [a.id, a]));
  const favs = y.favourites.filter((f) => byId[f.albumId]);
  const wanted = favs.flatMap((f) => bestSongs(f.song).map((song) => ({ album: byId[f.albumId], song })));
  const noSong = favs.filter((f) => !bestSongs(f.song).length).map((f) => byId[f.albumId]);
  const name = `${year} Favourite Songs`;

  const m = openModal(`
    <div class="modal-head"><h2>${esc(name)}</h2>${closeBtn()}</div>
    <div class="playlist-progress"><span class="spin"></span><span id="plStatus">Finding songs on Spotify…</span></div>
    <div id="plResult"></div>`);
  const status = $('#plStatus', m);
  let cancelled = false;
  m.onClose = () => { cancelled = true; };

  try {
    const found = new Array(wanted.length);
    let next = 0, done = 0;
    const worker = async () => {
      while (next < wanted.length && !cancelled) {
        const i = next++;
        try { found[i] = await findTrack(wanted[i].album, wanted[i].song); }
        catch (e) { if (e.status === 401 || e.status === 403) throw e; found[i] = null; }
        status.textContent = `Finding songs on Spotify… ${++done} of ${wanted.length}`;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (cancelled) return;
    const uris = [...new Set(found.filter(Boolean).map((t) => t.uri))];
    const missed = wanted.filter((_, i) => !found[i]);
    if (!uris.length) throw new Error('None of the best songs could be found on Spotify.');
    status.textContent = 'Saving the playlist…';
    const description = `The best song from each of my favourite albums of ${year}, in order. Made with Music Library.`;
    const { url, created } = await spotify.upsertPlaylist(name, description, uris);
    if (cancelled) return;
    $('.playlist-progress', m).remove();
    $('#plResult', m).innerHTML = `
      <p class="playlist-done">${ICON.check} ${created ? 'Made' : 'Updated'} with ${uris.length} song${uris.length === 1 ? '' : 's'}${missed.length ? `, but ${missed.length} couldn't be found` : ''}.</p>
      ${missed.length ? `<div class="playlist-missed"><b>Not found on Spotify</b>
        <ul>${missed.map((w) => `<li><span>${esc(w.song)}</span><small>${esc(w.album.title || w.album.artist)} · ${esc(w.album.artist)}</small></li>`).join('')}</ul>
        <small class="muted">Check the spelling of the best song, or add these in Spotify by hand.</small></div>` : ''}
      ${noSong.length ? `<p class="muted small-print">${noSong.length} favourite${noSong.length === 1 ? ' has' : 's have'} no best song yet: ${noSong.map((a) => esc(a.title || a.artist)).join(', ')}.</p>` : ''}
      <div class="form-actions"><a class="btn spotify" href="${esc(url)}" target="_blank" rel="noopener">${ICON.spotify} Open in Spotify</a></div>`;
  } catch (e) {
    if (cancelled) return;
    const needsLogin = e.status === 401 || e.status === 403;
    $('.playlist-progress', m)?.remove();
    $('#plResult', m).innerHTML = `
      <p class="warn">Couldn't make the playlist: ${esc(e.message)}</p>
      ${e.status === 403 ? `<p class="muted small-print">If this keeps happening, your Spotify account may need adding to the app's allowed users (the app owner can do this in the Spotify developer dashboard).</p>` : ''}
      <div class="form-actions">${needsLogin
        ? `<button type="button" class="btn spotify" id="plRetry">${ICON.spotify} Log in to Spotify again</button>`
        : `<button type="button" class="btn" id="plRetry">Try again</button>`}</div>`;
    $('#plRetry', m).addEventListener('click', () => {
      if (needsLogin) spotify.login({ scopes: spotify.PLAYLIST_SCOPES, then: `playlist:${year}` });
      else { closeModal(m, true); makePlaylist(year); }
    });
  }
}

// ------------------------------------------------------------------ best songs

// A favourite can have several best songs. Each shows as a chip, with a box
// underneath for adding another. They're stored in fav.song joined with "; "
// so older copies of the app and friends' views still show them.
function songChipsHtml(fav, editable = true) {
  return bestSongs(fav.song).map((s, i) => `<li class="song-chip"><span>♪ ${esc(s)}</span>${editable
    ? `<button type="button" data-rm-song="${i}" title="Remove ${esc(s)}" aria-label="Remove ${esc(s)}">${ICON.close}</button>` : ''}</li>`).join('');
}

function songPickerHtml(album, fav, listId) {
  const n = bestSongs(fav.song).length;
  return `<div class="song-picker" data-album="${album.id}">
    <ul class="song-chips">${songChipsHtml(fav)}</ul>
    <div class="song-add">
      <input class="song-input" placeholder="${n ? '+ Add another song' : 'Best song…'}" aria-label="${n ? 'Add another best song' : 'Best song'}" list="${listId}" enterkeyhint="done" autocomplete="off">
      ${album.title ? `<button type="button" class="tl-toggle" aria-expanded="false" title="Pick songs from the album's tracklist">${ICON.list}<span>Tracklist</span></button>` : ''}
    </div>
    <datalist id="${listId}">${(album.songs || []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="tracklist" hidden></div>
  </div>`;
}

const fmtTime = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}` : '');
const songKey = (t) => norm(cleanSong(t));

function tracklistHtml(tracks, fav) {
  const picked = new Set(bestSongs(fav.song).map(songKey));
  const discs = new Set(tracks.map((t) => t.disc)).size > 1;
  let html = '', disc = null;
  tracks.forEach((t, i) => {
    if (discs && t.disc !== disc) { disc = t.disc; html += `<li class="tl-disc">Disc ${disc}</li>`; }
    const on = picked.has(songKey(t.name));
    html += `<li><button type="button" class="tl-track${on ? ' on' : ''}" data-track="${i}" aria-pressed="${on}">
      <span class="tl-no">${t.no || i + 1}</span><span class="tl-name">${esc(cleanSong(t.name))}</span>
      <span class="tl-time">${fmtTime(t.ms)}</span><span class="tl-mark">${on ? ICON.check : ICON.plus}</span></button></li>`;
  });
  return `<div class="tl-head"><span>Tap the songs you love</span><button type="button" class="link-btn tl-done">Done</button></div><ol class="tl-list">${html}</ol>`;
}

// favFor(element) returns the favourite that a picker inside `root` belongs to.
function bindSongPicker(root, favFor) {
  const redraw = (picker, fav) => {
    const n = bestSongs(fav.song).length;
    $('.song-chips', picker).innerHTML = songChipsHtml(fav);
    const input = $('.song-input', picker);
    input.placeholder = n ? '+ Add another song' : 'Best song…';
    input.setAttribute('aria-label', n ? 'Add another best song' : 'Best song');
    const picked = new Set(bestSongs(fav.song).map(songKey));
    const tracks = $('.tracklist', picker)._tracks || [];
    picker.querySelectorAll('.tl-track').forEach((b) => {
      const on = picked.has(songKey(tracks[b.dataset.track]?.name));
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      $('.tl-mark', b).innerHTML = on ? ICON.check : ICON.plus;
    });
  };
  const save = (picker, fav, songs, message) => {
    fav.song = songs.join('; ');
    redraw(picker, fav);
    store.commit({ quiet: true });
    toast(message);
  };
  const add = (input) => {
    const fresh = bestSongs(input.value);
    input.value = '';
    if (!fresh.length) return;
    const fav = favFor(input);
    const songs = bestSongs(fav.song);
    const have = new Set(songs.map((x) => norm(x)));
    for (const x of fresh) if (!have.has(norm(x))) { songs.push(x); have.add(norm(x)); }
    save(input.closest('.song-picker'), fav, songs, songs.length > 1 ? 'Best songs saved' : 'Best song saved');
  };
  const openTracklist = async (picker, btn) => {
    const panel = $('.tracklist', picker);
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (!open || panel._tracks) return;
    const found = store.findAlbum(picker.dataset.album);
    if (!found) return;
    panel.innerHTML = '<div class="tl-status"><span class="spin"></span>Finding the tracklist…</div>';
    try {
      const tracks = await findTracklist(found.album);
      if (!tracks.length) throw new Error('none');
      panel._tracks = tracks;
      panel.innerHTML = tracklistHtml(tracks, favFor(picker));
      // Typing a song suggests from the tracklist too.
      const dl = picker.querySelector('datalist');
      const seen = new Set();
      dl.innerHTML = [...(found.album.songs || []), ...tracks.map((t) => cleanSong(t.name))]
        .filter((x) => !seen.has(norm(x)) && seen.add(norm(x))).map((x) => `<option value="${esc(x)}">`).join('');
    } catch (e) {
      panel.innerHTML = `<div class="tl-status">${e.message === 'rate limited' ? 'Too many lookups just now. Try again in a minute.' : "Couldn't find this album's tracklist. Type the song instead."}</div>`;
    }
  };
  root.addEventListener('change', (e) => { if (e.target.matches('.song-input')) add(e.target); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.song-input')) { e.preventDefault(); add(e.target); }
  });
  root.addEventListener('click', (e) => {
    const picker = e.target.closest('.song-picker');
    if (!picker) return;
    const toggle = e.target.closest('.tl-toggle');
    if (toggle) { e.stopPropagation(); openTracklist(picker, toggle); return; }
    if (e.target.closest('.tl-done')) {
      e.stopPropagation();
      $('.tracklist', picker).hidden = true;
      $('.tl-toggle', picker)?.setAttribute('aria-expanded', 'false');
      return;
    }
    const track = e.target.closest('[data-track]');
    if (track) {
      e.stopPropagation();
      const t = $('.tracklist', picker)._tracks?.[track.dataset.track];
      if (!t) return;
      const fav = favFor(picker);
      const songs = bestSongs(fav.song);
      const i = songs.findIndex((x) => songKey(x) === songKey(t.name));
      if (i >= 0) { songs.splice(i, 1); save(picker, fav, songs, 'Best song removed'); }
      else { songs.push(cleanSong(t.name)); save(picker, fav, songs, songs.length > 1 ? 'Best songs saved' : 'Best song saved'); }
      return;
    }
    const rm = e.target.closest('[data-rm-song]');
    if (!rm) return;
    e.stopPropagation();
    const fav = favFor(rm);
    const songs = bestSongs(fav.song);
    songs.splice(Number(rm.dataset.rmSong), 1);
    save(picker, fav, songs, 'Best song removed');
  });
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
  if (ro()) return openFriendAlbum(id);
  const found = store.findAlbum(id);
  if (!found) return;
  const { year, album, yearData } = found;
  const rank = store.favRank(yearData, id);
  const fav = yearData.favourites.find((f) => f.albumId === id);
  const queued = data.toListen.find((x) => x.albumId === id);
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
          <button class="btn queue ${queued ? 'on' : ''}" id="queueToggle" aria-pressed="${!!queued}">${queued ? ICON.check : ICON.queue}<span>${queued ? 'In Up next' : 'Add to Up next'}</span></button>
        </div>
        ${rank ? `<div class="field" id="bestSongField"><span>Best songs</span>${songPickerHtml(album, fav, 'detailSongs')}</div>` : ''}
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
  $('#queueToggle', m).addEventListener('click', () => {
    if (queued) {
      data.toListen = data.toListen.filter((x) => x.albumId !== id);
      toast('Taken off Up next');
    } else {
      const item = { id: store.uid(), albumId: id, artist: album.artist, title: album.title, added: new Date().toISOString().slice(0, 10) };
      const art = artFor(album);
      if (art) item.art = art;
      if (album.spotify) item.spotify = album.spotify;
      data.toListen.unshift(item);
      toast('Added to Up next');
    }
    store.commit();
    closeModal(m, true);
    openAlbum(id);
  });
  if ($('#bestSongField', m)) bindSongPicker($('#bestSongField', m), () => fav);
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

// An album in a friend's library: look, play, or queue it in your own Up next.
function openFriendAlbum(id) {
  const found = store.findAlbum(id);
  if (!found) return;
  const { year, album, yearData } = found;
  const rank = store.favRank(yearData, id);
  const fav = yearData.favourites.find((f) => f.albumId === id);
  const mine = store.ownData();
  const inQueue = () => mine.toListen.find((x) => queueMatches(x, album));
  const m = openModal(`
    ${closeBtn('floating')}
    <div class="detail">
      ${coverHtml(album, 'xl')}
      <div class="detail-info">
        <p class="eyebrow"><a href="#/year/${year}">${year}</a>${rank ? ` · <span class="accent">${esc(possessive(friendName()))} #${rank}</span>` : ''}</p>
        <h2 class="detail-title">${esc(album.title || album.artist)}</h2>
        <p class="detail-artist">${album.title ? esc(album.artist) : 'No album noted'}</p>
        ${(album.songs || []).length ? `<div class="chips">${album.songs.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
        ${bestSongs(fav?.song).length ? `<div class="best-song"><span>Best song${bestSongs(fav.song).length > 1 ? 's' : ''}</span><ul class="song-chips">${songChipsHtml(fav, false)}</ul></div>` : ''}
        <div class="detail-actions">
          <a class="btn spotify" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener">${ICON.spotify} Play on Spotify</a>
          <button class="btn queue" id="queueMine"></button>
        </div>
      </div>
    </div>`, 'detail-modal');
  watchCovers(m);
  requestArt(album);
  const btn = $('#queueMine', m);
  const paint = () => {
    const on = !!inQueue();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on);
    btn.innerHTML = `${on ? ICON.check : ICON.queue}<span>${on ? 'In your Up next' : 'Add to my Up next'}</span>`;
  };
  paint();
  btn.addEventListener('click', () => {
    const existing = inQueue();
    if (existing) {
      mine.toListen = mine.toListen.filter((x) => x !== existing);
      toast('Taken off your Up next');
    } else {
      const item = { id: store.uid(), artist: album.artist, title: album.title, added: new Date().toISOString().slice(0, 10) };
      const art = artFor(album);
      if (art) item.art = art;
      if (album.spotify) item.spotify = album.spotify;
      mine.toListen.unshift(item);
      toast('Added to your Up next');
    }
    store.commit({ quiet: true });
    paint();
  });
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
        ${yearField(year)}
      </div>
      <label class="field"><span>Spotify link <small>optional, paste from Share › Copy link</small></span><input name="spotify" value="${esc(album.spotify || '')}" placeholder="https://open.spotify.com/album/…"></label>
      <label class="field"><span>Artwork URL <small>optional</small></span><input name="art" value="${esc(artFor(album) || '')}"></label>
      <div class="form-actions"><button class="btn primary">Save</button></div>
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

function yearField(value, { optional = false } = {}) {
  const max = new Date().getFullYear() + 1;
  return `<label class="field narrow"><span>Release year</span><input name="year" type="number" inputmode="numeric" min="1900" max="${max}" ${optional ? 'placeholder="Look it up"' : 'required'} value="${esc(value)}"></label>`;
}

// ------------------------------------------------------------------ add album

const TYPE_LABEL = { single: 'Single', ep: 'EP', compilation: 'Compilation' };

function addAlbum({ year: fallbackYear, query = '', fromQueue = null } = {}) {
  // New albums go under their release year: filled in from the search result,
  // or looked up from the artist and album when typed in by hand. If it can't
  // be found, the album goes under the year you added it from (or this year).
  fallbackYear = fallbackYear || String(new Date().getFullYear());
  let chosen = null;
  const m = openModal(`
    <div class="modal-head"><h2>Add an album</h2>${closeBtn()}</div>
    <label class="search-field big"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="addQ" type="search" placeholder="Search for an album or artist…" autocomplete="off" value="${esc(query)}"></label>
    <div class="results" id="results"></div>
    <form id="addForm" class="form">
      <div class="form-cover" id="addCover" hidden></div>
      <label class="field"><span>Artist</span><input name="artist" required autocomplete="off"></label>
      <label class="field"><span>Album</span><input name="title" autocomplete="off"></label>
      <div class="log-only">
        <label class="field"><span>Standout songs <small>optional, comma separated</small></span><input name="songs" autocomplete="off"></label>
        <div class="row">
          ${yearField('', { optional: true })}
          <label class="check"><input type="checkbox" name="fav"> ${ICON.heart} Favourite</label>
        </div>
      </div>
      <p class="hint" id="yearHint" hidden></p>
      <p class="warn" id="dupWarn" hidden></p>
      <div class="form-actions"><button class="btn primary" id="addSubmit">Add to log</button></div>
    </form>`, 'wide');
  const form = $('#addForm', m);
  const F = form.elements;
  const q = $('#addQ', m);
  const results = $('#results', m);
  const coverPreview = () => {
    const al = { id: 'preview', artist: F.artist.value, title: F.title.value };
    $('#addCover', m).hidden = !chosen?.art && !al.artist && !al.title;
    $('#addCover', m).innerHTML = `<div class="cover md" style="background:${placeholder(al)}"><span class="cover-initial">${esc((al.title || al.artist || '?').slice(0, 1).toUpperCase())}</span>${chosen?.art ? `<img src="${esc(chosen.art)}" alt="">` : ''}</div>`;
    checkDup();
  };
  const checkDup = () => {
    const w = $('#dupWarn', m);
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
        const list = await findAlbums(term, 20);
        if (t !== ticket) return;
        results.innerHTML = list.length ? list.map((r, i) => `
          <button type="button" class="result" data-i="${i}">
            <img src="${esc(r.art.replace('600x600', '120x120'))}" alt="">
            <span><b>${esc(r.title)}</b><small>${esc(r.artist)}${r.year ? ` · ${r.year}` : ''}${TYPE_LABEL[r.type] ? ` · <em class="kind">${TYPE_LABEL[r.type]}</em>` : ''}</small></span>
          </button>`).join('') : '<p class="muted pad-sm">No matches. Fill in the details below instead.</p>';
        results._list = list;
      } catch {
        if (t === ticket) results.innerHTML = '<p class="muted pad-sm">Search is unavailable right now. Fill in the details below.</p>';
      }
    }, 400);
  };
  q.addEventListener('input', search);

  // Typed in by hand: look the release year up once there's an artist and album.
  // A year the user typed themselves is never overwritten.
  const hint = $('#yearHint', m);
  let yearTimer, yearTicket = 0, yearTyped = false;
  const lookupYear = async () => {
    const al = { artist: F.artist.value.trim(), title: F.title.value.trim() };
    if (!al.artist || !al.title) return '';
    const t = ++yearTicket;
    try {
      const hit = await findRelease(al);
      if (t !== yearTicket) return null; // superseded by a newer lookup
      return hit?.year || '';
    } catch { return t === yearTicket ? '' : null; }
  };
  const autoYear = () => {
    clearTimeout(yearTimer);
    if (yearTyped || chosen) return;
    if (F.year.value) { F.year.value = ''; checkDup(); }
    hint.hidden = true;
    if (!F.artist.value.trim() || !F.title.value.trim()) return;
    yearTimer = setTimeout(async () => {
      hint.hidden = false;
      hint.innerHTML = '<span class="spin"></span> Looking up the release year…';
      const found = await lookupYear();
      if (found === null || yearTyped || chosen) return;
      if (found) {
        F.year.value = found;
        hint.textContent = `Found it: released in ${found}. Change it if that's wrong.`;
        checkDup();
      } else {
        hint.textContent = `Couldn't find the release year, so this will go in ${fallbackYear} unless you fill it in.`;
      }
    }, 700);
  };
  results.addEventListener('click', (e) => {
    const b = e.target.closest('.result');
    if (!b) return;
    chosen = results._list[b.dataset.i];
    F.artist.value = chosen.artist.toLowerCase();
    F.title.value = chosen.title.toLowerCase();
    clearTimeout(yearTimer); yearTicket++; yearTyped = false; hint.hidden = true;
    F.year.value = chosen.year || '';
    $$('.result', results).forEach((x) => x.classList.toggle('chosen', x === b));
    coverPreview();
    F.songs.focus();
  });
  F.artist.addEventListener('input', () => { chosen = null; coverPreview(); autoYear(); });
  F.title.addEventListener('input', () => { chosen = null; coverPreview(); autoYear(); });
  F.year.addEventListener('input', () => {
    yearTyped = !!F.year.value; clearTimeout(yearTimer); yearTicket++; hint.hidden = true;
    if (!yearTyped) autoYear();
    checkDup();
  });
  let saving = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    let guessed = false;
    if (!F.year.value) {
      saving = true;
      const btn = $('#addSubmit', m);
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> Finding the year…';
      clearTimeout(yearTimer);
      const found = chosen?.year || await lookupYear();
      F.year.value = found || fallbackYear;
      guessed = !found;
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
    toast(guessed ? `Added to ${F.year.value}. Couldn't find its release year, so open the album to change it if that's wrong.`
      : cleared ? `Added to ${F.year.value} and ticked off Up next` : `Added to ${F.year.value}`);
    if (location.hash !== `#/year/${F.year.value}`) location.hash = `#/year/${F.year.value}`;
    else render();
    if (!album.art) requestArt(album);
  });
  coverPreview();
  if (query) search();
  q.focus();
}

// ------------------------------------------------------------------ up next

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
      <h2>Up next <span>${items.length}</span></h2>
      <a class="link-btn" href="#/up-next">See all</a>
    </div>
    ${items.length ? `<div class="upnext-strip">${items.slice(0, 15).map((x) => `
      <button class="q-card" data-queue="${x.id}">
        ${coverHtml(x)}
        <span class="q-title">${esc(queueName(x))}</span>
        <span class="q-sub">${esc(queueSub(x))}</span>
      </button>`).join('')}
      ${items.length > 15 ? `<a class="q-more" href="#/up-next">+${items.length - 15}<small>more</small></a>` : ''}
    </div>` : ''}
  </section>`;
}

// Albums queued from the library (a re-listen) point back at the album with
// albumId. They are already logged, so hearing them just ticks them off.
const queuedAlbum = (item) => (item.albumId && store.findAlbum(item.albumId)) || null;

function tickOff(id) {
  data.toListen = data.toListen.filter((x) => x.id !== id);
  store.commit();
  toast('Ticked off Up next');
}

function openQueueItem(id) {
  const item = data.toListen.find((x) => x.id === id);
  if (!item) return;
  if (queuedAlbum(item)) return openAlbum(item.albumId);
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
      <p class="hero-stats"><b>${data.toListen.length}</b> waiting to be heard</p></div></section>
    ${data.toListen.length ? `<div class="rows">${data.toListen.map((x) => `
      <div class="row-item">
        <button class="row-open" data-queue="${x.id}">
          ${coverHtml(x, 'sm')}
          <span class="row-meta"><span class="row-title">${esc(queueName(x))}</span><span class="row-artist">${x.title ? esc(x.artist) : '<i>artist</i>'}</span></span>
        </button>
        <button class="btn small" data-heard="${x.id}" title="Log it as listened">${ICON.check}<span class="hide-sm"> Listened</span></button>
        <button class="icon-btn subtle" data-drop="${x.id}" title="Remove">${ICON.close}</button>
      </div>`).join('')}</div>`
      : '<div class="empty"><h2>Nothing queued</h2><p>Open any album in your library and tap Add to Up next.</p></div>'}`;
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
      if (queuedAlbum(item)) { tickOff(item.id); renderUpNext(); return; }
      addAlbum({ query: `${item.artist} ${item.title}`.trim(), fromQueue: item.id, year: String(new Date().getFullYear()) });
    }
  });
}

// ------------------------------------------------------------------ search

function renderSearch(initial) {
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">every year</p><h1>search</h1></div></section>
    <div class="toolbar">
      <label class="search-field">${ICON.search}
        <input id="gq" type="search" placeholder="Artist, album or song…" value="${esc(initial)}" autocomplete="off"></label>
      ${viewToggleHtml()}
    </div>
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
  const statusShort = { saving: 'Saving…', error: `Not saved yet: ${lastError}` }[status] || 'All changes saved';
  const m = openModal(`
    <div class="modal-head"><h2>Settings</h2>${closeBtn()}</div>
    <div class="account-box">
      ${user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((user.displayName || user.email || '?').slice(0, 1).toUpperCase())}</span>`}
      <div><b>${esc(user.displayName || user.email || 'Signed in')}</b>${user.displayName && user.email ? `<small>${esc(user.email)}</small>` : ''}
        <small class="status-line ${status}" title="${esc(statusText)}"><span class="sync-dot ${status}"></span>${esc(statusShort)}</small></div>
      <button type="button" class="btn small" id="signOutBtn">Sign out</button>
    </div>
    ${spotify.configured() ? `<div class="spotify-box">
      ${ICON.spotify}
      <div><b>Spotify</b><small>${spotify.connected()
        ? 'Connected for artwork and album links'
        : 'Connect for better artwork and album links'}${spotify.lastError ? `<br>Last Spotify error: ${esc(spotify.lastError)}` : ''}</small></div>
      <button type="button" class="btn ${spotify.connected() ? '' : 'spotify'} small" id="spotifyBtn">${spotify.connected() ? 'Log out' : 'Log in'}</button>
    </div>` : ''}
    <div class="share-box" id="shareBox">
      <div class="share-head">
        ${ICON.share}
        <div><b>Share my library</b><small>Friends with your code can browse your years, favourites and best songs. They can't change anything, and your Up next stays private.</small></div>
        <label class="switch" title="Share my library"><input type="checkbox" id="shareToggle" disabled aria-label="Share my library"><span></span></label>
      </div>
      <div class="share-body" id="shareBody" hidden></div>
    </div>
    <p class="warn" id="cfgErr" hidden></p>
    <div class="backup-row">
      <span class="muted">Backup</span>
      <button type="button" class="link-btn" id="export">Download</button>
      <label class="link-btn" id="restore">Restore<input type="file" accept="application/json,.json" hidden></label>
    </div>`);
  $('#export', m).addEventListener('click', store.exportJson);
  setUpShareBox(m);
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

// ------------------------------------------------------------------ sharing

function setUpShareBox(m) {
  const toggle = $('#shareToggle', m);
  const body = $('#shareBody', m);
  const err = $('#cfgErr', m);
  let share = null;
  const fail = (ex) => {
    err.hidden = false;
    err.textContent = ex.code === 'permission-denied'
      ? 'Firestore refused that. The sharing rules need publishing in the Firebase console first.'
      : ex.message;
  };
  const draw = () => {
    toggle.checked = !!share;
    body.hidden = !share;
    if (!share) { body.innerHTML = ''; return; }
    const link = store.shareLink(share.token);
    const people = share.viewers.map((v) => esc(v.name || 'Someone')).join(', ');
    body.innerHTML = `
      <div class="share-code">
        <div><small>Your code</small><b>${esc(store.formatCode(share.token))}</b></div>
        <button type="button" class="btn small" id="copyLink">${ICON.copy} Copy link</button>
        ${navigator.share ? `<button type="button" class="btn small" id="sendLink">${ICON.share} Send</button>` : ''}
      </div>
      <label class="field"><span>Your name, as friends see it</span><input id="shareName" value="${esc(share.name || '')}" maxlength="60" autocomplete="name"></label>
      <p class="muted share-people">${people ? `Added by ${people}` : 'Nobody has added your code yet.'}</p>
      <button type="button" class="link" id="newCode">Make a new code</button>
      <small class="muted share-note">A new code stops everyone who has the old one until you send it again.</small>`;
    $('#copyLink', body).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); toast('Link copied'); }
      catch { prompt('Copy this link', link); }
    });
    $('#sendLink', body)?.addEventListener('click', () => {
      navigator.share({ title: 'My music library', text: `See the albums I've been listening to. My code is ${store.formatCode(share.token)}.`, url: link }).catch(() => {});
    });
    $('#shareName', body).addEventListener('change', async (e) => {
      const name = e.target.value.trim() || store.defaultShareName();
      e.target.value = name;
      try { await store.renameShare(share.token, name); share.name = name; toast('Name saved'); }
      catch (ex) { fail(ex); }
    });
    $('#newCode', body).addEventListener('click', async (e) => {
      if (!confirm('Make a new code? Anyone with the old one loses access until you send them the new one.')) return;
      e.target.disabled = true;
      try { share = await store.newShareCode(share.name); draw(); toast('New code made'); }
      catch (ex) { fail(ex); e.target.disabled = false; }
    });
  };
  store.getShare().then((s) => { share = s; toggle.disabled = false; draw(); }).catch((ex) => { toggle.disabled = false; fail(ex); });
  toggle.addEventListener('change', async () => {
    err.hidden = true;
    toggle.disabled = true;
    try {
      if (toggle.checked) { share = await store.startSharing(); toast('Sharing is on. Send your code to a friend.'); }
      else {
        if (share?.viewers.length && !confirm('Stop sharing? Friends who added your code will lose access.')) { toggle.checked = true; return; }
        await store.stopSharing(); share = null; toast('Your library is private again');
      }
      draw();
    } catch (ex) { toggle.checked = !!share; fail(ex); }
    finally { toggle.disabled = false; }
  });
}

// Your library plus the friends' libraries you've added.
async function openLibraries() {
  const m = openModal(`
    <div class="modal-head"><h2>Libraries</h2>${closeBtn()}</div>
    <div class="libs" id="libList"><p class="muted pad-sm"><span class="spin"></span> Loading…</p></div>
    <form class="inline-add code-add" id="codeForm">
      <input id="codeInput" placeholder="Friend's code, like ABCDE-FGH23" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Friend's share code">
      <button class="btn">Add</button>
    </form>
    <p class="warn" id="libErr" hidden></p>
    <p class="muted small-print">Want friends to see yours? Turn on <button type="button" class="link" id="toShare">Share my library</button> in Settings.</p>`);
  const err = $('#libErr', m);
  const showErr = (msg) => { err.hidden = !msg; err.textContent = msg || ''; };
  const user = store.currentUser();
  const current = store.viewingFriend()?.uid || '';
  const initial = (n) => esc((n || '?').slice(0, 1).toUpperCase());
  const draw = async () => {
    let list = [];
    try { list = await store.friends(); } catch (ex) { showErr(ex.message); }
    $('#libList', m).innerHTML = `
      <button class="lib ${current ? '' : 'on'}" data-lib="">
        <span class="avatar">${initial(user.displayName || user.email)}</span>
        <span class="lib-name"><b>My library</b><small>${esc(user.email || '')}</small></span>
        ${current ? '' : ICON.check}
      </button>
      ${list.map((f) => `<div class="lib-row">
        <button class="lib ${current === f.uid ? 'on' : ''}" data-lib="${esc(f.uid)}">
          <span class="avatar friend">${initial(f.name)}</span>
          <span class="lib-name"><b>${esc(f.name)}</b><small>read only</small></span>
          ${current === f.uid ? ICON.check : ''}
        </button>
        <button class="icon-btn subtle" data-unfollow="${esc(f.uid)}" title="Remove ${esc(f.name)}" aria-label="Remove ${esc(f.name)}">${ICON.close}</button>
      </div>`).join('')}
      ${list.length ? '' : '<p class="muted lib-empty">Add a friend’s code below to look through their library.</p>'}`;
  };
  $('#libList', m).addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-unfollow]');
    if (rm) {
      const f = (await store.friends()).find((x) => x.uid === rm.dataset.unfollow);
      if (!f || !confirm(`Remove ${f.name}'s library from your list?`)) return;
      try { await store.removeFriend(f.uid); toast(`Removed ${f.name}`); draw(); render(); }
      catch (ex) { showErr(ex.message); }
      return;
    }
    const lib = e.target.closest('[data-lib]');
    if (!lib) return;
    showErr('');
    if (!lib.dataset.lib) { closeModal(m, true); showOwn(); return; }
    lib.classList.add('busy');
    try { await showFriend(lib.dataset.lib); closeModal(m, true); }
    catch (ex) { showErr(ex.message); lib.classList.remove('busy'); }
  });
  $('#codeForm', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('');
    const btn = e.submitter || $('#codeForm .btn', m);
    btn.classList.add('busy');
    try {
      const f = await store.addFriend($('#codeInput', m).value);
      await showFriend(f.uid);
      closeModal(m, true);
      toast(`Added ${f.name}'s library`);
    } catch (ex) { showErr(ex.message); }
    finally { btn.classList.remove('busy'); }
  });
  $('#toShare', m).addEventListener('click', () => { closeModal(m, true); openSettings(); });
  await draw();
}

async function showFriend(uid) {
  await store.viewFriend(uid);
  data = store.getData();
  ui.filter = '';
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else render();
  scrollTo(0, 0);
}

function showOwn() {
  store.viewOwn();
  data = store.getData();
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else render();
  scrollTo(0, 0);
}

// Opened a share link (#/friend/CODE): add that library and show it.
async function acceptCode(code) {
  app.innerHTML = '<div class="loading"><span class="spin"></span>Opening your friend’s library…</div>';
  history.replaceState(null, '', '#/');
  try {
    const f = await store.addFriend(code);
    await showFriend(f.uid);
    toast(`Added ${f.name}'s library`);
  } catch (ex) {
    render();
    toast(ex.message, 'error');
  }
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
  const yearBtn = e.target.closest('[data-year-menu]');
  if (yearBtn) { e.stopPropagation(); openYearMenu(yearBtn); return; }
  if ($('#yearMenu') && (!e.target.closest('#yearMenu') || e.target.closest('a'))) closeYearMenu();
  const add = e.target.closest('[data-add]');
  if (add) addAlbum({ year: add.dataset.add });
  const q = e.target.closest('[data-queue]');
  if (q) openQueueItem(q.dataset.queue);
  if (e.target.closest('[data-view-own]')) showOwn();
});
$('#addBtn').addEventListener('click', () => data && !ro() && addAlbum());
$('#libsBtn').addEventListener('click', () => data && openLibraries());
$('#searchBtn').addEventListener('click', () => (location.hash = '#/search'));
$('#settingsBtn').addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && closeYearMenu()) return;
  if (e.key === 'Escape') { const last = modalRoot.lastElementChild; if (last) closeModal(last); return; }
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (modalRoot.children.length || !isStarted) return;
  if (e.key === 'n' && !ro()) { e.preventDefault(); addAlbum(); }
  if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
});

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
