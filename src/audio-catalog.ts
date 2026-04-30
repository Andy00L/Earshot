import { LoreTapeId } from "./types";

export type AmbientId =
  | "reception_ambient"
  | "cubicles_ambient"
  | "server_ambient"
  | "stairwell_ambient"
  | "archives_ambient";

export type MonsterVocalId =
  | "monster_patrol_breath"
  | "monster_alert_growl"
  | "monster_hunt_screech"
  | "monster_charge_roar"
  | "monster_attack_lunge"
  | "monster_idle_howl";

export type MonsterConfusedVocalId = "confused_growl" | "monster_growl_close";

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
  | "death_thud"
  | "locker_close"
  | "locker_open"
  | "locker_door_creak"
  | "desk_crouch"
  | "static_burst"
  | "radio_throw"
  | "monster_dash_screech"
  | "jumper_vent_creak"
  | "jumper_peek_breath"
  | "jumper_fakeout_hiss"
  | "floor_jumper_emerge"
  | "floor_jumper_attack_charge"
  | "floor_jumper_attack_lunge"
  | "floor_jumper_crawl"
  | "floor_jumper_retreat"
  | "breaker_original"
  | "breaker_variant_a"
  | "breaker_variant_b"
  | "breaker_variant_c"
  | "breaker_lock_alarm"
  | "whisper_trap_ambient"
  | "whisper_trap_fail"
  | "tape_garbled"
  | "tape_unlock";

export type TapeSegmentId =
  | "tape_01_seg_1" | "tape_01_seg_2" | "tape_01_seg_3" | "tape_01_seg_4"
  | "tape_02_seg_1" | "tape_02_seg_2" | "tape_02_seg_3" | "tape_02_seg_4"
  | "tape_03_seg_1" | "tape_03_seg_2" | "tape_03_seg_3" | "tape_03_seg_4";

export type RadioVoiceId =
  | "radio_intro"
  | "radio_keycard_hint"
  | "radio_breaker_hint"
  | "radio_exit_hint";

export type WhispererVoiceId =
  | "whisper_01" | "whisper_02" | "whisper_03" | "whisper_04"
  | "whisper_05" | "whisper_06" | "whisper_07" | "whisper_08"
  | "whisper_fade";

export type TutorialId = "tutorial_t0" | "tutorial_t1" | "tutorial_t2" | "tutorial_t3";

export type MapNarrationId = "tape_map_fragment";

export type IntroNarrationId = "intro_panel_1" | "intro_panel_2" | "intro_panel_3";

export type AudioId = AmbientId | MonsterVocalId | MonsterConfusedVocalId | SfxId | RadioVoiceId | WhispererVoiceId | LoreTapeId | TutorialId | MapNarrationId | IntroNarrationId | TapeSegmentId;

export interface WhispererVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface AudioAsset {
  id: AudioId;
  category: "ambient" | "monster_vocal" | "sfx" | "radio_voice" | "whisperer_voice" | "lore_tape";
  prompt: string;
  durationSec?: number;
  loop: boolean;
  volume: number;
  isMusic?: boolean;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: WhispererVoiceSettings;
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
  archives_ambient: {
    id: "archives_ambient",
    category: "ambient",
    prompt: "Deep oppressive ambient drone for an abandoned underground archive, paper rustling, distant slow drips of water, low resonant hum, claustrophobic, isolating, no melody, dark cinematic, instrumental only, loops seamlessly",
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

  // MONSTER CONFUSED / DEATH VOCALS
  confused_growl: {
    id: "confused_growl",
    category: "monster_vocal",
    prompt: "Low, confused, hesitant creature growl. Uncertain, sniffing, puzzled. About 2 seconds.",
    durationSec: 2,
    loop: false,
    volume: 0.7,
  },
  monster_growl_close: {
    id: "monster_growl_close",
    category: "monster_vocal",
    prompt: "Loud, close-range creature growl right next to the listener. Wet, threatening. About 1.5 seconds.",
    durationSec: 1.5,
    loop: false,
    volume: 1.0,
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

  // HIDING SFX (Sound Effects API)
  locker_close: {
    id: "locker_close",
    category: "sfx",
    prompt: "Metal locker door slamming closed with a heavy clang. About 1 second.",
    durationSec: 1,
    loop: false,
    volume: 0.6,
  },
  locker_open: {
    id: "locker_open",
    category: "sfx",
    prompt: "Metal locker door creaking open slowly. About 1 second.",
    durationSec: 1,
    loop: false,
    volume: 0.5,
  },
  locker_door_creak: {
    id: "locker_door_creak",
    category: "sfx",
    prompt: "Brief metal locker door creak, like someone testing the latch quietly. About 0.4 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.3,
  },
  desk_crouch: {
    id: "desk_crouch",
    category: "sfx",
    prompt: "Soft cloth and wood rustle as someone ducks under a desk. About 0.5 seconds.",
    durationSec: 1,
    loop: false,
    volume: 0.4,
  },

  // RADIO BAIT SFX
  static_burst: {
    id: "static_burst",
    category: "sfx",
    prompt: "Short burst of harsh radio static followed by a brief electronic feedback squeal, 1.5 to 2 seconds, distorted, no music, sudden, abrasive",
    durationSec: 2,
    loop: false,
    volume: 0.7,
  },
  radio_throw: {
    id: "radio_throw",
    category: "sfx",
    prompt: "Short whoosh of a small object thrown through the air, ending with a soft thud as it lands on a hard floor, 1 second, no music, no voice",
    durationSec: 1,
    loop: false,
    volume: 0.5,
  },

  // LISTENER DASH SFX (Sound Effects API)
  monster_dash_screech: {
    id: "monster_dash_screech",
    category: "sfx",
    prompt: "Sudden burst of speed. Sharp violent intake of breath followed by a guttural roar accelerating in pitch. Predator-like shriek. Bones snapping. Wet aggressive snarl. Approximately 1.2 seconds. High intensity, panic-inducing.",
    durationSec: 1.5,
    loop: false,
    volume: 1.0,
  },

  // JUMPER SFX (Sound Effects API)
  jumper_vent_creak: {
    id: "jumper_vent_creak",
    category: "sfx",
    prompt: "Slow rusty metal grate creaking open. Quiet but unsettling. Dry hinge groaning. Old metal flexing. Low tension. Approximately 1.5 seconds. Subtle, dread-inducing, NOT loud.",
    durationSec: 1.8,
    loop: false,
    volume: 0.5,
  },
  jumper_peek_breath: {
    id: "jumper_peek_breath",
    category: "sfx",
    prompt: "Slow wet shallow breathing through a metal grate. Faint raspy exhale. Almost silent inhale. Distant, muffled. Approximately 2 seconds. Creepy, malaise, NOT a roar. Like something watching from a hiding place.",
    durationSec: 2.0,
    loop: false,
    volume: 0.45,
  },
  jumper_fakeout_hiss: {
    id: "jumper_fakeout_hiss",
    category: "sfx",
    prompt: "Short aggressive hiss followed by retreat. Sharp inhale, brief snarl, then silence. Like a predator that decided not to attack. Approximately 1 second. Tense, unsettling.",
    durationSec: 1.2,
    loop: false,
    volume: 0.7,
  },

  // FLOOR JUMPER SFX (Sound Effects API)
  floor_jumper_emerge: {
    id: "floor_jumper_emerge",
    category: "sfx",
    prompt: "Metal vent grate cracking and warping, sudden breath inhale from a wet creature throat, debris falling, claws scraping rusted metal. Building tension, no music. Horror game sound.",
    durationSec: 2.0,
    loop: false,
    volume: 0.85,
  },
  floor_jumper_attack_charge: {
    id: "floor_jumper_attack_charge",
    category: "sfx",
    prompt: "Low demonic growl building, claws clicking rapidly on a concrete floor, raspy hyperventilation. Tension before a strike. Horror game.",
    durationSec: 1.0,
    loop: false,
    volume: 0.7,
  },
  floor_jumper_attack_lunge: {
    id: "floor_jumper_attack_lunge",
    category: "sfx",
    prompt: "Sudden visceral shriek, bone snapping, lunge whoosh, wet impact thud. Jumpscare moment. Horror game.",
    durationSec: 1.2,
    loop: false,
    volume: 0.9,
  },
  floor_jumper_crawl: {
    id: "floor_jumper_crawl",
    category: "sfx",
    prompt: "Bones scraping concrete, claws tapping rhythmically, faint raspy breathing. Slow creature movement. No music. Loopable seamlessly.",
    durationSec: 3.0,
    loop: true,
    volume: 0.6,
  },
  floor_jumper_retreat: {
    id: "floor_jumper_retreat",
    category: "sfx",
    prompt: "Creature gurgling backwards, metal vent grate clattering, dragging body sound, fading raspy breath. Withdrawal back into a wall vent. Horror game.",
    durationSec: 1.5,
    loop: false,
    volume: 0.65,
  },

  // BREAKER PUZZLE SFX (Sound Effects API)
  breaker_original: {
    id: "breaker_original",
    category: "sfx",
    prompt: "Heavy industrial relay switch CLICK followed by a deep electrical HUM that lasts 1 second. Loud, clear, distinct relay sound. Vintage 1970s power breaker. Mono, fully audible.",
    durationSec: 2.0,
    loop: false,
    volume: 1.0,
  },
  breaker_variant_a: {
    id: "breaker_variant_a",
    category: "sfx",
    prompt: "Small electrical relay click, HIGH PITCH like a tiny mechanical switch, followed by a thin high-frequency buzz. Distinctly higher and lighter than a large industrial relay. Loud, mono, 2 seconds.",
    durationSec: 2.0,
    loop: false,
    volume: 1.0,
  },
  breaker_variant_b: {
    id: "breaker_variant_b",
    category: "sfx",
    prompt: "Industrial relay switch click followed by LOUD electrical STATIC CRACKLE and sparks. Like a faulty breaker arcing. The crackle is the dominant sound. Mono, loud, 2 seconds.",
    durationSec: 2.0,
    loop: false,
    volume: 1.0,
  },
  breaker_variant_c: {
    id: "breaker_variant_c",
    category: "sfx",
    prompt: "TWO industrial relay clicks 300 milliseconds apart, like a double-tap, followed by a brief electrical hum. The double click is rhythmic and clearly two separate clicks. Loud, mono, 2.5 seconds.",
    durationSec: 2.5,
    loop: false,
    volume: 1.0,
  },
  breaker_lock_alarm: {
    id: "breaker_lock_alarm",
    category: "sfx",
    prompt: "Loud industrial alarm BUZZER, harsh and continuous, like a security system alarm. Aggressive electronic warning sound. Mono, full volume, 2.5 seconds.",
    durationSec: 2.5,
    loop: false,
    volume: 1.0,
  },

  // WHISPER LOCK PUZZLE SFX (Sound Effects API)
  whisper_trap_ambient: {
    id: "whisper_trap_ambient",
    category: "sfx",
    prompt: "Faint indistinct whisper voices, distant, layered, ominous, mono, loopable seamlessly",
    durationSec: 6.0,
    loop: true,
    volume: 0.18,
  },
  whisper_trap_fail: {
    id: "whisper_trap_fail",
    category: "sfx",
    prompt: "Painful breath inhale then ghostly distorted shriek, 1.5 seconds, mono",
    durationSec: 1.5,
    loop: false,
    volume: 0.9,
  },

  // TAPE STATION SFX
  tape_garbled: {
    id: "tape_garbled",
    category: "sfx",
    prompt: "Cassette tape playing backwards garbled, 2 seconds, mono, lo-fi",
    durationSec: 2.0,
    loop: false,
    volume: 0.8,
  },
  tape_unlock: {
    id: "tape_unlock",
    category: "sfx",
    prompt: "Cassette tape click followed by a soft chime, 1 second, mono",
    durationSec: 1.0,
    loop: false,
    volume: 0.85,
  },

  // TAPE STATION SEGMENTS (TTS - Adam voice, dramatic narration)
  tape_01_seg_1: { id: "tape_01_seg_1", category: "lore_tape", prompt: "we saw the lights", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_01_seg_2: { id: "tape_01_seg_2", category: "lore_tape", prompt: "then the listening began", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_01_seg_3: { id: "tape_01_seg_3", category: "lore_tape", prompt: "and we forgot", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_01_seg_4: { id: "tape_01_seg_4", category: "lore_tape", prompt: "our names", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },

  tape_02_seg_1: { id: "tape_02_seg_1", category: "lore_tape", prompt: "your voice is not yours", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_02_seg_2: { id: "tape_02_seg_2", category: "lore_tape", prompt: "it belongs to the walls", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_02_seg_3: { id: "tape_02_seg_3", category: "lore_tape", prompt: "they whisper back", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_02_seg_4: { id: "tape_02_seg_4", category: "lore_tape", prompt: "when you speak", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },

  tape_03_seg_1: { id: "tape_03_seg_1", category: "lore_tape", prompt: "the door at the top", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_03_seg_2: { id: "tape_03_seg_2", category: "lore_tape", prompt: "opens for those who listen", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_03_seg_3: { id: "tape_03_seg_3", category: "lore_tape", prompt: "the others stay below", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },
  tape_03_seg_4: { id: "tape_03_seg_4", category: "lore_tape", prompt: "forever", loop: false, volume: 0.85, voiceId: "pNInz6obpgDQGcFmaJgB", modelId: "eleven_turbo_v2_5", voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } },

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

  // WHISPERER VOICE (TTS - eerie female whisper)
  whisper_01: {
    id: "whisper_01",
    category: "whisperer_voice",
    prompt: "behind you",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_02: {
    id: "whisper_02",
    category: "whisperer_voice",
    prompt: "i can see you",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_03: {
    id: "whisper_03",
    category: "whisperer_voice",
    prompt: "stay still",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_04: {
    id: "whisper_04",
    category: "whisperer_voice",
    prompt: "closer now",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_05: {
    id: "whisper_05",
    category: "whisperer_voice",
    prompt: "you're not alone",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_06: {
    id: "whisper_06",
    category: "whisperer_voice",
    prompt: "look at me",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_07: {
    id: "whisper_07",
    category: "whisperer_voice",
    prompt: "where are you going",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_08: {
    id: "whisper_08",
    category: "whisperer_voice",
    prompt: "we hear everything",
    loop: false,
    volume: 0.6,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },
  whisper_fade: {
    id: "whisper_fade",
    category: "whisperer_voice",
    prompt: "you saw me",
    loop: false,
    volume: 0.8,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.3, similarity_boost: 0.6, style: 0.9, use_speaker_boost: true },
  },

  // LORE TAPES (TTS - male office worker voice memos)
  tape_01: {
    id: "tape_01",
    category: "lore_tape",
    prompt: "Day fourteen. The night crew reported voices in the server room again. Maintenance found nothing on the cameras. We're going to need to bring in someone.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tape_02: {
    id: "tape_02",
    category: "lore_tape",
    prompt: "I asked Janet about the smell in the archives. She said it's been there since they took the building over. She wouldn't tell me when. She wouldn't say from who.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tape_03: {
    id: "tape_03",
    category: "lore_tape",
    prompt: "It only listens. That's what the old security log said. The lights bother it less than we thought. The sound bothers it more than we knew.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tape_04: {
    id: "tape_04",
    category: "lore_tape",
    prompt: "I saw something in the vent. Just for a second. It was watching the cubicles. I couldn't move until it pulled itself back up.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tape_05: {
    id: "tape_05",
    category: "lore_tape",
    prompt: "The third one is the worst. You feel it before you see it. And once you see it, you can't unsee it. Don't look at them. Just keep moving.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tape_06: {
    id: "tape_06",
    category: "lore_tape",
    prompt: "If anyone finds this. The breaker is the only way out. Don't go up the stairs. Don't ever go up the stairs. There's nothing up there that wants you to leave.",
    loop: false,
    volume: 0.8,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  // MAP FRAGMENT NARRATION (TTS - same voice as lore tapes, triggered on map_fragment pickup)
  tape_map_fragment: {
    id: "tape_map_fragment",
    category: "lore_tape",
    prompt: "Old facility map. Five sectors. Reception is the hub, Server in the middle, Stairwell at the top. If you got this far, you can get out.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },

  // TUTORIAL VOICE MEMOS (TTS - field operator, same voice as lore tapes)
  tutorial_t0: {
    id: "tutorial_t0",
    category: "lore_tape",
    prompt: "If you can hear this, get out. It hunts by sound. Stay quiet. Stay hidden.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tutorial_t1: {
    id: "tutorial_t1",
    category: "lore_tape",
    prompt: "This is field operator. Your flashlight is voice-activated. Speak into your microphone to keep it lit.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tutorial_t2: {
    id: "tutorial_t2",
    category: "lore_tape",
    prompt: "The thing in the dark hears you. Whisper safely. Talk if you need to see. Never shout unless you have to.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  tutorial_t3: {
    id: "tutorial_t3",
    category: "lore_tape",
    prompt: "Find the keycard, flip the breaker, reach the stairwell.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },

  // INTRO PANEL NARRATION (TTS - same voice as lore tapes, played during intro sequence)
  intro_panel_1: {
    id: "intro_panel_1",
    category: "lore_tape",
    prompt: "You shouldn't be here. But you are.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  intro_panel_2: {
    id: "intro_panel_2",
    category: "lore_tape",
    prompt: "It hunts by sound. Your microphone is the controller. Whisper. Or don't speak at all.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
  intro_panel_3: {
    id: "intro_panel_3",
    category: "lore_tape",
    prompt: "Get out. Three things stand between you and the door. One. Keycard. Find it first. Two. Breaker. Power needed. Three. Stairwell exit. Your way out.",
    loop: false,
    volume: 0.85,
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_turbo_v2_5",
    voiceSettings: { stability: 0.5, similarity_boost: 0.7, style: 0.4, use_speaker_boost: true },
  },
};

export const TUTORIAL_TRANSCRIPTS: Record<TutorialId, string> = {
  tutorial_t0: "If you can hear this, get out. It hunts by sound. Stay quiet. Stay hidden.",
  tutorial_t1: "This is field operator. Your flashlight is voice-activated. Speak into your microphone to keep it lit.",
  tutorial_t2: "The thing in the dark hears you. Whisper safely. Talk if you need to see. Never shout unless you have to.",
  tutorial_t3: "Find the keycard, flip the breaker, reach the stairwell.",
};

export const MAP_FRAGMENT_TRANSCRIPT =
  "Old facility map. Five sectors. Reception is the hub, Server in the middle, Stairwell at the top. If you got this far, you can get out.";

export const LORE_TAPE_TRANSCRIPTS: Record<LoreTapeId, string> = {
  tape_01: "Day fourteen. The night crew reported voices in the server room again. Maintenance found nothing on the cameras. We're going to need to bring in someone.",
  tape_02: "I asked Janet about the smell in the archives. She said it's been there since they took the building over. She wouldn't tell me when. She wouldn't say from who.",
  tape_03: "It only listens. That's what the old security log said. The lights bother it less than we thought. The sound bothers it more than we knew.",
  tape_04: "I saw something in the vent. Just for a second. It was watching the cubicles. I couldn't move until it pulled itself back up.",
  tape_05: "The third one is the worst. You feel it before you see it. And once you see it, you can't unsee it. Don't look at them. Just keep moving.",
  tape_06: "If anyone finds this. The breaker is the only way out. Don't go up the stairs. Don't ever go up the stairs. There's nothing up there that wants you to leave.",
};
