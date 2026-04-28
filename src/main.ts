import { Application } from 'pixi.js';
import { Howler } from 'howler';
import { loadGameAssets } from './assets';
import { Game, markAudioInitialized } from './game';
import { audioManager } from './audio';
import { micAnalyser } from './mic';

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

// Loading screen progress updater
function updateLoadingScreen(atlasProgress: number, audioProgress: number): void {
  const combined = (atlasProgress + audioProgress) / 2;
  const pct = Math.round(combined * 100);
  const fill = document.getElementById('loading-bar-fill');
  const percentEl = document.getElementById('loading-percent');
  if (fill) fill.style.width = pct + '%';
  if (percentEl) percentEl.textContent = pct + '%';
}

function fadeOutLoadingScreen(): Promise<void> {
  return new Promise((resolve) => {
    const el = document.getElementById('loading-screen');
    if (!el) {
      resolve();
      return;
    }
    el.classList.add('fading-out');
    setTimeout(() => {
      el.remove();
      resolve();
    }, 500);
  });
}

function showLoadingError(): void {
  const errorEl = document.getElementById('loading-error');
  if (errorEl) errorEl.style.display = 'block';
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

  // Track progress from both loaders (only increases, never backwards)
  let atlasProgressMax = 0;
  let audioProgressMax = 0;

  const loadStartTime = performance.now();
  let loadFailed = false;

  // Timeout: if loading takes more than 30 seconds, show error
  const loadTimeout = setTimeout(() => {
    if (atlasProgressMax < 1 || audioProgressMax < 1) {
      loadFailed = true;
      showLoadingError();
    }
  }, 30000);

  // Load atlas textures and audio in parallel
  let manifest;
  try {
    const results = await Promise.all([
      loadGameAssets((p: number) => {
        atlasProgressMax = Math.max(atlasProgressMax, p);
        updateLoadingScreen(atlasProgressMax, audioProgressMax);
      }),
      audioManager.loadAll((loaded: number, total: number) => {
        audioProgressMax = Math.max(audioProgressMax, total > 0 ? loaded / total : 1);
        updateLoadingScreen(atlasProgressMax, audioProgressMax);
      }),
    ]);
    manifest = results[0];
  } catch (e) {
    console.error('Failed to load game assets:', e);
    showLoadingError();
    clearTimeout(loadTimeout);
    return;
  }

  clearTimeout(loadTimeout);
  if (loadFailed) return;

  // Mark audio as loaded so Game.start() skips its own initAudio
  markAudioInitialized();

  // Ensure loading screen is visible for at least 600ms (avoids flash on fast loads)
  const elapsed = performance.now() - loadStartTime;
  if (elapsed < 600) {
    await new Promise<void>((r) => setTimeout(r, 600 - elapsed));
  }

  // Set bar to 100% before fade
  updateLoadingScreen(1, 1);

  await fadeOutLoadingScreen();

  // Title screen blocks until user clicks
  await showTitleScreen();

  // Stop title drone before game audio takes over
  stopTitleDrone();

  // Request microphone (requires user gesture from title click)
  await micAnalyser.start();

  const game = new Game(app, manifest);
  await game.start();
})();
