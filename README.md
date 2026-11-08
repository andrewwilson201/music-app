# Music library

An app for logging the albums I listen to each year, ranking my favourites, and jumping straight to them on Spotify.

It's a static site (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages.

## How it works

- **Accounts**: everyone signs in with Google or an email and password (Firebase Auth). Each person's log is stored in Firestore under `users/{uid}`, and [`firestore.rules`](firestore.rules) lets only that person read or write it. Edits are also kept in the browser until they're saved, so nothing is lost offline.
- **Sharing**: Settings › Share my library gives a 10-character code and link. A signed-in friend who adds it (via the people button, or by opening the link) can browse that person's years, favourites and best songs read-only, and switch back to their own library from the same menu. Up next stays private. Turning sharing off, or making a new code, cuts off everyone who had the old one. Codes live in `shares/{code}`, and the rules check that the reader is listed under `shares/{code}/viewers` for the owner's current code.
- **First sign-in**: a new account can start an empty log or restore a backup file.
- **Backups**: Settings › Download backup saves the whole log as JSON; Restore backup loads one.
- **Firebase setup**: the web config goes in [`js/config.js`](js/config.js), the rules are deployed by the GitHub Action below, and `andrewwilson201.github.io` must be in Authentication › Settings › Authorized domains. The SDK is bundled into `vendor/firebase.js` (see `tools/firebase-entry.js` to rebuild it).
- `tools/import_xlsx.py` turns the original `music.xlsx` into a JSON backup that can be loaded with Restore backup.
- **Artwork** comes from the iTunes Search API, looked up as albums scroll into view, and is saved into the data file once it's found.
- **Spotify**: "Play on Spotify" opens a Spotify search for the album. To link to an exact album, paste its Spotify link into the album's Edit form.
- **Playlists**: Favourites › Make playlist finds each favourite's best song on Spotify and puts them, in ranking order, into a private "YYYY Favourite Songs" playlist in your own Spotify account, then offers to open it. Running it again replaces the songs in that same playlist. An album can have several best songs: each one shows as a chip, with an "Add another song" box under them (they're stored in the favourite's `song` field joined with `; `). Songs it can't find are listed so you can fix the spelling. The first time, Spotify asks for permission to manage playlists. Everyone who uses it must be listed under User Management in the Spotify developer dashboard while the Spotify app is in development mode.

- **Listening time**: Settings › Track listening time signs in to Spotify a second time (asking only to read recently played tracks) and saves that sign-in to `users/{uid}/private/spotify`. A scheduled Cloud Function ([`functions/index.js`](functions/index.js)) runs every 30 minutes, reads each person's last 50 plays, and adds any new ones to `users/{uid}/listening/{spotifyAlbumId}` (total time, plays, time per week and per track). Spotify doesn't say how much of a track was heard, so each play counts as the track's length, capped by the time since the previous play ended ([`functions/listening.js`](functions/listening.js)). The album details panel matches these totals to the log by Spotify album link, or by artist and title so other editions still count. Friends can't see them. If more than 50 plays happen between checks, Settings says some were missed.

- **Listening page** (headphones button, `#/listening`): an Albums | Songs switch; songs are ranked by plays (`#/listening/{period}/songs`, best songs marked ♥). Top albums by time for this week, the last 4 weeks, this year or all time (from the weekly totals), how much of it was on albums in the log, and unlogged albums in the charts get a + button. Covers show a time pill (Settings can hide it), the year heading shows the year's total, and the year page can sort by Most listened.

- **History import**: Settings › Track listening time › Import your full history takes the "Extended streaming history" zip from Spotify's privacy page (or its `Streaming_History_Audio_*.json` files). It's read and added up in the browser ([`js/history.js`](js/history.js)), only plays from before live tracking started are counted, and the totals per album and song are saved gzipped in `users/{uid}/history/{n}` (a few hundred KB each) with a summary in `users/{uid}/meta/listening`. They show up everywhere live totals do. "Don't suggest it" on an unlogged album hides its + for good.
- **Logging heard albums in place**: in the Listening chart, each album not in the log looks itself up as it scrolls into view (`findAlbums`, three at a time). A sure match (same Spotify album, or same artist and title) shows "Adds as … · year" and one tap on + logs it under its release year; otherwise + or tapping the row opens the closest few to pick from, with add-as-named, Search… and Don't suggest it. The chart has an All | Not logged filter and Show more.

- **Recommendations**: friends who share with each other can send an album from its popup (Recommend). It's written to `users/{to}/recs/{id}` (only allowed while both follow each other's current code, see `firestore.rules`) and the recipient's app moves it into their Up next, tagged with who sent it and their note, so they can listen before deciding whether to log it.
- **Notifications**: Settings › Notifications saves this device's Firebase Cloud Messaging token in `users/{uid}/private/push`. After sending a recommendation the app calls the `notifyRec` function, which pushes "{name} recommends" to the recipient's devices; `sw.js` shows it and a tap opens `#/rec/{id}`, which shows that album in Up next. Needs `FIREBASE_VAPID_KEY` in `js/config.js` (Firebase console › Project settings › Cloud Messaging › Web Push certificates). On iPhone it only works once the app is added to the Home Screen.

## Deploying the functions and rules

A GitHub Action ([`.github/workflows/deploy-firebase.yml`](.github/workflows/deploy-firebase.yml)) runs the function tests and deploys `firestore.rules` and the functions whenever they change on `main`. It can also be run by hand from the Actions tab (Run workflow). It needs the Firebase project on the Blaze plan (the usage fits in the free allowance).

One-time setup:

1. Google Cloud console › IAM & Admin › Service Accounts (project `music-app-d0f3f`) › Create service account, named e.g. `github-deploy`.
2. Give it these roles: Firebase Admin, Cloud Functions Admin, Cloud Run Admin, Cloud Scheduler Admin, Artifact Registry Administrator, Service Account User.
3. Open it › Keys › Add key › JSON, which downloads a file.
4. GitHub › this repository › Settings › Secrets and variables › Actions › New repository secret: name `FIREBASE_SERVICE_ACCOUNT`, value = the whole contents of that file. Then delete the file.

Until the secret exists the workflow only runs the tests. `cd functions && npm test` runs them locally.

## Shortcuts

`n` adds an album, `/` searches the whole library (the All years filter), and `Esc` closes a dialog.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```

To test against the Firebase emulators instead of the real project, run `firebase emulators:start --only auth,firestore` (Firestore on port 8081) and open http://localhost:8000/?emulator.
