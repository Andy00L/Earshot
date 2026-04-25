# Earshot — Asset Pipeline (v4)

Robust multi-atlas slicer for the *Earshot* hand-drawn horror game.

## What's new in v4

- **Multi-atlas characters** — `player-base.png`, `player-run.png`, etc. all merge into one `assets/player/` entry. Game accesses `assets.player.run1` regardless of which source image the frame came from.
- **Forgiving frame counts** — if ChatGPT gives 5 frames instead of 6, slicer uses what it found. Extras get auto-named.
- **Visual preview HTML** — every run produces `assets/preview.html`. Open in browser to QA every frame visually.
- **Smarter file detection** — accepts `.png`, `.jpg`, `.jpeg`, `.webp`.
- **Cleaner output** — readable progress + summary report.

## Setup

```bash
npm install
```

## Workflow

1. Generate atlases in ChatGPT
2. Drop them into `raw/` with the right filename (see below)
3. `npm run slice`
4. Open `assets/preview.html` in browser to QA

## Expected file names

### Player (5 atlases → all merge into `assets/player/`)

| File in `raw/` | Frames |
|---|---|
| `player-base.png` | idle, walk1-4, crouch, dead |
| `player-run.png` | run1-4, run-stop, run-look-back |
| `player-crouch.png` | crouch-idle1-2, crouch-walk1-4 |
| `player-scared.png` | scared-idle1-2, scared-walk1-4 |
| `player-caught.png` | caught1-3, dead-collapsed, dead-blood, dead-flashlight-out |

### Monster (4 atlases → all merge into `assets/monster/`)

| File in `raw/` | Frames |
|---|---|
| `monster-base.png` | idle1-2, walk1-4 |
| `monster-alert.png` | alert1-2, hunt1-4 |
| `monster-charge.png` | charge1-4, attack1-2 |
| `monster-attack.png` | attack3, howl1-2 |

### Rooms (single illustrated backgrounds)

| File in `raw/` | Notes |
|---|---|
| `reception.png` | OR `reception-l.png` + `reception-r.png` (auto-stitched) |
| `cubicles.png` | OR halves |
| `server.png` | OR halves |
| `stairwell.png` | OR halves |

### Props + UI

| File | Notes |
|---|---|
| `props.png` | 6×2 grid of 96×96 props |
| `title.png` | Title screen |
| `gameover.png` | Game over screen |
| `radio.png` | HUD walkie-talkie |

## Manifest format

`assets/atlas.json` is what the game loads:

```json
{
  "player": {
    "type": "character",
    "frames": {
      "idle":         { "file": "...", "width": 221, "height": 581, "baselineY": 503, "sourceAtlas": "player-base" },
      "run1":         { "file": "...", "width": 411, "height": 627, "baselineY": 489, "sourceAtlas": "player-run" },
      "scared-walk1": { "file": "...", "width": 264, "height": 627, "baselineY": 531, "sourceAtlas": "player-scared" }
    },
    "boundingBox": { "width": 778, "height": 627 }
  }
}
```

Game references frames as `character.frame` — e.g. `player.run1`, `player.scared-walk2`.

`baselineY` = where the character's feet are within the frame. Use it to anchor sprites to a consistent floor line.

## Adding more atlases

Edit `CHARACTERS` map at top of `scripts/slice.js`. Add an entry:

```js
'player-newatlas': ['frame1', 'frame2', 'frame3', ...]
```

Re-run `npm run slice`.

## Tuning detection

At top of `scripts/slice.js`:

- `GAP_THRESHOLD` (default 8) — min empty columns between frames
- `CONTENT_BRIGHTNESS_THRESHOLD` (default 100) — pixel darkness cutoff for content
- `MIN_DARK_PIXELS_PER_COLUMN` (default 3) — noise filter
