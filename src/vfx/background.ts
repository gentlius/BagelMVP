/**
 * background.ts — Frosted Sky gradient background
 *
 * Reproduces the canonical 3-stop linear gradient from sample HTML L46–56:
 *   180deg  #B5D8E8 0%  (Sky Blue)
 *           #F5C2D4 50% (Soft Pink)
 *           #C4B0E0 100%(Lavender)
 *
 * Implementation: Pixi v8 FillGradient (LinearGradient) — verified present in
 * pixi.js 8.18.1 as a named export. Graphics.rect().fill(gradient) is then
 * baked into a Texture via renderer.generateTexture() and wrapped in a Sprite.
 * This avoids per-frame draw-call overhead; the Sprite is placed in bgContainer
 * at z=0 and scaled to cover the full canvas.
 *
 * Authority: owned exclusively by technical-artist.
 * Caller: main.ts bootstrap — see [main session 안내] in task instructions.
 */

import { Application, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js';

// Frosted Sky colours — sample HTML L52–55 exact hex
const SKY_TOP    = 0xB5D8E8; // 스카이 블루
const SKY_MID    = 0xF5C2D4; // 소프트 핑크
const SKY_BOTTOM = 0xC4B0E0; // 라벤더

// D-P6-FOG-01: Frost overlay — soft white cloud ellipses scattered over gradient.
// art-bible §1.2 "Frosted Sky" 의미 확장 (사용자 의도): 단순 gradient + frost cloud 흩뿌림.
const FROST_CLOUD_COUNT = 8;
const FROST_ALPHA = 0.18;

let _skyTexCache: Texture | null = null;

/**
 * Creates the Frosted Sky background Sprite.
 *
 * The sprite covers the full app canvas (app.screen.width × app.screen.height).
 * Place it as the first child of bgContainer (z=0) after app.init().
 *
 * @example
 * ```ts
 * import { createFrostedSkyBackground } from './vfx/background.js';
 * const sky = createFrostedSkyBackground(app);
 * bgContainer.addChildAt(sky, 0);
 * ```
 *
 * The texture is cached. If the canvas resizes (orientation change) call
 * destroyFrostedSkyBackground() then recreate.
 */
export function createFrostedSkyBackground(app: Application): Container {
  const w = app.screen.width;
  const h = app.screen.height;

  if (!_skyTexCache) {
    // Pixi v8 FillGradient: LinearGradient from (x0,y0) to (x1,y1) in local coords
    // 180deg = top → bottom = (0,0) → (0,h)
    const gradient = new FillGradient(0, 0, 0, h);
    gradient.addColorStop(0.0, SKY_TOP);
    gradient.addColorStop(0.5, SKY_MID);
    gradient.addColorStop(1.0, SKY_BOTTOM);

    const g = new Graphics();
    g.rect(0, 0, w, h).fill({ fill: gradient });

    // D-P6-FOG-01: frost cloud overlay (white ellipses, low alpha, varied size/pos)
    // 절차적 seed-free random — 첫 빌드 캐싱 후 고정. 매번 같은 cloud layout.
    let rngSeed = 12345;
    const nextRng = () => { rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff; return rngSeed / 0x7fffffff; };
    for (let i = 0; i < FROST_CLOUD_COUNT; i++) {
      const cx = nextRng() * w;
      const cy = nextRng() * h;
      const rx = 80 + nextRng() * 200; // 80–280 px
      const ry = 40 + nextRng() * 80;  // 40–120 px
      g.ellipse(cx, cy, rx, ry).fill({ color: 0xffffff, alpha: FROST_ALPHA });
    }

    _skyTexCache = app.renderer.generateTexture({
      target: g,
      resolution: window.devicePixelRatio || 1,
    });
    g.destroy();
  }

  // Wrap sprite in Container to keep API flexibility (future fog drift animation)
  const container = new Container();
  const sprite = new Sprite(_skyTexCache);
  sprite.width = w;
  sprite.height = h;
  sprite.x = 0;
  sprite.y = 0;
  container.addChild(sprite);
  return container;
}

/**
 * Destroys the cached sky texture. Call if the canvas resizes and you need to
 * regenerate at the new dimensions.
 */
export function destroyFrostedSkyBackground(): void {
  _skyTexCache?.destroy();
  _skyTexCache = null;
}
