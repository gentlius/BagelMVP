/**
 * HUD — POP!
 *
 * Implements: sprint-d-e-build.md §3 T-19 (HUD Overlay)
 * Design Doc: score-combo-system.md §3 §6, visual-juice-system.md AC.10
 *
 * Responsibility:
 *   - Score text (top-right, updated on score:updated)
 *   - Combo text (below score, hidden when combo < 1)
 *   - GAME OVER overlay + RETRY button (shown on game:over, fade-in 500ms)
 *
 * Mount: call attachHUD(uiContainer, app) once after GameLoop.init().
 * The function registers all EventBus listeners and returns the HUD instance.
 *
 * RETRY button emits input:retry → GameLoop listens and calls reset() (D-P2-04).
 *
 * Autonomous decisions (D-P3-UI-01 ~ D-P3-UI-04) appended to
 *   production/decisions/2026-05-31-build-decisions.md §Phase 3
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import { eventBus } from '../events/event-bus.js';
import type { ScoreUpdatedPayload, ComboMilestonePayload, ComboResetPayload } from '../events/event-bus.js';
import { UI } from '../conventions/ui-strings.js';

// ---------------------------------------------------------------------------
// Layout constants (D-P3-UI-01: ui-programmer autonomous decision)
// ---------------------------------------------------------------------------

/** Horizontal margin from right edge for Score/Combo text */
const HUD_MARGIN_RIGHT = 16;

/** Top margin for Score text */
const HUD_MARGIN_TOP = 20;

/** Vertical gap between Score and Combo text */
const HUD_COMBO_GAP = 32;

/** Score text font size */
const SCORE_FONT_SIZE = 24;

/** Combo text font size */
const COMBO_FONT_SIZE = 20;

/** Minimum combo count to display combo text (D-P3-UI-02) */
const COMBO_DISPLAY_THRESHOLD = 1;

/** RETRY button fade-in duration in seconds — AC.10 (visual-juice §3.1 priority 2) */
const RETRY_FADE_DURATION_S = 0.5;

/** RETRY button minimum tap target size in px (UX 48×48 minimum) */
const RETRY_MIN_TAP_SIZE = 48;

/** RETRY button width */
const RETRY_WIDTH = 160;

/** RETRY button height */
const RETRY_HEIGHT = 56;

/** RETRY button corner radius */
const RETRY_CORNER_RADIUS = 12;

// ---------------------------------------------------------------------------
// Color palette (art-bible §4 Color System — neon palette)
// D-P3-UI-03: #FFFFFF HUD text, neon accent #00F5FF for RETRY button
// ---------------------------------------------------------------------------
const COLOR_HUD_TEXT = 0xffffff;
const COLOR_COMBO_TEXT = 0xffd700; // HERO tier gold (art-bible §4.2)
const COLOR_RETRY_BG = 0x001a33;   // deep navy (art-bible §1.2 frosted sky dark)
const COLOR_RETRY_BORDER = 0x00f5ff; // neon cyan (art-bible neon palette)
const COLOR_GAMEOVER_TEXT = 0xffffff;

// ---------------------------------------------------------------------------
// HUD class
// ---------------------------------------------------------------------------

export class HUD {
  private readonly _container: Container;
  private readonly _app: Application;

  private _scoreText: Text;
  private _comboText: Text;
  private _gameOverOverlay: Container;
  private _retryButton: Container;
  private _retryAlpha: number = 0;
  private _retryFading: boolean = false;
  private _retryFadeElapsed: number = 0;

  constructor(uiContainer: Container, app: Application) {
    this._container = uiContainer;
    this._app = app;

    // ------------------------------------------------------------------
    // Score text — top-right aligned
    // ------------------------------------------------------------------
    this._scoreText = new Text({
      text: UI.score(0),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: SCORE_FONT_SIZE,
        fill: COLOR_HUD_TEXT,
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
          angle: Math.PI / 4,
          alpha: 0.6,
        },
      },
    });
    // D-P3-UI-05 (사용자 2026-05-31): 우상단 → 중앙 상단 이동
    this._scoreText.anchor.set(0.5, 0); // center-top anchor
    this._scoreText.x = this._app.screen.width / 2;
    this._scoreText.y = HUD_MARGIN_TOP;
    this._container.addChild(this._scoreText);

    // ------------------------------------------------------------------
    // Combo text — below score, hidden initially (D-P3-UI-02)
    // ------------------------------------------------------------------
    this._comboText = new Text({
      text: UI.combo(0),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: COMBO_FONT_SIZE,
        fill: COLOR_COMBO_TEXT,
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 3,
          distance: 1,
          angle: Math.PI / 4,
          alpha: 0.5,
        },
      },
    });
    this._comboText.anchor.set(0.5, 0); // D-P3-UI-05: center-top (Score 정렬)
    this._comboText.x = this._app.screen.width / 2;
    this._comboText.y = HUD_MARGIN_TOP + HUD_COMBO_GAP;
    this._comboText.alpha = 0; // hidden until combo >= COMBO_DISPLAY_THRESHOLD
    this._container.addChild(this._comboText);

    // ------------------------------------------------------------------
    // Game Over overlay (GAME OVER label + RETRY button)
    // Hidden until game:over — alpha 0
    // ------------------------------------------------------------------
    this._gameOverOverlay = new Container();
    this._gameOverOverlay.alpha = 0;
    this._gameOverOverlay.visible = false;

    // GAME OVER label (centered)
    const gameOverLabel = new Text({
      text: UI.gameOver,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 48,
        fill: COLOR_GAMEOVER_TEXT,
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 8,
          distance: 3,
          angle: Math.PI / 4,
          alpha: 0.8,
        },
      },
    });
    gameOverLabel.anchor.set(0.5, 0.5);
    gameOverLabel.x = this._app.screen.width / 2;
    gameOverLabel.y = this._app.screen.height * 0.35;
    this._gameOverOverlay.addChild(gameOverLabel);

    // RETRY button (neon-bordered rounded rect + label)
    this._retryButton = this._buildRetryButton();
    this._gameOverOverlay.addChild(this._retryButton);

    this._container.addChild(this._gameOverOverlay);

    // ------------------------------------------------------------------
    // Resize: keep score/combo anchored to top-right
    // ------------------------------------------------------------------
    this._app.renderer.on('resize', this._onResize.bind(this));

    // ------------------------------------------------------------------
    // EventBus subscriptions
    // ------------------------------------------------------------------
    eventBus.on('score:updated', this._onScoreUpdated.bind(this));
    eventBus.on('combo:milestone', this._onComboMilestone.bind(this));
    eventBus.on('combo:reset', this._onComboReset.bind(this));
    eventBus.on('game:over', this._onGameOver.bind(this));
    eventBus.on('game:start', this._onGameStart.bind(this));

    // Ticker for RETRY fade-in animation
    this._app.ticker.add(this._onTick.bind(this));
  }

  // ------------------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------------------

  private _onScoreUpdated(payload: ScoreUpdatedPayload): void {
    this._scoreText.text = UI.score(payload.totalScore);

    // Update combo display
    if (payload.combo >= COMBO_DISPLAY_THRESHOLD) {
      this._comboText.text = UI.combo(payload.combo);
      this._comboText.alpha = 1;
    } else {
      this._comboText.alpha = 0;
    }
  }

  private _onComboMilestone(payload: ComboMilestonePayload): void {
    // Keep combo text visible and up-to-date on milestone
    this._comboText.text = UI.combo(payload.combo);
    this._comboText.alpha = 1;
  }

  private _onComboReset(_payload: ComboResetPayload): void {
    // M0: combo:reset → hide combo text (no other visual — visual-juice §3.1 priority 8)
    this._comboText.alpha = 0;
  }

  private _onGameOver(_payload: Record<string, never>): void {
    // AC.10: RETRY activation is simultaneous with fade start (E6)
    this._gameOverOverlay.visible = true;
    this._gameOverOverlay.alpha = 0;
    this._retryAlpha = 0;
    this._retryFading = true;
    this._retryFadeElapsed = 0;
  }

  private _onGameStart(_payload: Record<string, never>): void {
    // Reset HUD state for new game
    this._scoreText.text = UI.score(0);
    this._comboText.alpha = 0;
    this._gameOverOverlay.visible = false;
    this._gameOverOverlay.alpha = 0;
    this._retryFading = false;
    this._retryAlpha = 0;
  }

  // ------------------------------------------------------------------------
  // Ticker: RETRY fade-in
  // D-P3-UI-04: Ticker lerp for fade — avoids setTimeout (forbidden pattern)
  // ------------------------------------------------------------------------

  private _onTick(ticker: { deltaMS: number }): void {
    if (!this._retryFading) return;

    const dt = ticker.deltaMS / 1000;
    this._retryFadeElapsed += dt;
    const progress = Math.min(this._retryFadeElapsed / RETRY_FADE_DURATION_S, 1);
    this._retryAlpha = progress;
    this._gameOverOverlay.alpha = progress;

    if (progress >= 1) {
      this._retryFading = false;
      this._gameOverOverlay.alpha = 1;
    }
  }

  // ------------------------------------------------------------------------
  // Build RETRY button (Pixi Graphics + Text)
  // ------------------------------------------------------------------------

  private _buildRetryButton(): Container {
    const cx = this._app.screen.width / 2;
    const cy = this._app.screen.height * 0.55;

    const btnContainer = new Container();

    // Ensure minimum tap target (UX 48×48)
    const w = Math.max(RETRY_WIDTH, RETRY_MIN_TAP_SIZE);
    const h = Math.max(RETRY_HEIGHT, RETRY_MIN_TAP_SIZE);

    // Neon-bordered background
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, RETRY_CORNER_RADIUS)
      .fill({ color: COLOR_RETRY_BG, alpha: 0.85 })
      .stroke({ color: COLOR_RETRY_BORDER, width: 2 });
    btnContainer.addChild(bg);

    // RETRY label
    const label = new Text({
      text: UI.retry,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fill: COLOR_RETRY_BORDER,
        fontWeight: 'bold',
        letterSpacing: 2,
      },
    });
    label.anchor.set(0.5, 0.5);
    btnContainer.addChild(label);

    btnContainer.x = cx;
    btnContainer.y = cy;

    // Pixi v8 federated events (mobile touch + mouse)
    btnContainer.eventMode = 'static';
    btnContainer.cursor = 'pointer';
    // Hit area larger than visual for easier tap (minimum 48px honoured by w/h above)
    btnContainer.hitArea = {
      contains: (px: number, py: number) =>
        px >= -w / 2 && px <= w / 2 && py >= -h / 2 && py <= h / 2,
    };

    btnContainer.on('pointertap', () => {
      eventBus.emit('input:retry', {});
    });

    return btnContainer;
  }

  // ------------------------------------------------------------------------
  // Resize handler
  // ------------------------------------------------------------------------

  private _onResize(): void {
    const w = this._app.screen.width;
    const h = this._app.screen.height;

    // D-P3-UI-05: center-top
    this._scoreText.x = w / 2;
    this._comboText.x = w / 2;

    // Re-center game-over overlay elements
    if (this._gameOverOverlay.children.length >= 2) {
      const label = this._gameOverOverlay.children[0] as Text;
      label.x = w / 2;
      label.y = h * 0.35;

      const btn = this._gameOverOverlay.children[1] as Container;
      btn.x = w / 2;
      btn.y = h * 0.55;
    }
  }

  /** Remove all EventBus listeners and Ticker — call on scene teardown */
  destroy(): void {
    eventBus.off('score:updated', this._onScoreUpdated.bind(this));
    eventBus.off('combo:milestone', this._onComboMilestone.bind(this));
    eventBus.off('combo:reset', this._onComboReset.bind(this));
    eventBus.off('game:over', this._onGameOver.bind(this));
    eventBus.off('game:start', this._onGameStart.bind(this));
    this._app.ticker.remove(this._onTick.bind(this));
    this._app.renderer.off('resize', this._onResize.bind(this));
    this._container.removeChild(this._scoreText);
    this._container.removeChild(this._comboText);
    this._container.removeChild(this._gameOverOverlay);
  }
}

// ---------------------------------------------------------------------------
// Public factory — called by main session from main.ts
// ---------------------------------------------------------------------------

/**
 * Attach HUD to the uiContainer (L4 layer).
 *
 * Call once after GameLoop.init():
 *   import { attachHUD } from './ui/hud.js';
 *   attachHUD(containers.uiContainer, app);
 *
 * @returns HUD instance (retain if you need to call destroy() later)
 */
export function attachHUD(uiContainer: Container, app: Application): HUD {
  return new HUD(uiContainer, app);
}
