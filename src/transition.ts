import { Container, Graphics, Ticker } from "pixi.js";

/**
 * Fade out to black, run `between` callback at peak black, then fade back in.
 * Uses ticker.deltaMS for wall-clock duration regardless of frame rate.
 */
export async function fadeTransition(
  stage: Container,
  ticker: Ticker,
  between: () => void | Promise<void>,
  durationMS: number = 600,
): Promise<void> {
  const overlay = new Graphics();
  overlay.rect(0, 0, 4000, 2000);
  overlay.fill({ color: 0x000000 });
  overlay.alpha = 0;
  overlay.zIndex = 10000;
  stage.sortableChildren = true;
  stage.addChild(overlay);

  await tweenValue(ticker, durationMS / 2, (t) => {
    overlay.alpha = t;
  });
  await Promise.resolve(between());
  await tweenValue(ticker, durationMS / 2, (t) => {
    overlay.alpha = 1 - t;
  });

  stage.removeChild(overlay);
  overlay.destroy();
}

function tweenValue(
  ticker: Ticker,
  durationMS: number,
  onUpdate: (t: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const handler = (tk: Ticker) => {
      elapsed += tk.deltaMS;
      const t = Math.min(elapsed / durationMS, 1);
      onUpdate(t);
      if (t >= 1) {
        ticker.remove(handler);
        resolve();
      }
    };
    ticker.add(handler);
  });
}
