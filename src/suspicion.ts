/**
 * Map raw mic RMS (0..1) to suspicion delta per second.
 *
 * Calibration v2 (2026-04-27): user feedback "trop sensible".
 * Modere preset: +50% on RMS thresholds, -20% on curve output.
 * Beacon drain rates unchanged. Listener AI thresholds unchanged.
 * Hardware-dependent. May still trigger on noisy hardware.
 *
 * Curve targets (with monster decay = 5/sec, 0.8x output scaling):
 *   - silence (rms < 0.01125)         : 0 per sec    (decay wins, suspicion stays at 0)
 *   - whisper (0.01125 to 0.0225)     : 0 to 6.4 per sec   (slow rise, can self-correct)
 *   - normal voice (0.0225 to 0.0675) : 6.4 to 32 per sec  (crosses ALERT in ~1.5s)
 *   - loud (0.0675 to 0.18)           : 32 to 72 per sec   (HUNT in seconds)
 *   - shout (0.18+)                   : saturates at 96 per sec
 *
 * Margin notes:
 *   - SILENCE_FLOOR (0.01125) raised from 0.0075 to reduce false positives
 *     from ambient noise, breathing, fan hum, and laptop mic idle noise (~0.010).
 *   - Saturation at 96/sec (was 120) means the curve is 20% more forgiving overall.
 */
export function rmsToSuspicionPerSec(rms: number): number {
  // Defensive guards
  if (!Number.isFinite(rms) || rms <= 0) return 0;

  // Below silence floor: ambient noise, breathing, typing, mouse, speaker bleed
  if (rms < 0.01125) return 0;

  // Whisper zone: linear 0 to 6.4 (was 0 to 8, scaled 0.8x)
  if (rms < 0.0225) {
    return ((rms - 0.01125) / (0.0225 - 0.01125)) * 6.4;
  }

  // Normal voice: linear 6.4 to 32 (was 8 to 40, scaled 0.8x)
  if (rms < 0.0675) {
    return 6.4 + ((rms - 0.0225) / (0.0675 - 0.0225)) * 25.6;
  }

  // Loud voice: linear 32 to 72 (was 40 to 90, scaled 0.8x)
  if (rms < 0.18) {
    return 32 + ((rms - 0.0675) / (0.18 - 0.0675)) * 40;
  }

  // Shout: saturate from 72 toward 96 (was 90 to 120, scaled 0.8x)
  if (rms < 0.36) {
    return 72 + ((rms - 0.18) / (0.36 - 0.18)) * 24;
  }

  // Hard saturation at 96 (was 120, scaled 0.8x)
  return 96;
}

/**
 * Convert per-second rate to per-frame delta given frame time in ms.
 */
export function suspicionDeltaForFrame(rms: number, deltaMS: number): number {
  return rmsToSuspicionPerSec(rms) * (deltaMS / 1000);
}
