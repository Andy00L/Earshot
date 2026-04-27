/**
 * Map raw mic RMS (0..1) to suspicion delta per second.
 *
 * Hotfix v3: all RMS breakpoints tripled (3x) to raise the noise floor
 * above PC speaker bleed (typical 0.001-0.003). Shape unchanged.
 *
 * Curve targets (with monster decay = 5/sec):
 *   - silence (rms < 0.0075)        : 0 per sec    (decay wins, suspicion stays at 0)
 *   - whisper (0.0075 to 0.015)     : 0 to 8 per sec   (slow rise, can self-correct)
 *   - normal voice (0.015 to 0.045) : 8 to 40 per sec  (crosses ALERT in ~1s, HUNT in ~3s)
 *   - loud (0.045 to 0.120)         : 40 to 90 per sec (HUNT immediately)
 *   - shout (0.120+)                : saturates at 120 per sec
 *
 * Margin notes:
 *   - SILENCE_FLOOR (0.0075) is set well above typical speaker bleed (0.003)
 *     to ensure ambient noise, breathing, fan, and mouse clicks do NOT raise suspicion.
 *   - Saturation at 120/sec means even shouting cannot exceed reasonable values
 *     given the per-frame multiplication (dt ~16.7ms means max ~2 per frame).
 */
export function rmsToSuspicionPerSec(rms: number): number {
  // Defensive guards
  if (!Number.isFinite(rms) || rms <= 0) return 0;

  // Below silence floor: ambient noise, breathing, typing, mouse, speaker bleed
  if (rms < 0.0075) return 0;

  // Whisper zone: linear 0 to 8
  if (rms < 0.015) {
    return ((rms - 0.0075) / (0.015 - 0.0075)) * 8;
  }

  // Normal voice: linear 8 to 40 (the demo target zone)
  if (rms < 0.045) {
    return 8 + ((rms - 0.015) / (0.045 - 0.015)) * 32;
  }

  // Loud voice: linear 40 to 90
  if (rms < 0.120) {
    return 40 + ((rms - 0.045) / (0.120 - 0.045)) * 50;
  }

  // Shout: saturate from 90 toward 120
  if (rms < 0.240) {
    return 90 + ((rms - 0.120) / (0.240 - 0.120)) * 30;
  }

  // Hard saturation. Even rms=1.0 returns 120, never higher.
  return 120;
}

/**
 * Convert per-second rate to per-frame delta given frame time in ms.
 */
export function suspicionDeltaForFrame(rms: number, deltaMS: number): number {
  return rmsToSuspicionPerSec(rms) * (deltaMS / 1000);
}
