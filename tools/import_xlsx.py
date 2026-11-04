"""One-off import of music.xlsx into data/music.json.

Usage: python tools/import_xlsx.py path/to/music.xlsx data/music.json
"""
import json, re, sys, hashlib, difflib
import openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src)


def s(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", " ", str(v)).strip()


def norm(t):
    t = t.lower().replace("&", "and")
    t = re.sub(r"^the ", "", t)
    return re.sub(r"[^a-z0-9]", "", t)


def make_id(year, artist, title, n):
    h = hashlib.sha1(f"{year}|{artist}|{title}|{n}".encode()).hexdigest()[:10]
    return f"a{h}"


def split_songs(v):
    v = s(v)
    if not v or v in ("*", "x"):
        return []
    return [p.strip() for p in v.split(",") if p.strip() and p.strip() not in ("….", "...")]


data = {"version": 1, "years": {}, "toListen": [], "always": []}


def listened(ws, first_row, last_row=None, song_col="D"):
    albums, seen = [], set()
    last_row = last_row or ws.max_row
    for r in range(first_row, last_row + 1):
        artist = s(ws[f"B{r}"].value)
        title = s(ws[f"C{r}"].value)
        if not artist:
            continue
        key = (norm(artist), norm(title))
        if key in seen:
            continue
        seen.add(key)
        songs = split_songs(ws[f"{song_col}{r}"].value) if song_col else []
        if song_col and s(ws[f"E{r}"].value) and ws.title == "2022":
            songs += split_songs(ws[f"E{r}"].value)
        albums.append({"id": make_id(ws.title, artist, title, len(albums)),
                       "artist": artist, "title": title, "songs": songs})
    # drop bare-artist rows when that artist already has a titled entry this year
    titled = {norm(a["artist"]) for a in albums if a["title"]}
    return [a for a in albums if a["title"] or norm(a["artist"]) not in titled]


def find(albums, artist, title="", song=""):
    na, nt = norm(artist), norm(title)
    cands = [a for a in albums if norm(a["artist"]) == na]
    if not cands:  # loose artist match (typos like "nilufer  yanya", "djon")
        cands = [a for a in albums if na and (na in norm(a["artist"]) or norm(a["artist"]) in na)]
    if not cands:  # spelling slips ("maria sommerville")
        cands = [a for a in albums if difflib.SequenceMatcher(None, na, norm(a["artist"])).ratio() > 0.88]
    if nt:
        exact = [a for a in cands if norm(a["title"]) == nt]
        if exact:
            return exact[0]
        loose = [a for a in cands if nt and a["title"] and (nt in norm(a["title"]) or norm(a["title"]) in nt)]
        if loose:
            return loose[0]
    if song:
        ns = norm(song)
        for a in cands:
            if any(norm(x) == ns for x in a["songs"]):
                return a
    with_title = [a for a in cands if a["title"]]
    return (with_title or cands or [None])[0]


def add_fav(year, albums, favs, artist, title="", song="", note=""):
    a = find(albums, artist, title, song)
    if a is None:
        a = {"id": make_id(year, artist, title, len(albums)), "artist": artist,
             "title": title, "songs": [song] if song else []}
        albums.append(a)
    elif title and not a["title"]:
        a["title"] = title
    if any(f["albumId"] == a["id"] for f in favs):
        return
    fav = {"albumId": a["id"], "song": song}
    if note:
        fav["note"] = note
    favs.append(fav)


# ---- per-year sheets -------------------------------------------------------
for year in ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]:
    ws = wb[year]
    last = {"2022": 89, "2025": 105}.get(year)  # rows below are scratch notes
    albums = listened(ws, 4 if year != "2023" else 5, last, None if year in ("2020", "2021") else "D")
    favs = []
    if year == "2021":
        for r in range(4, 21):
            artist = s(ws[f"F{r}"].value)
            if artist:
                add_fav(year, albums, favs, artist)
    elif year == "2022":
        for r in range(4, 31):
            artist = s(ws[f"J{r}"].value)
            if not artist:
                continue
            song = s(ws[f"L{r}"].value)
            add_fav(year, albums, favs, artist, s(ws[f"K{r}"].value),
                    "" if song == "all" else song, s(ws[f"M{r}"].value))
    elif year == "2023":
        for r in range(4, 24):
            artist = s(ws[f"I{r}"].value)
            if artist:
                add_fav(year, albums, favs, artist, "", s(ws[f"J{r}"].value))
    elif year == "2024":
        for r in range(3, 25):
            g = s(ws[f"G{r}"].value)
            if not g:
                continue
            song = s(ws[f"H{r}"].value)
            if " - " in g:
                artist, title = [x.strip() for x in g.split(" - ", 1)]
                title = title.split(" / ")[0]
            else:  # "nick cave" | "wild god" (album in song column)
                artist, title, song = g, song, ""
            add_fav(year, albums, favs, artist, title, song)
    elif year == "2025":
        for r in range(4, 37):
            artist = s(ws[f"G{r}"].value)
            if artist:
                add_fav(year, albums, favs, artist, s(ws[f"H{r}"].value), s(ws[f"I{r}"].value))
    data["years"][year] = {"albums": albums, "favourites": favs}

# ---- to listen / always ----------------------------------------------------
seen = set()
for r in range(1, wb["to listen"].max_row + 1):
    v = s(wb["to listen"][f"B{r}"].value)
    if v and norm(v) not in seen:
        seen.add(norm(v))
        data["toListen"].append(v)
for r in range(1, wb["always"].max_row + 1):
    v = s(wb["always"][f"B{r}"].value)
    if v:
        data["always"].append(v)

with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)

for y, d in data["years"].items():
    print(y, len(d["albums"]), "albums,", len(d["favourites"]), "favourites")
print("to listen", len(data["toListen"]), "always", len(data["always"]))
