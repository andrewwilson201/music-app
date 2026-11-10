// Firestore rules: who can read and write what. Runs against the emulator:
//   cd tests && npx firebase emulators:exec --only auth,firestore --project music-app-d0f3f 'npm run test:emulators'
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'music-app-d0f3f',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8081 },
  });
});
after(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid) => env.authenticatedContext(uid).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ann shares with code ANNCODE and bob added it; bob shares BOBCODE and ann added it.
async function friends({ mutual = true } = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, 'users/ann'), { toListen: [{ id: 'q', artist: 'x', title: 'y' }] });
    await setDoc(doc(db, 'users/ann/years/2026'), { albums: [], favourites: [] });
    await setDoc(doc(db, 'users/ann/listening/abc'), { ms: 1 });
    await setDoc(doc(db, 'users/ann/private/spotify'), { refreshToken: 'secret' });
    await setDoc(doc(db, 'users/ann/meta/share'), { token: 'ANNCODE' });
    await setDoc(doc(db, 'shares/ANNCODE'), { uid: 'ann', name: 'Ann' });
    await setDoc(doc(db, 'shares/ANNCODE/viewers/bob'), { name: 'Bob' });
    if (mutual) {
      await setDoc(doc(db, 'users/bob/meta/share'), { token: 'BOBCODE' });
      await setDoc(doc(db, 'shares/BOBCODE'), { uid: 'bob', name: 'Bob' });
      await setDoc(doc(db, 'shares/BOBCODE/viewers/ann'), { name: 'Ann' });
    }
  });
}

test('you can read and write your own library', async () => {
  await assertSucceeds(setDoc(doc(as('ann'), 'users/ann/years/2026'), { albums: [], favourites: [] }));
  await assertSucceeds(getDoc(doc(as('ann'), 'users/ann/years/2026')));
});

test('a stranger can read nothing and write nothing', async () => {
  await friends();
  await assertFails(getDoc(doc(as('eve'), 'users/ann/years/2026')));
  await assertFails(getDoc(doc(as('eve'), 'users/ann')));
  await assertFails(setDoc(doc(as('eve'), 'users/ann/years/2026'), { albums: [] }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/ann/years/2026')));
});

test("a friend with your code reads your years, but not Up next, listening or Spotify sign-in", async () => {
  await friends();
  const bob = as('bob');
  await assertSucceeds(getDoc(doc(bob, 'users/ann/years/2026')));
  await assertFails(getDoc(doc(bob, 'users/ann')));
  await assertFails(getDoc(doc(bob, 'users/ann/listening/abc')));
  await assertFails(getDoc(doc(bob, 'users/ann/private/spotify')));
  await assertFails(setDoc(doc(bob, 'users/ann/years/2026'), { albums: [] }));
});

test('a new share code cuts off friends who had the old one', async () => {
  await friends();
  await seed((db) => setDoc(doc(db, 'users/ann/meta/share'), { token: 'NEWCODE' }));
  await assertFails(getDoc(doc(as('bob'), 'users/ann/years/2026')));
});

const rec = (extra = {}) => ({ from: 'bob', fromName: 'Bob', artist: 'geese', title: 'getting killed', sentAt: serverTimestamp(), ...extra });

test('friends who follow each other can recommend albums', async () => {
  await friends();
  await assertSucceeds(setDoc(doc(as('bob'), 'users/ann/recs/r1'), rec()));
  await assertFails(getDoc(doc(as('bob'), 'users/ann/recs/r1')));
  // ...with a song to start with
  await assertSucceeds(setDoc(doc(as('bob'), 'users/ann/recs/r2'), rec({ song: 'trinidad', songSpotify: 'https://open.spotify.com/track/abc' })));
  await assertFails(setDoc(doc(as('bob'), 'users/ann/recs/r3'), rec({ song: 'x'.repeat(201) })));
});

test("recommendations need both of you following each other, and can't be forged", async () => {
  await friends({ mutual: false });
  await assertFails(setDoc(doc(as('bob'), 'users/ann/recs/r1'), rec()));
  await friends();
  await assertFails(setDoc(doc(as('bob'), 'users/ann/recs/r2'), rec({ from: 'someone-else' })));
  await assertFails(setDoc(doc(as('bob'), 'users/ann/recs/r3'), rec({ extra: 'field' })));
  await assertFails(setDoc(doc(as('eve'), 'users/ann/recs/r4'), rec({ from: 'eve' })));
});
