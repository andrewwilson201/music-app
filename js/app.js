import * as store from './store.js?v=37';
import * as spotify from './spotify.js?v=37';
import * as spHistory from './history.js?v=37';
import { queueArt, prioritise, searchAlbums, findAlbums, spotifyBlockedFor, findRelease, findSpotifyLink, spotifyUrl, spotifyArtistUrl, placeholder, norm, artVersion, findTrack, bestSongs, findTracklist, cleanSong } from './art.js?v=37';
import * as mood from './mood.js?v=37';

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
  bell: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><path d="M3 11h18M12 7v14M5 11v10h14V11M3 7h18v4H3z"/><path d="M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7Zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7Z"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M4 6h12M4 11h12M4 16h7"/><path d="m15 14 5 3-5 3z" fill="currentColor"/></svg>',
  grip: '<svg viewBox="0 0 24 24" class="fill"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  headphones: '<svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" class="dot"/><circle cx="15" cy="15" r="1.2" class="dot"/><circle cx="15" cy="9" r="1.2" class="dot"/><circle cx="9" cy="15" r="1.2" class="dot"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/></svg>',
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
let pendingTracking = null; // Spotify token for listening tracking, saved once signed in
let recs = [];
let pendingRec = ''; // recommendation to open once loaded (from a notification) // albums friends recommended to me, see store.recs
let tracking = { enabled: false }; // listening tracking state, see store.trackingState

// ------------------------------------------------------------------ boot

async function boot() {
  app.innerHTML = '<div class="loading"><span class="spin"></span>Loading your records…</div>';
  let spotifyMsg = '';
  try {
    const back = await spotify.handleRedirect();
    if (typeof back === 'string' && back.startsWith('playlist:')) resumePlaylist = back.slice(9);
    else if (back?.then === 'listening') pendingTracking = back;
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
    // New recommendations are worth checking for every time the app comes back.
    if (Date.now() - hiddenAt < 30000 || modalRoot.children.length) { loadRecs(); return; }
    try {
      if (ro()) { await store.viewFriend(store.viewingFriend().uid); render(); }
      else if (await store.refresh()) { data = store.getData(); render(); }
      loadListening();
    } catch {}
    loadRecs();
  });
  render();
  loadListening();
  loadRecs();
  if (pendingTracking) finishTrackingLogin();
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
  $('#listenBtn').hidden = !(hasListening() || (!ro() && tracking.enabled));
  $('#listenBtn').classList.toggle('on', page === 'listening');
  navActive = page === 'year' ? a : page ? page : years[0];
  if (!page) return renderYear(years[0], 'listened');
  if (page === 'year' && data.years[a]) return renderYear(a, b || 'listened');
  if ((page === 'up-next' || page === 'to-listen') && !ro()) return renderUpNext();
  if (page === 'search') return renderSearch(a || '');
  if (page === 'listening' && !ro()) return renderListening(a || 'month', b === 'songs' ? 'songs' : 'albums');
  if (page === 'friend' && a) return acceptCode(a);
  if (page === 'rec' && a) { pendingRec = a; location.replace('#/'); if (isStarted) loadRecs(); return; }
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
  // Switching year keeps you on the tab you're looking at (Listened or Favourites).
  const [page, , tab] = route();
  const suffix = page === 'year' && tab === 'favourites' ? '/favourites' : '';
  menu.innerHTML = shownYears().map((y) => {
    const n = data.years[y]?.albums.length || 0;
    return `<a href="#/year/${y}${suffix}" class="${y === navActive ? 'on' : ''}"><b>${y}</b><small>${n ? `${n} album${n === 1 ? '' : 's'}` : y === now ? 'nothing yet' : ''}</small></a>`;
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
  if (ui.sort === 'listened') list.sort((x, y) => (listeningFor(y.a)?.ms || 0) - (listeningFor(x.a)?.ms || 0));
  return list.map(({ a }) => a);
}

const timePill = (album) => {
  const l = pillsOn() && listeningFor(album);
  return l && l.ms >= 60000 ? `<span class="play-time" title="Time listened on Spotify">${ICON.headphones}${fmtDur(l.ms)}</span>` : '';
};

function cardHtml(album, yearData, showYear = '') {
  const rank = yearData ? store.favRank(yearData, album.id) : 0;
  return `<button class="card" data-open="${album.id}">
    ${coverHtml(album).replace(/<\/div>$/, `${timePill(album)}</div>`)}
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
      ${(() => { const l = listeningFor(album); return l && l.ms >= 60000 ? `<span class="row-time" title="Time listened on Spotify">${fmtDur(l.ms)}</span>` : ''; })()}
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
        ${yearListenHtml(y)}
      </div>
      ${ro() ? '' : `<button type="button" class="btn pick-btn" data-pick title="Pick an album from your library">${ICON.dice}<span>Pick for me</span></button>`}
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
          ${hasListening() ? '<option value="listened">Most listened</option>' : ''}
        </select>
      </label>
      ${viewToggleHtml()}
    </div>
    <div id="grid"></div>`;
  if (!ro() && year === store.years()[0] && data.toListen.length) body.insertAdjacentHTML('afterbegin', upNextHtml());
  if (!ro() && year === store.years()[0] && recs.length) body.insertAdjacentHTML('afterbegin', recsHtml());
  if (ui.sort === 'listened' && !hasListening()) ui.sort = 'latest';
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
  bindSongPicker(list, (el) => {
    const id = el.closest('.fav').dataset.id;
    return songsOf(y.albums.find((a) => a.id === id), y.favourites.find((x) => x.albumId === id));
  });
  list.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-unfav]');
    if (!rm) return;
    e.stopPropagation();
    const id = rm.dataset.unfav;
    keepSongs(y, id);
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

// Any album can have best songs. They live in album.songs, and a favourite
// also keeps them in fav.song (what playlists and friends' views read), so
// songsOf() hands the picker one thing to edit that keeps both in step.
function songsOf(album, fav) {
  return {
    get song() { return fav ? fav.song : (album?.songs || []).join('; '); },
    set song(v) {
      if (album) album.songs = bestSongs(v);
      if (fav) fav.song = v;
    },
  };
}

// Before an album stops being a favourite, keep its best songs on the album.
function keepSongs(yearData, albumId) {
  const fav = yearData.favourites.find((f) => f.albumId === albumId);
  const album = yearData.albums.find((a) => a.id === albumId);
  if (fav && album && bestSongs(fav.song).length) album.songs = bestSongs(fav.song);
}

// favFor(element) returns what a picker inside `root` edits: anything with a
// `song` string (see songsOf).
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
  if (on && !has) y.favourites.push({ albumId: album.id, song: (album.songs || []).join('; ') });
  if (!on && has) keepSongs(y, album.id);
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
        ${listenPanelHtml(album, fav)}
        <div class="detail-actions">
          <a class="btn spotify" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener">${ICON.spotify} Play on Spotify</a>
          <button class="btn heart ${rank ? 'on' : ''}" id="favToggle" aria-pressed="${!!rank}">${ICON.heart}<span>${rank ? 'Favourite' : 'Add to favourites'}</span></button>
          <button class="btn queue ${queued ? 'on' : ''}" id="queueToggle" aria-pressed="${!!queued}">${queued ? ICON.check : ICON.queue}<span>${queued ? 'In Up next' : 'Add to Up next'}</span></button>
          <button class="btn" id="recommend">${ICON.gift}<span>Recommend</span></button>
        </div>
        <div class="field" id="bestSongField"><span>Best songs</span>${songPickerHtml(album, songsOf(album, fav), 'detailSongs')}</div>
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
  bindSongPicker($('#bestSongField', m), () => songsOf(album, fav));
  $('#recommend', m).addEventListener('click', () => recommend(album, year));
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
          <button class="btn" id="recommend">${ICON.gift}<span>Recommend</span></button>
        </div>
      </div>
    </div>`, 'detail-modal');
  watchCovers(m);
  requestArt(album);
  $('#recommend', m).addEventListener('click', () => recommend(album, year, store.viewingFriend()?.uid));
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

// The year a search result is already logged under, if it is. Edition tags
// like "(Deluxe Edition)" or "- Remastered" are ignored.
const bareTitle = (t) => norm(String(t || '').replace(/\s*[([][^)\]]*[)\]]\s*$/, '').replace(/\s+-\s+[^-]*$/, ''));
function loggedYear(r) {
  const a = norm(r.artist), t = norm(r.title), bt = bareTitle(r.title);
  if (!a || !t) return '';
  return store.years().find((y) => data.years[y].albums.some((x) =>
    norm(x.artist) === a && (norm(x.title) === t || (bt && bareTitle(x.title) === bt)))) || '';
}

function addAlbum({ year: fallbackYear, query = '', fromQueue = null, fromRec = null } = {}) {
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
        <label class="field"><span>Best songs <small>optional, comma separated</small></span><input name="songs" autocomplete="off"></label>
        <div class="row">
          ${yearField('', { optional: true })}
          <label class="check"><input type="checkbox" name="fav"> ${ICON.heart} Favourite</label>
        </div>
      </div>
      <p class="hint" id="yearHint" hidden></p>
      <p class="warn" id="dupWarn" hidden></p>
      <div class="form-actions">
        <button class="btn" id="addMore" hidden>Add and pick another</button>
        <button class="btn primary" id="addSubmit">Add to log</button>
      </div>
    </form>`, 'wide');
  const form = $('#addForm', m);
  const F = form.elements;
  const q = $('#addQ', m);
  const results = $('#results', m);
  const addMore = $('#addMore', m);
  const addedYears = []; // years added to while "Add and pick another" kept this open
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
        results._list = list;
        showResults();
      } catch {
        if (t !== ticket) return;
        const wait = Math.ceil(spotifyBlockedFor() / 60000);
        results.innerHTML = `<p class="muted pad-sm">${wait
          ? `Spotify has paused searches for ${wait > 90 ? 'a while' : `about ${wait} minute${wait === 1 ? '' : 's'}`} after a lot of lookups, and iTunes didn't answer either.`
          : 'Search is unavailable right now.'} Try again shortly, or fill in the details below.</p>`;
      }
    }, 400);
  };
  q.addEventListener('input', search);
  // Albums already in the log get a tick, so it's easy to see what's left to add.
  function showResults() {
    const list = results._list || [];
    results.innerHTML = list.length ? list.map((r, i) => {
      const inLog = loggedYear(r);
      return `
          <button type="button" class="result${inLog ? ' logged' : ''}${r === chosen ? ' chosen' : ''}" data-i="${i}">
            <img src="${esc(r.art.replace('600x600', '120x120'))}" alt="">
            <span><b>${esc(r.title)}</b><small>${esc(r.artist)}${r.year ? ` · ${r.year}` : ''}${TYPE_LABEL[r.type] ? ` · <em class="kind">${TYPE_LABEL[r.type]}</em>` : ''}</small></span>
            ${inLog ? `<em class="in-log">${ICON.check}<span>${inLog === String(r.year) ? 'Logged' : `In ${esc(inLog)}`}</span></em>` : ''}
          </button>`;
    }).join('') : '<p class="muted pad-sm">No matches. Fill in the details below instead.</p>';
    addMore.hidden = !list.length;
  }

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
    const more = e.submitter === addMore && !addMore.hidden;
    let guessed = false;
    if (!F.year.value) {
      saving = true;
      const btn = more ? addMore : $('#addSubmit', m);
      const label = btn.innerHTML;
      $$('.form-actions .btn', m).forEach((b) => { b.disabled = true; });
      btn.innerHTML = '<span class="spin"></span> Finding the year…';
      clearTimeout(yearTimer);
      const found = chosen?.year || await lookupYear();
      F.year.value = found || fallbackYear;
      guessed = !found;
      saving = false;
      $$('.form-actions .btn', m).forEach((b) => { b.disabled = false; });
      btn.innerHTML = label;
    }
    const y = store.ensureYear(F.year.value);
    const album = { id: store.uid(), artist: F.artist.value.trim(), title: F.title.value.trim(), songs: splitSongs(F.songs.value) };
    if (chosen?.art) album.art = chosen.art;
    if (chosen?.spotify) album.spotify = chosen.spotify;
    y.albums.push(album);
    if (F.fav.checked) y.favourites.push({ albumId: album.id, song: album.songs.join('; ') });
    const cleared = clearFromQueue(album, fromQueue);
    store.commit();
    clearRecs(album, fromRec?.id);
    if (!album.art) requestArt(album);
    if (more) {
      // Back to the same search results, with this one now ticked, ready for the next.
      if (!addedYears.includes(F.year.value)) addedYears.push(F.year.value);
      toast(guessed ? `Added to ${F.year.value} (couldn't find its release year)` : `Added to ${F.year.value}`);
      chosen = null;
      form.reset();
      yearTyped = false; hint.hidden = true;
      coverPreview();
      showResults();
      $('.modal', m).scrollTo({ top: 0, behavior: 'smooth' });
      m.onClose = () => {
        // Finished: show the year everything went into, or stay put if it was several.
        const go = addedYears.length === 1 ? `#/year/${addedYears[0]}` : '';
        if (go && location.hash !== go) location.hash = go; else render();
      };
      return;
    }
    closeModal(m, true);
    toast(guessed ? `Added to ${F.year.value}. Couldn't find its release year, so open the album to change it if that's wrong.`
      : cleared ? `Added to ${F.year.value} and ticked off Up next` : `Added to ${F.year.value}`);
    if (location.hash !== `#/year/${F.year.value}`) location.hash = `#/year/${F.year.value}`;
    else render();
  });
  if (fromRec) {
    // A friend's recommendation: start from what they sent.
    chosen = { artist: fromRec.artist, title: fromRec.title, art: fromRec.art || '', spotify: fromRec.spotify || '', year: fromRec.year || '' };
    F.artist.value = fromRec.artist;
    F.title.value = fromRec.title;
    F.year.value = fromRec.year || ''; // without one, the year is looked up on save
  }
  coverPreview();
  if (query) search();
  if (fromRec) F.songs.focus(); else q.focus();
}

// ------------------------------------------------------------------ recommendations

// Friends who share libraries with each other can send each other albums.
// They land in users/{uid}/recs and show as a strip on the home page, with a
// popup the first time they're seen.

const recItem = (r) => ({ id: `rec-${r.id}`, artist: r.artist, title: r.title, art: r.art || '' });
const recMatches = (r, album) => queueMatches({ artist: r.artist, title: r.title }, album);
const isLogged = (r) => store.years().some((y) => data.years[y].albums.some((a) => recMatches(r, a)));

async function loadRecs() {
  if (ro() || !store.canSync()) return;
  let list;
  try { list = await store.recs(); } catch { return; }
  // Already in the log (added some other way): no need to suggest it.
  const done = list.filter(isLogged);
  done.forEach((r) => store.dismissRec(r.id).catch(() => {}));
  const before = recs.map((r) => r.id).join();
  recs = list.filter((r) => !done.includes(r));
  if (recs.map((r) => r.id).join() !== before && !ro() && !modalRoot.children.length) render();
  if (pendingRec) {
    const id = pendingRec;
    pendingRec = '';
    if (recs.some((r) => r.id === id)) {
      [...modalRoot.children].forEach((w) => closeModal(w, true));
      store.markRecsSeen(recs.filter((r) => !r.seen).map((r) => r.id)).catch(() => {});
      recs.forEach((r) => { r.seen = true; });
      return openRec(id);
    }
  }
  const fresh = recs.filter((r) => !r.seen);
  if (!fresh.length) return;
  store.markRecsSeen(fresh.map((r) => r.id)).catch(() => {});
  fresh.forEach((r) => { r.seen = true; });
  if (!modalRoot.children.length && !ro()) openRec(fresh[0].id, fresh.length - 1);
}

function clearRecs(album, id) {
  const gone = recs.filter((r) => r.id === id || recMatches(r, album));
  if (!gone.length) return;
  recs = recs.filter((r) => !gone.includes(r));
  gone.forEach((r) => store.dismissRec(r.id).catch(() => {}));
}

function recsHtml() {
  return `<section class="upnext recs">
    <div class="upnext-head">
      <h2>Recommended for you <span>${recs.length}</span></h2>
    </div>
    <div class="upnext-strip">${recs.map((r) => `
      <button class="q-card" data-rec="${esc(r.id)}">
        ${coverHtml(recItem(r))}
        <span class="q-title">${esc(r.title || r.artist)}</span>
        <span class="q-sub">${r.title ? esc(r.artist) : 'artist'}</span>
        <span class="q-from">from ${esc(r.fromName || 'a friend')}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function openRec(id, more = 0) {
  const r = recs.find((x) => x.id === id);
  if (!r) return;
  const item = recItem(r);
  const mine = store.ownData();
  const inQueue = () => mine.toListen.find((x) => queueMatches(x, r));
  const m = openModal(`
    ${closeBtn('floating')}
    <div class="detail">
      ${coverHtml(item, 'xl')}
      <div class="detail-info">
        <p class="eyebrow"><span class="accent">${esc(r.fromName || 'A friend')} recommends</span>${r.year ? ` · ${esc(r.year)}` : ''}</p>
        <h2 class="detail-title">${esc(r.title || r.artist)}</h2>
        <p class="detail-artist">${r.title ? esc(r.artist) : 'Artist to check out'}</p>
        ${r.note ? `<blockquote class="rec-note">${esc(r.note)}</blockquote>` : ''}
        <div class="detail-actions">
          <a class="btn spotify" href="${esc(r.spotify || (r.title ? spotifyUrl(r) : spotifyArtistUrl(r.artist)))}" target="_blank" rel="noopener">${ICON.spotify} Play on Spotify</a>
          <button class="btn primary" id="recAdd">${ICON.plus} Add to my library</button>
          <button class="btn queue" id="recQueue">${inQueue() ? ICON.check : ICON.queue}<span>${inQueue() ? 'In Up next' : 'Add to Up next'}</span></button>
        </div>
        <button type="button" class="link-btn" id="recNotify" hidden>${ICON.bell} Notify me about the next one</button>
        ${more > 0 ? `<p class="muted small-print">${more} more recommendation${more > 1 ? 's' : ''} waiting on your home page.</p>` : ''}
        <div class="detail-foot">
          <button class="link-btn danger" id="recDismiss">${ICON.close} No thanks</button>
        </div>
      </div>
    </div>`, 'detail-modal');
  store.pushState().then((st) => {
    const b = $('#recNotify', m);
    if (!b || st !== 'off') return;
    b.hidden = false;
    b.addEventListener('click', async () => {
      try { await store.enablePush(); b.remove(); toast('You’ll get a notification next time'); }
      catch (ex) { toast(ex.message, 'error'); }
    });
  }).catch(() => {});
  $('#recAdd', m).addEventListener('click', () => {
    closeModal(m, true);
    addAlbum({ fromRec: r });
  });
  $('#recQueue', m).addEventListener('click', () => {
    if (!inQueue()) {
      const q = { id: store.uid(), artist: r.artist, title: r.title, added: new Date().toISOString().slice(0, 10) };
      if (r.art) q.art = r.art;
      if (r.spotify) q.spotify = r.spotify;
      mine.toListen.unshift(q);
      store.commit({ quiet: true });
    }
    // In Up next now, so it doesn't need to sit here too.
    recs = recs.filter((x) => x !== r);
    store.dismissRec(r.id).catch(() => {});
    closeModal(m);
    toast(`Added to Up next. Tell ${r.fromName || 'them'} thanks!`);
  });
  $('#recDismiss', m).addEventListener('click', async () => {
    recs = recs.filter((x) => x !== r);
    closeModal(m);
    try { await store.dismissRec(r.id); toast('Recommendation dismissed'); }
    catch (ex) { toast(`Couldn’t remove it: ${ex.message}`, 'error'); }
  });
  m.onClose = () => render();
}

// Send an album to one or more friends who share with you both ways.
async function recommend(album, year, skipUid = '') {
  const m = openModal(`
    <div class="modal-head"><h2>Recommend this album</h2>${closeBtn()}</div>
    <div class="rec-album">${coverHtml(album, 'sm')}<span><b>${esc(album.title || album.artist)}</b><small>${album.title ? esc(album.artist) : ''}</small></span></div>
    <div id="recBody"><p class="muted pad-sm"><span class="spin"></span> Finding your friends…</p></div>`);
  const body = $('#recBody', m);
  let res;
  try { res = await store.mutualFriends(); }
  catch (ex) { body.innerHTML = `<p class="warn">${esc(ex.message)}</p>`; return; }
  const list = res.list.filter((f) => f.uid !== skipUid);
  if (!list.length) {
    body.innerHTML = `<p class="muted">You can recommend albums to friends who share their library with you and have added your code too.</p>
      ${res.sharing ? '' : '<p class="muted">Turn on <b>Share my library</b> in Settings and send your code to a friend first.</p>'}`;
    return;
  }
  body.innerHTML = `<form class="form" id="recForm">
      <div class="field"><span>Send to</span>
        <div class="rec-people">${list.map((f, i) => `
          <label class="check"><input type="checkbox" name="to" value="${esc(f.uid)}" ${list.length === 1 || i === 0 ? 'checked' : ''}> ${esc(f.name || 'A friend')}</label>`).join('')}
        </div>
      </div>
      <label class="field"><span>Note <small>optional</small></span><input name="note" maxlength="300" placeholder="Why they'll love it" autocomplete="off"></label>
      <p class="warn" id="recErr" hidden></p>
      <div class="form-actions"><button class="btn primary" id="recSend">${ICON.gift} Send</button></div>
    </form>`;
  const form = $('#recForm', body);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = $$('input[name=to]:checked', form).map((x) => x.value);
    const err = $('#recErr', form);
    if (!to.length) { err.hidden = false; err.textContent = 'Pick someone to send it to.'; return; }
    const btn = $('#recSend', form);
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Sending…';
    const send = { artist: album.artist, title: album.title, year, art: artFor(album) || '', spotify: album.spotify || '' };
    const failed = [];
    for (const uid of to) {
      try { await store.sendRec(uid, send, form.elements.note.value); }
      catch (ex) { failed.push([list.find((f) => f.uid === uid)?.name || 'a friend', ex.message]); }
    }
    if (failed.length) {
      btn.disabled = false;
      btn.innerHTML = `${ICON.gift} Send`;
      err.hidden = false;
      err.textContent = failed.length === to.length ? failed[0][1] : `Couldn't send to ${failed.map((f) => f[0]).join(', ')}. ${failed[0][1]}`;
      return;
    }
    closeModal(m);
    const names = to.map((uid) => list.find((f) => f.uid === uid)?.name || 'a friend');
    toast(`Sent to ${names.join(' and ')}`);
  });
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

// Notifications on this phone when a friend recommends an album.
async function setUpPushBox(box) {
  const state = await store.pushState();
  if (state === 'unsupported') return;
  const note = {
    'home-screen': 'On iPhone, add this app to your Home Screen first (Share › Add to Home Screen), then open it from there and turn this on.',
    blocked: 'Notifications are blocked for this app. Allow them in your phone’s settings, then turn this on.',
  }[state] || 'Get a notification on this device when a friend recommends an album.';
  box.hidden = false;
  box.innerHTML = `<div class="share-head">
      ${ICON.bell}
      <div><b>Notifications</b><small>${note}</small></div>
      <label class="switch" title="Notifications"><input type="checkbox" id="pushToggle" ${state === 'on' ? 'checked' : ''} ${state === 'home-screen' ? 'disabled' : ''} aria-label="Notifications"><span></span></label>
    </div>`;
  const toggle = $('#pushToggle', box);
  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      if (toggle.checked) { await store.enablePush(); toast('Notifications are on for this device'); }
      else { await store.disablePush(); toast('Notifications are off'); }
    } catch (ex) { toggle.checked = !toggle.checked; toast(ex.message, 'error'); }
    toggle.disabled = false;
  });
}

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
    ${spotify.configured() ? `<div class="share-box listen-set" id="listenBox">
      <div class="share-head">
        ${ICON.headphones}
        <div><b>Track listening time</b><small>Adds up what you play on Spotify, on any device, and shows the time on each album. Only you can see it.</small></div>
        <label class="switch" title="Track listening time"><input type="checkbox" id="listenToggle" ${tracking.enabled ? 'checked' : ''} aria-label="Track listening time"><span></span></label>
      </div>
      <p class="listen-status" id="listenStatus" ${tracking.enabled || tracking.lastError ? '' : 'hidden'}>${trackingStatusHtml()}</p>
      ${hasListening() ? `<label class="check listen-pills"><input type="checkbox" id="pillsToggle" ${pillsOn() ? 'checked' : ''}> Show time on album covers</label>` : ''}
      <div class="import" id="historyBox">${historyBoxHtml()}</div>
    </div>` : ''}
    <div class="share-box" id="shareBox">
      <div class="share-head">
        ${ICON.share}
        <div><b>Share my library</b><small>Friends with your code can browse your years, favourites and best songs. They can't change anything, and your Up next stays private.</small></div>
        <label class="switch" title="Share my library"><input type="checkbox" id="shareToggle" disabled aria-label="Share my library"><span></span></label>
      </div>
      <div class="share-body" id="shareBody" hidden></div>
    </div>
    <div class="share-box" id="pushBox" hidden></div>
    <p class="warn" id="cfgErr" hidden></p>
    <div class="backup-row">
      <span class="muted">Backup</span>
      <button type="button" class="link-btn" id="export">Download</button>
      <label class="link-btn" id="restore">Restore<input type="file" accept="application/json,.json" hidden></label>
    </div>`);
  $('#export', m).addEventListener('click', store.exportJson);
  setUpShareBox(m);
  setUpListenBox(m);
  setUpPushBox($('#pushBox', m));
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

// ------------------------------------------------------------------ listening time
// A scheduled function (functions/index.js) reads each person's recent Spotify
// plays and keeps a total per Spotify album in users/{uid}/listening. Here we
// only read those totals and match them to albums in the log.

let listenIndex = null; // { groups: { key: group }, byId: { spotifyId: key } }, built from the loaded totals
let listenStamp = '';

async function loadListening() {
  if (ro()) return;
  try {
    const [all, state] = await Promise.all([store.loadListening(), store.trackingState()]);
    tracking = state;
    const stamp = Object.values(all).map((l) => `${l.albumId}:${l.ms}`).join() + (tracking.enabled ? '+' : '');
    if (stamp === listenStamp) return;
    listenStamp = stamp;
    listenIndex = indexListening(all);
    // Show the new totals, unless that would interrupt typing or an open dialog.
    if (!modalRoot.children.length && !document.activeElement?.closest('input, select, textarea')) render();
  } catch (e) { console.warn('Listening totals not loaded:', e.message); }
}
const hasListening = () => !ro() && !!(listenIndex && Object.keys(listenIndex.groups).length);
const pillsOn = () => { try { return localStorage.getItem('music-log:pills') !== 'off'; } catch { return true; } };

async function finishTrackingLogin() {
  const { refreshToken } = pendingTracking;
  pendingTracking = null;
  if (!refreshToken) return toast('Spotify didn’t allow tracking. Try again from Settings.', 'error');
  try {
    await store.startTracking(refreshToken, spotify.clientId());
    tracking = await store.trackingState();
    toast('Listening tracking is on. New plays show up within half an hour.');
  } catch (e) { toast(`Couldn’t turn on tracking: ${e.message}`, 'error'); }
}

function historyBoxHtml() {
  const meta = store.listeningMeta();
  const h = meta.history;
  const hidden = (meta.hidden || []).length;
  const year = (ms) => new Date(ms).getFullYear();
  return h?.parts
    ? `<div class="import-row">${ICON.check}<div><b>Spotify history imported</b><small>${h.plays.toLocaleString()} plays of ${h.albums.toLocaleString()} albums, ${year(h.from)}–${year(h.to)}</small></div>
        <label class="link-btn">Replace<input type="file" id="historyFile" accept=".zip,.json,application/zip,application/json" multiple hidden></label>
        <button type="button" class="link-btn danger" id="historyRemove">Remove</button></div>
      ${hidden ? `<p class="small-print muted">${hidden} album${hidden === 1 ? '' : 's'} hidden from Not logged · <button type="button" class="link" id="unhideAll">Show them again</button></p>` : ''}`
    : `<div class="import-row">${ICON.download}<div><b>Import your full history</b><small>Upload the “Extended streaming history” zip from Spotify’s privacy page to add everything before tracking started.</small></div>
        <label class="btn small">Upload<input type="file" id="historyFile" accept=".zip,.json,application/zip,application/json" multiple hidden></label></div>
      ${hidden ? `<p class="small-print muted">${hidden} album${hidden === 1 ? '' : 's'} hidden from Not logged · <button type="button" class="link" id="unhideAll">Show them again</button></p>` : ''}`;
}

function bindHistoryBox(m) {
  const box = $('#historyBox', m);
  if (!box) return;
  const redraw = () => { box.innerHTML = historyBoxHtml(); bindHistoryBox(m); };
  const busy = (text) => { box.innerHTML = `<p class="pad-sm muted"><span class="spin"></span>${esc(text)}</p>`; };
  $('#historyFile', box)?.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    try {
      busy('Opening your history…');
      const rows = await spHistory.readExport(files, busy);
      busy(`Adding up ${rows.length.toLocaleString()} plays…`);
      await new Promise((r) => setTimeout(r, 30));
      // Plays from after live tracking began are already counted.
      const { albums, info } = spHistory.aggregate(rows, { before: tracking.since || Infinity });
      if (!albums.length) throw new Error('No song plays found in those files.');
      busy('Saving…');
      await store.saveHistory(albums, info);
      listenStamp = '';
      await loadListening();
      render();
      redraw();
      toast(`Imported ${info.plays.toLocaleString()} plays of ${info.albums.toLocaleString()} albums`);
    } catch (err) {
      redraw();
      toast(`Import failed: ${err.message}`, 'error');
    }
  });
  $('#historyRemove', box)?.addEventListener('click', async () => {
    if (!confirm('Remove your imported Spotify history? Plays counted since tracking started are kept.')) return;
    try {
      busy('Removing…');
      await store.removeHistory();
      listenStamp = '';
      await loadListening();
      render();
      redraw();
      toast('Imported history removed');
    } catch (err) { redraw(); toast(`Couldn’t remove it: ${err.message}`, 'error'); }
  });
  $('#unhideAll', box)?.addEventListener('click', async () => {
    try { await store.setListenMeta({ hidden: [] }); redraw(); render(); toast('Hidden albums are back in Not logged'); }
    catch (err) { toast(`Couldn’t save that: ${err.message}`, 'error'); }
  });
}

function setUpListenBox(m) {
  bindHistoryBox(m);
  $('#pillsToggle', m)?.addEventListener('change', (e) => {
    try { localStorage.setItem('music-log:pills', e.target.checked ? 'on' : 'off'); } catch {}
    render();
  });
  const toggle = $('#listenToggle', m);
  if (!toggle) return;
  toggle.addEventListener('change', async () => {
    if (toggle.checked) return spotify.loginForTracking();
    toggle.disabled = true;
    try {
      await store.stopTracking();
      tracking = await store.trackingState();
      $('#listenStatus', m).hidden = true;
      toast('Listening tracking is off. Your totals so far are kept.');
    } catch (e) { toggle.checked = true; toast(`Couldn’t turn off tracking: ${e.message}`, 'error'); }
    toggle.disabled = false;
  });
}

const fmtDur = (ms) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
};
const fmtDay = (ms) => {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
};
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);
function ago(ms) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 864e5);
  if (days <= 0) {
    const min = Math.round((Date.now() - ms) / 60000);
    return min < 2 ? 'just now' : min < 60 ? `${min} min ago` : 'today';
  }
  return days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : fmtDay(ms);
}

function trackingStatusHtml() {
  const t = tracking;
  if (t.lastError) return `<span class="sync-dot error"></span>${esc(t.lastError)}`;
  if (!t.enabled) return '';
  if (!t.lastRun) return '<span class="sync-dot saving"></span>Waiting for the first check, usually within half an hour.';
  const missed = t.gapAt && Date.now() - t.gapAt < 14 * 864e5 ? ` Some plays just before ${fmtDay(t.gapAt)} were missed.` : '';
  return `<span class="sync-dot saved"></span><span>Checked ${ago(t.lastRun)} · ${(t.plays || 0).toLocaleString()} plays counted since ${fmtDay(t.since || t.lastRun)}.${missed}</span>`;
}

const spotifyAlbumId = (url) => (String(url || '').match(/album[/:]([A-Za-z0-9]{22})/) || [])[1] || '';
// Strips "(Deluxe Edition)", "- 2011 Remaster" and the like, so other editions still match.
const baseTitle = (t) => norm(String(t || '').replace(/\s*[([][^)\]]*[)\]]\s*$/, '').replace(/\s+-\s+[^-]*(remaster|edition|version|deluxe|expanded)[^-]*$/i, ''));
const firstArtist = (a) => norm(String(a || '').split(/,|&| and | feat\.? | x /i)[0]);

const groupKey = (artist, title) => `${firstArtist(artist)}|${baseTitle(title)}`;

// Spotify editions of the same album (deluxe, remaster...) are summed into one
// group, keyed by first artist + base title.
function indexListening(all) {
  const groups = {};
  const byId = {};
  for (const l of Object.values(all || {})) {
    const key = groupKey(l.artist, l.title);
    byId[l.albumId] = key;
    const g = groups[key] ||= { key, ids: [], title: l.title, artist: l.artist, art: l.art, spotify: l.spotify,
      ms: 0, plays: 0, first: Infinity, last: 0, albumMs: 0, weeks: {}, tracks: {} };
    g.ids.push(l.albumId);
    if ((l.ms || 0) > (g.top || 0)) Object.assign(g, { top: l.ms, title: l.title, art: l.art || g.art, spotify: l.spotify || g.spotify });
    else if (!g.art && l.art) Object.assign(g, { art: l.art, spotify: g.spotify || l.spotify });
    if (!l.hist) g.liveMs = (g.liveMs || 0) + (l.ms || 0);
    g.ms += l.ms || 0;
    g.plays += l.plays || 0;
    g.first = Math.min(g.first, l.first || Infinity);
    g.last = Math.max(g.last, l.last || 0);
    g.albumMs = Math.max(g.albumMs, l.albumMs || 0);
    for (const [w, ms] of Object.entries(l.weeks || {})) g.weeks[w] = (g.weeks[w] || 0) + ms;
    for (const t of Object.values(l.tracks || {})) {
      const o = g.tracks[norm(t.name)] ||= { name: t.name, ms: 0, plays: 0, weeks: {}, wplays: {} };
      o.ms += t.ms || 0;
      o.plays += t.plays || 0;
      // Songs counted before weekly song totals were kept go in the album's last week.
      const weeks = t.weeks || { [weekKey(l.last || Date.now())]: t.ms || 0 };
      const wplays = t.wplays || { [weekKey(l.last || Date.now())]: t.plays || 0 };
      for (const [w, ms] of Object.entries(weeks)) o.weeks[w] = (o.weeks[w] || 0) + ms;
      for (const [w, n] of Object.entries(wplays)) o.wplays[w] = (o.wplays[w] || 0) + n;
    }
  }
  return { groups, byId };
}

// The listening group for an album in the log: its linked Spotify edition,
// or anything with the same artist and title.
function listeningFor(album) {
  if (ro() || !listenIndex || !album?.title) return null;
  return listenIndex.groups[exactKey(album)] || nearGroup(album);
}

// Edit distance, giving up (returning max + 1) once it's over max.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Typos allowed in a name of this length: none for short names, then about
// one per six letters, at most three.
const slack = (s) => Math.min(3, Math.floor(s.length / 6));

// Albums typed into the log with a small spelling difference from Spotify
// ("thomas dolbaum", "reality awakes") still find their listening, as long as
// either the artist or the title matches exactly. Two things keep different
// albums apart: an album never takes a group that another album in the log
// matches exactly, and titles whose numbers differ ("Vol. 1" / "Vol. 2",
// "III" / "IV") never match. Results are cached until the listening index or
// the log changes.
const numbersIn = (t) => (String(t || '').toLowerCase().match(/\d+|\b[ivx]+\b/g) || []).join(' ');
const exactKey = (album) => listenIndex.byId[spotifyAlbumId(album.spotify)] || groupKey(album.artist, album.title);
let near = { index: null, stamp: '', byArtist: null, byTitle: null, claimed: null, cache: new Map() };
function nearGroup(album) {
  const artist = firstArtist(album.artist);
  const title = baseTitle(album.title);
  if (!artist || !title) return null;
  const years = store.years();
  const stamp = years.map((y) => `${y}:${data.years[y].albums.length}`).join();
  if (near.index !== listenIndex) {
    near = { index: listenIndex, stamp: '', byArtist: new Map(), byTitle: new Map(), claimed: null, cache: new Map() };
    for (const g of Object.values(listenIndex.groups)) {
      const [a, t] = g.key.split('|');
      if (!near.byArtist.has(a)) near.byArtist.set(a, []);
      if (!near.byTitle.has(t)) near.byTitle.set(t, []);
      near.byArtist.get(a).push([t, g]);
      near.byTitle.get(t).push([a, g]);
    }
  }
  if (near.stamp !== stamp) {
    near.stamp = stamp;
    near.cache = new Map();
    near.claimed = new Set();
    for (const y of years) for (const a of data.years[y].albums) if (a.title) near.claimed.add(exactKey(a));
  }
  const id = `${artist}|${title}|${album.title}`;
  if (near.cache.has(id)) return near.cache.get(id);
  const nums = numbersIn(album.title);
  let found = null;
  let foundD = Infinity;
  const look = (list, mine) => {
    const max = slack(mine);
    for (const [other, g] of list || []) {
      if (near.claimed.has(g.key) || numbersIn(g.title) !== nums) continue;
      const d = editDistance(mine, other, max);
      if (d && d <= max && (d < foundD || (d === foundD && g.ms > found.ms))) { found = g; foundD = d; }
    }
  };
  look(near.byArtist.get(artist), title);
  look(near.byTitle.get(title), artist);
  near.cache.set(id, found);
  return found;
}

// Each Spotify-heard album group mapped to the album in the log it belongs to.
function loggedByGroup() {
  const out = {};
  for (const y of store.years()) {
    for (const album of data.years[y].albums) {
      const l = listeningFor(album);
      if (l && !out[l.key]) out[l.key] = album;
    }
  }
  return out;
}

function yearListenHtml(y) {
  if (!hasListening()) return '';
  const seen = new Set();
  let ms = 0;
  for (const album of y.albums) {
    const l = listeningFor(album);
    if (l && !seen.has(l.key)) { seen.add(l.key); ms += l.ms; }
  }
  return ms >= 60000 ? `<p class="hero-stats"><b>${y.albums.length}</b> album${y.albums.length === 1 ? '' : 's'} · <a class="listen-link" href="#/listening/year"><span class="ear"></span><b>${fmtDur(ms).replace(/ 00m$/, '')}</b> listened on Spotify</a></p>` : '';
}

const PERIODS = {
  week: { tab: 'Week', title: 'This week', since: () => weekKey(Date.now()) },
  month: { tab: 'Month', title: 'Last 4 weeks', since: () => weekKey(Date.now() - 21 * 864e5) },
  year: { tab: 'Year', title: 'This year', since: () => `${new Date().getFullYear()}-01-01` },
  all: { tab: 'All', title: 'All time', since: () => '' },
};
// Time in a period, from the weekly totals (a week counts if it starts in the period).
const msSince = (g, since) => (since ? Object.entries(g.weeks).reduce((n, [w, ms]) => n + (w >= since ? ms : 0), 0) : g.ms);
const playsSince = (t, since) => (since ? Object.entries(t.wplays).reduce((n, [w, c]) => n + (w >= since ? c : 0), 0) : t.plays);

let listFilter = 'all'; // or 'unlogged'
let listShown = 25;

function renderListening(period, mode = 'albums') {
  const P = PERIODS[period] ? period : 'month';
  if (mode === 'songs') return renderTopSongs(P);
  const since = PERIODS[P].since();
  const logged = loggedByGroup();
  const rows = Object.values(listenIndex?.groups || {}).map((g) => ({ g, ms: msSince(g, since), album: logged[g.key] }))
    .filter((r) => r.ms >= 60000).sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((n, r) => n + r.ms, 0);
  const inLog = rows.reduce((n, r) => n + (r.album ? r.ms : 0), 0);
  const max = rows[0]?.ms || 1;
  rows.forEach((r, i) => { r.rank = i + 1; });
  const hidden = hiddenHeard();
  const unlogged = rows.filter((r) => !r.album && !hidden.has(r.g.key));
  if (!unlogged.length) listFilter = 'all';
  const list = listFilter === 'unlogged' ? unlogged : rows;
  const top = list.slice(0, listShown);
  const pseudo = (g) => ({ id: `l-${g.ids[0]}`, artist: g.artist, title: g.title, art: g.art || '' });
  // Albums not in the log find their match by themselves (see matchHeard).
  const rowHtml = (r) => {
    const heard = !r.album && !hidden.has(r.g.key);
    return `<li${heard ? ` class="heard" data-heard="${esc(r.g.key)}"` : ''}>
      <span class="n">${r.rank}</span>
      <button class="lb-open" ${heard ? 'data-heard-more aria-expanded="false"' : openAttr(r)}><span class="heard-cover">${coverHtml(r.album || pseudo(r.g), 'sm')}</span>
        <span class="m"><b>${esc(r.g.title)}</b><small>${esc(r.g.artist)}${r.album ? '' : ' · <i>not logged</i>'}</small>
        ${heard ? '<small class="heard-match"><span class="spin"></span> Finding it…</small>' : ''}
        <span class="bar"><i style="width:${Math.max(2, Math.round(r.ms / max * 100))}%"></i></span></span>
        <span class="t">${fmtDur(r.ms)}</span></button>
      ${heard ? `<button class="icon-btn log-add" data-add-heard title="Add ${esc(r.g.title)} to your library" aria-label="Add ${esc(r.g.title)} to your library" disabled>${ICON.plus}</button>
        <div class="heard-pick" hidden></div>` : logBtn(r)}</li>`;
  };
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">your listening</p><h1>${PERIODS[P].title.toLowerCase()}</h1></div></section>
    ${listenNavHtml(P, 'albums')}
    ${!tracking.enabled && !hasListening()
      ? `<div class="empty"><h2>Not tracking yet</h2><p>Switch on Track listening time in Settings to see how long you spend on each album.</p><button class="btn primary" id="goSettings">Open Settings</button></div>`
      : !rows.length
        ? `<div class="empty"><h2>Nothing yet</h2><p>${tracking.enabled ? 'Plays you make on Spotify show up here within half an hour.' : 'No listening counted in this period.'}</p></div>`
        : `<div class="big-total">
            <div><b>${fmtDur(total)}</b><small>on Spotify</small></div>
            <div><b>${rows.length}</b><small>album${rows.length === 1 ? '' : 's'}</small></div>
            <div><b>${Math.round(inLog / total * 100)}%</b><small>on albums in your log</small></div>
          </div>
          ${unlogged.length ? `<div class="lb-filter" role="group" aria-label="Show">
            <button type="button" class="${listFilter === 'all' ? 'on' : ''}" data-lb-filter="all">All</button>
            <button type="button" class="${listFilter === 'unlogged' ? 'on' : ''}" data-lb-filter="unlogged">Not logged <small>${unlogged.length}</small></button>
          </div>` : ''}
          <ol class="lb">${top.map(rowHtml).join('')}</ol>
          ${list.length > listShown ? `<button class="btn small lb-more" id="lbMore">Show more (${list.length - listShown} left)</button>` : ''}`}`;
  watchCovers();
  watchHeard();
  $('#goSettings')?.addEventListener('click', openSettings);
  $('#lbMore')?.addEventListener('click', () => { listShown += 50; render(); });
  $$('[data-lb-filter]').forEach((b) => b.addEventListener('click', () => { listFilter = b.dataset.lbFilter; listShown = 25; render(); }));
}

// Albums heard on Spotify but not in the log: tapping them, or their + button,
// opens Add album with a search for them already filled in.
const openAttr = (r) => (r.album ? `data-open="${r.album.id}"` : `data-log-heard="${esc(r.g.key)}" title="Add to your library"`);
// Albums hidden with "Don't suggest it" lose their + and match.
const hiddenHeard = () => new Set(store.listeningMeta().hidden || []);
const logBtn = (r) => (r.album || hiddenHeard().has(r.g.key) ? '' : `<button class="icon-btn log-add" data-log-heard="${esc(r.g.key)}" title="Add ${esc(r.g.title)} to your library" aria-label="Add ${esc(r.g.title)} to your library">${ICON.plus}</button>`);
document.addEventListener('click', async (e) => {
  const hide = e.target.closest('[data-hide-heard]');
  if (hide && !ro()) {
    const key = hide.dataset.hideHeard;
    hide.closest('li')?.remove();
    try {
      await store.setListenMeta({ hidden: [...hiddenHeard(), key] });
      toast('Won’t suggest that again');
      render();
    } catch (err) { toast(`Couldn’t save that: ${err.message}`, 'error'); }
    return;
  }
  const b = e.target.closest('[data-log-heard]');
  const g = b && listenIndex?.groups[b.dataset.logHeard];
  if (g && !ro()) addAlbum({ query: `${g.artist} ${g.title}` });
});

// ------------------------------------------------------------------ logging heard albums in place

// Each album in the Listening chart that isn't in the log finds its album by
// itself (Spotify, or iTunes) as it scrolls into view. A sure match (same Spotify album, or same artist
// and title) is logged with one tap on +, filed under its release year.
// Otherwise + (or tapping the row) opens the closest few to pick from.
const heardMatches = new Map(); // group key -> Promise of { sure, list, options, failed }
const heardResolved = new Map(); // group key -> the settled value, for clicks

const searchTermFor = (g) => `${String(g.artist).split(/,|&/)[0].trim()} ${String(g.title).replace(/\s*[([][^)\]]*[)\]]\s*$/, '')}`;

// A few lookups at a time, so a long list doesn't fire hundreds at once.
let lookupsRunning = 0;
const lookupsWaiting = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      lookupsRunning++;
      fn().then(resolve, reject).finally(() => { lookupsRunning--; lookupsWaiting.shift()?.(); });
    };
    if (lookupsRunning < 3) run(); else lookupsWaiting.push(run);
  });
}

// Matches are remembered on this device for a fortnight, so opening the
// Listening page again doesn't search for every album again.
const MATCH_KEY = 'music-log:heard-matches';
const MATCH_DAYS = 14;
let savedMatches = null;
function matchStore() {
  if (!savedMatches) {
    try { savedMatches = JSON.parse(localStorage.getItem(MATCH_KEY) || '{}'); } catch { savedMatches = {}; }
    const old = Date.now() - MATCH_DAYS * 864e5;
    for (const [k, v] of Object.entries(savedMatches)) if (!(v.t > old)) delete savedMatches[k];
  }
  return savedMatches;
}
let saveTimer;
function rememberMatch(key, list) {
  const keep = (r) => ({ artist: r.artist, artists: r.artists, title: r.title, art: r.art, year: r.year, type: r.type, spotify: r.spotify });
  matchStore()[key] = { t: Date.now(), list: list.map(keep) };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = Object.entries(matchStore()).sort((a, b) => b[1].t - a[1].t).slice(0, 600);
    savedMatches = Object.fromEntries(all);
    try { localStorage.setItem(MATCH_KEY, JSON.stringify(savedMatches)); } catch {}
  }, 1000);
}

function lookupHeard(g) {
  const saved = matchStore()[g.key];
  if (saved) return Promise.resolve(saved.list);
  return limited(() => findAlbums(searchTermFor(g), 8, { background: true }))
    .then((list) => { rememberMatch(g.key, list); return list; });
}

function matchHeard(g) {
  if (!heardMatches.has(g.key)) {
    heardMatches.set(g.key, lookupHeard(g)
      .then((list) => {
        const id = spotifyAlbumId(g.spotify);
        const same = (r) => (id && spotifyAlbumId(r.spotify) === id)
          || (firstArtist(r.artist) === firstArtist(g.artist) && baseTitle(r.title) === baseTitle(g.title));
        const sure = list.find(same) || null;
        const byArtist = list.filter((r) => firstArtist(r.artist) === firstArtist(g.artist));
        const options = [...(sure ? [sure] : []), ...(byArtist.length ? byArtist : list).filter((r) => r !== sure)].slice(0, 4);
        return { sure, options };
      })
      .catch((e) => {
        // Don't remember a failure: try again next time the row is shown.
        setTimeout(() => { heardMatches.delete(g.key); heardResolved.delete(g.key); }, 0);
        return { sure: null, options: [], failed: true, busy: e?.message === 'rate limited' };
      })
      .then((m) => { if (!m.failed) heardResolved.set(g.key, m); return m; }));
  }
  return heardMatches.get(g.key);
}

const matchDesc = (r) => `<b>${esc(r.title)}</b><small>${esc(r.artist)}${r.year ? ` · ${r.year}` : ''}${TYPE_LABEL[r.type] ? ` · <em class="kind">${TYPE_LABEL[r.type]}</em>` : ''}</small>`;
const asHeard = (g) => ({ artist: g.artist, title: g.title, art: g.art || '', spotify: g.spotify || '', year: '' });

function showHeardMatch(li, g, m) {
  if (!li.isConnected) return;
  const line = $('.heard-match', li);
  const add = $('[data-add-heard]', li);
  add.disabled = false;
  if (m.sure) {
    line.innerHTML = `${ICON.check} Adds as ${esc(m.sure.title)}${m.sure.year ? ` · ${m.sure.year}` : ''}`;
    line.classList.add('sure');
    if (m.sure.art && !g.art) $('.heard-cover', li).innerHTML = coverHtml({ id: `hm-${g.ids[0]}`, artist: m.sure.artist, title: m.sure.title, art: m.sure.art }, 'sm');
  } else if (m.options.length) {
    line.textContent = 'Tap + to choose';
  } else {
    line.textContent = m.busy ? 'Searching paused for a bit: + adds as named'
      : m.failed ? 'Search is down: + adds as named' : 'Not found: + adds as named';
  }
}

const heardObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    heardObserver.unobserve(e.target);
    const g = listenIndex?.groups[e.target.dataset.heard];
    if (g) matchHeard(g).then((m) => showHeardMatch(e.target, g, m));
  }
}, { rootMargin: '400px' });

function watchHeard() {
  heardObserver.disconnect();
  $$('li.heard').forEach((li) => {
    const m = heardResolved.get(li.dataset.heard);
    const g = listenIndex?.groups[li.dataset.heard];
    if (m && g) showHeardMatch(li, g, m);
    else heardObserver.observe(li);
  });
}

function toggleHeardPick(li, g) {
  const box = $('.heard-pick', li);
  const open = box.hidden;
  $('[data-heard-more]', li).setAttribute('aria-expanded', String(open));
  if (!open) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<p class="muted"><span class="spin"></span> Finding it…</p>';
  matchHeard(g).then((m) => {
    if (box.hidden) return;
    box._options = m.options;
    box.innerHTML = `${m.options.length ? `<div class="results">${m.options.map((r, i) => `
        <button type="button" class="result${r === m.sure ? ' chosen' : ''}" data-pick-heard="${i}"><img src="${esc((r.art || '').replace('600x600', '120x120'))}" alt=""><span>${matchDesc(r)}</span></button>`).join('')}</div>` : ''}
      <p class="heard-pick-more">
        <button type="button" class="link-btn" data-pick-heard="named">Add it as it's named on Spotify</button>
        <button type="button" class="link-btn" data-search-heard>Search…</button>
        <button type="button" class="link-btn" data-hide-heard="${esc(g.key)}">Don't suggest it</button>
      </p>`;
  });
}

let addingHeard = false;
async function addHeard(g, r, li) {
  if (addingHeard) return;
  addingHeard = true;
  const btn = li && $('[data-add-heard]', li);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  try {
    const album = { id: store.uid(), artist: r.artist.toLowerCase(), title: r.title.toLowerCase(), songs: [] };
    let year = r.year;
    if (!year) {
      try { year = (await findRelease(album))?.year; } catch {}
    }
    const guessed = !year;
    // Without a release year, file it under the year it was first heard.
    year = String(year || new Date(Number.isFinite(g.first) ? g.first : Date.now()).getFullYear());
    if (r.art) album.art = r.art;
    album.spotify = r.spotify || g.spotify || '';
    if (!album.spotify) delete album.spotify;
    store.ensureYear(year).albums.push(album);
    clearFromQueue(album);
    store.commit();
    clearRecs(album);
    // Logged under a name that doesn't lead back to this listening: stop suggesting it.
    if (listeningFor(album)?.key !== g.key) store.setListenMeta({ hidden: [...hiddenHeard(), g.key] }).catch(() => {});
    toast(guessed ? `Added to ${year}, the year you first played it. Couldn’t find its release year.` : `Added ${album.title} to ${year}`);
    if (!album.art) requestArt(album);
  } finally {
    addingHeard = false;
    render();
  }
}

document.addEventListener('click', (e) => {
  const li = e.target.closest('li.heard');
  const g = li && listenIndex?.groups[li.dataset.heard];
  if (!g || ro()) return;
  if (e.target.closest('[data-add-heard]')) {
    const m = heardResolved.get(g.key);
    if (!m) return;
    if (m.sure) addHeard(g, m.sure, li);
    else if (m.options.length) toggleHeardPick(li, g);
    else addHeard(g, asHeard(g), li);
  } else if (e.target.closest('[data-heard-more]')) {
    toggleHeardPick(li, g);
  } else if (e.target.closest('[data-pick-heard]')) {
    const i = e.target.closest('[data-pick-heard]').dataset.pickHeard;
    addHeard(g, i === 'named' ? asHeard(g) : $('.heard-pick', li)._options[i], li);
  } else if (e.target.closest('[data-search-heard]')) {
    addAlbum({ query: `${g.artist} ${g.title}` });
  }
});

function listenNavHtml(P, mode) {
  const suffix = mode === 'songs' ? '/songs' : '';
  return `<nav class="listen-mode" aria-label="Show">
      <a href="#/listening/${P}" class="${mode === 'albums' ? 'on' : ''}">Albums</a>
      <a href="#/listening/${P}/songs" class="${mode === 'songs' ? 'on' : ''}">Songs</a>
    </nav>
    <nav class="seg listen-seg">${Object.entries(PERIODS).map(([k, v]) => `<a href="#/listening/${k}${suffix}" class="${k === P ? 'on' : ''}">${v.tab}</a>`).join('')}</nav>`;
}

// Every song heard in the period, most played first (then most time).
function renderTopSongs(P) {
  const since = PERIODS[P].since();
  const logged = loggedByGroup();
  const best = new Set();
  for (const y of store.years()) {
    for (const album of data.years[y].albums) {
      const l = listeningFor(album);
      if (!l) continue;
      const fav = data.years[y].favourites.find((f) => f.albumId === album.id);
      bestSongs(songsOf(album, fav).song).forEach((s) => best.add(`${l.key}|${norm(s)}`));
    }
  }
  const songs = [];
  for (const g of Object.values(listenIndex?.groups || {})) {
    for (const [k, t] of Object.entries(g.tracks)) {
      const plays = playsSince(t, since);
      const ms = msSince(t, since);
      if (plays || ms >= 60000) songs.push({ t, g, plays, ms, album: logged[g.key], best: best.has(`${g.key}|${k}`) });
    }
  }
  songs.sort((a, b) => b.plays - a.plays || b.ms - a.ms);
  const top = songs.slice(0, 50);
  const max = top[0]?.plays || 1;
  const pseudo = (g) => ({ id: `l-${g.ids[0]}`, artist: g.artist, title: g.title, art: g.art || '' });
  app.innerHTML = `
    <section class="hero"><div><p class="eyebrow">your listening</p><h1>${PERIODS[P].title.toLowerCase()}</h1></div></section>
    ${listenNavHtml(P, 'songs')}
    ${!top.length
      ? `<div class="empty"><h2>No songs yet</h2><p>${tracking.enabled ? 'Songs you play on Spotify show up here within half an hour.' : 'Switch on Track listening time in Settings to see your most played songs.'}</p></div>`
      : `<div class="big-total">
          <div><b>${songs.reduce((n, s) => n + s.plays, 0).toLocaleString()}</b><small>plays</small></div>
          <div><b>${songs.length.toLocaleString()}</b><small>song${songs.length === 1 ? '' : 's'}</small></div>
        </div>
        <ol class="lb songs">${top.map((s, i) => `<li>
          <span class="n">${i + 1}</span>
          <button class="lb-open" ${openAttr(s)}>${coverHtml(s.album || pseudo(s.g), 'sm')}
            <span class="m"><b class="${s.best ? 'best' : ''}">${esc(s.t.name)}</b><small>${esc(s.g.artist)} · ${esc(s.g.title)}</small>
            <span class="bar"><i style="width:${Math.max(2, Math.round(s.plays / max * 100))}%"></i></span></span>
            <span class="t">${s.plays} play${s.plays === 1 ? '' : 's'}<small>${fmtDur(s.ms)}</small></span></button>${logBtn(s)}</li>`).join('')}</ol>`}`;
  watchCovers();
}

// Monday of a week as YYYY-MM-DD in UTC, matching functions/listening.js.
function weekKey(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function weeksChartHtml(l) {
  const WEEK = 7 * 864e5;
  const now = Date.parse(weekKey(Date.now()));
  let start = Date.parse(weekKey(l.first));
  start = Math.max(start, now - 25 * WEEK); // at most half a year of bars
  const bars = [];
  for (let w = start; w <= now; w += WEEK) bars.push(l.weeks[new Date(w).toISOString().slice(0, 10)] || 0);
  while (bars.length < 8) bars.unshift(0);
  const max = Math.max(...bars, 1);
  const label = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short' });
  return `<div class="weeks" role="img" aria-label="Listening time by week">${bars.map((ms) =>
    `<i class="${ms ? '' : 'z'}" style="height:${ms ? Math.max(6, Math.round(ms / max * 100)) : 4}%" title="${ms ? fmtDur(ms) : ''}"></i>`).join('')}</div>
    <div class="weeks-axis"><span>${label(now - (bars.length - 1) * WEEK)}</span><span>by week</span><span>now</span></div>`;
}

function listenPanelHtml(album, fav) {
  const l = listeningFor(album);
  if (!l || !l.ms) {
    return tracking.enabled && album.title ? '<p class="listen-none">No Spotify plays counted for this album yet.</p>' : '';
  }
  const best = new Set(bestSongs(songsOf(album, fav).song).map(norm));
  const times = l.albumMs ? l.ms / l.albumMs : 0;
  const timesText = times >= 10 ? Math.round(times) : times.toFixed(1).replace(/\.0$/, '');
  const tracks = Object.values(l.tracks).sort((a, b) => b.ms - a.ms).slice(0, 5);
  const top = tracks[0]?.ms || 1;
  return `<div class="listen-box">
    <div class="listen-head">Your listening <small>last played ${ago(l.last)}</small></div>
    <div class="listen-stats">
      <div><b>${fmtDur(l.ms)}</b><small>total time</small></div>
      ${times ? `<div><b>${timesText}×</b><small>front to back</small></div>` : `<div><b>${l.plays}</b><small>plays</small></div>`}
      <div><b>${fmtDay(l.first)}</b><small>first played</small></div>
    </div>
    ${weeksChartHtml(l)}
    ${tracks.length ? `<ul class="tracks">${tracks.map((t) => `<li class="${best.has(norm(t.name)) ? 'best' : ''}">
      <span>${esc(t.name)}</span><em>${t.plays} play${t.plays === 1 ? '' : 's'} · ${fmtDur(t.ms)}</em>
      <div class="bar"><i style="width:${Math.round(t.ms / top * 100)}%"></i></div></li>`).join('')}</ul>` : ''}
  </div>`;
}

// ------------------------------------------------------------------ modal + toast

const closeBtn = (cls = '') => `<button class="icon-btn modal-close ${cls}" data-close aria-label="Close">${ICON.close}</button>`;

// An open popup gets its own history entry, so the phone's back gesture
// closes it instead of leaving the page underneath (and its year) behind.
let skipPop = false;
if (history.state?.modal) history.replaceState(null, '');
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  const top = modalRoot.lastElementChild;
  if (history.state?.modal) {
    // Landed on a popup's leftover entry (e.g. after a link inside it): step over it.
    if (!top) history.back();
    return;
  }
  if (!top) return;
  closeModal(top);
  if (modalRoot.children.length) history.pushState({ modal: true }, '');
});
function releaseModalEntry() {
  // Deferred so a popup that closes and immediately opens another keeps the entry.
  setTimeout(() => {
    if (modalRoot.children.length || !history.state?.modal) return;
    skipPop = true;
    history.back();
  });
}

function openModal(html, cls = '') {
  if (!history.state?.modal) history.pushState({ modal: true }, '');
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
  if (!modalRoot.children.length) releaseModalEntry();
}

let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), kind === 'error' ? 6000 : 2400);
}

// ------------------------------------------------------------------ pick for me

// "Pick for me": a random album from your log, or one that fits a mood. Moods
// come from Last.fm / MusicBrainz tags (see mood.js), read in the background
// while this is open and cached on the device, so the first mood pick on a big
// library may take a moment and every one after is instant.
const pickPrefs = { scope: 'all', mood: '' };
try { Object.assign(pickPrefs, JSON.parse(localStorage.getItem('music-log:pick') || '{}')); } catch {}
const recentPicks = []; // album ids shown lately, so "Another" doesn't repeat itself

function pickPool(scope, year) {
  const out = [];
  for (const y of store.years()) {
    if (scope === 'year' && y !== year) continue;
    const yd = data.years[y];
    const favIds = new Set(yd.favourites.map((f) => f.albumId));
    for (const album of yd.albums) {
      if (!album.artist) continue;
      if (scope === 'favs' && !favIds.has(album.id)) continue;
      out.push({ album, year: y });
    }
  }
  return out;
}

function weightedPick(list, weight = () => 1) {
  const fresh = list.filter((x) => !recentPicks.includes(x.album.id));
  const from = fresh.length ? fresh : list.filter((x) => x.album.id !== recentPicks[0]);
  const pool = from.length ? from : list;
  const total = pool.reduce((n, x) => n + weight(x), 0);
  let r = Math.random() * total;
  for (const x of pool) { r -= weight(x); if (r <= 0) return x; }
  return pool[pool.length - 1];
}

function openPicker() {
  const [page, a] = route();
  const year = page === 'year' && data.years[a] ? a : shownYears()[0];
  if (pickPrefs.scope === 'year') pickPrefs.scope = 'all'; // the year follows the page, so start wide
  const m = openModal(`
    <div class="modal-head"><h2>What should I play?</h2>${closeBtn()}</div>
    <div class="seg pick-scope" role="radiogroup" aria-label="Pick from">
      <a href="#" role="radio" data-scope="all">Everything</a>
      <a href="#" role="radio" data-scope="favs">Favourites</a>
      <a href="#" role="radio" data-scope="year">${esc(year)}</a>
    </div>
    <p class="pick-label">How are you feeling?</p>
    <div class="mood-chips">
      <button type="button" class="mood-chip" data-mood="">${ICON.dice}<span>Surprise me</span></button>
      ${mood.MOODS.map((x) => `<button type="button" class="mood-chip" data-mood="${x.id}"><i aria-hidden="true">${x.emoji}</i><span>${esc(x.label)}</span><small></small></button>`).join('')}
    </div>
    <div id="pickResult" class="pick-result" aria-live="polite"></div>
    <p id="pickStatus" class="pick-status muted"></p>`, 'pick-modal');

  let alive = true;
  let shown = null; // { album, year } on screen
  let scanning = false;
  let pool = [];
  const savePrefs = () => { try { localStorage.setItem('music-log:pick', JSON.stringify(pickPrefs)); } catch {} };
  const untagged = () => pool.filter(({ album }) => mood.cachedTags(album) === undefined);
  const fitsOf = (moodId) => pool.map((x) => ({ ...x, fit: mood.fits(mood.cachedTags(x.album), moodId) })).filter((x) => x.fit);

  function drawChips() {
    $$('[data-scope]', m).forEach((b) => { const on = b.dataset.scope === pickPrefs.scope; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    for (const b of $$('[data-mood]', m)) {
      const on = b.dataset.mood === pickPrefs.mood;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      const small = $('small', b);
      if (small) { const n = fitsOf(b.dataset.mood).length; small.textContent = n || ''; }
    }
  }

  function drawStatus() {
    const left = untagged().length;
    const el = $('#pickStatus', m);
    if (!pickPrefs.mood) { el.textContent = ''; return; }
    if (!left) { el.textContent = `Moods come from ${mood.source()} tags.`; return; }
    el.innerHTML = `<span class="spinner" aria-hidden="true"></span> Reading mood tags from ${mood.source()}: ${pool.length - left} of ${pool.length} albums. Keep this open and more will turn up.`;
  }

  function show(p, why = []) {
    shown = p;
    recentPicks.unshift(p.album.id);
    recentPicks.length = Math.min(recentPicks.length, 12);
    const { album, year: y } = p;
    const rank = store.favRank(data.years[y], album.id);
    const box = $('#pickResult', m);
    box.innerHTML = `<div class="pick-card">
      ${coverHtml(album, 'pick')}
      <div class="pick-info">
        <p class="eyebrow">${esc(y)}${rank ? ` · <span class="accent">#${rank} favourite</span>` : ''}</p>
        <h3>${esc(album.title || album.artist)}</h3>
        ${album.title ? `<p class="pick-artist">${esc(album.artist)}</p>` : ''}
        ${why.length ? `<p class="pick-why">${why.map((w) => `<span>${esc(w)}</span>`).join('')}</p>` : ''}
        <div class="pick-actions">
          <a class="btn spotify small" href="${esc(spotifyUrl(album))}" target="_blank" rel="noopener">${ICON.spotify} Play</a>
          <button type="button" class="btn small" data-pick-open>Open</button>
          <button type="button" class="btn small" data-pick-again title="Pick another">${ICON.refresh} Another</button>
        </div>
      </div>
    </div>`;
    watchCovers(box);
    requestArt(album);
  }

  function message(html) {
    shown = null;
    $('#pickResult', m).innerHTML = `<div class="pick-empty">${html}</div>`;
  }

  // Show a pick for the current choices, or say why there isn't one yet.
  function pick() {
    pool = pickPool(pickPrefs.scope, year);
    drawChips();
    drawStatus();
    if (!pool.length) {
      return message(pickPrefs.scope === 'favs' ? 'No favourites to pick from yet.' : `Nothing logged${pickPrefs.scope === 'year' ? ` for ${esc(year)}` : ''} yet.`);
    }
    if (!pickPrefs.mood) return show(weightedPick(pool));
    const fits = fitsOf(pickPrefs.mood);
    const label = mood.MOODS.find((x) => x.id === pickPrefs.mood).label.toLowerCase();
    if (fits.length) {
      const p = weightedPick(fits, (x) => x.fit.score);
      return show(p, p.fit.why);
    }
    if (untagged().length) {
      message(`<span class="spinner" aria-hidden="true"></span> Looking for something ${esc(label)}…`);
      scan();
    } else {
      message(`Nothing here is tagged ${esc(label)} yet. Try another mood, or pick from Everything.`);
    }
  }

  // Read tags for every untagged album in the pool, a few at a time, while the
  // popup is open. Each find updates the counts, and fills an empty result.
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      while (alive) {
        const todo = untagged();
        if (!todo.length) break;
        const batch = todo.sort(() => Math.random() - 0.5).slice(0, mood.source() === 'Last.fm' ? 3 : 1);
        const results = await Promise.allSettled(batch.map(({ album }) => mood.tagsFor(album)));
        if (!alive) break;
        if (results.some((r) => r.status === 'rejected' && r.reason?.message === 'busy')) await new Promise((r) => setTimeout(r, 20000));
        drawChips();
        drawStatus();
        if (!shown && pickPrefs.mood && fitsOf(pickPrefs.mood).length) pick();
      }
    } finally {
      scanning = false;
    }
    if (alive) { drawChips(); drawStatus(); if (!shown && pickPrefs.mood) pick(); }
  }

  m.addEventListener('click', (e) => {
    const sc = e.target.closest('[data-scope]');
    if (sc) { e.preventDefault(); pickPrefs.scope = sc.dataset.scope; savePrefs(); pick(); if (pickPrefs.mood) scan(); return; }
    const md = e.target.closest('[data-mood]');
    if (md) { pickPrefs.mood = md.dataset.mood; savePrefs(); pick(); if (pickPrefs.mood) scan(); return; }
    if (e.target.closest('[data-pick-again]')) { pick(); return; }
    if (e.target.closest('[data-pick-open]') && shown) { const id = shown.album.id; closeModal(m, true); openAlbum(id); }
  });
  // Stop reading tags once the popup goes, however it closes.
  const gone = new MutationObserver(() => { if (!m.isConnected) { alive = false; gone.disconnect(); } });
  gone.observe(modalRoot, { childList: true });
  pick();
  if (pickPrefs.mood) scan();
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
  const rec = e.target.closest('[data-rec]');
  if (rec) openRec(rec.dataset.rec);
  if (e.target.closest('[data-view-own]')) showOwn();
  if (e.target.closest('[data-pick]') && !ro()) openPicker();
});
$('#addBtn').addEventListener('click', () => data && !ro() && addAlbum());
$('#libsBtn').addEventListener('click', () => data && openLibraries());
$('#searchBtn').addEventListener('click', () => (location.hash = '#/search'));
$('#listenBtn').addEventListener('click', () => (location.hash = '#/listening'));
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
  // A tapped notification, with the app already open: show that recommendation.
  navigator.serviceWorker.addEventListener('message', (e) => {
    const url = e.data?.open;
    if (typeof url === 'string' && url.includes('#/rec/')) location.hash = url.slice(url.indexOf('#'));
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
