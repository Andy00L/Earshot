import { Howler } from "howler";
import { audioManager } from "./audio";
import { TapeSegmentId } from "./audio-catalog";
import { TapeId } from "./types";

export type TapePuzzleResult = "success" | "fail_wrong_order" | "cancelled";

export interface TapePuzzleConfig {
  tapeId: TapeId;
  onResult: (result: TapePuzzleResult, tapeId: TapeId) => void;
  onFragmentPlay?: () => void;
}

// Segment IDs per tape (correct narrative order)
const TAPE_SEGMENTS: Record<TapeId, TapeSegmentId[]> = {
  broken_tape_01: ["tape_01_seg_1", "tape_01_seg_2", "tape_01_seg_3", "tape_01_seg_4"],
  broken_tape_02: ["tape_02_seg_1", "tape_02_seg_2", "tape_02_seg_3", "tape_02_seg_4"],
  broken_tape_03: ["tape_03_seg_1", "tape_03_seg_2", "tape_03_seg_3", "tape_03_seg_4"],
};

// Volume per canonical position (loud = first in narrative)
const POSITION_VOLUMES: number[] = [1.0, 0.7, 0.45, 0.25];

// Display labels per segment (shown on buttons)
const SEGMENT_LABELS: Record<TapeId, string[]> = {
  broken_tape_01: ["we saw the lights", "then the listening began", "and we forgot", "our names"],
  broken_tape_02: ["your voice is not yours", "it belongs to the walls", "they whisper back", "when you speak"],
  broken_tape_03: ["the door at the top", "opens for those who listen", "the others stay below", "forever"],
};

export class TapePuzzle {
  private config: TapePuzzleConfig;
  private open_ = false;

  private overlay: HTMLDivElement | null = null;
  private submitBtn: HTMLButtonElement | null = null;
  private playFullBtn: HTMLButtonElement | null = null;

  // Puzzle state
  private fragmentOrder: number[] = []; // shuffled indices (0-3)
  private selectedFragment: number | null = null; // index into fragmentOrder
  private slots: (number | null)[] = [null, null, null, null]; // each slot holds original segment index or null

  // Web Audio buffers
  private segmentBuffers: (AudioBuffer | null)[] = [null, null, null, null];
  private currentSource: AudioBufferSourceNode | null = null;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: TapePuzzleConfig) {
    this.config = config;
    this.injectStyles();
  }

  isOpen(): boolean {
    return this.open_;
  }

  async open(): Promise<void> {
    if (this.open_) return;
    this.open_ = true;
    this.selectedFragment = null;
    this.slots = [null, null, null, null];

    // Shuffle fragment display order
    this.fragmentOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    // Load audio buffers
    await this.loadSegments();
    if (!this.open_) return; // closed during load

    this.buildOverlay();
    this.updateUI();

    this.keyHandler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener("keydown", this.keyHandler);
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;

    this.stopCurrentSound();

    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.submitBtn = null;
    this.playFullBtn = null;
    this.segmentBuffers = [null, null, null, null];
  }

  // ── Audio ──

  private async loadSegments(): Promise<void> {
    const ctx = (Howler as unknown as { ctx: AudioContext }).ctx;
    const segIds = TAPE_SEGMENTS[this.config.tapeId];

    const results = await Promise.all(
      segIds.map(async (id) => {
        try {
          const resp = await fetch(`/audio/${id}.mp3`);
          if (!resp.ok) return null;
          const ab = await resp.arrayBuffer();
          return await ctx.decodeAudioData(ab);
        } catch {
          console.warn(`[tape-puzzle] Failed to load segment ${id}`);
          return null;
        }
      }),
    );

    this.segmentBuffers = results;
  }

  private playSegment(originalIndex: number): void {
    this.stopCurrentSound();
    const buffer = this.segmentBuffers[originalIndex];
    if (!buffer) {
      // Fallback to Howler if buffer load failed
      const segId = TAPE_SEGMENTS[this.config.tapeId][originalIndex];
      audioManager.playOneShot(segId, POSITION_VOLUMES[originalIndex]);
      this.config.onFragmentPlay?.();
      return;
    }

    const ctx = (Howler as unknown as { ctx: AudioContext }).ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = POSITION_VOLUMES[originalIndex];
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    this.currentSource = source;
    source.onended = () => {
      if (this.currentSource === source) this.currentSource = null;
    };
    this.config.onFragmentPlay?.();
  }

  private async playFullSequence(): Promise<void> {
    this.stopCurrentSound();

    const ctx = (Howler as unknown as { ctx: AudioContext }).ctx;
    const orderedBuffers: AudioBuffer[] = [];

    for (const slotVal of this.slots) {
      if (slotVal === null) return; // all slots must be filled
      const buf = this.segmentBuffers[slotVal];
      if (!buf) return;
      orderedBuffers.push(buf);
    }

    let cursor = ctx.currentTime + 0.05;
    orderedBuffers.forEach((buffer, slotIndex) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = POSITION_VOLUMES[slotIndex];
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(cursor);
      cursor += buffer.duration;
    });

    this.config.onFragmentPlay?.();
  }

  private stopCurrentSound(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch { /* already stopped */ }
      this.currentSource = null;
    }
  }

  // ── Interaction ──

  private selectFragment(displayIndex: number): void {
    const originalIndex = this.fragmentOrder[displayIndex];

    // If already placed in a slot, ignore
    if (this.slots.includes(originalIndex)) return;

    this.selectedFragment = originalIndex;
    this.playSegment(originalIndex);
    this.updateUI();
  }

  private placeInSlot(slotIndex: number): void {
    if (this.selectedFragment === null) return;

    // If slot already has something, return it to pool
    if (this.slots[slotIndex] !== null) {
      // The displaced fragment goes back to the pool (no action needed, just clear)
    }

    // Remove selected fragment from any other slot
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] === this.selectedFragment) {
        this.slots[i] = null;
      }
    }

    this.slots[slotIndex] = this.selectedFragment;
    this.selectedFragment = null;
    this.updateUI();
  }

  private submit(): void {
    // Check if all slots filled
    if (this.slots.some((s) => s === null)) return;

    // Correct order is 0, 1, 2, 3
    const isCorrect =
      this.slots[0] === 0 &&
      this.slots[1] === 1 &&
      this.slots[2] === 2 &&
      this.slots[3] === 3;

    if (isCorrect) {
      this.close();
      this.config.onResult("success", this.config.tapeId);
    } else {
      this.config.onResult("fail_wrong_order", this.config.tapeId);
      // Reshuffle and reset slots for retry
      this.fragmentOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      this.slots = [null, null, null, null];
      this.selectedFragment = null;
      this.updateUI();
    }
  }

  // ── Keyboard ──

  private handleKey(e: KeyboardEvent): void {
    if (!this.open_) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      this.config.onResult("cancelled", this.config.tapeId);
      return;
    }

    // 1-4 select fragments
    const fragKeys: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
    if (e.key in fragKeys) {
      e.preventDefault();
      this.selectFragment(fragKeys[e.key]);
      return;
    }

    // A-D place in slots
    const slotKeys: Record<string, number> = { "a": 0, "b": 1, "c": 2, "d": 3 };
    if (e.key.toLowerCase() in slotKeys) {
      e.preventDefault();
      this.placeInSlot(slotKeys[e.key.toLowerCase()]);
      return;
    }

    // Enter submits
    if (e.key === "Enter") {
      e.preventDefault();
      this.submit();
      return;
    }

    // Space plays full sequence
    if (e.key === " ") {
      e.preventDefault();
      this.playFullSequence();
    }
  }

  // ── UI ──

  private updateUI(): void {
    if (!this.overlay) return;

    const labels = SEGMENT_LABELS[this.config.tapeId];

    // Update fragment buttons
    const fragBtns = this.overlay.querySelectorAll<HTMLButtonElement>(".tp-frag");
    fragBtns.forEach((btn) => {
      const di = parseInt(btn.dataset.displayIndex ?? "0", 10);
      const origIdx = this.fragmentOrder[di];
      const isPlaced = this.slots.includes(origIdx);
      const isSelected = this.selectedFragment === origIdx;

      btn.classList.toggle("tp-selected", isSelected);
      btn.classList.toggle("tp-placed", isPlaced);
      btn.disabled = isPlaced;
      btn.textContent = `\u25B6 ${di + 1}. ${labels[origIdx]}`;
    });

    // Update slot display
    const slotEls = this.overlay.querySelectorAll<HTMLElement>(".tp-slot");
    slotEls.forEach((el) => {
      const si = parseInt(el.dataset.slotIndex ?? "0", 10);
      const slotLabel = ["A", "B", "C", "D"][si];
      const origIdx = this.slots[si];
      if (origIdx !== null) {
        el.textContent = `${slotLabel}. ${labels[origIdx]}`;
        el.classList.add("tp-filled");
      } else {
        el.textContent = `${slotLabel}. ___`;
        el.classList.remove("tp-filled");
      }
    });

    // Submit enabled only when all slots filled
    if (this.submitBtn) {
      this.submitBtn.disabled = this.slots.some((s) => s === null);
    }
  }

  private buildOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "tp-overlay";

    const panel = document.createElement("div");
    panel.className = "tp-panel";

    // Title
    const title = document.createElement("div");
    title.className = "tp-title";
    title.textContent = "ARRANGE BY VOLUME. LOUD FIRST.";
    panel.appendChild(title);

    // Fragment buttons
    const fragContainer = document.createElement("div");
    fragContainer.className = "tp-frags";
    for (let di = 0; di < 4; di++) {
      const btn = document.createElement("button");
      btn.className = "tp-frag";
      btn.dataset.displayIndex = String(di);
      btn.addEventListener("click", () => this.selectFragment(di));
      fragContainer.appendChild(btn);
    }
    panel.appendChild(fragContainer);

    // Slots
    const slotContainer = document.createElement("div");
    slotContainer.className = "tp-slots";
    for (let si = 0; si < 4; si++) {
      const slot = document.createElement("div");
      slot.className = "tp-slot";
      slot.dataset.slotIndex = String(si);
      slot.addEventListener("click", () => this.placeInSlot(si));
      slotContainer.appendChild(slot);
    }
    panel.appendChild(slotContainer);

    // Play Full button
    this.playFullBtn = document.createElement("button");
    this.playFullBtn.className = "tp-btn tp-play-full";
    this.playFullBtn.textContent = "\u25B6 PLAY FULL";
    this.playFullBtn.addEventListener("click", () => this.playFullSequence());
    panel.appendChild(this.playFullBtn);

    // Submit button
    this.submitBtn = document.createElement("button");
    this.submitBtn.className = "tp-btn tp-submit";
    this.submitBtn.textContent = "SUBMIT ORDER";
    this.submitBtn.disabled = true;
    this.submitBtn.addEventListener("click", () => this.submit());
    panel.appendChild(this.submitBtn);

    // Hint
    const hint = document.createElement("div");
    hint.className = "tp-hint";
    hint.textContent = "1-4 listen. A-D place. Loud=first. ENTER submit. ESC leave.";
    panel.appendChild(hint);

    // Back button (same as ESC)
    const backBtn = document.createElement("button");
    backBtn.className = "tp-back";
    backBtn.setAttribute("aria-label", "Leave puzzle");
    backBtn.innerHTML = '<img src="/ui/back-button.png" alt="Back" />';
    backBtn.addEventListener("click", () => {
      this.close();
      this.config.onResult("cancelled", this.config.tapeId);
    });
    panel.appendChild(backBtn);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  private injectStyles(): void {
    if (document.querySelector("#tp-styles")) return;
    const style = document.createElement("style");
    style.id = "tp-styles";
    style.textContent = `
      .tp-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 8000;
        font-family: 'Courier New', monospace;
      }
      .tp-panel {
        position: relative;
        background: #1c1410;
        border: 2px solid #6a4828;
        padding: 28px;
        width: 540px;
        max-width: 90vw;
        color: #d4a878;
        text-align: center;
        box-shadow: 0 0 40px rgba(0,0,0,0.8) inset;
      }
      .tp-title {
        font-size: 16px;
        letter-spacing: 4px;
        margin-bottom: 20px;
        text-shadow: 0 0 8px #6a4828;
      }
      .tp-frags {
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        margin-bottom: 18px;
      }
      .tp-frag {
        background: #2a1810;
        border: 2px solid #6a4828;
        color: #d4a878;
        padding: 10px 12px;
        font-family: inherit;
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        letter-spacing: 1px;
        transition: transform 0.1s ease;
      }
      .tp-frag:hover { background: #3a2418; }
      .tp-frag:active { transform: scale(1.03); }
      .tp-frag.tp-selected {
        background: #6a4828;
        color: #fff;
        box-shadow: 0 0 14px #d4a878 inset;
      }
      .tp-frag.tp-placed {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .tp-slots {
        display: flex; flex-direction: column; gap: 6px;
        margin-bottom: 18px;
        background: #0d0805;
        padding: 12px;
        border: 1px dashed #6a4828;
      }
      .tp-slot {
        text-align: left;
        padding: 8px 12px;
        background: #2a1810;
        border: 1px solid #6a4828;
        cursor: pointer;
        font-size: 13px;
        letter-spacing: 1px;
      }
      .tp-slot:hover { background: #3a2018; }
      .tp-slot.tp-filled { background: #4a2818; }
      .tp-btn {
        background: #2a1810;
        border: 2px solid #6a4828;
        color: #d4a878;
        padding: 12px 20px;
        font-family: inherit;
        font-size: 14px;
        cursor: pointer;
        letter-spacing: 2px;
        margin-bottom: 8px;
        width: 100%;
      }
      .tp-btn:hover { background: #3a2418; }
      .tp-submit:disabled {
        opacity: 0.4; cursor: not-allowed;
      }
      .tp-hint {
        font-size: 11px;
        opacity: 0.5;
        letter-spacing: 1px;
      }
      .tp-back {
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
      .tp-back img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .tp-back:hover img {
        filter: brightness(1.2);
      }
    `;
    document.head.appendChild(style);
  }
}
