import { audioManager } from "./audio";
import { micAnalyser } from "./mic";
import { synthesizeTTS } from "./tts";
import { RMS_THRESHOLD_WHISPER, RMS_THRESHOLD_NORMAL } from "./beacon";

export type WhisperPuzzleResult =
  | "success"
  | "fail_too_loud"
  | "fail_timeout"
  | "cancelled";

export interface WhisperPuzzleConfig {
  onResult: (result: WhisperPuzzleResult) => void;
  attemptsAllowed?: number; // default 3
  windowMs?: number; // default 10000 per attempt
  requiredDurationMs?: number; // default 1500
}

type PuzzlePhase =
  | "closed"
  | "loading_phrase"
  | "playing_phrase"
  | "awaiting_voice"
  | "monitoring"
  | "succeeded"
  | "failed";

const WHISPER_PHRASES = [
  "shadow walks beside you",
  "no one ever leaves this place",
  "their names live in the walls",
  "listen to what is missing",
  "the silence is alive",
  "you have been here before",
  "they remember your voice",
];

// Bella voice for whisperer TTS
const BELLA_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export class WhisperPuzzle {
  private config: WhisperPuzzleConfig;
  private attemptsAllowed: number;
  private windowMs: number;
  private requiredDurationMs: number;

  // Mic thresholds derived from beacon.ts constants
  private whisperMin = RMS_THRESHOLD_WHISPER; // 0.01125
  private whisperMax = RMS_THRESHOLD_NORMAL; // 0.0225

  private overlay: HTMLDivElement | null = null;
  private phraseEl: HTMLElement | null = null;
  private progressBar: HTMLDivElement | null = null;
  private micIcon: HTMLDivElement | null = null;
  private attemptsContainer: HTMLElement | null = null;

  private open_ = false;
  private phase: PuzzlePhase = "closed";
  private currentPhrase = "";
  private attemptsRemaining = 3;
  private whisperAccumulatedMs = 0;
  private attemptStartTime = 0;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private attemptTimeoutId: number | null = null;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private ttsBlobUrl: string | null = null;

  constructor(config: WhisperPuzzleConfig) {
    this.config = config;
    this.attemptsAllowed = config.attemptsAllowed ?? 3;
    this.windowMs = config.windowMs ?? 10000;
    this.requiredDurationMs = config.requiredDurationMs ?? 1500;
    this.injectStyles();
  }

  isOpen(): boolean {
    return this.open_;
  }

  async open(): Promise<void> {
    if (this.open_) return;

    // E2: Check mic availability
    if (micAnalyser.state !== "active") {
      console.warn("[whisper-puzzle] Mic not active, cannot open.");
      this.config.onResult("cancelled");
      return;
    }

    this.open_ = true;
    this.attemptsRemaining = this.attemptsAllowed;
    this.whisperAccumulatedMs = 0;
    this.phase = "loading_phrase";

    // Pick a random phrase
    this.currentPhrase =
      WHISPER_PHRASES[Math.floor(Math.random() * WHISPER_PHRASES.length)];

    this.buildOverlay();
    this.updateAttemptsDisplay();

    // Keyboard handler
    this.keyHandler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener("keydown", this.keyHandler);

    // Generate TTS phrase
    if (this.phraseEl) this.phraseEl.textContent = "...";

    const blobUrl = await synthesizeTTS(
      `[whispering] ${this.currentPhrase}`,
      undefined,
      {
        voiceId: BELLA_VOICE_ID,
        modelId: "eleven_turbo_v2_5",
        voiceSettings: {
          stability: 0.3,
          similarity_boost: 0.85,
          style: 0.5,
          use_speaker_boost: false,
        },
      },
    );

    if (!this.open_) return; // closed during TTS generation

    if (blobUrl) {
      this.ttsBlobUrl = blobUrl;
      this.phase = "playing_phrase";
      audioManager.loadAndPlayBlob("whisper_phrase", blobUrl, {
        volume: 0.8,
      });
      // Wait for audio to finish (estimate 2s for short phrase)
      window.setTimeout(() => {
        if (this.open_ && this.phase === "playing_phrase") {
          this.startAttempt();
        }
      }, 2500);
    } else {
      // E1: TTS failed. Show phrase text immediately and proceed.
      console.warn("[whisper-puzzle] TTS failed, proceeding without audio.");
      this.startAttempt();
    }
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.phase = "closed";

    // Stop rAF loop
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Stop timers
    if (this.attemptTimeoutId !== null) {
      clearTimeout(this.attemptTimeoutId);
      this.attemptTimeoutId = null;
    }

    // Clean up TTS blob
    if (this.ttsBlobUrl) {
      URL.revokeObjectURL(this.ttsBlobUrl);
      this.ttsBlobUrl = null;
    }

    // Clean up keyboard handler
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    // Remove DOM
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.phraseEl = null;
    this.progressBar = null;
    this.micIcon = null;
    this.attemptsContainer = null;
  }

  // ── Attempt lifecycle ──

  private startAttempt(): void {
    this.phase = "awaiting_voice";
    this.whisperAccumulatedMs = 0;
    this.attemptStartTime = performance.now();
    this.lastFrameTime = performance.now();

    // Show phrase text
    if (this.phraseEl) this.phraseEl.textContent = this.currentPhrase;
    if (this.progressBar) this.progressBar.style.width = "0%";
    if (this.micIcon) this.micIcon.dataset.state = "idle";

    // Start attempt timeout
    this.attemptTimeoutId = window.setTimeout(
      () => this.onAttemptTimeout(),
      this.windowMs,
    );

    // Start mic monitoring rAF loop
    this.startMonitoringLoop();
  }

  private startMonitoringLoop(): void {
    const loop = () => {
      if (!this.open_) return;
      if (
        this.phase !== "awaiting_voice" &&
        this.phase !== "monitoring"
      )
        return;

      const now = performance.now();
      const dtMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Sample the mic (game ticker is paused, we do it ourselves)
      micAnalyser.sample();
      const rms = micAnalyser.smoothedRms;

      this.processRms(rms, dtMs);

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private processRms(rms: number, dtMs: number): void {
    // Too loud: instant fail
    if (rms >= this.whisperMax) {
      if (this.micIcon) this.micIcon.dataset.state = "too_loud";
      this.onFailTooLoud();
      return;
    }

    // In whisper range: accumulate
    if (rms >= this.whisperMin) {
      this.phase = "monitoring";
      if (this.micIcon) this.micIcon.dataset.state = "whispering";
      this.whisperAccumulatedMs += dtMs;

      // Update progress bar
      const fraction = Math.min(
        1,
        this.whisperAccumulatedMs / this.requiredDurationMs,
      );
      if (this.progressBar) {
        this.progressBar.style.width = `${fraction * 100}%`;
      }

      // Check success
      if (this.whisperAccumulatedMs >= this.requiredDurationMs) {
        this.onSuccess();
        return;
      }
    } else {
      // Below whisper: not speaking. Keep accumulated (lenient, E6).
      if (this.micIcon) this.micIcon.dataset.state = "idle";
    }
  }

  // ── Outcomes ──

  private onSuccess(): void {
    this.phase = "succeeded";
    this.stopMonitoring();
    this.close();
    this.config.onResult("success");
  }

  private onFailTooLoud(): void {
    this.phase = "failed";
    this.stopMonitoring();
    this.close();
    this.config.onResult("fail_too_loud");
  }

  private onAttemptTimeout(): void {
    this.attemptTimeoutId = null;
    this.attemptsRemaining--;

    if (this.attemptsRemaining <= 0) {
      this.phase = "failed";
      this.stopMonitoring();
      this.close();
      this.config.onResult("fail_timeout");
      return;
    }

    // Reset for next attempt
    this.stopMonitoring();
    this.updateAttemptsDisplay();
    this.startAttempt();
  }

  private stopMonitoring(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.attemptTimeoutId !== null) {
      clearTimeout(this.attemptTimeoutId);
      this.attemptTimeoutId = null;
    }
  }

  // ── Keyboard ──

  private handleKey(e: KeyboardEvent): void {
    if (!this.open_) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      this.config.onResult("cancelled");
    }
  }

  // ── DOM ──

  private updateAttemptsDisplay(): void {
    if (!this.attemptsContainer) return;
    const dots = this.attemptsContainer.querySelectorAll(".wp-dot");
    dots.forEach((dot, i) => {
      (dot as HTMLElement).classList.toggle(
        "wp-dot-active",
        i < this.attemptsRemaining,
      );
    });
  }

  private buildOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "wp-overlay";

    const panel = document.createElement("div");
    panel.className = "wp-panel";

    // Title
    const title = document.createElement("div");
    title.className = "wp-title";
    title.textContent = "THE WHISPERER SPEAKS. REPEAT.";
    panel.appendChild(title);

    // Mic icon
    this.micIcon = document.createElement("div");
    this.micIcon.className = "wp-mic";
    this.micIcon.dataset.state = "idle";
    this.micIcon.textContent = "\uD83C\uDF99\uFE0F";
    panel.appendChild(this.micIcon);

    // Phrase
    this.phraseEl = document.createElement("div");
    this.phraseEl.className = "wp-phrase";
    this.phraseEl.textContent = "...";
    panel.appendChild(this.phraseEl);

    // Instruction
    const instruction = document.createElement("div");
    instruction.className = "wp-instruction";
    instruction.textContent = "WHISPER ONLY. DO NOT SPEAK ABOVE A WHISPER.";
    panel.appendChild(instruction);

    // Progress bar
    const progressOuter = document.createElement("div");
    progressOuter.className = "wp-progress";
    this.progressBar = document.createElement("div");
    this.progressBar.className = "wp-progress-bar";
    this.progressBar.style.width = "0%";
    progressOuter.appendChild(this.progressBar);
    panel.appendChild(progressOuter);

    // Attempt dots
    this.attemptsContainer = document.createElement("div");
    this.attemptsContainer.className = "wp-attempts";
    for (let i = 0; i < this.attemptsAllowed; i++) {
      const dot = document.createElement("span");
      dot.className = "wp-dot wp-dot-active";
      this.attemptsContainer.appendChild(dot);
    }
    panel.appendChild(this.attemptsContainer);

    // Hint
    const hint = document.createElement("div");
    hint.className = "wp-hint";
    hint.textContent = "ESC to leave. Speak too loud and you fail.";
    panel.appendChild(hint);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  private injectStyles(): void {
    if (document.querySelector("#wp-styles")) return;
    const style = document.createElement("style");
    style.id = "wp-styles";
    style.textContent = `
      .wp-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 8000;
        font-family: 'Courier New', monospace;
      }
      .wp-panel {
        background: #0d1410;
        border: 2px solid #2a4030;
        padding: 32px;
        width: 480px;
        max-width: 90vw;
        color: #8ab098;
        text-align: center;
        box-shadow: 0 0 40px rgba(0,0,0,0.8) inset;
      }
      .wp-title {
        font-size: 16px;
        letter-spacing: 4px;
        margin-bottom: 24px;
        text-shadow: 0 0 8px #2a4030;
      }
      .wp-mic {
        font-size: 64px;
        margin: 16px 0;
        filter: grayscale(1);
        transition: filter 200ms, transform 200ms;
      }
      .wp-mic[data-state="whispering"] {
        filter: grayscale(0) brightness(1.3) drop-shadow(0 0 12px #4a8060);
        transform: scale(1.1);
      }
      .wp-mic[data-state="too_loud"] {
        filter: drop-shadow(0 0 16px #c43030);
      }
      .wp-phrase {
        font-size: 24px;
        font-style: italic;
        margin: 16px 0;
        letter-spacing: 2px;
        color: #c4d4c0;
        text-shadow: 0 0 8px #2a4030;
      }
      .wp-instruction {
        font-size: 11px;
        letter-spacing: 2px;
        margin-bottom: 12px;
        opacity: 0.6;
      }
      .wp-progress {
        height: 6px;
        background: #1a2018;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .wp-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4a8060, #8ab098);
        transition: width 100ms linear;
      }
      .wp-attempts {
        display: flex; justify-content: center; gap: 8px;
        margin-bottom: 8px;
      }
      .wp-dot {
        width: 10px; height: 10px;
        border-radius: 50%;
        background: #1a2018;
        border: 1px solid #2a4030;
        display: inline-block;
      }
      .wp-dot.wp-dot-active {
        background: #4a8060;
      }
      .wp-hint {
        font-size: 11px;
        opacity: 0.4;
        letter-spacing: 1px;
      }
    `;
    document.head.appendChild(style);
  }
}
