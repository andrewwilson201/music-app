// The app in a real browser against the Firebase emulators: the main screens
// open without errors, undo works, and edits from two devices both survive.
//   cd tests && npx firebase emulators:exec --only auth,firestore --project music-app-d0f3f 'npm run test:emulators'
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = fileURLToPath(new URL('fixture.json', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

let server;
let browser;
let base;
before(async () => {
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path) || '.html'] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}/?emulator`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

// A browser "device": no service worker (it would bypass routing), and nothing
// outside this machine (Spotify, iTunes, fonts) so the test needs no network.
async function device() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return { ctx, page };
}

async function signIn(page, email, create) {
  await page.goto(base);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'secret123');
  if (create) await page.click('#modeBtn');
  await page.click('#emailBtn');
}

const store = (page, fn, arg) => page.evaluate(async ([src, a]) => {
  const s = await import('./js/store.js');
  return new Function('s', 'a', `return (${src})(s, a)`)(s, a);
}, [fn.toString(), arg]);
async function waitStatus(page, want) {
  for (let i = 0; i < 120; i++) {
    if (await store(page, (s) => s.getStatus().status) === want) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`never got to ${want}`);
}
// Saved, with nothing left waiting to be saved.
async function waitClean(page) {
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => Object.keys(localStorage).every((k) => !k.startsWith('music-log:dirty:'))) && await store(page, (s) => s.getStatus().status) === 'saved') return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('never finished saving');
}

test('the main screens open, and undo puts things back', async () => {
  const { ctx, page } = await device();
  await signIn(page, 'smoke@example.com', true);
  await page.setInputFiles('[data-start="file"] input', FIXTURE);
  await page.waitForSelector('button.card[data-open]');
  assert.equal(await page.locator('button.card[data-open]').count(), 4);

  // Album popup, delete, undo.
  await page.click('button.card[data-open="a4"]');
  await page.click('#deleteAlbum');
  await page.waitForSelector('.toast.show .toast-undo');
  assert.equal(await page.locator('button.card[data-open="a4"]').count(), 0);
  await page.click('.toast-undo');
  await page.waitForSelector('button.card[data-open="a4"]');

  // Favourites: remove the top one, undo, it's back at #1.
  await page.goto(`${base}#/year/2025/favourites`);
  await page.waitForSelector('.fav');
  await page.click('[data-unfav="b3"]');
  await page.waitForSelector('.toast.show .toast-undo');
  await page.click('.toast-undo');
  await page.waitForFunction(() => document.querySelector('.fav')?.dataset.id === 'b3');

  // Settings, Pick for me, All years with the "needs fixing" filter.
  await page.click('#settingsBtn');
  await page.waitForSelector('#shareToggle');
  await page.keyboard.press('Escape');
  await page.goto(`${base}#/all`);
  await page.waitForSelector('#fixToggle');
  await page.click('#fixToggle');
  await page.waitForSelector('.fix-row');
  assert.ok((await page.locator('.fix-row').count()) >= 1);
  await page.click('[data-pick-for-me]');
  await page.waitForSelector('.modal');
  await page.keyboard.press('Escape');
  await page.goto(`${base}#/up-next`);
  await page.waitForSelector('[data-queue="q1"]');

  assert.deepEqual(page.errors, []);
  await ctx.close();
});

test('edits made on two devices are both kept', async () => {
  const phone = await device();
  const laptop = await device();
  await signIn(phone.page, 'sync@example.com', true);
  await phone.page.setInputFiles('[data-start="file"] input', FIXTURE);
  await phone.page.waitForSelector('button.card[data-open]');
  await signIn(laptop.page, 'sync@example.com', false);
  await laptop.page.waitForSelector('button.card[data-open]');

  // The phone loses signal and adds an album; the laptop adds another meanwhile.
  await phone.ctx.setOffline(true);
  await store(phone.page, (s) => { s.getData().years['2026'].albums.push({ id: 'phone1', artist: 'phone band', title: 'offline album', songs: [] }); s.commit(); });
  await waitStatus(phone.page, 'offline');
  await store(laptop.page, (s) => { s.getData().years['2026'].albums.push({ id: 'laptop1', artist: 'laptop band', title: 'online album', songs: [] }); s.commit(); });
  await waitClean(laptop.page);

  // Signal back: the phone's save merges with the laptop's instead of replacing it.
  await phone.ctx.setOffline(false);
  await phone.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitClean(phone.page);
  const ids = (p) => store(p, (s) => s.getData().years['2026'].albums.map((a) => a.id));
  assert.ok((await ids(phone.page)).includes('laptop1'), 'the phone shows the laptop’s album');
  await laptop.page.reload();
  await laptop.page.waitForSelector('button.card[data-open]');
  const after = await ids(laptop.page);
  assert.ok(after.includes('phone1') && after.includes('laptop1'), `both albums saved, got ${after}`);

  assert.deepEqual([...phone.page.errors, ...laptop.page.errors], []);
  await phone.ctx.close();
  await laptop.ctx.close();
});
