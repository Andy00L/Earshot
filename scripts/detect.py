"""
Sprite detection via connected component labeling (CCL).

Algorithm:
  1. Take the alpha channel from the chroma-keyed RGBA image.
  2. Threshold to binary (alpha > 0).
  3. Apply morphological closing with a horizontal kernel to bridge
     intra-sprite gaps (head to body, body to limb) without bridging
     across different sprites.
  4. Run cv2.connectedComponentsWithStats with 8-connectivity.
  5. Filter out components below MIN_COMPONENT_AREA (noise).
  6. Return sorted components and the label map for per-component masking.

References:
  cv2.connectedComponentsWithStats:
    https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html
  CCL for sprite extraction:
    https://dev.to/viniciusccarvalho/using-computer-vision-to-extract-sprite-pixel-art-4m8
"""

import cv2
import numpy as np

# Components smaller than this pixel count are treated as noise.
MIN_COMPONENT_AREA = 500

# Default morphological closing kernel for bridging intra-sprite gaps.
# Wider than tall because limb extensions tend to be horizontal.
DEFAULT_CLOSING_KERNEL = (21, 7)

# For grid layouts, components whose vertical overlap (relative to the
# shorter one) exceeds this fraction are considered to be in the same row.
ROW_OVERLAP_THRESHOLD = 0.5


def detect_sprites_strip(
    rgba: np.ndarray,
    closing_kernel: tuple[int, int] | None = None,
    min_area: int = MIN_COMPONENT_AREA,
) -> tuple[list[dict], np.ndarray]:
    """
    Detect sprites in a horizontal strip.

    Returns:
      components: list sorted left to right. Each entry has keys:
        bbox (x, y, w, h), area, centroid (cx, cy), label (int)
      labels: 2D array where each pixel is labeled with its component index.
        Label 0 is background. Labels 1..N are foreground components.
    """
    return _detect_and_sort(rgba, "strip", closing_kernel, min_area)


def detect_sprites_grid(
    rgba: np.ndarray,
    closing_kernel: tuple[int, int] | None = None,
    min_area: int = MIN_COMPONENT_AREA,
) -> tuple[list[dict], np.ndarray]:
    """
    Detect sprites in a 2D grid.

    Returns components sorted top-to-bottom by row, then left-to-right
    within each row. Same return format as detect_sprites_strip.
    """
    return _detect_and_sort(rgba, "grid", closing_kernel, min_area)


def _detect_and_sort(
    rgba: np.ndarray,
    sort_mode: str,
    closing_kernel: tuple[int, int] | None,
    min_area: int,
) -> tuple[list[dict], np.ndarray]:
    if rgba.ndim != 3 or rgba.shape[2] != 4:
        raise ValueError(f"Expected RGBA (H, W, 4), got shape {rgba.shape}")

    alpha = rgba[:, :, 3]
    binary = (alpha > 0).astype(np.uint8) * 255

    # Bridge intra-sprite gaps
    kw, kh = closing_kernel or DEFAULT_CLOSING_KERNEL
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # 8-connectivity: pixels touching on any of 8 directions are connected
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        closed, connectivity=8
    )

    # Skip label 0 (background), filter by area
    components = []
    for i in range(1, num_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        h = int(stats[i, cv2.CC_STAT_HEIGHT])
        cx, cy = centroids[i]
        components.append({
            "bbox": (x, y, w, h),
            "area": area,
            "centroid": (float(cx), float(cy)),
            "label": i,
        })

    # Sort by layout type
    if sort_mode == "strip":
        components.sort(key=lambda c: c["bbox"][0])
    elif sort_mode == "grid":
        components = _sort_grid(components)
    else:
        raise ValueError(f"Unknown sort_mode: {sort_mode}")

    return components, labels


def _sort_grid(components: list[dict]) -> list[dict]:
    """
    Cluster components into rows by vertical overlap, then sort each row
    left to right. Two components are in the same row if their vertical
    overlap divided by the shorter height >= ROW_OVERLAP_THRESHOLD.
    """
    if not components:
        return []

    by_y = sorted(components, key=lambda c: c["bbox"][1])

    rows: list[list[dict]] = []
    for comp in by_y:
        _, cy, _, ch = comp["bbox"]
        placed = False
        for row in rows:
            _, ry, _, rh = row[0]["bbox"]
            overlap_top = max(cy, ry)
            overlap_bot = min(cy + ch, ry + rh)
            overlap = max(0, overlap_bot - overlap_top)
            shorter = min(ch, rh)
            if shorter > 0 and overlap / shorter >= ROW_OVERLAP_THRESHOLD:
                row.append(comp)
                placed = True
                break
        if not placed:
            rows.append([comp])

    for row in rows:
        row.sort(key=lambda c: c["bbox"][0])

    return [comp for row in rows for comp in row]
