// src/beacon.ts
//
// Voice-activated vision meter. Refills from microphone input, drains in silence.
// Drives the player's vision radius (flashlight cone size) and the Listener's
// suspicion multiplier.

export const BEACON_MAX = 100;
export const BEACON_INITIAL = 100;
export const BEACON_MAX_FLOOR = 50;
export const BEACON_DRAIN_HIGH = 2.0;
export const BEACON_DRAIN_LOW = 6.0;
export const BEACON_DRAIN_LOW_THRESHOLD = 30;

export const BEACON_REFILL_WHISPER = 1.0;
export const BEACON_REFILL_NORMAL = 3.0;
export const BEACON_REFILL_SHOUT = 12.0;

export const VISION_RADIUS_MIN = 0;
export const VISION_RADIUS_MAX = 280;

export const VISION_BRIGHTNESS_MIN = 0.0;
export const VISION_BRIGHTNESS_MAX = 1.0;

export const SUSPICION_MULT_SILENT = 0.0;
export const SUSPICION_MULT_WHISPER = 0.5;
export const SUSPICION_MULT_NORMAL = 1.0;
export const SUSPICION_MULT_SHOUT = 2.0;

// RMS band boundaries (from suspicion.ts calibrated curve, not redefined here)
export const RMS_THRESHOLD_WHISPER = 0.0075;
export const RMS_THRESHOLD_NORMAL = 0.015;
export const RMS_THRESHOLD_SHOUT = 0.045;

export type VoiceBand = "silent" | "whisper" | "normal" | "shout";

export interface BeaconState {
  value: number;            // 0 to maxBeacon
  maxBeacon: number;        // starts at 100, eroded by Whisperer looks (floor: BEACON_MAX_FLOOR)
  visionRadius: number;     // current radius in px, derived from value
  visionBrightness: number; // 0.0 to 1.0, cone alpha derived from value
  voiceBand: VoiceBand;     // current band, for HUD and suspicion routing
}

export function createBeaconState(): BeaconState {
  return {
    value: BEACON_INITIAL,
    maxBeacon: BEACON_MAX,
    visionRadius: VISION_RADIUS_MAX,
    visionBrightness: VISION_BRIGHTNESS_MAX,
    voiceBand: "silent",
  };
}

export function erodeMaxBeacon(state: BeaconState, amount: number): void {
  state.maxBeacon = Math.max(BEACON_MAX_FLOOR, state.maxBeacon - amount);
  if (state.value > state.maxBeacon) state.value = state.maxBeacon;
}

export function classifyVoiceBand(
  rms: number,
  thresholds: { whisper: number; normal: number; shout: number },
): VoiceBand {
  if (rms < thresholds.whisper) return "silent";
  if (rms < thresholds.normal) return "whisper";
  if (rms < thresholds.shout) return "normal";
  return "shout";
}

export function updateBeacon(
  state: BeaconState,
  band: VoiceBand,
  deltaMs: number,
  drainMultiplier: number = 1.0,
): void {
  const dt = deltaMs / 1000;
  let delta = 0;

  switch (band) {
    case "silent":
      delta =
        -(state.value <= BEACON_DRAIN_LOW_THRESHOLD
          ? BEACON_DRAIN_LOW
          : BEACON_DRAIN_HIGH) * dt * drainMultiplier;
      break;
    case "whisper":
      delta = BEACON_REFILL_WHISPER * dt;
      break;
    case "normal":
      delta = BEACON_REFILL_NORMAL * dt;
      break;
    case "shout":
      delta = BEACON_REFILL_SHOUT * dt;
      break;
  }

  state.value = Math.max(0, Math.min(state.maxBeacon, state.value + delta));
  state.voiceBand = band;
  state.visionRadius = computeVisionRadius(state.value);
  state.visionBrightness = computeVisionBrightness(state.value);
}

export function computeVisionRadius(beacon: number): number {
  const t = beacon / BEACON_MAX;
  return VISION_RADIUS_MIN + (VISION_RADIUS_MAX - VISION_RADIUS_MIN) * t;
}

export function computeVisionBrightness(beacon: number): number {
  const t = beacon / BEACON_MAX;
  return VISION_BRIGHTNESS_MIN + (VISION_BRIGHTNESS_MAX - VISION_BRIGHTNESS_MIN) * t;
}

export function suspicionMultiplierForBand(band: VoiceBand): number {
  switch (band) {
    case "silent":
      return SUSPICION_MULT_SILENT;
    case "whisper":
      return SUSPICION_MULT_WHISPER;
    case "normal":
      return SUSPICION_MULT_NORMAL;
    case "shout":
      return SUSPICION_MULT_SHOUT;
  }
}
