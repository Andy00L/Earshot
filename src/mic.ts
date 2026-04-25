import { Howler } from "howler";

export type MicState = "idle" | "requesting" | "active" | "denied" | "no_device" | "error";

export class MicAnalyser {
  public state: MicState = "idle";
  public smoothedRms: number = 0;
  public lastErrorMessage: string = "";

  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private pcmBuffer: Float32Array<ArrayBuffer> | null = null;

  private readonly SMOOTHING = 0.2;

  /**
   * Request microphone permission. Must be called from a user gesture
   * (click handler) per browser autoplay policy.
   */
  async start(): Promise<void> {
    if (this.state === "active" || this.state === "requesting") return;
    this.state = "requesting";

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        this.state = "denied";
        this.lastErrorMessage = "Microphone permission denied. Suspicion will stay at 0.";
      } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
        this.state = "no_device";
        this.lastErrorMessage = "No microphone found. Demo mode active.";
      } else {
        this.state = "error";
        this.lastErrorMessage = `Mic error: ${err.message}`;
      }
      console.warn(this.lastErrorMessage);
      return;
    }

    // Use the same AudioContext as Howler
    const ctx = Howler.ctx as AudioContext;
    if (ctx.state === "suspended") await ctx.resume();

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    this.source = ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    // Do NOT connect analyser to ctx.destination (no mic playback)

    this.pcmBuffer = new Float32Array(this.analyser.fftSize);
    this.state = "active";

    // Detect mic disconnect
    for (const track of this.stream.getTracks()) {
      track.onended = () => {
        this.state = "no_device";
        this.lastErrorMessage = "Microphone disconnected.";
        this.smoothedRms = 0;
        console.warn(this.lastErrorMessage);
      };
    }
  }

  /**
   * Sample the current mic RMS. Call once per frame from Game.tick.
   */
  sample(): number {
    if (this.state !== "active" || !this.analyser || !this.pcmBuffer) {
      this.smoothedRms = 0;
      return 0;
    }
    this.analyser.getFloatTimeDomainData(this.pcmBuffer);
    let sumSquares = 0;
    for (let i = 0; i < this.pcmBuffer.length; i++) {
      const s = this.pcmBuffer[i];
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / this.pcmBuffer.length);
    this.smoothedRms = this.SMOOTHING * rms + (1 - this.SMOOTHING) * this.smoothedRms;
    return this.smoothedRms;
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.pcmBuffer = null;
    this.state = "idle";
  }
}

export const micAnalyser = new MicAnalyser();
