/**
 * Map raw mic RMS (0..1) to suspicion delta per second.
 *
 * Calibrated from observed runtime trace on user's microphone:
 *   - No AGC, no echoCancellation, no noiseSuppression (per spec)
 *   - Observed silence/idle RMS:    0.0008 to 0.0021
 *   - Observed peaks during play:   up to ~0.0046
 *   - User confirmed normal speech is BELOW the previous 0.01 floor
 *
 * Curve targets (with monster decay = 5/sec):
 *   - silence (rms < 0.0025)        : 0 per sec    (decay wins, suspicion stays at 0)
 *   - whisper (0.0025 to 0.005)     : 0 to 8 per sec   (slow rise, can self-correct)
 *   - normal voice (0.005 to 0.015) : 8 to 40 per sec  (crosses ALERT in ~1s, HUNT in ~3s)
 *   - loud (0.015 to 0.040)         : 40 to 90 per sec (HUNT immediately)
 *   - shout (0.040+)                : saturates at 120 per sec
 *
 * Margin notes:
 *   - SILENCE_FLOOR (0.0025) is set above the observed maximum idle (0.0021) to
 *     ensure breathing, fan noise, and mouse clicks do NOT raise suspicion.
 *   - Saturation at 120/sec means even shouting cannot exceed reasonable values
 *     given the per-frame multiplication (dt ~16.7ms means max ~2 per frame).
 */
export function rmsToSuspicionPerSec(rms: number): number {
  // Defensive guards
  if (!Number.isFinite(rms) || rms <= 0) return 0;

  // Below silence floor: ambient noise, breathing, typing, mouse
  if (rms < 0.0025) return 0;

  // Whisper zone: linear 0 to 8
  if (rms < 0.005) {
    return ((rms - 0.0025) / (0.005 - 0.0025)) * 8;
  }

  // Normal voice: linear 8 to 40 (the demo target zone)
  if (rms < 0.015) {
    return 8 + ((rms - 0.005) / (0.015 - 0.005)) * 32;
  }

  // Loud voice: linear 40 to 90
  if (rms < 0.040) {
    return 40 + ((rms - 0.015) / (0.040 - 0.015)) * 50;
  }

  // Shout: saturate from 90 toward 120
  if (rms < 0.080) {
    return 90 + ((rms - 0.040) / (0.080 - 0.040)) * 30;
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
