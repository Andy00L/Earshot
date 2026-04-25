export type AmbientId =
  | "reception_ambient"
  | "cubicles_ambient"
  | "server_ambient"
  | "stairwell_ambient";

export type MonsterVocalId =
  | "monster_patrol_breath"
  | "monster_alert_growl"
  | "monster_hunt_screech"
  | "monster_charge_roar"
  | "monster_attack_lunge"
  | "monster_idle_howl";

export type SfxId =
  | "footstep_concrete"
  | "footstep_concrete_run"
  | "flashlight_click"
  | "door_open_creak"
  | "door_locked_rattle"
  | "breaker_switch"
  | "keycard_pickup"
  | "player_breath_normal"
  | "win_chime"
  | "death_thud";

export type RadioVoiceId =
  | "radio_intro"
  | "radio_keycard_hint"
  | "radio_breaker_hint"
  | "radio_exit_hint";

export type AudioId = AmbientId | MonsterVocalId | SfxId | RadioVoiceId;

export interface AudioAsset {
  id: AudioId;
  category: "ambient" | "monster_vocal" | "sfx" | "radio_voice";
  prompt: string;
  durationSec?: number;
  loop: boolean;
  volume: number;
  isMusic?: boolean;
}

export const AUDIO_CATALOG: Record<AudioId, AudioAsset> = {
  // AMBIENT (Music API)
  reception_ambient: {
    id: "reception_ambient",
    category: "ambient",
    prompt: "Slow, eerie ambient horror drone for an abandoned office reception. Low synth pad, distant fluorescent buzz, quiet, tense. Loop seamlessly. Instrumental only.",
    loop: true,
    volume: 0.4,
    isMusic: true,
  },
  cubicles_ambient: {
    id: "cubicles_ambient",
    category: "ambient",
    prompt: "Tense ambient horror drone for an empty office cubicle floor. Subtle creaks, distant typing. Low and minimal. Loop seamlessly. Instrumental only.",
    loop: true,
    volume: 0.4,
    isMusic: true,
  },
  server_ambient: {
    id: "server_ambient",
    category: "ambient",
    prompt: "Loud humming server room ambience with low electrical drone, fan noise, occasional pop. Industrial, oppressive. Loop seamlessly. Instrumental only.",
    loop: true,
    volume: 0.5,
    isMusic: true,
  },
  stairwell_ambient: {
    id: "stairwell_ambient",
    category: "ambient",
    prompt: "Dread ambient drone for a concrete stairwell, building tension. Low cello sustains, distant metallic creaks. Heavy, foreboding. Loop seamlessly. Instrumental only.",
    loop: true,
    volume: 0.5,
    isMusic: true,
  },

  // MONSTER VOCALS (Sound Effects API)
  monster_patrol_breath: {
    id: "monster_patrol_breath",
    category: "monster_vocal",
    prompt: "Slow, wet, raspy creature breathing. Low. Patient. About 4 seconds, loopable.",
    durationSec: 4,
    loop: true,
    volume: 0.6,
  },
  monster_alert_growl: {
    id: "monster_alert_growl",
    category: "monster_vocal",
    prompt: "Sharp, sudden creature growl as it notices a sound. Wet, sinister. About 1.5 seconds.",
    durationSec: 1.5,
    loop: false,
    volume: 0.8,
  },
  monster_hunt_screech: {
    id: "monster_hunt_screech",
    category: "monster_vocal",
    prompt: "Long, building creature screech as it hunts prey. Aggressive but controlled. About 3 seconds.",
    durationSec: 3,
    loop: false,
    volume: 0.8,
  },
  monster_charge_roar: {
    id: "monster_charge_roar",
    category: "monster_vocal",
    prompt: "Explosive creature roar at full charge. Loud, terrifying. About 1.5 seconds.",
    durationSec: 1.5,
    loop: false,
    volume: 1.0,
  },
  monster_attack_lunge: {
    id: "monster_attack_lunge",
    category: "monster_vocal",
    prompt: "Sharp, vicious creature snarl during attack lunge. Wet teeth, aggressive. About 1 second.",
    durationSec: 1,
    loop: false,
    volume: 1.0,
  },
  monster_idle_howl: {
    id: "monster_idle_howl",
    category: "monster_vocal",
    prompt: "Long, mournful, distant creature howl. Echoing, lonely, terrifying. About 3 seconds.",
    durationSec: 3,
    loop: false,
    volume: 0.9,
  },

  // SFX (Sound Effects API)
  footstep_concrete: {
    id: "footstep_concrete",
    category: "sfx",
    prompt: "Single quiet footstep on concrete floor. Soft, dry. About 0.3 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.4,
  },
  footstep_concrete_run: {
    id: "footstep_concrete_run",
    category: "sfx",
    prompt: "Single faster footstep on concrete floor while running. Slightly heavier than walk. About 0.2 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.5,
  },
  flashlight_click: {
    id: "flashlight_click",
    category: "sfx",
    prompt: "Sharp metal click of a flashlight switch turning on. About 0.15 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.6,
  },
  door_open_creak: {
    id: "door_open_creak",
    category: "sfx",
    prompt: "Old wooden door creaking open slowly. About 1.5 seconds.",
    durationSec: 2,
    loop: false,
    volume: 0.5,
  },
  door_locked_rattle: {
    id: "door_locked_rattle",
    category: "sfx",
    prompt: "Locked door handle rattling, no opening. About 0.8 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.5,
  },
  breaker_switch: {
    id: "breaker_switch",
    category: "sfx",
    prompt: "Heavy industrial breaker switch flipping with electrical hum starting. About 1 second.",
    durationSec: 1,
    loop: false,
    volume: 0.7,
  },
  keycard_pickup: {
    id: "keycard_pickup",
    category: "sfx",
    prompt: "Plastic keycard picked up with subtle electronic chirp. About 0.5 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.5,
  },
  player_breath_normal: {
    id: "player_breath_normal",
    category: "sfx",
    prompt: "Quiet, steady human breathing through the nose, not labored. About 4 seconds, loopable.",
    durationSec: 4,
    loop: true,
    volume: 0.3,
  },
  win_chime: {
    id: "win_chime",
    category: "sfx",
    prompt: "Subtle relief chime, low-key, not triumphant. Single brief tone. About 1 second.",
    durationSec: 1,
    loop: false,
    volume: 0.7,
  },
  death_thud: {
    id: "death_thud",
    category: "sfx",
    prompt: "Heavy body hitting the floor with a thud. About 0.8 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.8,
  },

  // RADIO OPERATOR VOICE (TTS)
  radio_intro: {
    id: "radio_intro",
    category: "radio_voice",
    prompt: "Wake up. You're not alone in there. Whatever you do, keep your voice down. It hears everything.",
    loop: false,
    volume: 0.8,
  },
  radio_keycard_hint: {
    id: "radio_keycard_hint",
    category: "radio_voice",
    prompt: "There should be a keycard somewhere on this floor. You'll need it to get out.",
    loop: false,
    volume: 0.8,
  },
  radio_breaker_hint: {
    id: "radio_breaker_hint",
    category: "radio_voice",
    prompt: "The exit door's electric. You'll need power. Find the breaker in the server room.",
    loop: false,
    volume: 0.8,
  },
  radio_exit_hint: {
    id: "radio_exit_hint",
    category: "radio_voice",
    prompt: "You're almost there. Quiet now. Quieter than you've ever been.",
    loop: false,
    volume: 0.8,
  },
};
