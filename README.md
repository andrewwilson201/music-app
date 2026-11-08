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
- **Playlists**: Favourites › Make playlist finds each favourite's best song on Spotify and puts them, in ranking order, into a private "YYYY Favourite Songs" playlist in your own Spotify account, then offers to open it. Running it again replaces the songs in that same playlist. An album can have several best songs: each one shows as a chip, with an "Add another song" box under them (they're stored in the favourite's `song` field joined with `; `). Songs it can't find are listed so you can fix the spelling. The first time, Spotify asks for permission to manage playlists. Everyone who uses it must be listed under User Management in the Spotify developer dashboard while the Spotify app is in development mode.

- **Listening time**: Settings › Track listening time signs in to Spotify a second time (asking only to read recently played tracks) and saves that sign-in to `users/{uid}/private/spotify`. A scheduled Cloud Function ([`functions/index.js`](functions/index.js)) runs every 30 minutes, reads each person's last 50 plays, and adds any new ones to `users/{uid}/listening/{spotifyAlbumId}` (total time, plays, time per week and per track). Spotify doesn't say how much of a track was heard, so each play counts as the track's length, capped by the time since the previous play ended ([`functions/listening.js`](functions/listening.js)). The album details panel matches these totals to the log by Spotify album link, or by artist and title so other editions still count. Friends can't see them. If more than 50 plays happen between checks, Settings says some were missed.

- **Listening page** (headphones button, `#/listening`): an Albums | Songs switch; songs are ranked by plays (`#/listening/{period}/songs`, best songs marked ♥). Top albums by time for this week, the last 4 weeks, this year or all time (from the weekly totals), how much of it was on albums in the log, and a "Heard, not logged" list with a Log it button; unlogged albums in the charts also get a + button. Covers show a time pill (Settings can hide it), the year heading shows the year's total, and the year page can sort by Most listened.

- **History import**: Settings › Track listening time › Import your full history takes the "Extended streaming history" zip from Spotify's privacy page (or its `Streaming_History_Audio_*.json` files). It's read and added up in the browser ([`js/history.js`](js/history.js)), only plays from before live tracking started are counted, and the totals per album and song are saved gzipped in `users/{uid}/history/{n}` (a few hundred KB each) with a summary in `users/{uid}/meta/listening`. They show up everywhere live totals do. "Heard, not logged" only suggests albums played since tracking began unless "Suggest albums from imported history" is ticked, and the × on a suggestion hides that album for good.
- **Sort through them** (`#/listening/sort`): goes through every unlogged album heard for 5+ minutes, most listened first, one at a time. Each is looked up automatically (`findAlbums`); a sure match (same Spotify album, or same artist and title) is one tap to Add, filed under its release year, and otherwise the closest few are shown and tapping one adds it. Not for me hides it, Later moves it to the back.

## Deploying the listening function

It needs the Firebase project on the Blaze plan (the usage fits in the free allowance). From this folder:

```sh
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase deploy --only functions
```

`cd functions && npm test` runs the tests for the counting logic.

## Shortcuts

`n` adds an album, `/` searches every year, and `Esc` closes a dialog.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```

To test against the Firebase emulators instead of the real project, run `firebase emulators:start --only auth,firestore` (Firestore on port 8081) and open http://localhost:8000/?emulator.
