import { Application } from 'pixi.js';
import { loadGameAssets } from './assets';
import { Game } from './game';

function startAmbientDrone(): { stop: () => Promise<void> } {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.value = 55;
    osc2.type = "sine";
    osc2.frequency.value = 82.4;
    gain.gain.value = 0.05;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    let stopped = false;
    return {
      stop: async () => {
        if (stopped) return;
        stopped = true;
        try {
          // Ramp gain to 0 to avoid audio click
          const now = ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.05);
          // Stop oscillators after ramp
          osc1.stop(now + 0.06);
          osc2.stop(now + 0.06);
          // Wait for stop, then disconnect and close
          await new Promise((r) => setTimeout(r, 100));
          gain.disconnect();
          await ctx.close();
        } catch (err) {
          console.warn("[ambient drone] cleanup warning:", err);
        }
      },
    };
  } catch {
    return { stop: async () => {} };
  }
}

function showTitleScreen(): Promise<void> {
  return new Promise((resolve) => {
    const titleEl = document.getElementById("title-screen");
    if (!titleEl) {
      resolve();
      return;
    }
    titleEl.classList.remove("hidden");

    const ambientCtrl = startAmbientDrone();

    const onClick = async () => {
      titleEl.removeEventListener("click", onClick);
      titleEl.classList.add("hidden");
      // Fully stop drone and close its AudioContext before proceeding
      await ambientCtrl.stop();
      resolve();
    };

    titleEl.addEventListener("click", onClick);
  });
}

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

  // Show title screen first (blocks until user clicks)
  await showTitleScreen();

  let manifest;
  try {
    manifest = await loadGameAssets();
  } catch (e) {
    console.error('Failed to load game assets:', e);
    return;
  }

  const game = new Game(app, manifest);
  await game.start();
})();
