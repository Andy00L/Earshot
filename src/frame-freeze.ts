/**
 * Brief gameplay pause for impact moments. Keeps VFX and render alive.
 *
 * Usage: call trigger(durationMs) at the impact moment. In the
 * gameplay tick, check isFrozen() and skip game logic when true.
 * The render loop and VFX updates run unconditionally.
 */
export class FrameFreeze {
  private freezeUntilMs = 0;

  trigger(durationMs: number): void {
    const target = performance.now() + durationMs;
    // Additive: if a longer freeze is in progress, keep it.
    if (target > this.freezeUntilMs) {
      this.freezeUntilMs = target;
    }
  }

  isFrozen(): boolean {
    return performance.now() < this.freezeUntilMs;
  }

  // Clear any active freeze. Call on death, room change, restart.
  clear(): void {
    this.freezeUntilMs = 0;
  }
}
