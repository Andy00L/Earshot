/**
 * Procedural heartbeat audio via Web Audio API.
 * BPM and volume scale with suspicion (0..100).
 * A heartbeat = two thumps in quick succession (lub-dub), then silence.
 */
export class Heartbeat {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nextBeatAt = 0;
  private active = false;
  private currentBPM = 0;
  private currentVolume = 0;
  private targetBPM = 0;
  private targetVolume = 0;

  start(sharedCtx?: AudioContext): void {
    this.ctx =
      sharedCtx ??
      new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);
    this.active = true;
    this.nextBeatAt = performance.now() + 1000;
  }

  setSuspicion(suspicion: number): void {
    if (suspicion < 30) {
      this.targetBPM = 0;
      this.targetVolume = 0;
    } else if (suspicion < 60) {
      const t = (suspicion - 30) / 30;
      this.targetBPM = 50 + t * 30;
      this.targetVolume = 0.15 + t * 0.2;
    } else if (suspicion < 90) {
      const t = (suspicion - 60) / 30;
      this.targetBPM = 80 + t * 50;
      this.targetVolume = 0.35 + t * 0.2;
    } else {
      const t = Math.min(1, (suspicion - 90) / 10);
      this.targetBPM = 130 + t * 30;
      this.targetVolume = 0.55 + t * 0.25;
    }

    this.currentBPM += (this.targetBPM - this.currentBPM) * 0.05;
    this.currentVolume += (this.targetVolume - this.currentVolume) * 0.05;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.currentVolume,
        this.ctx.currentTime,
        0.1,
      );
    }
  }

  tick(): void {
    if (!this.active || !this.ctx || this.currentBPM < 1) return;
    const now = performance.now();
    if (now >= this.nextBeatAt) {
      this.scheduleBeat();
      const intervalMs = 60000 / this.currentBPM;
      this.nextBeatAt = now + intervalMs;
    }
  }

  private scheduleBeat(): void {
    if (!this.ctx || !this.masterGain) return;
    this.scheduleThump(0, 60);
    this.scheduleThump(0.12, 80);
  }

  private scheduleThump(offsetSec: number, freqHz: number): void {
    if (!this.ctx || !this.masterGain) return;
    const startTime = this.ctx.currentTime + offsetSec;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freqHz;
    osc.connect(gain);
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1.0, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
    osc.start(startTime);
    osc.stop(startTime + 0.21);
  }

  stop(): void {
    this.active = false;
    this.currentBPM = 0;
    this.currentVolume = 0;
    this.targetBPM = 0;
    this.targetVolume = 0;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
    }
  }

  destroy(): void {
    this.stop();
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
