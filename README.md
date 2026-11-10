# Music library

An app for logging the albums I listen to each year, ranking my favourites, and jumping straight to them on Spotify.

It's a static site (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages.

## How it works

- **Accounts**: everyone signs in with Google or an email and password (Firebase Auth). Each person's log is stored in Firestore under `users/{uid}`, and [`firestore.rules`](firestore.rules) lets only that person read or write it. Edits are also kept in the browser until they're saved, so nothing is lost offline.
- **Several devices**: before saving a year (or Up next), the app compares it with the server. If another device changed it since, the two are merged album by album ([`js/merge.js`](js/merge.js)), so edits from both survive; when both changed the same field, the device saving wins. Offline edits wait on the device and are merged when the connection is back.
- **Undo**: deleting an album, unfavouriting, and ticking off or removing from Up next show a toast with Undo for 6 seconds instead of asking first.
- **Sharing**: Settings › Share my library gives a 10-character code and link. A signed-in friend who adds it (via the people button, or by opening the link) can browse that person's years, favourites and best songs read-only, and switch back to their own library from the same menu. Up next stays private. Turning sharing off, or making a new code, cuts off everyone who had the old one. Codes live in `shares/{code}`, and the rules check that the reader is listed under `shares/{code}/viewers` for the owner's current code.
- **First sign-in**: a new account can start an empty log or restore a backup file.
- **Backups**: Firestore keeps a weekly backup for 14 weeks (set up by the deploy workflow below; restore one from the Firebase console › Firestore › Backups). Settings › Download backup also saves the whole log as JSON, and Restore backup loads one.
- **Firebase setup**: the web config goes in [`js/config.js`](js/config.js), the rules are deployed by the GitHub Action below, and `andrewwilson201.github.io` must be in Authentication › Settings › Authorized domains. The SDK is bundled into `vendor/firebase.js` (see `tools/firebase-entry.js` to rebuild it).
- `tools/import_xlsx.py` turns the original `music.xlsx` into a JSON backup that can be loaded with Restore backup.
- **Artwork** comes from Spotify (when signed in) or the iTunes Search API, looked up as albums scroll into view, and is saved with the album once it's found.
- **Needs fixing**: All years shows "N albums need fixing" when some have no album name or no cover that could be found. Tapping it lists just those, each with a Fix button that opens Edit and looks for covers (picking one also fills in the Spotify link, and the name if it's missing).
- **Spotify**: "Play on Spotify" opens a Spotify search for the album. To link to an exact album, paste its Spotify link into the album's Edit form.
- **Playlists**: Favourites › Make playlist finds each favourite's best song on Spotify and puts them, in ranking order, into a private "YYYY Favourite Songs" playlist in your own Spotify account, then offers to open it. Running it again replaces the songs in that same playlist. An album can have several best songs: each one shows as a chip, with an "Add another song" box under them (they're stored in the favourite's `song` field joined with `; `). Songs it can't find are listed so you can fix the spelling. The first time, Spotify asks for permission to manage playlists. Everyone who uses it must be listed under User Management in the Spotify developer dashboard while the Spotify app is in development mode.

- **Listening time**: Settings › Track listening time signs in to Spotify a second time (asking only to read recently played tracks) and saves that sign-in to `users/{uid}/private/spotify`. A scheduled Cloud Function ([`functions/index.js`](functions/index.js)) runs every 30 minutes, reads each person's last 50 plays, and adds any new ones to `users/{uid}/listening/{spotifyAlbumId}` (total time, plays, time per week and per track). Spotify doesn't say how much of a track was heard, so each play counts as the track's length, capped by the time since the previous play ended ([`functions/listening.js`](functions/listening.js)). The album details panel matches these totals to the log by Spotify album link, or by artist and title so other editions still count. Friends can't see them. If more than 50 plays happen between checks, Settings says some were missed.

- **Listening page** (headphones button, `#/listening`): an Albums | Songs switch; songs are ranked by plays (`#/listening/{period}/songs`, best songs marked ♥). Top albums by time for this week, the last 4 weeks, this year or all time (from the weekly totals), how much of it was on albums in the log, and unlogged albums in the charts get a + button. Covers show a time pill (Settings can hide it), the year heading shows the year's total, and the year page can sort by Most listened.

- **History import**: Settings › Track listening time › Import your full history takes the "Extended streaming history" zip from Spotify's privacy page (or its `Streaming_History_Audio_*.json` files). It's read and added up in the browser ([`js/history.js`](js/history.js)), only plays from before live tracking started are counted, and the totals per album and song are saved gzipped in `users/{uid}/history/{n}` (a few hundred KB each) with a summary in `users/{uid}/meta/listening`. They show up everywhere live totals do. "Don't suggest it" on an unlogged album hides its + for good.
- **Logging heard albums in place**: in the Listening chart, tapping + on an album not in the log looks it up then (`quickFind`, at most two requests). A sure match (same Spotify album, or same artist and title) is logged under its release year straight away; otherwise the closest few open in the row to pick from, with add-as-named, Search…, Don't suggest it and Don't count it. The chart has an All | Not logged filter and Show more.
- **Don't count**: sleep sounds, white noise or kids' audio can be left out of every listening total, chart, time pill and sort, from the album's listening panel or a chart row. They're listed, folded, under the chart with "Count it again". Saved as `uncounted` in `users/{uid}/meta/listening`.
- **Favourites picker**: Add on a Favourites tab lists the year's most played albums first, with their time, when listening is tracked.
- **New releases**: Settings › New releases into Up next (needs listening tracking). Once a week the `syncListening` function looks up the 40 artists you've logged most (recent years count double) on Spotify and puts albums released in the last three weeks, not logged or queued already, at the top of Up next marked "new release" ([`functions/releases.js`](functions/releases.js)). Artist ids and albums already suggested are remembered in `users/{uid}/private/releases`.

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

The same workflow switches on weekly Firestore backups (kept 14 weeks) if they aren't on yet. If the run shows a warning about backups, give the `github-deploy` service account the **Cloud Datastore Owner** role and run the workflow again from the Actions tab.

## Checks on pull requests

[`.github/workflows/checks.yml`](.github/workflows/checks.yml) runs on every pull request: the function tests, the merge tests, the Firestore rules tests (friends can read your years but not Up next, listening or your Spotify sign-in; recommendations need mutual follows), and a smoke test that opens the app in Chromium against the Firebase emulators with a made-up library ([`tests/fixture.json`](tests/fixture.json)): the main screens, undo, the needs-fixing filter, and two devices editing the same year, one of them offline. To run them locally (needs Java for the emulators):

```sh
cd tests && npm ci && npx playwright install chromium
npm test
npx firebase emulators:exec --only auth,firestore --project music-app-d0f3f 'npm run test:emulators'
```

## Shortcuts

`n` adds an album, `/` searches the whole library (the All years filter), and `Esc` closes a dialog.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```

To test against the Firebase emulators instead of the real project, run `firebase emulators:start --only auth,firestore` (Firestore on port 8081) and open http://localhost:8000/?emulator.
