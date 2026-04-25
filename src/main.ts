import { Application } from 'pixi.js';
import { loadGameAssets } from './assets';
import { Game } from './game';

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
})();
