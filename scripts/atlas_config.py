"""
Per-atlas configuration for the Earshot asset pipeline.

One entry per file in raw/. Each entry declares: type, entity, expected
frame names, layout hints, and chroma key flag.

Detection order is deterministic:
  - Strip layouts: left to right (sorted by bbox x_min)
  - Grid layouts:  top to bottom by row band, then left to right within row

Frame names are extracted from the original slice.js config and must be
globally unique within an entity.
"""

ATLAS_PROFILES = {
    # ── Player character (5 atlases, one entity) ──────────────────────────

    "player-base.png": {
        "type": "character_strip",
        "entity": "player",
        "frames": ["idle", "walk1", "walk2", "walk3", "walk4", "crouch", "dead"],
        "chroma_key": True,
    },
    "player-run.png": {
        "type": "character_strip",
        "entity": "player",
        "frames": ["run1", "run2", "run3", "run4", "run-stop", "run-look-back"],
        "chroma_key": True,
    },
    "player-crouch.png": {
        "type": "character_strip",
        "entity": "player",
        "frames": [
            "crouch-idle1", "crouch-idle2",
            "crouch-walk1", "crouch-walk2", "crouch-walk3", "crouch-walk4",
        ],
        "chroma_key": True,
    },
    "player-scared.png": {
        "type": "character_strip",
        "entity": "player",
        "frames": [
            "scared-idle1", "scared-idle2",
            "scared-walk1", "scared-walk2", "scared-walk3", "scared-walk4",
        ],
        "chroma_key": True,
    },
    "player-caught.png": {
        "type": "character_strip",
        "entity": "player",
        "frames": [
            "caught1", "caught2", "caught3",
            "dead-collapsed", "dead-blood", "dead-flashlight-out",
        ],
        "chroma_key": True,
    },

    # ── Monster character (4 atlases, one entity) ─────────────────────────

    "monster-base.png": {
        "type": "character_strip",
        "entity": "monster",
        "frames": ["idle1", "idle2", "walk1", "walk2", "walk3", "walk4"],
        "chroma_key": True,
    },
    "monster-alert.png": {
        "type": "character_strip",
        "entity": "monster",
        "frames": ["alert1", "alert2", "hunt1", "hunt2", "hunt3", "hunt4"],
        "chroma_key": True,
    },
    "monster-charge.png": {
        "type": "character_strip",
        "entity": "monster",
        "frames": ["charge1", "charge2", "charge3", "charge4", "attack1", "attack2"],
        "chroma_key": True,
    },
    "monster-attack.png": {
        "type": "character_strip",
        "entity": "monster",
        "frames": ["attack3", "howl1", "howl2"],
        "chroma_key": True,
    },
    "monster_confused.png": {
        "type": "character_strip",
        "entity": "monster",
        "frames": ["confused1", "confused2", "confused3", "confused4", "confused5", "confused6"],
        "chroma_key": True,
    },

    # ── Props (2D grid, 6 cols x 2 rows) ──────────────────────────────────

    "props.png": {
        "type": "props_grid",
        "entity": "props",
        "rows": 2,
        "cols": 6,
        "frames": [
            # row 0, left to right
            "door-closed", "door-open", "desk-hide", "locker-hide", "keycard", "breaker-off",
            # row 1, left to right
            "breaker-on", "vent", "flickerlight", "radio-table", "exit-sign", "corpse",
        ],
        "chroma_key": True,
    },

    # ── Single object on green background ─────────────────────────────────

    "radio.png": {
        "type": "single_object",
        "entity": "radio",
        "frames": ["radio"],
        "chroma_key": True,
    },

    # ── Full-scene backgrounds (no chroma key) ────────────────────────────

    "reception.png": {
        "type": "background",
        "entity": "reception",
        "frames": ["reception"],
        "chroma_key": False,
    },
    "cubicles.png": {
        "type": "background",
        "entity": "cubicles",
        "frames": ["cubicles"],
        "chroma_key": False,
    },
    "server.png": {
        "type": "background",
        "entity": "server",
        "frames": ["server"],
        "chroma_key": False,
    },
    "stairwell.png": {
        "type": "background",
        "entity": "stairwell",
        "frames": ["stairwell"],
        "chroma_key": False,
    },
    "title.png": {
        "type": "background",
        "entity": "title",
        "frames": ["title"],
        "chroma_key": False,
    },
    "gameover.png": {
        "type": "background",
        "entity": "gameover",
        "frames": ["gameover"],
        "chroma_key": False,
    },
}
