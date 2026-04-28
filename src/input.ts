const MOVEMENT_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'a', 'A', 'd', 'D', 'w', 'W', 's', 'S',
  ' ',
]);

export class Input {
  private held = new Set<string>();
  private codesHeld = new Set<string>();
  private codesPressedThisFrame = new Set<string>();

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (MOVEMENT_KEYS.has(e.key)) {
        e.preventDefault();
      }

      this.held.add(e.key);

      if (!this.codesHeld.has(e.code)) {
        this.codesPressedThisFrame.add(e.code);
      }
      this.codesHeld.add(e.code);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.held.delete(e.key);
      this.codesHeld.delete(e.code);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  isLeft(): boolean {
    return this.held.has('a') || this.held.has('A') || this.held.has('ArrowLeft');
  }

  isRight(): boolean {
    return this.held.has('d') || this.held.has('D') || this.held.has('ArrowRight');
  }

  isUp(): boolean {
    return this.held.has('w') || this.held.has('W') || this.held.has('ArrowUp');
  }

  isDown(): boolean {
    return this.held.has('s') || this.held.has('S') || this.held.has('ArrowDown');
  }

  isRunning(): boolean {
    return this.held.has('Shift');
  }

  isCrouching(): boolean {
    return this.held.has('Control');
  }

  isEscapeHeld(): boolean {
    return this.held.has('Escape');
  }

  /** Returns true on the single frame a key code was first pressed. */
  justPressed(code: string): boolean {
    return this.codesPressedThisFrame.has(code);
  }

  /** Returns true on the single frame E or Up Arrow was first pressed. */
  justInteracted(): boolean {
    return this.justPressed("KeyE") || this.justPressed("ArrowUp");
  }

  /** Returns true on the single frame R was first pressed (arm radio). */
  justArmedRadio(): boolean {
    return this.justPressed("KeyR");
  }

  /** Returns true on the single frame G was first pressed (throw radio). */
  justThrew(): boolean {
    return this.justPressed("KeyG");
  }

  /** Returns the inventory slot selected this frame (0, 1, 2) or -1 if none. */
  justSelectedSlot(): number {
    if (this.justPressed("Digit1")) return 0;
    if (this.justPressed("Digit2")) return 1;
    if (this.justPressed("Digit3")) return 2;
    return -1;
  }

  /** Clear all held/pressed state (used after resuming from PAUSED). */
  clearAll(): void {
    this.held.clear();
    this.codesHeld.clear();
    this.codesPressedThisFrame.clear();
  }

  /** Call at the end of every game tick to clear edge-triggered state. */
  endFrame(): void {
    this.codesPressedThisFrame.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
