"""
HSV chroma key with channel-min despill and inward edge feathering.

The source atlases use a green background that is not pure #00FF00 but is
consistently in the HSV range H:55-65, S:190-255, V:220-255 (OpenCV scale).
The bounds below are set wide enough to capture this variation while avoiding
false positives on character pixels.

References:
  HSV color filtering:
    https://docs.opencv.org/4.x/df/d9d/tutorial_py_colorspaces.html
  Channel-min despill:
    Classic compositing technique. Where green exceeds max(R, B) by more than
    a threshold, reduce green to max(R, B). Removes spill without color shift.
  Distance transform feathering:
    Smooths the alpha edge inward over a configurable ramp distance.
"""

import cv2
import numpy as np

# HSV thresholds for the impure green background.
# Verified against corner pixel samples from all 17 source atlases.
HSV_LOWER = np.array([35, 80, 80], dtype=np.uint8)
HSV_UPPER = np.array([85, 255, 255], dtype=np.uint8)

# Pixels where green exceeds max(R, B) by more than this are despilled.
DESPILL_THRESHOLD = 5

# Default feather radius in pixels. Creates a soft alpha transition over
# this many pixels inward from the foreground edge. Set to 0 for binary alpha.
DEFAULT_FEATHER_RADIUS = 2


def chroma_key_hsv(
    rgb: np.ndarray,
    feather_radius: int = DEFAULT_FEATHER_RADIUS,
) -> np.ndarray:
    """
    Convert an RGB image (H, W, 3) to RGBA with green background keyed out.

    Steps:
      1. Convert to HSV, threshold for green background
      2. Clean speckle with morphological open
      3. Invert to get foreground mask
      4. Despill foreground pixels (reduce green spill on edges)
      5. Build alpha from foreground mask with optional feathering

    Returns RGBA uint8 array (H, W, 4).
    """
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError(f"Expected RGB (H, W, 3), got shape {rgb.shape}")

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # 255 = green background, 0 = foreground
    bg_mask = cv2.inRange(hsv, HSV_LOWER, HSV_UPPER)

    # Remove speckle in the background region (isolated non-green pixels
    # inside what should be solid green)
    kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel_clean)

    # 255 = foreground (sprite), 0 = background
    fg_mask = cv2.bitwise_not(bg_mask)

    # Despill: where green dominates over both R and B, clamp it down
    out = rgb.copy().astype(np.int16)
    r, g, b = out[:, :, 0], out[:, :, 1], out[:, :, 2]
    max_rb = np.maximum(r, b)
    spill = np.maximum(g - max_rb - DESPILL_THRESHOLD, 0)
    out[:, :, 1] = g - spill
    out = np.clip(out, 0, 255).astype(np.uint8)

    # Build alpha channel
    alpha = _feather_alpha(fg_mask, feather_radius)

    return np.dstack([out, alpha])


def _feather_alpha(fg_mask: np.ndarray, radius: int) -> np.ndarray:
    """
    Create alpha from foreground mask with inward-only edge feathering.

    Only foreground pixels receive non-zero alpha. Background pixels stay at 0.
    This prevents green fringe that would result from extending alpha into
    background pixels.

    With radius=2, the outermost foreground pixel (distance 1 from background)
    gets alpha ~127. Pixels at distance >= radius get alpha 255.
    """
    if radius <= 0:
        return fg_mask

    # Distance from each foreground pixel to the nearest background pixel
    dist = cv2.distanceTransform(fg_mask, cv2.DIST_L2, 3)

    alpha = np.zeros_like(fg_mask, dtype=np.uint8)
    fg = fg_mask > 0
    alpha[fg] = np.clip(dist[fg] / radius * 255, 0, 255).astype(np.uint8)
    return alpha
