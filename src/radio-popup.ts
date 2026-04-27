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

  // Store all listener refs for cleanup
  private keyHandler: (e: KeyboardEvent) => void;
  private inputHandler: () => void;
  private sliderHandler: () => void;
  private armHandler: () => void;
  private cancelHandler: () => void;
  private presetHandlers: { btn: HTMLButtonElement; handler: () => void }[] = [];

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

    this.inputHandler = () => {
      this.charCount.textContent = String(this.input.value.length);
      this.armBtn.disabled = this.input.value.trim().length === 0;
    };
    this.input.addEventListener("input", this.inputHandler);

    this.sliderHandler = () => {
      this.timerValue.textContent = this.timerSlider.value;
    };
    this.timerSlider.addEventListener("input", this.sliderHandler);

    this.presetBtns.forEach((btn) => {
      const handler = () => {
        this.input.value = btn.dataset.preset || "";
        this.charCount.textContent = String(this.input.value.length);
        this.armBtn.disabled = false;
        this.input.focus();
      };
      btn.addEventListener("click", handler);
      this.presetHandlers.push({ btn, handler });
    });

    this.armHandler = () => this.confirm();
    this.armBtn.addEventListener("click", this.armHandler);

    this.cancelHandler = () => this.cancel();
    this.cancelBtn.addEventListener("click", this.cancelHandler);

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
    this.input.removeEventListener("input", this.inputHandler);
    this.timerSlider.removeEventListener("input", this.sliderHandler);
    this.armBtn.removeEventListener("click", this.armHandler);
    this.cancelBtn.removeEventListener("click", this.cancelHandler);
    for (const { btn, handler } of this.presetHandlers) {
      btn.removeEventListener("click", handler);
    }
    this.presetHandlers = [];
  }
}
