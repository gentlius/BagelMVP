/**
 * GameLoop — POP!
 *
 * Implements: design/gdd/systems-index.md §Engine Bootstrap
 * Design Doc: design/gdd/systems-index.md §Engine Bootstrap + 5 GDDs
 *
 * Owns: instantiation of 5 systems, Ticker wiring, EventBus listener registration,
 * start/reset/end lifecycle.
 *
 * Phase 2 Decision (D-P2-07): P2 listener order placeholder pattern.
 *   Visual Juice is Phase 3 (not yet implemented). Per score-combo §9 IC P2 lock,
 *   a no-op placeholder listener for 'balloon:popped' and 'criticalPop:fired' is
 *   registered FIRST so that when Phase 3 technical-artist replaces it with real
 *   VFX handlers, the registration order contract is already satisfied.
 *   Phase 3 instruction: remove placeholder, register real VFX listener in same slot.
 *
 * Phase 2 Decision (D-P2-08): dt unit policy.
 *   ticker.deltaMS / 1000 → seconds for all system update() calls.
 *   Max clamp: 50ms (0.05s) to prevent spiral-of-death on tab-resume drift.
 *   Rationale: a frame > 50ms means the browser was backgrounded; clamping prevents
 *   physics tunneling and pity timer over-accumulation.
 *
 * AudioContext unlock (visual-juice §3.7):
 *   GameLoop.init() registers eventBus.once('input:fire', ...) to unlock
 *   globalThis.audioManager if present. Phase 3 sound-designer assigns
 *   globalThis.audioManager before first user gesture.
 */

import type { Application, Ticker } from 'pixi.js';
import { eventBus } from '../events/event-bus.js';
import { BalloonPhysicsSplitSystem } from './balloon-physics-split.js';
import { CriticalPopSystem } from './critical-pop.js';
import { ScoreComboSystem } from './score-combo.js';
import { InputSystem } from './input-system.js';
import { attachVisualJuice, type VisualJuiceSystem } from '../vfx/visual-juice.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameContainers {
  bgContainer: import('pixi.js').Container;
  balloonContainer: import('pixi.js').Container;
  harpoonContainer: import('pixi.js').Container;
  vfxContainer: import('pixi.js').Container;
  uiContainer: import('pixi.js').Container;
}

/** Max dt clamp to prevent physics tunneling on tab resume (D-P2-08) */
const MAX_DT_SEC = 0.05; // 50ms

// ---------------------------------------------------------------------------
// GameLoop
// ---------------------------------------------------------------------------

export class GameLoop {
  private readonly _app: Application;
  private readonly _containers: GameContainers;

  private _balloonSystem!: BalloonPhysicsSplitSystem;
  private _criticalPop!: CriticalPopSystem;
  private _scoreCombo!: ScoreComboSystem;
  private _input!: InputSystem;
  private _visualJuice!: VisualJuiceSystem;

  private _started = false;
  private _paused = false; // D-P6-BGM-02 (사용자): About 모달 pause/resume

  constructor(app: Application, containers: GameContainers) {
    this._app = app;
    this._containers = containers;
  }

  /**
   * Instantiate all 5 systems, wire dependencies, register EventBus listeners
   * in the correct P2 order lock.
   *
   * Call once after Pixi Application.init() completes. Do NOT call start() yet.
   */
  init(): void {
    const { balloonContainer, harpoonContainer } = this._containers;

    // 1. Instantiate systems
    this._balloonSystem = new BalloonPhysicsSplitSystem({
      app: this._app,
      balloonContainer,
      harpoonContainer,
      eventBus,
    });

    this._criticalPop = new CriticalPopSystem(this._balloonSystem);

    // Wire criticalPop into balloonSystem (direct hook pattern — D-P2-04, M0 §3.1)
    this._balloonSystem.criticalPop = this._criticalPop;

    this._scoreCombo = new ScoreComboSystem();

    this._input = new InputSystem(this._app);
    this._input.attach(); // BUGFIX 2026-05-31: attach() 누락 — PointerEvent listener 등록 0건 → 모든 input 무시

    // 2. Register EventBus listeners — P2 listener order lock (score-combo §9 IC)
    //    Visual Juice FIRST, Score & Combo SECOND.
    //    Phase 3 (D-P3-TA-*): attachVisualJuice replaces former placeholder slot.
    this._visualJuice = attachVisualJuice({
      app: this._app,
      bgContainer: this._containers.bgContainer,
      balloonContainer: this._containers.balloonContainer,
      harpoonContainer: this._containers.harpoonContainer,
      vfxContainer: this._containers.vfxContainer,
      uiContainer: this._containers.uiContainer,
      characterPosition: () => {
        const c = this._balloonSystem.getCharacter();
        return { x: c.x, y: c.y };
      },
      // D-P6-CRIT-VIS-03 (사용자): character white-hot glow swap during critical
      getCharacterSprite: () => this._balloonSystem.getCharacter().sprite,
    });
    // D-P6-WIRE-02 (사용자 BUGFIX 2026-05-31): attachListeners 누락 → 파티클/시각 효과 0건.
    // factory가 instance만 만들고 listener 등록 안 함 → balloon:popped/balloon:split/criticalPop:fired
    // 모두 ignore. 여기서 명시적 호출 (P2 lock: score-combo.attachListeners보다 먼저).
    this._visualJuice.attachListeners(eventBus);

    // Score & Combo registers after Visual Juice (FIFO order = dispatch order)
    this._scoreCombo.attachListeners();

    // Critical Pop: listen for isCritical=true balloon:popped events
    eventBus.on('balloon:popped', (p) => this._criticalPop.onBalloonPopped(p));

    // Input → BalloonPhysics wiring (D-P6-CTRL-01: virtual stick)
    // D-P6-AUDIO-01 (사용자 BUGFIX): InputSystem Pixi 'input:fire' → EventBus forward.
    // 이전: forward 없음 → EventBus 'input:fire' emit 0건 → AudioContext unlock 미발동 + harpoon-fire SFX 사일런트.
    this._input.on('input:fire', () => {
      this._balloonSystem.onFire();
      eventBus.emit('input:fire', {});
    });
    this._input.on('input:dragStart', (p) => this._balloonSystem.onDragStart(p.x));
    this._input.on('input:dragMove', (p) => this._balloonSystem.onDragMove(p.x));
    this._input.on('input:dragEnd', () => this._balloonSystem.onDragEnd());
    this._input.on('input:dragCancel', () => this._balloonSystem.onDragEnd());

    // RETRY — reset and restart
    eventBus.on('input:retry', () => this.reset());

    // AudioContext unlock on first user gesture (visual-juice §3.7, D-P2-07)
    eventBus.once('input:fire', () => {
      const am = (globalThis as unknown as { audioManager?: { unlock?: () => void } }).audioManager;
      am?.unlock?.();
    });

    // Mobile platform: tab background → pause (BGM 누수 + 배터리 드레인 방지).
    // pause()/resume()는 About 모달과 동일 경로 — _paused guard로 중복 safe.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.resume();
    });

    // Ticker: single update handler
    this._app.ticker.add((ticker: Ticker) => this.update(ticker));
  }

  /**
   * Start game. Emits game:start, begins balloon spawning.
   * Ticker was already added in init(); systems begin accumulating dt from here.
   */
  start(): void {
    if (this._started) return;
    this._started = true;

    this._balloonSystem.start();
    // InputSystem is event-driven and requires no explicit start() call
    eventBus.emit('game:start', {});
  }

  /**
   * Reset all systems for RETRY. Does not re-register listeners (already registered).
   * Emits game:start after reset.
   */
  reset(): void {
    this._balloonSystem.reset();
    this._criticalPop.reset();
    this._scoreCombo.reset();
    this._visualJuice.reset();

    this._balloonSystem.start();
    eventBus.emit('game:start', {});
  }

  /**
   * End game. Emits game:over. Systems freeze (Ticker continues but update is no-op
   * after game:over — systems check internal state).
   */
  end(): void {
    this._balloonSystem.end();
    eventBus.emit('game:over', {});
  }

  /**
   * D-P6-BGM-02 (사용자): About 모달 pause/resume.
   * Game logic update freeze + AudioContext suspend. BGM/SFX 일시정지.
   */
  pause(): void {
    if (this._paused) return;
    this._paused = true;
    const am = (globalThis as unknown as { audioManager?: { suspend?: () => void } }).audioManager;
    am?.suspend?.();
  }
  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    const am = (globalThis as unknown as { audioManager?: { resume?: () => void } }).audioManager;
    am?.resume?.();
  }
  isPaused(): boolean { return this._paused; }
  /** e2e smoke test 진입 검증용 — game:start emit 후 true */
  isStarted(): boolean { return this._started; }

  /**
   * Per-frame update. Called by Pixi Ticker.
   * Converts deltaMS → seconds, clamps to MAX_DT_SEC (D-P2-08).
   */
  update(ticker: Ticker): void {
    if (!this._started || this._paused) return;

    // D-P2-08: clamp dt — tab-resume can produce huge deltaMS spikes
    const dtSec = Math.min(ticker.deltaMS / 1000, MAX_DT_SEC);

    this._balloonSystem.update(dtSec);
    this._criticalPop.update(dtSec);
    this._scoreCombo.update(dtSec);
    this._visualJuice.update(dtSec);
    // InputSystem is event-driven; no per-frame update needed
  }
}
