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

  isRunning(): boolean {
    return this.held.has('Shift');
  }

  isCrouching(): boolean {
    return this.held.has('Control');
  }

  /** Returns true on the single frame a key code was first pressed. */
  justPressed(code: string): boolean {
    return this.codesPressedThisFrame.has(code);
  }

  /** Returns true on the single frame E or Up Arrow was first pressed. */
  justInteracted(): boolean {
    return this.justPressed("KeyE") || this.justPressed("ArrowUp");
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
