import { Application } from 'pixi.js';
import { loadGameAssets } from './assets';
import { Game } from './game';
import { micAnalyser } from './mic';

(async () => {
  const app = new Application();

  await app.init({
    width: 1280,
    height: 720,
    background: 0x0a0a0a,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  let manifest;
  try {
    manifest = await loadGameAssets();
  } catch (e) {
    console.error('Failed to load game assets:', e);
    return;
  }

  const game = new Game(app, manifest);
  await game.start();

  // TEMP DIAGNOSTIC: expose game to window for console inspection.
  // Tree-shaken in production. Remove before final demo recording.
  if (import.meta.env.DEV) {
    (window as any).game = game;
    (window as any).mic = micAnalyser;

    (window as any).calibrate = () => {
      const phases = ["SILENCE (5s)", "WHISPER (5s)", "NORMAL VOICE (5s)", "SHOUT (3s)"];
      const phaseDurations = [5000, 5000, 5000, 3000];
      let phaseIdx = 0;
      let phaseStart = performance.now();
      let samples: number[] = [];
      const results: { phase: string; min: number; max: number; median: number }[] = [];
      console.log(`[calibrate] Starting. ${phases[0]}`);
      const id = setInterval(() => {
        const rms = micAnalyser.sample();
        samples.push(rms);
        const elapsed = performance.now() - phaseStart;
        if (elapsed >= phaseDurations[phaseIdx]) {
          const sorted = [...samples].sort((a, b) => a - b);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const median = sorted[Math.floor(sorted.length / 2)];
          results.push({ phase: phases[phaseIdx], min, max, median });
          console.log(
            `[calibrate] ${phases[phaseIdx]} done. ` +
            `min=${min.toFixed(6)} max=${max.toFixed(6)} median=${median.toFixed(6)} samples=${samples.length}`
          );
          samples = [];
          phaseIdx++;
          if (phaseIdx >= phases.length) {
            clearInterval(id);
            console.log("[calibrate] DONE. Results:");
            for (const r of results) {
              console.log(`  ${r.phase}: median=${r.median.toFixed(6)}`);
            }
            console.log("[calibrate] Use these median values to calibrate src/suspicion.ts");
            return;
          }
          console.log(`[calibrate] Next: ${phases[phaseIdx]}`);
          phaseStart = performance.now();
        }
      }, 50);
    };

    console.log("[diag] window.game and window.mic exposed. Calibration: window.calibrate()");
  }
})();
