import { Howl, Howler } from "howler";
import { AUDIO_CATALOG, AudioId, AmbientId } from "./audio-catalog";

interface ManagedHowl {
  howl: Howl;
  baseVolume: number;
}

export class AudioManager {
  private sounds: Map<AudioId, ManagedHowl> = new Map();
  private currentAmbient: AmbientId | null = null;
  private currentAmbientHowl: Howl | null = null;
  private masterVolume: number = 1.0;
  private suspended: boolean = false;

  async loadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    // Skip if already loaded (survives Game restart)
    if (this.sounds.size > 0) {
      const total = Object.keys(AUDIO_CATALOG).length;
      onProgress?.(total, total);
      return;
    }

    const ids = Object.keys(AUDIO_CATALOG) as AudioId[];
    let loaded = 0;
    await Promise.all(
      ids.map((id) =>
        new Promise<void>((resolve) => {
          const asset = AUDIO_CATALOG[id];
          const howl = new Howl({
            src: [`/audio/${id}.mp3`],
            loop: asset.loop,
            volume: 0,
            preload: true,
            onload: () => {
              this.sounds.set(id, { howl, baseVolume: asset.volume });
              loaded++;
              onProgress?.(loaded, ids.length);
              resolve();
            },
            onloaderror: (_: any, err: any) => {
              console.warn(`Audio load failed for ${id}:`, err);
              loaded++;
              onProgress?.(loaded, ids.length);
              resolve();
            },
          });
        })
      )
    );
  }

  has(id: AudioId): boolean {
    return this.sounds.has(id);
  }

  crossfadeAmbient(id: AmbientId, fadeMS: number = 800): void {
    if (this.currentAmbient === id) return;

    const prev = this.currentAmbientHowl;
    const next = this.sounds.get(id);
    if (!next) {
      console.warn(`Ambient track not loaded: ${id}`);
      return;
    }

    next.howl.volume(0);
    next.howl.play();
    next.howl.fade(0, next.baseVolume * this.masterVolume, fadeMS);

    if (prev) {
      prev.fade(prev.volume(), 0, fadeMS);
      setTimeout(() => prev.stop(), fadeMS + 100);
    }

    this.currentAmbient = id;
    this.currentAmbientHowl = next.howl;
  }

  playOneShot(id: AudioId): number | null {
    const managed = this.sounds.get(id);
    if (!managed) return null;
    // Reset loop to catalog default (prevents looping after loop() was called)
    managed.howl.loop(AUDIO_CATALOG[id].loop);
    managed.howl.volume(managed.baseVolume * this.masterVolume);
    return managed.howl.play();
  }

  loop(id: AudioId): void {
    const managed = this.sounds.get(id);
    if (!managed || managed.howl.playing()) return;
    managed.howl.loop(true);
    managed.howl.volume(managed.baseVolume * this.masterVolume);
    managed.howl.play();
  }

  stop(id: AudioId): void {
    this.sounds.get(id)?.howl.stop();
  }

  stopAllMonsterVocals(): void {
    for (const [id] of this.sounds) {
      if (AUDIO_CATALOG[id].category === "monster_vocal") {
        this.sounds.get(id)!.howl.stop();
      }
    }
  }

  fadeOutAmbient(fadeMS: number = 600): void {
    if (this.currentAmbientHowl) {
      const h = this.currentAmbientHowl;
      h.fade(h.volume(), 0, fadeMS);
      setTimeout(() => h.stop(), fadeMS + 100);
      this.currentAmbient = null;
      this.currentAmbientHowl = null;
    }
  }

  /** Load and play audio from a blob URL (used for runtime TTS). */
  loadAndPlayBlob(id: string, blobUrl: string, opts?: { volume?: number }): void {
    const howl = new Howl({
      src: [blobUrl],
      format: ["mp3"],
      volume: (opts?.volume ?? 1.0) * this.masterVolume,
      onend: () => {
        howl.unload();
        URL.revokeObjectURL(blobUrl);
      },
      onloaderror: () => {
        console.warn(`[radio] Failed to decode TTS blob ${id}, cleaning up`);
        howl.unload();
        URL.revokeObjectURL(blobUrl);
      },
    });
    howl.play();
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    Howler.volume(this.masterVolume);
  }

  suspend(): void {
    if (this.suspended) return;
    Howler.ctx?.suspend();
    this.suspended = true;
  }

  resume(): void {
    if (!this.suspended) return;
    Howler.ctx?.resume();
    this.suspended = false;
  }
}

export const audioManager = new AudioManager();
