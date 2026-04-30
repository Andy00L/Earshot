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
    "player-hide-desk-enter.png": {
        "type": "fixed_cell_strip",
        "entity": "player",
        "frame_count": 6,
        "frames": [
            "hide-desk-enter1", "hide-desk-enter2", "hide-desk-enter3",
            "hide-desk-enter4", "hide-desk-enter5", "hide-desk-enter6",
        ],
        "chroma_key": True,
    },
    "player-hide-desk-exit.png": {
        "type": "fixed_cell_strip",
        "entity": "player",
        "frame_count": 6,
        "frames": [
            "hide-desk-exit1", "hide-desk-exit2", "hide-desk-exit3",
            "hide-desk-exit4", "hide-desk-exit5", "hide-desk-exit6",
        ],
        "chroma_key": True,
    },
    "player-hide-desk-idle.png": {
        "type": "fixed_cell_strip",
        "entity": "player",
        "frame_count": 6,
        "frames": [
            "hide-desk-idle1", "hide-desk-idle2", "hide-desk-idle3",
            "hide-desk-idle4", "hide-desk-idle5", "hide-desk-idle6",
        ],
        "chroma_key": True,
    },

    "locker_hide.png": {
        "type": "single_chroma",
        "entity": "player",
        "frames": ["locker-hide"],
        "chroma_key": True,
        "chroma_color": "magenta",
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

    # ── Jumper character (8 atlases, one entity) ─────────────────────────

    "jumper-emerge-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["emerge1", "emerge2", "emerge3", "emerge4", "emerge5", "emerge6"],
        "chroma_key": True,
    },
    "jumper-fall-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["fall1", "fall2", "fall3", "fall4", "fall5", "fall6"],
        "chroma_key": True,
    },
    "jumper-walk-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["walk1", "walk2", "walk3", "walk4", "walk5", "walk6"],
        "chroma_key": True,
    },
    "jumper-run-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["run1", "run2", "run3", "run4", "run5", "run6"],
        "chroma_key": True,
    },
    "jumper-attack-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["attack1", "attack2", "attack3", "attack4", "attack5", "attack6"],
        "chroma_key": True,
    },
    "jumper-getup-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["getup1", "getup2", "getup3", "getup4", "getup5", "getup6"],
        "chroma_key": True,
    },
    "jumper-retreat-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["retreat1", "retreat2", "retreat3", "retreat4", "retreat5", "retreat6"],
        "chroma_key": True,
    },
    "jumper-idle-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "jumper",
        "frame_count": 6,
        "frames": ["idle1", "idle2", "idle3", "idle4", "idle5", "idle6"],
        "chroma_key": True,
    },

    # ── Whisperer character (4 atlases, one entity) ──────────────────────

    "whisperer-spawn-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "whisperer",
        "frame_count": 6,
        "frames": ["spawn1", "spawn2", "spawn3", "spawn4", "spawn5", "spawn6"],
        "chroma_key": True,
    },
    "whisperer-idle-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "whisperer",
        "frame_count": 6,
        "frames": ["idle1", "idle2", "idle3", "idle4", "idle5", "idle6"],
        "chroma_key": True,
    },
    "whisperer-glide-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "whisperer",
        "frame_count": 6,
        "frames": ["glide1", "glide2", "glide3", "glide4", "glide5", "glide6"],
        "chroma_key": True,
    },
    "whisperer-fade-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "whisperer",
        "frame_count": 6,
        "frames": ["fade1", "fade2", "fade3", "fade4", "fade5", "fade6"],
        "chroma_key": True,
    },

    # ── Environment sprite sheets (10 atlases) ──────────────────────────

    "vents-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "vents",
        "frame_count": 6,
        "frames": ["closed", "eyes", "drip", "bent", "open", "sealed"],
        "chroma_key": True,
    },
    "ladder-and-traversal-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "traversal",
        "frame_count": 6,
        "frames": ["ladder-mid", "ladder-bottom", "ladder-top", "catwalk", "plank-floor", "hatch"],
        "chroma_key": True,
    },
    "workbench-and-craft-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "workbench",
        "frame_count": 6,
        "frames": ["bench", "bench-glow", "crafting", "finished-item", "tool-rack", "crate"],
        "chroma_key": True,
    },
    "bookshelves-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "bookshelves",
        "frame_count": 6,
        "frames": ["normal", "fake", "ajar-30", "ajar-90", "cabinet", "storage-rack"],
        "chroma_key": True,
    },
    "shade-and-tape-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "shade-tape",
        "frame_count": 6,
        "frames": ["shade1", "shade2", "shade3", "recorder", "recorder-active", "recorder-finished"],
        "chroma_key": True,
    },
    "materials-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "materials",
        "frame_count": 6,
        "frames": ["wire", "glass", "battery", "tape", "keycard", "fuse"],
        "chroma_key": True,
    },
    "flare-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "flare",
        "frame_count": 6,
        "frames": ["unlit", "igniting", "burn1", "burn2", "dying", "burnt-out"],
        "chroma_key": True,
    },
    "smokebomb-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "smokebomb",
        "frame_count": 6,
        "frames": ["idle", "ignited", "smoke1", "smoke2", "smoke3", "dissipating"],
        "chroma_key": True,
    },
    "decoy-radio-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "decoy-radio",
        "frame_count": 6,
        "frames": ["idle", "armed", "broadcasting1", "broadcasting2", "peak", "spent"],
        "chroma_key": True,
    },
    "cubicle-dividers-sheet.png": {
        "type": "fixed_cell_strip",
        "entity": "cubicle-dividers",
        "frame_count": 6,
        "frames": ["straight", "straight-damaged", "l-corner", "l-corner-damaged", "half-height", "gap"],
        "chroma_key": True,
    },

    # ── UI elements (single chroma-keyed sprites) ────────────────────────

    "beacon-meter-frame.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["beacon-meter-frame"],
        "chroma_key": True,
    },
    "beacon-meter-fill.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["beacon-meter-fill"],
        "chroma_key": True,
    },
    "inventory-slot-empty.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["inventory-slot-empty"],
        "chroma_key": True,
    },
    "inventory-slot-selected.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["inventory-slot-selected"],
        "chroma_key": True,
    },
    "craft-menu-bg.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["craft-menu-bg"],
        "chroma_key": True,
    },
    "craft-button-available.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["craft-button-available"],
        "chroma_key": True,
    },
    "craft-button-locked.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["craft-button-locked"],
        "chroma_key": True,
    },
    "minimap-frame.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["minimap-frame"],
        "chroma_key": True,
    },
    "minimap-room-tile.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["minimap-room-tile"],
        "chroma_key": True,
    },
    "minimap-player-dot.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["minimap-player-dot"],
        "chroma_key": True,
    },
    "flare-light-overlay.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["flare-light-overlay"],
        "chroma_key": True,
    },
    "ui-arrow-guidance.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["arrow-guidance"],
        "chroma_key": True,
    },
    "ui-back-button.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["back-button"],
        "chroma_key": True,
    },
    "ui-click-to-continue.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["click-to-continue"],
        "chroma_key": True,
    },
    "ui-key-ctrl.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["key-ctrl"],
        "chroma_key": True,
    },
    "ui-key-e.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["key-e"],
        "chroma_key": True,
    },
    "ui-key-g.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["key-g"],
        "chroma_key": True,
    },
    "ui-key-r.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["key-r"],
        "chroma_key": True,
    },
    "ui-label-climb.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-climb"],
        "chroma_key": True,
    },
    "ui-label-craft.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-craft"],
        "chroma_key": True,
    },
    "ui-label-crouch.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-crouch"],
        "chroma_key": True,
    },
    "ui-label-grab.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-grab"],
        "chroma_key": True,
    },
    "ui-label-hide.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-hide"],
        "chroma_key": True,
    },
    "ui-label-interact.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-interact"],
        "chroma_key": True,
    },
    "ui-label-pickup.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-pickup"],
        "chroma_key": True,
    },
    "ui-label-restart.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-restart"],
        "chroma_key": True,
    },
    "ui-label-throw.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-throw"],
        "chroma_key": True,
    },
    "ui-label-tune.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-tune"],
        "chroma_key": True,
    },
    "ui-label-rebuild.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-rebuild"],
        "chroma_key": True,
    },
    "ui-label-whisper.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["label-whisper"],
        "chroma_key": True,
    },
    "ui-mouse-click.png": {
        "type": "single_chroma",
        "entity": "ui",
        "frames": ["mouse-click"],
        "chroma_key": True,
    },

    # ── Puzzle prop sprites (single chroma-keyed objects) ──────────────

    "broken_tape.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["broken_tape"],
        "chroma_key": True,
    },
    "tape_recorder.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["tape_recorder"],
        "chroma_key": True,
    },
    "trapdoor_sealed.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["trapdoor_sealed"],
        "chroma_key": True,
    },
    "whisper_charm.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["whisper_charm"],
        "chroma_key": True,
        "chroma_color": "magenta",
    },
    "whisper_charm_explainer.png": {
        "type": "single_chroma",
        "entity": "puzzle-props",
        "frames": ["whisper_charm_explainer"],
        "chroma_key": True,
        "chroma_color": "magenta",
    },

    # ── New full-scene backgrounds ───────────────────────────────────────

    "archives-bg.png": {
        "type": "background",
        "entity": "archives",
        "frames": ["archives"],
        "chroma_key": False,
    },
    "server-room-upper-bg.png": {
        "type": "background",
        "entity": "server-upper",
        "frames": ["server-upper"],
        "chroma_key": False,
    },
}
