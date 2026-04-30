"""
Earshot asset pipeline. Reads atlases from raw/, slices into individual
frames, writes to assets/{entity}/{frame}.png, generates atlas.json
manifest and preview.html for QA.

Usage:
    python scripts/slice.py                          # slice all atlases
    python scripts/slice.py --only monster-attack.png # slice one
    python scripts/slice.py --debug                  # save debug overlays
    python scripts/slice.py --clean                  # wipe assets/ first
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# Sibling imports
sys.path.insert(0, str(Path(__file__).parent))
from atlas_config import ATLAS_PROFILES
from chroma import chroma_key_hsv, chroma_key_magenta
from detect import detect_sprites_strip, detect_sprites_grid

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
ASSETS = ROOT / "assets"


# ── File discovery ───────────────────────────────────────────────────────


def _discover_raw_files() -> dict[str, Path]:
    """
    Scan raw/ recursively and return a mapping from basename to full path.
    Raises if two files in different subdirectories share the same basename,
    since ATLAS_PROFILES keys are basenames.
    """
    by_name: dict[str, Path] = {}
    for p in RAW.rglob("*.png"):
        name = p.name
        if name in by_name:
            raise RuntimeError(
                f"Duplicate basename '{name}' found at:\n"
                f"  {by_name[name]}\n"
                f"  {p}\n"
                f"Profile keys must be unique basenames."
            )
        by_name[name] = p
    return by_name


# ── Component merging ─────────────────────────────────────────────────────


def _merge_components_by_slot(
    components: list[dict],
    expected_count: int,
    image_width: int,
) -> list[dict]:
    """
    When CCL detects more components than expected (e.g. detached debris,
    blood, dropped flashlight near a character), group them by horizontal
    slot position and merge each group into one composite component.

    Each frame in a horizontal strip occupies roughly image_width/N pixels.
    Components whose centroid falls in the same slot are merged by taking
    the union of their bounding boxes and collecting all their labels.
    """
    if len(components) <= expected_count:
        return components

    slot_width = image_width / expected_count

    # Assign each component to a slot by centroid x
    slots: dict[int, list[dict]] = {}
    for comp in components:
        slot_idx = min(int(comp["centroid"][0] / slot_width), expected_count - 1)
        slots.setdefault(slot_idx, []).append(comp)

    merged = []
    for slot_idx in sorted(slots.keys()):
        group = slots[slot_idx]
        if len(group) == 1:
            c = group[0]
            c.setdefault("labels", [c["label"]])
            merged.append(c)
        else:
            # Union of bounding boxes
            x_min = min(c["bbox"][0] for c in group)
            y_min = min(c["bbox"][1] for c in group)
            x_max = max(c["bbox"][0] + c["bbox"][2] for c in group)
            y_max = max(c["bbox"][1] + c["bbox"][3] for c in group)
            main = max(group, key=lambda c: c["area"])
            merged.append({
                "bbox": (x_min, y_min, x_max - x_min, y_max - y_min),
                "area": sum(c["area"] for c in group),
                "centroid": main["centroid"],
                "labels": [c["label"] for c in group],
            })

    merged.sort(key=lambda c: c["bbox"][0])
    return merged


# ── Per-type handlers ─────────────────────────────────────────────────────


def _handle_background(filename: str, profile: dict, src_path: Path) -> dict:
    """Copy a background image as-is. No chroma key, no detection."""
    entity = profile["entity"]
    name = profile["frames"][0]
    out_path = ASSETS / f"{entity}.png"

    img = Image.open(src_path)
    img.save(out_path, "PNG")

    return {
        "type": "background",
        "entity": entity,
        "frames": {
            name: {
                "file": f"assets/{entity}.png",
                "width": img.width,
                "height": img.height,
            }
        },
    }


def _handle_single_object(
    filename: str, profile: dict, src_path: Path, debug: bool,
) -> dict:
    """Chroma key a single object, detect one component, trim and save."""
    entity = profile["entity"]
    name = profile["frames"][0]

    rgb = np.array(Image.open(src_path).convert("RGB"))
    rgba = chroma_key_hsv(rgb)

    # Use a smaller closing kernel for single objects (less gap bridging needed)
    ck = profile.get("closing_kernel", (11, 5))
    components, labels = detect_sprites_strip(rgba, closing_kernel=ck)

    if len(components) == 0:
        print(f"    ERROR: no components detected in {filename}")
        return {}
    if len(components) > 1:
        print(f"    NOTE: {len(components)} components in single-object atlas, using largest")
        components.sort(key=lambda c: c["area"], reverse=True)

    comp = components[0]
    x, y, w, h = comp["bbox"]

    # Extract with component mask to avoid stray pixels
    crop = rgba[y:y + h, x:x + w].copy()
    crop_labels = labels[y:y + h, x:x + w]
    other_mask = (crop_labels != comp["label"]) & (crop_labels != 0)
    crop[other_mask, 3] = 0

    pil = Image.fromarray(crop)
    bbox = pil.getbbox()
    if bbox:
        pil = pil.crop(bbox)

    out_path = ASSETS / f"{entity}.png"
    pil.save(out_path, "PNG")

    if debug:
        _save_debug_overlay(filename, rgba, components)

    return {
        "type": "single_object",
        "entity": entity,
        "frames": {
            name: {
                "file": f"assets/{entity}.png",
                "width": pil.width,
                "height": pil.height,
            }
        },
    }


def _handle_character_strip(
    filename: str, profile: dict, src_path: Path, debug: bool,
) -> dict:
    """Chroma key a character strip, detect frames via CCL, save each."""
    entity = profile["entity"]
    source_atlas = Path(filename).stem
    expected_frames = profile["frames"]
    expected = len(expected_frames)

    img_pil = Image.open(src_path).convert("RGB")
    rgb = np.array(img_pil)
    rgba = chroma_key_hsv(rgb)

    ck = profile.get("closing_kernel")
    components, labels = detect_sprites_strip(rgba, closing_kernel=ck)
    detected = len(components)

    if detected != expected:
        print(f"    detected {detected} components, expected {expected}")
        if debug:
            _save_debug_overlay(filename, rgba, components)
        if detected > expected:
            components = _merge_components_by_slot(
                components, expected, img_pil.width,
            )
            print(f"    after slot merge: {len(components)} components")

    entity_dir = ASSETS / entity
    entity_dir.mkdir(parents=True, exist_ok=True)

    frames = {}
    for i, comp in enumerate(components):
        if i >= expected:
            name = f"_extra_{i}"
            print(f"    extra component {i} beyond expected count")
        else:
            name = expected_frames[i]

        meta = _save_frame(rgba, labels, comp, entity_dir, name, source_atlas)
        frames[name] = meta

    return {
        "type": "character_strip",
        "entity": entity,
        "frames": frames,
    }


def _handle_props_grid(
    filename: str, profile: dict, src_path: Path, debug: bool,
) -> dict:
    """Chroma key a props grid, detect tiles via CCL with grid sort, save each."""
    entity = profile["entity"]
    expected_frames = profile["frames"]
    expected = len(expected_frames)

    rgb = np.array(Image.open(src_path).convert("RGB"))
    rgba = chroma_key_hsv(rgb)

    ck = profile.get("closing_kernel")
    components, labels = detect_sprites_grid(rgba, closing_kernel=ck)
    detected = len(components)

    if detected != expected:
        print(f"    WARNING: detected {detected} tiles, expected {expected}")
        if debug:
            _save_debug_overlay(filename, rgba, components)

    entity_dir = ASSETS / entity
    entity_dir.mkdir(parents=True, exist_ok=True)

    frames = {}
    for i, comp in enumerate(components):
        if i >= expected:
            name = f"_extra_{i}"
            print(f"    extra tile {i} beyond expected count")
        else:
            name = expected_frames[i]

        meta = _save_tile(rgba, labels, comp, entity_dir, name)
        frames[name] = meta

    return {
        "type": "props_grid",
        "entity": entity,
        "frames": frames,
        "cols": profile.get("cols", 6),
        "rows": profile.get("rows", 2),
    }


def _handle_fixed_cell_strip(
    filename: str, profile: dict, src_path: Path, debug: bool,
) -> dict:
    """Chroma key a sheet and slice into N equal horizontal cells."""
    entity = profile["entity"]
    expected_frames = profile["frames"]
    frame_count = profile["frame_count"]
    source_atlas = Path(filename).stem

    if len(expected_frames) != frame_count:
        print(f"    ERROR: frame_count={frame_count} but {len(expected_frames)} "
              f"frame names in {filename}")
        return {}

    img_pil = Image.open(src_path).convert("RGB")
    rgb = np.array(img_pil)
    rgba = chroma_key_hsv(rgb)
    height, width = rgba.shape[:2]

    entity_dir = ASSETS / entity
    entity_dir.mkdir(parents=True, exist_ok=True)

    frames = {}
    for i in range(frame_count):
        name = expected_frames[i]
        x_start = round(i * width / frame_count)
        x_end = round((i + 1) * width / frame_count)

        cell = rgba[:, x_start:x_end].copy()
        pil = Image.fromarray(cell)
        bbox = pil.getbbox()

        if bbox is None:
            print(f"    ERROR: empty cell {i} ({name}) in {filename}")
            return {}

        pil = pil.crop(bbox)
        w_out, h_out = pil.width, pil.height

        alpha = np.array(pil)[:, :, 3]
        nonzero_rows = np.where(alpha.any(axis=1))[0]
        baseline_y = int(nonzero_rows[-1]) if len(nonzero_rows) > 0 else h_out - 1

        out_path = entity_dir / f"{name}.png"
        pil.save(out_path, "PNG")

        frames[name] = {
            "file": f"assets/{entity}/{name}.png",
            "width": w_out,
            "height": h_out,
            "baselineY": baseline_y,
            "sourceAtlas": source_atlas,
        }

    return {
        "type": "fixed_cell_strip",
        "entity": entity,
        "frames": frames,
    }


def _handle_single_chroma(
    filename: str, profile: dict, src_path: Path, debug: bool,
) -> dict:
    """Chroma key (or passthrough) a single sprite without CCL detection."""
    entity = profile["entity"]
    name = profile["frames"][0]
    use_chroma = profile.get("chroma_key", True)

    if use_chroma:
        rgb = np.array(Image.open(src_path).convert("RGB"))
        chroma_color = profile.get("chroma_color", "green")
        if chroma_color == "magenta":
            rgba = chroma_key_magenta(rgb)
        else:
            rgba = chroma_key_hsv(rgb)
        pil = Image.fromarray(rgba)
    else:
        pil = Image.open(src_path).convert("RGBA")

    bbox = pil.getbbox()
    if bbox:
        pil = pil.crop(bbox)

    if pil.width == 0 or pil.height == 0:
        print(f"    ERROR: empty image after crop in {filename}")
        return {}

    entity_dir = ASSETS / entity
    entity_dir.mkdir(parents=True, exist_ok=True)
    out_path = entity_dir / f"{name}.png"
    pil.save(out_path, "PNG")

    alpha = np.array(pil)[:, :, 3]
    nonzero_rows = np.where(alpha.any(axis=1))[0]
    baseline_y = int(nonzero_rows[-1]) if len(nonzero_rows) > 0 else pil.height - 1

    return {
        "type": "single_chroma",
        "entity": entity,
        "frames": {
            name: {
                "file": f"assets/{entity}/{name}.png",
                "width": pil.width,
                "height": pil.height,
                "baselineY": baseline_y,
            }
        },
    }


# ── Frame/tile saving ────────────────────────────────────────────────────


def _save_frame(
    rgba: np.ndarray,
    labels: np.ndarray,
    comp: dict,
    out_dir: Path,
    name: str,
    source_atlas: str,
) -> dict:
    """Extract, mask, trim, and save a character frame. Returns metadata."""
    x, y, w, h = comp["bbox"]
    label_indices = comp.get("labels", [comp.get("label")])

    # Extract region, mask out pixels from other components
    crop = rgba[y:y + h, x:x + w].copy()
    crop_labels = labels[y:y + h, x:x + w]
    include = np.isin(crop_labels, label_indices)
    other_mask = ~include & (crop_labels != 0)
    crop[other_mask, 3] = 0

    # Trim transparent margins
    pil = Image.fromarray(crop)
    bbox = pil.getbbox()
    if bbox:
        pil = pil.crop(bbox)

    w_out, h_out = pil.width, pil.height

    # Compute baselineY: bottom-most non-transparent row
    alpha = np.array(pil)[:, :, 3]
    nonzero_rows = np.where(alpha.any(axis=1))[0]
    baseline_y = int(nonzero_rows[-1]) if len(nonzero_rows) > 0 else h_out - 1

    out_path = out_dir / f"{name}.png"
    pil.save(out_path, "PNG")

    return {
        "file": f"assets/{out_dir.name}/{name}.png",
        "width": w_out,
        "height": h_out,
        "baselineY": baseline_y,
        "sourceAtlas": source_atlas,
    }


def _save_tile(
    rgba: np.ndarray,
    labels: np.ndarray,
    comp: dict,
    out_dir: Path,
    name: str,
) -> dict:
    """Extract, mask, trim, and save a prop tile. Returns metadata."""
    x, y, w, h = comp["bbox"]
    label_indices = comp.get("labels", [comp.get("label")])

    crop = rgba[y:y + h, x:x + w].copy()
    crop_labels = labels[y:y + h, x:x + w]
    include = np.isin(crop_labels, label_indices)
    other_mask = ~include & (crop_labels != 0)
    crop[other_mask, 3] = 0

    pil = Image.fromarray(crop)
    bbox = pil.getbbox()
    if bbox:
        pil = pil.crop(bbox)

    out_path = out_dir / f"{name}.png"
    pil.save(out_path, "PNG")

    return {
        "file": f"assets/{out_dir.name}/{name}.png",
        "width": pil.width,
        "height": pil.height,
    }


# ── Debug overlay ─────────────────────────────────────────────────────────


def _save_debug_overlay(
    filename: str, rgba: np.ndarray, components: list[dict],
) -> None:
    """Draw numbered bounding boxes on the image and save to assets/_debug/."""
    debug_dir = ASSETS / "_debug"
    debug_dir.mkdir(parents=True, exist_ok=True)

    overlay = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGR).copy()
    for i, comp in enumerate(components):
        x, y, w, h = comp["bbox"]
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 0, 255), 3)
        cv2.putText(
            overlay, str(i), (x + 5, y + 30),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2,
        )
    stem = Path(filename).stem
    out_path = debug_dir / f"{stem}_debug.png"
    cv2.imwrite(str(out_path), overlay)
    print(f"    debug overlay saved to {out_path}")


# ── Manifest and preview ─────────────────────────────────────────────────


def build_atlas_json(per_atlas_results: dict) -> dict:
    """
    Merge per-atlas results into a single atlas.json matching the schema
    expected by src/assets.ts.

    Character type:  { type, frames: {name: FrameMeta}, boundingBox }
    Single type:     { type, file, width, height }
    Tileset type:    { type, tiles: {name: FrameMeta}, cols, rows }
    """
    manifest: dict = {}

    # Collect character frames by entity (multiple atlases per entity)
    char_frames: dict[str, dict] = {}

    for _filename, result in per_atlas_results.items():
        if not result:
            continue

        rtype = result["type"]
        entity = result["entity"]

        if rtype in ("character_strip", "fixed_cell_strip", "single_chroma"):
            if entity not in char_frames:
                char_frames[entity] = {}
            char_frames[entity].update(result["frames"])

        elif rtype in ("background", "single_object"):
            frame_name = list(result["frames"].keys())[0]
            meta = result["frames"][frame_name]
            manifest[entity] = {
                "type": "single",
                "file": meta["file"],
                "width": meta["width"],
                "height": meta["height"],
            }

        elif rtype == "props_grid":
            manifest[entity] = {
                "type": "tileset",
                "tiles": result["frames"],
                "cols": result.get("cols", 6),
                "rows": result.get("rows", 2),
            }

    # Build character entries with boundingBox
    for entity, frames in char_frames.items():
        max_w = max(f["width"] for f in frames.values()) if frames else 0
        max_h = max(f["height"] for f in frames.values()) if frames else 0
        manifest[entity] = {
            "type": "character",
            "frames": frames,
            "boundingBox": {"width": max_w, "height": max_h},
        }

    return manifest


def build_preview_html(atlas_data: dict, output_path: Path) -> None:
    """Generate preview.html showing every frame for visual QA."""
    lines = [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<title>Earshot asset preview</title>',
        '<style>',
        'body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #ddd; padding: 20px; }',
        'h2 { color: #ffa500; border-bottom: 1px solid #333; padding-bottom: 4px; }',
        '.frames { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }',
        '.frame { display: inline-block; text-align: center; }',
        '.frame img { display: block; background: #222; border: 1px solid #444; max-height: 300px; }',
        '.frame .label { font-size: 11px; color: #888; margin-top: 4px; }',
        '</style></head><body>',
        '<h1>Earshot asset preview</h1>',
    ]

    for entity, entry in sorted(atlas_data.items()):
        etype = entry.get("type", "unknown")
        lines.append(f'<h2>{entity} ({etype})</h2>')
        lines.append('<div class="frames">')

        if etype == "character":
            for name, meta in entry["frames"].items():
                bl = meta.get("baselineY", "?")
                lines.append(
                    f'<div class="frame">'
                    f'<img src="{meta["file"]}" alt="{name}">'
                    f'<div class="label">{name}<br>{meta["width"]}x{meta["height"]} bl={bl}</div>'
                    f'</div>'
                )
        elif etype == "tileset":
            for name, meta in entry["tiles"].items():
                lines.append(
                    f'<div class="frame">'
                    f'<img src="{meta["file"]}" alt="{name}">'
                    f'<div class="label">{name}<br>{meta["width"]}x{meta["height"]}</div>'
                    f'</div>'
                )
        elif etype == "single":
            lines.append(
                f'<div class="frame">'
                f'<img src="{entry["file"]}" alt="{entity}" style="max-height:400px">'
                f'<div class="label">{entity}<br>{entry["width"]}x{entry["height"]}</div>'
                f'</div>'
            )

        lines.append('</div>')

    lines.append('</body></html>')
    output_path.write_text("\n".join(lines), encoding="utf-8")


# ── Atlas integrity guard ────────────────────────────────────────────────


def _verify_atlas_integrity(atlas_data: dict) -> bool:
    """
    Verify every entry in atlas.json has a corresponding valid PNG on disk.
    Returns True if all checks pass, False otherwise.
    """
    errors = []
    total_frames = 0

    for entity, entry in sorted(atlas_data.items()):
        etype = entry.get("type")

        if etype == "character":
            for name, meta in entry["frames"].items():
                fpath = ROOT / meta["file"]
                if not fpath.exists():
                    errors.append(f"  MISSING: {meta['file']}")
                else:
                    try:
                        Image.open(fpath).verify()
                    except Exception as e:
                        errors.append(f"  CORRUPT: {meta['file']}: {e}")
                total_frames += 1

        elif etype == "tileset":
            for name, meta in entry["tiles"].items():
                fpath = ROOT / meta["file"]
                if not fpath.exists():
                    errors.append(f"  MISSING: {meta['file']}")
                else:
                    try:
                        Image.open(fpath).verify()
                    except Exception as e:
                        errors.append(f"  CORRUPT: {meta['file']}: {e}")
                total_frames += 1

        elif etype == "single":
            fpath = ROOT / entry["file"]
            if not fpath.exists():
                errors.append(f"  MISSING: {entry['file']}")
            else:
                try:
                    Image.open(fpath).verify()
                except Exception as e:
                    errors.append(f"  CORRUPT: {entry['file']}: {e}")
            total_frames += 1

    if errors:
        print("\nATLAS INTEGRITY CHECK FAILED:")
        for e in errors:
            print(e)
        return False

    print(f"\nAtlas integrity: {len(atlas_data)} entities, "
          f"{total_frames} frames verified, all OK")
    return True


# ── Main ──────────────────────────────────────────────────────────────────


def slice_atlas(
    filename: str, raw_files: dict[str, Path], debug: bool = False,
) -> dict:
    """Process one atlas. Returns metadata dict for atlas.json."""
    profile = ATLAS_PROFILES.get(filename)
    if not profile:
        print(f"  SKIP: no profile for {filename}")
        return {}

    src_path = raw_files.get(filename)
    if not src_path or not src_path.exists():
        print(f"  ERROR: {filename} not found in raw/ (searched recursively)")
        return {}

    atlas_type = profile["type"]
    print(f"  {filename} ({atlas_type})...")

    if atlas_type == "background":
        return _handle_background(filename, profile, src_path)
    elif atlas_type == "single_object":
        return _handle_single_object(filename, profile, src_path, debug)
    elif atlas_type == "character_strip":
        return _handle_character_strip(filename, profile, src_path, debug)
    elif atlas_type == "props_grid":
        return _handle_props_grid(filename, profile, src_path, debug)
    elif atlas_type == "fixed_cell_strip":
        return _handle_fixed_cell_strip(filename, profile, src_path, debug)
    elif atlas_type == "single_chroma":
        return _handle_single_chroma(filename, profile, src_path, debug)
    else:
        print(f"  ERROR: unknown type {atlas_type}")
        return {}


def main():
    parser = argparse.ArgumentParser(description="Earshot asset pipeline")
    parser.add_argument("--only", help="Process only this atlas filename")
    parser.add_argument("--debug", action="store_true", help="Save debug overlays")
    parser.add_argument("--clean", action="store_true", help="Wipe output dirs first")
    args = parser.parse_args()

    ASSETS.mkdir(parents=True, exist_ok=True)

    if args.clean:
        for item in ASSETS.iterdir():
            if item.is_dir() and item.name not in ("_debug", "audio"):
                shutil.rmtree(item)
            elif item.is_file() and item.name not in ("atlas.json", "preview.html"):
                item.unlink()

    raw_files = _discover_raw_files()
    targets = [args.only] if args.only else sorted(ATLAS_PROFILES.keys())

    print("\nEarshot asset pipeline (Python/CCL)")
    print("=" * 60)

    per_atlas_results = {}
    for filename in targets:
        result = slice_atlas(filename, raw_files, debug=args.debug)
        if result:
            per_atlas_results[filename] = result

    atlas_data = build_atlas_json(per_atlas_results)

    atlas_json_path = ASSETS / "atlas.json"

    # When using --only, merge into existing atlas to prevent partial overwrite
    if args.only and atlas_json_path.exists():
        existing = json.loads(atlas_json_path.read_text(encoding="utf-8"))
        for entity, data in atlas_data.items():
            if (data["type"] == "character"
                    and entity in existing
                    and existing[entity].get("type") == "character"):
                # Merge frames into existing character entity
                existing[entity]["frames"].update(data["frames"])
                frames = existing[entity]["frames"]
                max_w = max(f["width"] for f in frames.values())
                max_h = max(f["height"] for f in frames.values())
                existing[entity]["boundingBox"] = {"width": max_w, "height": max_h}
            else:
                existing[entity] = data
        atlas_data = existing

    atlas_json_path.write_text(
        json.dumps(atlas_data, indent=2), encoding="utf-8",
    )
    print(f"\nWrote {atlas_json_path}")

    preview_path = ASSETS / "preview.html"
    build_preview_html(atlas_data, preview_path)
    print(f"Wrote {preview_path}")

    # Per-entity summary
    total_frames = 0
    for entity, entry in sorted(atlas_data.items()):
        etype = entry.get("type")
        if etype == "character":
            n = len(entry.get("frames", {}))
        elif etype == "tileset":
            n = len(entry.get("tiles", {}))
        else:
            n = 1
        total_frames += n
        print(f"  {entity}: {n} frames")

    print(f"\nTotal: {len(atlas_data)} entities, {total_frames} frames/tiles")

    # Atlas integrity guard
    if not _verify_atlas_integrity(atlas_data):
        sys.exit(1)


if __name__ == "__main__":
    main()
