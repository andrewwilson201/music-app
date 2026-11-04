# Listening log

A personal app for logging the albums I listen to each year, ranking my favourites, and jumping straight to them on Spotify.

It's a static site (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages.

## How it works

- **Data** lives in [`data/music.json`](data/music.json). It was imported from my old `music.xlsx` with `tools/import_xlsx.py`.
- **Saving**: open Settings (the cog) and paste a fine-grained GitHub token that has *Contents: read and write* on this repo only. Edits are then committed straight to `data/music.json`, so every device sees them. Without a token, edits stay in that browser only.
- **Artwork** comes from the iTunes Search API, looked up as albums scroll into view, and is saved into the data file once it's found.
- **Spotify**: "Play on Spotify" opens a Spotify search for the album. To link to an exact album, paste its Spotify link into the album's Edit form.

## Shortcuts

`n` adds an album, `/` searches every year, and `Esc` closes a dialog.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```
