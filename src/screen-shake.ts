/**
 * Camera screen shake controller.
 * Applies random per-frame offsets that decay over a configurable duration.
 * Additive: multiple triggers stack up to MAX_INTENSITY.
 */
export class ScreenShake {
  private static readonly MAX_INTENSITY = 20;

  private remainingMs = 0;
  private intensity = 0;
  private totalMs = 0;
  private _offsetX = 0;
  private _offsetY = 0;

  trigger(durationMs: number, intensity: number): void {
    if (this.remainingMs > 0) {
      // Additive: stack intensity up to cap
      this.intensity = Math.min(
        ScreenShake.MAX_INTENSITY,
        this.intensity + intensity,
      );
      this.remainingMs = Math.max(this.remainingMs, durationMs);
      this.totalMs = this.remainingMs;
    } else {
      this.intensity = Math.min(ScreenShake.MAX_INTENSITY, intensity);
      this.remainingMs = durationMs;
      this.totalMs = durationMs;
    }
  }

  update(dtMs: number): void {
    if (this.remainingMs <= 0) {
      this._offsetX = 0;
      this._offsetY = 0;
      return;
    }
    this.remainingMs -= dtMs;
    const t = Math.max(0, this.remainingMs / this.totalMs);
    const amp = this.intensity * t;
    this._offsetX = (Math.random() - 0.5) * 2 * amp;
    this._offsetY = (Math.random() - 0.5) * 2 * amp;
  }

  get offsetX(): number {
    return this._offsetX;
  }

  get offsetY(): number {
    return this._offsetY;
  }
}
