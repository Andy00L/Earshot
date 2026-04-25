export interface ArmRadioResult {
  message: string;
  timerSec: number;
}

/**
 * HTML overlay for the radio ARM popup. Mounted in index.html as a hidden div.
 * Returns a promise that resolves with the player's message and timer choice,
 * or null if cancelled.
 */
export class RadioPopup {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private charCount: HTMLElement;
  private timerSlider: HTMLInputElement;
  private timerValue: HTMLElement;
  private armBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private presetBtns: HTMLButtonElement[];
  private resolveFn: ((result: ArmRadioResult | null) => void) | null = null;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.root = document.getElementById("radio-popup")!;
    this.input = document.getElementById("radio-message-input") as HTMLInputElement;
    this.charCount = document.getElementById("radio-char-count")!;
    this.timerSlider = document.getElementById("radio-timer") as HTMLInputElement;
    this.timerValue = document.getElementById("radio-timer-value")!;
    this.armBtn = document.getElementById("radio-arm-btn") as HTMLButtonElement;
    this.cancelBtn = document.getElementById("radio-cancel-btn") as HTMLButtonElement;
    this.presetBtns = Array.from(
      document.querySelectorAll(".radio-preset-btn"),
    ) as HTMLButtonElement[];

    this.input.addEventListener("input", () => {
      this.charCount.textContent = String(this.input.value.length);
      this.armBtn.disabled = this.input.value.trim().length === 0;
    });

    this.timerSlider.addEventListener("input", () => {
      this.timerValue.textContent = this.timerSlider.value;
    });

    this.presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.input.value = btn.dataset.preset || "";
        this.charCount.textContent = String(this.input.value.length);
        this.armBtn.disabled = false;
        this.input.focus();
      });
    });

    this.armBtn.addEventListener("click", () => this.confirm());
    this.cancelBtn.addEventListener("click", () => this.cancel());

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.root.classList.contains("radio-popup-hidden")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      }
      if (e.key === "Enter" && !this.armBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        this.confirm();
      }
    };
    document.addEventListener("keydown", this.keyHandler);
  }

  show(): Promise<ArmRadioResult | null> {
    return new Promise((resolve) => {
      this.resolveFn = resolve;
      this.input.value = "";
      this.charCount.textContent = "0";
      this.armBtn.disabled = true;
      this.timerSlider.value = "4";
      this.timerValue.textContent = "4";
      this.root.classList.remove("radio-popup-hidden");
      setTimeout(() => this.input.focus(), 50);
    });
  }

  private confirm(): void {
    const message = this.input.value.trim();
    if (!message) return;
    const result: ArmRadioResult = {
      message,
      timerSec: parseInt(this.timerSlider.value, 10),
    };
    this.hide();
    if (this.resolveFn) {
      this.resolveFn(result);
      this.resolveFn = null;
    }
  }

  private cancel(): void {
    this.hide();
    if (this.resolveFn) {
      this.resolveFn(null);
      this.resolveFn = null;
    }
  }

  private hide(): void {
    this.root.classList.add("radio-popup-hidden");
    this.input.blur();
  }

  destroy(): void {
    document.removeEventListener("keydown", this.keyHandler);
  }
}
