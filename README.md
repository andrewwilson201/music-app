# Music library

An app for logging the albums I listen to each year, ranking my favourites, and jumping straight to them on Spotify.

It's a static site (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages.

## How it works

- **Accounts**: everyone signs in with Google or an email and password (Firebase Auth). Each person's log is stored in Firestore under `users/{uid}`, and [`firestore.rules`](firestore.rules) lets only that person read or write it. Edits are also kept in the browser until they're saved, so nothing is lost offline.
- **Sharing**: Settings › Share my library gives a 10-character code and link. A signed-in friend who adds it (via the people button, or by opening the link) can browse that person's years, favourites and best songs read-only, and switch back to their own library from the same menu. Up next stays private. Turning sharing off, or making a new code, cuts off everyone who had the old one. Codes live in `shares/{code}`, and the rules check that the reader is listed under `shares/{code}/viewers` for the owner's current code.
- **First sign-in**: a new account can start an empty log, restore a backup file, or, on a device that used the older GitHub-token version, bring that log over.
- **Backups**: Settings › Download backup saves the whole log as JSON; Restore backup loads one.
- **Firebase setup**: the web config goes in [`js/config.js`](js/config.js), the rules go in Firebase console › Firestore › Rules, and `andrewwilson201.github.io` must be in Authentication › Settings › Authorized domains. The SDK is bundled into `vendor/firebase.js` (see `tools/firebase-entry.js` to rebuild it).
- `tools/import_xlsx.py` turns the original `music.xlsx` into a JSON backup that can be loaded with Restore backup.
- **Artwork** comes from the iTunes Search API, looked up as albums scroll into view, and is saved into the data file once it's found.
- **Spotify**: "Play on Spotify" opens a Spotify search for the album. To link to an exact album, paste its Spotify link into the album's Edit form.

## Shortcuts

`n` adds an album, `/` searches every year, and `Esc` closes a dialog.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```

To test against the Firebase emulators instead of the real project, run `firebase emulators:start --only auth,firestore` (Firestore on port 8081) and open http://localhost:8000/?emulator.
