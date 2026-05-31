/**
 * ScorePopupPool — POP! VFX
 *
 * Pool of 20 Pixi Text objects for score delta popups.
 * Float up 50px over 0.8s with alpha fade. FIFO eviction.
 * visual-juice-system.md §3.5 + §4.4
 *
 * Design: technical-artist
 * Note: M1 retrofit — migrate to BitmapText for atlas perf (visual-juice §3.5).
 */

import { Text, TextStyle } from 'pixi.js';
import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tuning knobs — visual-juice §7
// ---------------------------------------------------------------------------

export const SCORE_POPUP_FLOAT_SPEED = 50;  // px/s upward
export const SCORE_POPUP_LIFETIME    = 0.8; // s
export const SCORE_POPUP_POOL_SIZE   = 20;

// ---------------------------------------------------------------------------
// PopupText state
// ---------------------------------------------------------------------------

export interface PopupText extends Text {
  lifetime: number;
}

// ---------------------------------------------------------------------------
// ScorePopupPool
// ---------------------------------------------------------------------------

const POPUP_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 22,
  fontWeight: 'bold',
  fill: 0xffffff,
  dropShadow: {
    color: 0x000000,
    blur: 3,
    distance: 2,
    alpha: 0.6,
    angle: Math.PI / 4,
  },
  stroke: { color: 0x333333, width: 3 },
  align: 'center',
});

/**
 * Pool of score popup text objects.
 * FIFO eviction at SCORE_POPUP_POOL_SIZE (20) (§E4).
 */
export class ScorePopupPool {
  private readonly _pool: PopupText[] = [];
  private readonly _active: PopupText[] = [];
  private readonly _container: Container;

  constructor(uiContainer: Container) {
    this._container = uiContainer;

    for (let i = 0; i < SCORE_POPUP_POOL_SIZE; i++) {
      const t = this._makeText();
      this._pool.push(t);
      this._container.addChild(t);
      t.visible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Spawn
  // ---------------------------------------------------------------------------

  /**
   * Spawn a score popup at (x, y).
   * Text: "+{Math.floor(delta)}" — integer display, no decimal (visual-juice §3.5).
   */
  spawn(x: number, y: number, delta: number): void {
    let popup: PopupText;

    // FIFO eviction if pool exhausted (§E4)
    if (this._pool.length === 0) {
      const old = this._active.shift();
      if (!old) return;
      this.release(old);
    }

    popup = this._pool.pop()!;
    popup.text = `+${Math.floor(delta)}`;
    popup.position.set(x, y - 20); // §3.5: spawn 20px above hit point
    popup.alpha = 1.0;
    popup.lifetime = SCORE_POPUP_LIFETIME;
    popup.visible = true;
    this._active.push(popup);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this._active.splice(i, 1);
        this.release(p);
        continue;
      }
      p.y -= SCORE_POPUP_FLOAT_SPEED * dt;
      p.alpha = p.lifetime / SCORE_POPUP_LIFETIME;
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  reset(): void {
    for (const p of this._active) this.release(p);
    this._active.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get activeCount(): number { return this._active.length; }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private release(t: PopupText): void {
    t.visible = false;
    t.lifetime = 0;
    this._pool.push(t);
  }

  private _makeText(): PopupText {
    const t = new Text({ text: '', style: POPUP_STYLE }) as PopupText;
    t.anchor.set(0.5, 1);
    t.lifetime = 0;
    return t;
  }
}
