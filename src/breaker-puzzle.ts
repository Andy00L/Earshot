import { Howler } from "howler";
import { audioManager } from "./audio";
import { AUDIO_CATALOG, SfxId } from "./audio-catalog";

export type BreakerPuzzleResult =
  | "success"
  | "fail_wrong_choice"
  | "fail_timeout"
  | "cancelled";

export interface BreakerPuzzleConfig {
  onResult: (result: BreakerPuzzleResult) => void;
  onAudioPlay?: () => void;
  timerMs?: number; // default 15000
}

type PuzzleLetter = "A" | "B" | "C" | "D";

const VARIANT_IDS: SfxId[] = [
  "breaker_variant_a",
  "breaker_variant_b",
  "breaker_variant_c",
];
const LETTERS: readonly PuzzleLetter[] = ["A", "B", "C", "D"];

export class BreakerPuzzle {
  private config: BreakerPuzzleConfig;
  private timerMs: number;

  private overlay: HTMLDivElement | null = null;
  private timerBarInner: HTMLDivElement | null = null;
  private submitBtn: HTMLButtonElement | null = null;

  private selectedLetter: PuzzleLetter | null = null;
  private correctLetter: PuzzleLetter = "A";
  private letterToSfx: Record<PuzzleLetter, SfxId> = {
    A: "breaker_original",
    B: "breaker_variant_a",
    C: "breaker_variant_b",
    D: "breaker_variant_c",
  };

  private open_ = false;
  private startTime = 0;
  private pausedDuration = 0;
  private hideTime = 0;
  private timerInterval: number | null = null;
  private timeoutHandle: number | null = null;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  private lastPlayedId: SfxId | null = null;

  // Web Audio buffers (direct playback, bypasses Howler)
  private audioBuffers: Map<SfxId, AudioBuffer> = new Map();
  private currentSource: AudioBufferSourceNode | null = null;

  constructor(config: BreakerPuzzleConfig) {
    this.config = config;
    this.timerMs = config.timerMs ?? 15000;
    this.injectStyles();
  }

  isOpen(): boolean {
    return this.open_;
  }

  async open(): Promise<void> {
    if (this.open_) return;
    this.open_ = true;

    // Load audio buffers directly via Web Audio API. Howler playback
    // can fail silently when the PixiJS ticker is stopped (PAUSED phase).
    await this.loadBuffers();
    if (!this.open_) return;

    // E1: Check audio availability (buffer or Howler fallback).
    const required: SfxId[] = [
      "breaker_original",
      "breaker_variant_a",
      "breaker_variant_b",
      "breaker_variant_c",
    ];
    for (const id of required) {
      if (!this.audioBuffers.has(id) && !audioManager.has(id)) {
        console.error(
          `[breaker-puzzle] Missing audio ${id}, falling back to instant flip.`,
        );
        this.open_ = false;
        this.config.onResult("cancelled");
        return;
      }
    }
    this.selectedLetter = null;
    this.lastPlayedId = null;

    // Randomize correct answer
    this.correctLetter = LETTERS[Math.floor(Math.random() * 4)];

    // Assign SFX: correct letter gets breaker_original, others get shuffled variants
    const shuffled = [...VARIANT_IDS].sort(() => Math.random() - 0.5);
    let vi = 0;
    for (const letter of LETTERS) {
      this.letterToSfx[letter] =
        letter === this.correctLetter
          ? "breaker_original"
          : shuffled[vi++];
    }

    this.buildOverlay();

    // Start timer
    this.startTime = performance.now();
    this.pausedDuration = 0;
    this.timerInterval = window.setInterval(() => this.updateTimer(), 100);
    this.timeoutHandle = window.setTimeout(
      () => this.onTimeout(),
      this.timerMs,
    );

    // E4: Pause timer when page hidden
    this.visibilityHandler = () => this.handleVisibility();
    document.addEventListener("visibilitychange", this.visibilityHandler);

    // Keyboard handler
    this.keyHandler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener("keydown", this.keyHandler);

    // Auto-play original after 500ms delay
    window.setTimeout(() => {
      if (this.open_) this.playSound("breaker_original");
    }, 500);
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;

    // Stop any playing puzzle audio
    this.stopCurrentSound();

    // Clean up timers
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    // Clean up event listeners
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    // Remove DOM
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.timerBarInner = null;
    this.submitBtn = null;
  }

  // ── Audio ──

  private async loadBuffers(): Promise<void> {
    if (this.audioBuffers.size > 0) return;
    const ctx = (Howler as unknown as { ctx: AudioContext }).ctx;
    if (!ctx) return;

    const ids: SfxId[] = [
      "breaker_original",
      "breaker_variant_a",
      "breaker_variant_b",
      "breaker_variant_c",
    ];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const resp = await fetch(`/audio/${id}.mp3`);
          if (!resp.ok) return;
          const ab = await resp.arrayBuffer();
          const buffer = await ctx.decodeAudioData(ab);
          this.audioBuffers.set(id, buffer);
        } catch {
          console.warn(`[breaker-puzzle] Buffer load failed for ${id}`);
        }
      }),
    );
  }

  private playSound(id: SfxId): void {
    this.stopCurrentSound();
    this.lastPlayedId = id;

    const buffer = this.audioBuffers.get(id);
    if (buffer) {
      const ctx = (Howler as unknown as { ctx: AudioContext }).ctx;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = AUDIO_CATALOG[id].volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      this.currentSource = source;
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
      };
    } else {
      audioManager.playOneShot(id);
    }

    this.config.onAudioPlay?.();
  }

  private stopCurrentSound(): void {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* already ended */ }
      this.currentSource = null;
    }
    if (this.lastPlayedId) {
      audioManager.stop(this.lastPlayedId);
      this.lastPlayedId = null;
    }
  }

  // ── Interaction ──

  private selectLetter(letter: PuzzleLetter): void {
    this.selectedLetter = letter;

    // Update button highlight
    if (this.overlay) {
      const buttons =
        this.overlay.querySelectorAll<HTMLButtonElement>(".bp-choice");
      buttons.forEach((btn) => {
        btn.classList.toggle("bp-selected", btn.dataset.letter === letter);
      });
    }

    // Enable submit button with selected letter
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = `SUBMIT ${letter}`;
    }

    // Play the selected variant
    this.playSound(this.letterToSfx[letter]);
  }

  private submit(): void {
    if (!this.selectedLetter) return;
    const result: BreakerPuzzleResult =
      this.selectedLetter === this.correctLetter
        ? "success"
        : "fail_wrong_choice";
    this.close();
    this.config.onResult(result);
  }

  private onTimeout(): void {
    this.close();
    this.config.onResult("fail_timeout");
  }

  private cancel(): void {
    this.close();
    this.config.onResult("cancelled");
  }

  // ── Keyboard ──

  private handleKey(e: KeyboardEvent): void {
    if (!this.open_) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
      return;
    }

    // 1-4 select letters A-D
    const keyMap: Record<string, PuzzleLetter> = {
      "1": "A",
      "2": "B",
      "3": "C",
      "4": "D",
    };
    const letter = keyMap[e.key];
    if (letter) {
      e.preventDefault();
      e.stopPropagation();
      this.selectLetter(letter);
      return;
    }

    // Enter submits
    if (e.key === "Enter" && this.selectedLetter) {
      e.preventDefault();
      e.stopPropagation();
      this.submit();
      return;
    }

    // Space replays original
    if (e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      this.playSound("breaker_original");
    }
  }

  // ── Timer ──

  private getElapsedMs(): number {
    return performance.now() - this.startTime - this.pausedDuration;
  }

  private updateTimer(): void {
    if (!this.open_ || !this.timerBarInner) return;

    const elapsed = this.getElapsedMs();
    const fraction = Math.max(0, 1 - elapsed / this.timerMs);
    this.timerBarInner.style.width = `${fraction * 100}%`;

    // Color transitions: blue > yellow at 50% > red at 25%
    if (fraction > 0.5) {
      this.timerBarInner.style.background = "#4488cc";
    } else if (fraction > 0.25) {
      this.timerBarInner.style.background = "#ccaa44";
    } else {
      this.timerBarInner.style.background = "#c43030";
    }
  }

  // E4: Page visibility handling (pause timer when tab hidden)
  private handleVisibility(): void {
    if (!this.open_) return;

    if (document.hidden) {
      this.hideTime = performance.now();
      if (this.timeoutHandle !== null) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      if (this.timerInterval !== null) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    } else {
      this.pausedDuration += performance.now() - this.hideTime;
      const remaining = this.timerMs - this.getElapsedMs();
      if (remaining <= 0) {
        this.onTimeout();
        return;
      }
      this.timerInterval = window.setInterval(() => this.updateTimer(), 100);
      this.timeoutHandle = window.setTimeout(
        () => this.onTimeout(),
        remaining,
      );
    }
  }

  // ── DOM ──

  private buildOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "bp-overlay";

    const panel = document.createElement("div");
    panel.className = "bp-panel";

    // Title
    const title = document.createElement("div");
    title.className = "bp-title";
    title.textContent = "BREAKER LOCK. MATCH THE SIGNAL.";
    panel.appendChild(title);

    // Play Original button
    const origBtn = document.createElement("button");
    origBtn.className = "bp-btn bp-original";
    origBtn.textContent = "\u25B6 ORIGINAL";
    origBtn.addEventListener("click", () =>
      this.playSound("breaker_original"),
    );
    panel.appendChild(origBtn);

    // Choice buttons (2x2 grid)
    const choices = document.createElement("div");
    choices.className = "bp-choices";
    for (const letter of LETTERS) {
      const btn = document.createElement("button");
      btn.className = "bp-btn bp-choice";
      btn.dataset.letter = letter;
      btn.textContent = `\u25B6 ${letter}`;
      btn.addEventListener("click", () => this.selectLetter(letter));
      choices.appendChild(btn);
    }
    panel.appendChild(choices);

    // Submit button
    this.submitBtn = document.createElement("button");
    this.submitBtn.className = "bp-btn bp-submit";
    this.submitBtn.textContent = "SUBMIT";
    this.submitBtn.disabled = true;
    this.submitBtn.addEventListener("click", () => this.submit());
    panel.appendChild(this.submitBtn);

    // Timer bar
    const timerOuter = document.createElement("div");
    timerOuter.className = "bp-timer";
    this.timerBarInner = document.createElement("div");
    this.timerBarInner.className = "bp-timer-bar";
    this.timerBarInner.style.width = "100%";
    this.timerBarInner.style.background = "#4488cc";
    timerOuter.appendChild(this.timerBarInner);
    panel.appendChild(timerOuter);

    // Hint text
    const hint = document.createElement("div");
    hint.className = "bp-hint";
    hint.textContent = "1/2/3/4 select. SPACE replay original. ENTER submit. ESC leave.";
    panel.appendChild(hint);

    // Back button (same as ESC)
    const backBtn = document.createElement("button");
    backBtn.className = "bp-back";
    backBtn.setAttribute("aria-label", "Leave puzzle");
    backBtn.innerHTML = '<img src="/ui/back-button.png" alt="Back" />';
    backBtn.addEventListener("click", () => this.cancel());
    panel.appendChild(backBtn);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  private injectStyles(): void {
    if (document.querySelector("#bp-styles")) return;

    const style = document.createElement("style");
    style.id = "bp-styles";
    style.textContent = `
      .bp-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex; align-items: center; justify-content: center;
        z-index: 8000;
        font-family: 'Courier New', monospace;
      }
      .bp-panel {
        position: relative;
        background: #1a1410;
        border: 2px solid #5a3820;
        padding: 32px;
        width: 480px;
        max-width: 90vw;
        color: #c4a484;
        box-shadow: 0 0 40px rgba(0,0,0,0.8) inset;
      }
      .bp-title {
        font-size: 18px;
        letter-spacing: 4px;
        text-align: center;
        margin-bottom: 24px;
        text-shadow: 0 0 8px #5a3820;
      }
      .bp-btn {
        background: #2a1810;
        border: 2px solid #5a3820;
        color: #c4a484;
        padding: 12px 20px;
        font-family: inherit;
        font-size: 16px;
        cursor: pointer;
        letter-spacing: 2px;
        transition: transform 0.15s ease;
      }
      .bp-btn:hover {
        background: #3a2418;
        box-shadow: 0 0 12px #7a4830;
      }
      .bp-btn:active {
        transform: scale(1.05);
      }
      .bp-original {
        display: block; width: 100%;
        margin-bottom: 16px;
        font-weight: bold;
      }
      .bp-choices {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        margin-bottom: 16px;
      }
      .bp-choice.bp-selected {
        background: #5a3820;
        box-shadow: 0 0 16px #c4a484 inset;
      }
      .bp-submit {
        display: block; width: 100%;
        margin-bottom: 16px;
      }
      .bp-submit:disabled {
        opacity: 0.4; cursor: not-allowed;
      }
      .bp-timer {
        height: 4px;
        background: #2a1810;
        margin-bottom: 8px;
        overflow: hidden;
      }
      .bp-timer-bar {
        height: 100%;
        transition: width 100ms linear;
      }
      .bp-hint {
        font-size: 11px;
        text-align: center;
        opacity: 0.6;
        letter-spacing: 1px;
      }
      .bp-back {
        position: absolute;
        top: 12px;
        right: 12px;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        width: 48px;
        height: 48px;
      }
      .bp-back img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .bp-back:hover img {
        filter: brightness(1.2);
      }
    `;
    document.head.appendChild(style);
  }
}
