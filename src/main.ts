import { Application } from 'pixi.js';
import { Howler } from 'howler';
import { loadGameAssets } from './assets';
import { Game } from './game';

// Procedural title drone (sawtooth 55Hz + sine 82.4Hz).
// Starts after the user's first click (satisfies autoplay policy).
// https://developer.chrome.com/blog/autoplay
let titleDroneNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;

function startTitleDrone(): void {
  const ctx = Howler.ctx;
  if (!ctx) return;

  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  gain.connect(ctx.destination);

  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.value = 55;
  const sawGain = ctx.createGain();
  sawGain.gain.value = 0.08;
  saw.connect(sawGain);
  sawGain.connect(gain);
  saw.start();

  const sine = ctx.createOscillator();
  sine.type = "sine";
  sine.frequency.value = 82.4;
  const sineGain = ctx.createGain();
  sineGain.gain.value = 0.06;
  sine.connect(sineGain);
  sineGain.connect(gain);
  sine.start();

  titleDroneNodes = { oscs: [saw, sine], gain };
}

function stopTitleDrone(): void {
  if (!titleDroneNodes) return;
  for (const osc of titleDroneNodes.oscs) {
    osc.stop();
    osc.disconnect();
  }
  titleDroneNodes.gain.disconnect();
  titleDroneNodes = null;
}

function showTitleScreen(): Promise<void> {
  return new Promise((resolve) => {
    const titleEl = document.getElementById("title-screen");
    if (!titleEl) {
      resolve();
      return;
    }
    titleEl.classList.remove("hidden");

    const onClick = async () => {
      titleEl.removeEventListener("click", onClick);

      // Resume AudioContext per browser autoplay policy
      if (Howler.ctx && Howler.ctx.state !== "running") {
        try { await Howler.ctx.resume(); } catch { /* user disabled audio */ }
      }

      // Start procedural drone after user gesture
      startTitleDrone();

      titleEl.classList.add("hidden");
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
    stopTitleDrone();
    return;
  }

  // Stop title drone before game audio takes over
  stopTitleDrone();

  const game = new Game(app, manifest);
  await game.start();
})();
