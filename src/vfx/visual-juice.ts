/**
 * VisualJuiceSystem — POP! VFX
 *
 * Cross-cutting visual feedback layer. Implements all 5 VFX responsibilities:
 *   (a) Pop particle burst  — balloon:popped
 *   (b) Critical darkening  — criticalPop:fired (bgContainer ColorMatrixFilter)
 *   (c) 5-combo glow ring   — combo:milestone (tier=5)
 *   (d) Score popup float   — score:updated
 *   (e) GlowFilter          — character + active ring (Neon Glassblowing aesthetic)
 *
 * Design doc: design/gdd/visual-juice-system.md (§3.2–3.5, §4, §7, §8)
 * Art bible:  design/art/art-bible.md §1.2 + §2.1 S3 + §4.2
 *
 * P2 listener order lock (visual-juice §3.7):
 *   attachListeners() MUST be called BEFORE ScoreComboSystem.attachListeners().
 *   See GameLoop.init() for the correct invocation order.
 *
 * Authority boundaries (visual-juice §6 + §3.7):
 *   - Own:          vfxContainer, uiContainer (score popups)
 *   - Exception 1:  bgContainer.filters (Critical darkening) — per §2.1 S3
 *   - Exception 2:  bgContainer + balloonContainer + harpoonContainer alpha (game:over fade)
 *   - Forbidden:    everything else — read via events only
 *
 * Phase 3 Decision (D-P3-VJ-01): GlowFilter applied only to character sprite +
 *   active combo ring (≤2 objects). NOT applied per-balloon to keep draw calls
 *   within budget (GATE-04, R-SD-04 mitigation).
 *
 * Phase 3 Decision (D-P3-VJ-02): White flash overlay is a pooled Sprite (Graphics
 *   generateTexture once) sized to screen, alpha-animated via Ticker. Avoids
 *   per-frame Graphics redraw.
 *
 * Phase 3 Decision (D-P3-VJ-03): Ring texture generated once via Graphics
 *   → renderer.generateTexture(). Sprite + tint + scale animation avoids 60fps
 *   Graphics redraw (visual-juice §3.4 design intent).
 *
 * Phase 3 Decision (D-P3-VJ-04): characterPosition getter fallback is
 *   window.innerWidth/2, window.innerHeight - 100 when BalloonPhysicsSplitSystem
 *   does not yet expose getCharacterPosition(). See main session handoff below.
 */

import {
  Sprite,
  Graphics,
  ColorMatrixFilter,
  Texture,
} from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import type { Container, Application, Renderer } from 'pixi.js';
import type { EventBus } from '../events/event-bus.js';
import type { BalloonSize } from '../events/event-bus.js';
import { ParticlePool, POP_PARTICLE_COUNT } from './particle-pool.js';
import { ScorePopupPool } from './score-popup-pool.js';

// ---------------------------------------------------------------------------
// Tuning knobs — visual-juice §7
// ---------------------------------------------------------------------------

/** Critical darkening ramp duration in/out (s) */
const DARKEN_RAMP_SEC    = 0.05;
/** Brightness target during Critical darkening (1.0 = normal) */
const DARKEN_BRIGHTNESS  = 0.3;
/** White flash peak alpha */
const WHITE_FLASH_ALPHA  = 0.6;
/** White flash duration (s) */
const WHITE_FLASH_DUR    = 0.05;

/** 5-combo ring start radius multiplier vs character width */
const RING_RADIUS_START_MUL = 1.5;
/** 5-combo ring end radius multiplier */
const RING_RADIUS_END_MUL   = 2.5;
/** Ring start alpha */
const RING_ALPHA_START  = 0.85;
/** Ring lifetime (s) */
const RING_LIFETIME     = 0.5;
/** Ring texture internal radius (px) — generated texture base size */
const RING_TEX_RADIUS   = 64;
/** Ring stroke width (px) */
const RING_STROKE_WIDTH = 4;
/** HERO tier gold — art-bible §4.2 */
const RING_COLOR        = 0xFFD700;

/** Combo milestone tier that triggers visual ring (M0: tier 5 only) */
const MILESTONE_COMBO   = 5;

/** game:over layer alpha fade duration (s) — §E6 */
const GAMEOVER_FADE_SEC = 0.5;

/** Character reference width for ring radius calc (fallback if getter unavailable) */
const CHARACTER_WIDTH_FALLBACK = 48; // px — art-bible §3.2 "64–80px container"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisualJuiceOptions {
  /** Pixi Application — for renderer access + screen dimensions */
  app: Application;
  /** L3 VFX layer — particles, ring, flash */
  vfxContainer: Container;
  /** L4 UI layer — score popups */
  uiContainer: Container;
  /** L1 background layer — darkening ColorMatrixFilter */
  bgContainer: Container;
  /** Balloon layer — alpha fade on game:over (§E6) */
  balloonContainer: Container;
  /** Harpoon layer — alpha fade on game:over (§E6) */
  harpoonContainer: Container;
  /** Character sprite — for ring center + GlowFilter attachment */
  getCharacterSprite?: () => Sprite | null;
  /** Character position for ring center (fallback if getCharacterSprite unavailable) */
  characterPosition?: () => { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Critical darkening state machine
// ---------------------------------------------------------------------------

type DarkenPhase =
  | 'idle'
  | 'ramp-in'       // 0.00–0.05s: brightness 1.0 → 0.3
  | 'flash'         // 0.05–0.10s: white flash overlay
  | 'hold'          // 0.10–0.15s: hold dark + ring spawn OK
  | 'ramp-out';     // 0.15–0.20s: brightness 0.3 → 1.0

interface DarkenState {
  phase: DarkenPhase;
  elapsed: number;  // seconds since phase start
}

// ---------------------------------------------------------------------------
// VisualJuiceSystem
// ---------------------------------------------------------------------------

export class VisualJuiceSystem {
  private readonly _app: Application;
  private readonly _vfxContainer: Container;
  private readonly _uiContainer: Container;
  private readonly _bgContainer: Container;
  private readonly _balloonContainer: Container;
  private readonly _harpoonContainer: Container;
  private readonly _getCharacterSprite: (() => Sprite | null) | undefined;
  private readonly _characterPosition: () => { x: number; y: number };

  // Sub-systems
  private readonly _particles: ParticlePool;
  private readonly _popups: ScorePopupPool;

  // Critical darkening
  private readonly _cmFilter: ColorMatrixFilter;
  private _darken: DarkenState = { phase: 'idle', elapsed: 0 };

  // White flash overlay
  private _flashSprite: Sprite | null = null;
  private _flashElapsed = 0;

  // 5-combo ring
  private static _ringTexture: Texture | null = null;
  private _activeRing: Sprite | null = null;
  private _ringLifetimeRemaining = 0;

  // D-P6-CRIT-VIS-02 (사용자): Cool blue overlay (replaces cmFilter brightness)
  private _darkenOverlay: Sprite | null = null;

  // D-P6-CRIT-VIS-03 (사용자): Character white-hot glow 0.20s
  private _charGlowTimer = 0;
  private _charOrigFilters: import('pixi.js').Filter[] | null = null;
  private readonly _charGlowFilter: GlowFilter;

  // GlowFilter (Neon Glassblowing — art-bible §1.2)
  private readonly _glowFilter: GlowFilter;
  private _glowAttachedTo: Sprite | null = null;

  // game:over fade
  private _gameOverFading = false;
  private _gameOverElapsed = 0;

  // Texture init guard
  private _texturesReady = false;

  constructor(opts: VisualJuiceOptions) {
    this._app        = opts.app;
    this._vfxContainer    = opts.vfxContainer;
    this._uiContainer     = opts.uiContainer;
    this._bgContainer     = opts.bgContainer;
    this._balloonContainer  = opts.balloonContainer;
    this._harpoonContainer  = opts.harpoonContainer;
    this._getCharacterSprite = opts.getCharacterSprite;

    // Fallback: screen-center-bottom
    this._characterPosition = opts.characterPosition
      ?? (() => ({
        x: (this._app.screen?.width ?? window.innerWidth) / 2,
        y: (this._app.screen?.height ?? window.innerHeight) - 100,
      }));

    // Sub-systems
    this._particles = new ParticlePool(this._vfxContainer);
    this._popups    = new ScorePopupPool(this._uiContainer);

    // ColorMatrixFilter for Critical darkening (bgContainer — §2.1 S3)
    this._cmFilter = new ColorMatrixFilter();

    // GlowFilter — Neon Glassblowing (art-bible §1.2, D-P3-VJ-01)
    this._glowFilter = new GlowFilter({
      distance: 12,
      outerStrength: 2,
      innerStrength: 0,
      color: 0xffffff,
      quality: 0.2,   // lower quality → fewer passes → mobile perf
    });

    // D-P6-CRIT-VIS-03: Character white-hot glow filter (0.20s swap during critical)
    this._charGlowFilter = new GlowFilter({
      distance: 30,
      outerStrength: 2.5,
      innerStrength: 0,
      color: 0xffffff,
      quality: 0.5,
    });
  }

  // ---------------------------------------------------------------------------
  // Texture init (must call after Pixi renderer is ready)
  // ---------------------------------------------------------------------------

  initTextures(): void {
    if (this._texturesReady) return;
    const renderer = this._app.renderer as Renderer;

    // Particle textures
    this._particles.initTexture(renderer);

    // White flash sprite (full-screen, generated once — D-P3-VJ-02)
    const flashG = new Graphics();
    flashG.rect(0, 0, 1, 1).fill(0xffffff);
    const flashTex = renderer.generateTexture(flashG);
    flashG.destroy();
    this._flashSprite = new Sprite(flashTex);
    // D-P6-FLASH-01 (사용자 BUGFIX): 1×1 texture를 화면 전체로 stretch.
    // 이전: width/height 갱신 없음 → 1픽셀 점으로 보이거나 안 보임.
    this._flashSprite.width = this._app.screen.width;
    this._flashSprite.height = this._app.screen.height;
    this._flashSprite.x = 0;
    this._flashSprite.y = 0;
    this._flashSprite.alpha = 0;
    this._flashSprite.visible = false;
    this._flashSprite.zIndex = 10;
    this._vfxContainer.addChild(this._flashSprite);

    // D-P6-CRIT-VIS-02 (사용자): Cool blue darken overlay (replaces cmFilter brightness)
    // 색 #0a1f3a — sample HTML §critical-state .sky-bg L222 deep cool blue 정합.
    // alpha tween 0 → 0.6 → 0 over 5-phase state machine.
    const darkG = new Graphics();
    darkG.rect(0, 0, 1, 1).fill(0x0a1f3a);
    const darkTex = renderer.generateTexture(darkG);
    darkG.destroy();
    this._darkenOverlay = new Sprite(darkTex);
    this._darkenOverlay.width = this._app.screen.width;
    this._darkenOverlay.height = this._app.screen.height;
    this._darkenOverlay.x = 0;
    this._darkenOverlay.y = 0;
    this._darkenOverlay.alpha = 0;
    this._darkenOverlay.visible = false;
    this._darkenOverlay.zIndex = 9; // 위에 flash (10)가 표시되도록
    this._vfxContainer.addChild(this._darkenOverlay);

    // Ring texture — circle outline (D-P3-VJ-03)
    VisualJuiceSystem._ringTexture = this._buildRingTexture(renderer);

    // Attach GlowFilter to character if available
    this._tryAttachGlow();

    this._texturesReady = true;
  }

  // ---------------------------------------------------------------------------
  // EventBus listener registration (P2 lock — call BEFORE scoreCombo.attachListeners)
  // ---------------------------------------------------------------------------

  /**
   * Register all EventBus listeners.
   * visual-juice §3.7: must be called FIRST in GameLoop.init(), before
   * ScoreComboSystem.attachListeners() — FIFO order guarantees visual fire before score.
   */
  attachListeners(bus: EventBus): void {
    bus.on('balloon:popped',     (p) => this._onBalloonPopped(p));
    bus.on('balloon:split',      (p) => this._onBalloonSplit(p));
    bus.on('criticalPop:fired',  (p) => this._onCriticalPopFired(p));
    bus.on('combo:milestone',    (p) => this._onComboMilestone(p));
    bus.on('combo:reset',        (_) => this._onComboReset());
    bus.on('score:updated',      (p) => this._onScoreUpdated(p));
    bus.on('game:over',          (_) => this._onGameOver());
  }

  // ---------------------------------------------------------------------------
  // Per-frame update (add to Pixi Ticker via GameLoop)
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    this._particles.update(dt);
    this._popups.update(dt);
    this._updateDarkening(dt);
    this._updateRing(dt);
    this._updateGameOverFade(dt);
  }

  // ---------------------------------------------------------------------------
  // Reset (GameLoop.reset() → visualJuice.reset())
  // ---------------------------------------------------------------------------

  reset(): void {
    this._particles.reset();
    this._popups.reset();

    // Clear darkening
    this._darken = { phase: 'idle', elapsed: 0 };
    this._bgContainer.filters = [];
    if (this._flashSprite) { this._flashSprite.alpha = 0; this._flashSprite.visible = false; }

    // Clear ring
    if (this._activeRing) {
      this._vfxContainer.removeChild(this._activeRing);
      this._activeRing.destroy();
      this._activeRing = null;
    }
    this._ringLifetimeRemaining = 0;

    // Clear game:over fade
    this._gameOverFading = false;
    this._gameOverElapsed = 0;
    this._bgContainer.alpha = 1;
    this._balloonContainer.alpha = 1;
    this._harpoonContainer.alpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _onBalloonPopped(p: {
    size: BalloonSize;
    x: number;
    y: number;
    color: number;
    isCritical: boolean;
  }): void {
    // isCritical particles are handled by _onCriticalPopFired (the body position)
    // Normal pop: emit size-based count
    const count = POP_PARTICLE_COUNT[p.size];
    this._particles.spawnBurst(p.x, p.y, p.color, count);
  }

  // D-P6-SPLIT-02 (사용자 2026-05-31): 분열 시 parent 위치에 particle burst.
  // parent.size 기준 POP_PARTICLE_COUNT 재사용 — 큰 풍선 분열 시 더 화려.
  private _onBalloonSplit(p: {
    parent: { id: string; x: number; y: number; size: BalloonSize; color: number };
    children: Array<{ id: string; x: number; y: number; size: BalloonSize; color: number }>;
  }): void {
    const count = POP_PARTICLE_COUNT[p.parent.size];
    this._particles.spawnBurst(p.parent.x, p.parent.y, p.parent.color, count);
  }

  private _onCriticalPopFired(p: {
    x: number;
    y: number;
    chainedBalloons: Array<{ x: number; y: number; color: number }>;
  }): void {
    // Start (or restart) darkening sequence (§E2)
    this._startDarkening();

    // 50-particle Critical burst at body position
    this._particles.spawnBurst(p.x, p.y, RING_COLOR, POP_PARTICLE_COUNT.CriticalBody);

    // Chained balloons also each get a pop burst
    for (const b of p.chainedBalloons) {
      this._particles.spawnBurst(b.x, b.y, b.color, POP_PARTICLE_COUNT.Small);
    }
  }

  private _onComboMilestone(p: { tier: number }): void {
    if (p.tier !== MILESTONE_COMBO) return; // M0: tier=5 only (AC.6)
    this._spawnRing();
  }

  private _onComboReset(): void {
    // M0: visual = 0 (§E7, visual-juice §3.1 row 8)
  }

  private _onScoreUpdated(p: {
    delta: number;
    x: number;
    y: number;
  }): void {
    if (p.delta <= 0) return; // only positive delta triggers popup
    this._popups.spawn(p.x, p.y, p.delta);
  }

  private _onGameOver(): void {
    // Immediate VFX teardown
    this._particles.reset();
    if (this._activeRing) {
      this._vfxContainer.removeChild(this._activeRing);
      this._activeRing.destroy();
      this._activeRing = null;
    }
    this._darken = { phase: 'idle', elapsed: 0 };
    this._bgContainer.filters = [];
    if (this._flashSprite) { this._flashSprite.alpha = 0; this._flashSprite.visible = false; }

    // Begin gameplay-layer alpha fade (§E6 — authority exception)
    this._gameOverFading = true;
    this._gameOverElapsed = 0;
  }

  // ---------------------------------------------------------------------------
  // Critical darkening state machine (§3.3, §4.2)
  // ---------------------------------------------------------------------------

  private _startDarkening(): void {
    // §E2: interrupt existing sequence → restart
    this._darken = { phase: 'ramp-in', elapsed: 0 };
    // D-P6-CRIT-VIS-02: cmFilter brightness 폐기 → cool blue overlay 사용
    if (this._darkenOverlay) {
      this._darkenOverlay.visible = true;
      this._darkenOverlay.alpha = 0;
    }
    // D-P6-CRIT-VIS-03: character white-hot glow swap (0.20s 후 원상복구)
    const charSprite = this._getCharacterSprite?.();
    if (charSprite && this._charGlowTimer <= 0) {
      this._charOrigFilters = (charSprite.filters as import('pixi.js').Filter[] | null) ?? null;
      charSprite.filters = [this._charGlowFilter];
    }
    this._charGlowTimer = DARKEN_RAMP_SEC * 4; // 0.20s 전체 duration
  }

  private _updateDarkening(dt: number): void {
    if (this._darken.phase === 'idle') return;

    this._darken.elapsed += dt;
    const t = this._darken.elapsed;

    // D-P6-CRIT-VIS-02: cool blue overlay alpha 5-phase (replaces cmFilter brightness)
    const DARKEN_PEAK_ALPHA = 0.6;
    switch (this._darken.phase) {
      case 'ramp-in': {
        // 0.00–0.05s: alpha 0 → 0.6
        const progress = Math.min(t / DARKEN_RAMP_SEC, 1);
        if (this._darkenOverlay) this._darkenOverlay.alpha = DARKEN_PEAK_ALPHA * progress;
        if (t >= DARKEN_RAMP_SEC) {
          if (this._darkenOverlay) this._darkenOverlay.alpha = DARKEN_PEAK_ALPHA;
          this._darken = { phase: 'flash', elapsed: 0 };
          this._startFlash();
        }
        break;
      }
      case 'flash': {
        // 0.05–0.10s: white flash (darken overlay 유지)
        this._updateFlash(dt);
        if (t >= WHITE_FLASH_DUR) {
          this._darken = { phase: 'hold', elapsed: 0 };
        }
        break;
      }
      case 'hold': {
        // 0.10–0.15s: hold dark — no action needed
        if (t >= DARKEN_RAMP_SEC) {
          this._darken = { phase: 'ramp-out', elapsed: 0 };
        }
        break;
      }
      case 'ramp-out': {
        // 0.15–0.20s: alpha 0.6 → 0
        const progress = Math.min(t / DARKEN_RAMP_SEC, 1);
        if (this._darkenOverlay) this._darkenOverlay.alpha = DARKEN_PEAK_ALPHA * (1 - progress);
        if (t >= DARKEN_RAMP_SEC) {
          if (this._darkenOverlay) {
            this._darkenOverlay.alpha = 0;
            this._darkenOverlay.visible = false;
          }
          this._darken = { phase: 'idle', elapsed: 0 };
        }
        break;
      }
    }

    // D-P6-CRIT-VIS-03: Character white-hot glow timer (0.20s 후 원상복구)
    if (this._charGlowTimer > 0) {
      this._charGlowTimer -= dt;
      if (this._charGlowTimer <= 0) {
        this._charGlowTimer = 0;
        const charSprite = this._getCharacterSprite?.();
        if (charSprite) {
          charSprite.filters = this._charOrigFilters ?? null;
        }
        this._charOrigFilters = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // White flash
  // ---------------------------------------------------------------------------

  private _startFlash(): void {
    if (!this._flashSprite) return;
    const s = this._flashSprite;
    // Resize to fill screen
    s.width  = this._app.screen?.width  ?? window.innerWidth;
    s.height = this._app.screen?.height ?? window.innerHeight;
    s.alpha = WHITE_FLASH_ALPHA;
    s.visible = true;
    this._flashElapsed = 0;
  }

  private _updateFlash(dt: number): void {
    if (!this._flashSprite || !this._flashSprite.visible) return;
    this._flashElapsed += dt;
    const progress = Math.min(this._flashElapsed / WHITE_FLASH_DUR, 1);
    this._flashSprite.alpha = WHITE_FLASH_ALPHA * (1 - progress);
    if (progress >= 1) {
      this._flashSprite.alpha = 0;
      this._flashSprite.visible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 5-combo ring (§3.4, §4.3)
  // ---------------------------------------------------------------------------

  private _spawnRing(): void {
    // §E5: remove existing ring if active
    if (this._activeRing) {
      this._vfxContainer.removeChild(this._activeRing);
      this._activeRing.destroy();
      this._activeRing = null;
    }

    if (!VisualJuiceSystem._ringTexture) return;

    const ring = new Sprite(VisualJuiceSystem._ringTexture);
    ring.anchor.set(0.5);
    ring.tint = RING_COLOR; // #FFD700 HERO tier (art-bible §4.2)
    ring.alpha = RING_ALPHA_START;

    const charW = CHARACTER_WIDTH_FALLBACK;
    const startRadius = charW * RING_RADIUS_START_MUL;
    const scale = startRadius / RING_TEX_RADIUS;
    ring.scale.set(scale);

    const pos = this._characterPosition();
    ring.position.set(pos.x, pos.y);

    this._vfxContainer.addChild(ring);
    this._activeRing = ring;
    this._ringLifetimeRemaining = RING_LIFETIME;

    // Attach GlowFilter to ring for one frame of Neon Glassblowing (D-P3-VJ-01)
    ring.filters = [this._glowFilter];
  }

  private _updateRing(dt: number): void {
    if (!this._activeRing) return;

    this._ringLifetimeRemaining -= dt;
    if (this._ringLifetimeRemaining <= 0) {
      this._vfxContainer.removeChild(this._activeRing);
      this._activeRing.destroy();
      this._activeRing = null;
      return;
    }

    const charW = CHARACTER_WIDTH_FALLBACK;
    const startRadius = charW * RING_RADIUS_START_MUL;
    const endRadius   = charW * RING_RADIUS_END_MUL;

    const progress = 1 - (this._ringLifetimeRemaining / RING_LIFETIME);
    const radius = startRadius + (endRadius - startRadius) * progress;
    this._activeRing.scale.set(radius / RING_TEX_RADIUS);
    this._activeRing.alpha = (1 - progress) * RING_ALPHA_START;

    // Keep ring centered on character
    const pos = this._characterPosition();
    this._activeRing.position.set(pos.x, pos.y);
  }

  // ---------------------------------------------------------------------------
  // game:over alpha fade (§E6 — authority exception)
  // ---------------------------------------------------------------------------

  private _updateGameOverFade(dt: number): void {
    if (!this._gameOverFading) return;

    this._gameOverElapsed += dt;
    const progress = Math.min(this._gameOverElapsed / GAMEOVER_FADE_SEC, 1);
    const alpha = 1 - progress;
    this._bgContainer.alpha       = alpha;
    this._balloonContainer.alpha  = alpha;
    this._harpoonContainer.alpha  = alpha;

    if (progress >= 1) {
      this._gameOverFading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // GlowFilter — Neon Glassblowing (art-bible §1.2, D-P3-VJ-01)
  // ---------------------------------------------------------------------------

  /**
   * Attempt to attach GlowFilter to the character sprite (if getter available).
   * Only attaches once; does not re-attach on reset (sprite reference persists).
   */
  private _tryAttachGlow(): void {
    if (!this._getCharacterSprite) return;
    const sprite = this._getCharacterSprite();
    if (!sprite || sprite === this._glowAttachedTo) return;
    sprite.filters = [...(sprite.filters ?? []), this._glowFilter];
    this._glowAttachedTo = sprite;
  }

  // ---------------------------------------------------------------------------
  // Ring texture — generated once (D-P3-VJ-03)
  // ---------------------------------------------------------------------------

  private _buildRingTexture(renderer: Renderer): Texture {
    const g = new Graphics();
    // Outlined circle (no fill) for the ring visual
    g.circle(0, 0, RING_TEX_RADIUS)
      .stroke({ color: 0xffffff, width: RING_STROKE_WIDTH, alpha: 1 });
    const tex = renderer.generateTexture(g);
    g.destroy();
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Performance accessors (for self-audit)
  // ---------------------------------------------------------------------------

  get activeParticleCount(): number { return this._particles.activeCount; }
  get activePopupCount(): number    { return this._popups.activeCount; }
  get hasActiveRing(): boolean      { return this._activeRing !== null; }
  get isDarkening(): boolean        { return this._darken.phase !== 'idle'; }
}

// ---------------------------------------------------------------------------
// attachVisualJuice — drop-in for GameLoop.init() swap (D-P2-07, §3.7)
// ---------------------------------------------------------------------------

/**
 * Factory that creates and wires a VisualJuiceSystem into the EventBus.
 *
 * MAIN SESSION HANDOFF:
 * Replace the 4 no-op placeholder listeners in game-loop.ts (L101–104) with
 * a single call to this function BEFORE ScoreComboSystem.attachListeners().
 *
 * Example replacement in GameLoop.init():
 *
 *   import { attachVisualJuice } from '../vfx/visual-juice.js';
 *
 *   // In GameLoop.init(), before this._scoreCombo.attachListeners():
 *   this._visualJuice = attachVisualJuice({
 *     app: this._app,
 *     vfxContainer:     this._containers.vfxContainer,
 *     uiContainer:      this._containers.uiContainer,
 *     bgContainer:      this._containers.bgContainer,
 *     balloonContainer: this._containers.balloonContainer,
 *     harpoonContainer: this._containers.harpoonContainer,
 *     // Optional — if BalloonPhysicsSplitSystem exposes getCharacterPosition():
 *     characterPosition: () => this._balloonSystem.getCharacterPosition(),
 *   });
 *
 * Also add to GameLoop.update(ticker):
 *   this._visualJuice.update(dtSec);
 *
 * And GameLoop.reset():
 *   this._visualJuice.reset();
 */
export function attachVisualJuice(opts: VisualJuiceOptions): VisualJuiceSystem {
  const vj = new VisualJuiceSystem(opts);
  // Texture init deferred — renderer is available immediately after app.init()
  vj.initTextures();
  return vj;
}
