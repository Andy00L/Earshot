/**
 * Procedural sub-bass impact via Web Audio API.
 * Fires a one-shot sine oscillator with an AD envelope.
 * Pattern adapted from src/heartbeat.ts: oscillator + gain node
 * scheduled via setValueAtTime / linearRampToValueAtTime, connected
 * to a master gain that feeds ctx.destination.
 */
export class ImpactBass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  start(sharedCtx: AudioContext): void {
    this.ctx = sharedCtx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);
  }

  // Fire the impact. 40 Hz sine, 200 ms, peak gain 0.3,
  // 5 ms attack, 195 ms linear release.
  trigger(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") return;

    const frequency = 40;
    const peakGain = 0.3;
    const attackSec = 0.005;
    const totalSec = 0.2;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + attackSec);
    gain.gain.linearRampToValueAtTime(0, now + totalSec);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + totalSec + 0.01);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    };
  }

  destroy(): void {
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Already disconnected.
      }
      this.masterGain = null;
    }
    this.ctx = null;
  }
}
