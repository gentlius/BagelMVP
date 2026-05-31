/**
 * Score & Combo System — POP!
 *
 * Implements: design/gdd/score-combo-system.md (전체)
 * Design Doc: design/gdd/score-combo-system.md
 *
 * Single authority for combo tracking and score calculation.
 * Listens: balloon:popped, criticalPop:fired, game:start
 * Emits: score:updated (8-field payload), combo:milestone, combo:reset
 *
 * Phase 2 Decision (D-P2-05): Frame-guard uses Set<string> of chained balloon ids.
 * Set is rebuilt each criticalPop:fired event and cleared each frame update().
 * GC impact: Set is recreated per Critical event (~once per 30s avg). Acceptable for M0.
 * M1 optimization: reuse Set with clear() if GC spikes detected on profiling.
 *
 * Phase 2 Decision (D-P2-06): COMBO_RESET_SEC = 3.0s (score-combo §7 default).
 * MILESTONE_COMBO = 5 (M0 single milestone; M1 adds 10/20).
 *
 * P2 listener order lock (score-combo §1, §9 IC):
 *   GameLoop registers Visual Juice placeholder listener BEFORE this system's listeners.
 *   EventBus FIFO dispatch guarantees visual response fires before score update.
 */

import type {
  BalloonPoppedPayload,
  CriticalPopFiredPayload,
  BalloonSize,
} from '../events/event-bus.js';
import { eventBus } from '../events/event-bus.js';

// ---------------------------------------------------------------------------
// Constants (Tuning Knobs — score-combo §7)
// ---------------------------------------------------------------------------

/** Base score per pop (score-combo §4.1) */
export const BASE_SCORE = 10;

/** Size multiplier table (score-combo §4.1 + §7) — D-P6-SPLIT-01: XL/XS 추가 */
export const SIZE_MULTIPLIER: Record<BalloonSize, number> = {
  XL: 0.5,      // 큰 풍선 = 쉬움 (낮은 보상)
  Large: 1.0,
  Medium: 1.5,
  Small: 2.0,
  XS: 3.0,      // 작은 풍선 = 어려움 (높은 보상)
};

/**
 * Combo multiplier factor per combo count (score-combo §4.1).
 * comboMultiplier(N) = 1 + (N-1) * COMBO_MULTIPLIER_FACTOR
 */
export const COMBO_MULTIPLIER_FACTOR = 0.1;

/** Seconds of inactivity before combo resets (score-combo §7, D-P2-06) */
export const COMBO_RESET_SEC = 3.0;

/** First milestone combo threshold (score-combo §3.4, D-P2-06) */
export const MILESTONE_COMBO = 5;

/**
 * Critical chain combo cap (score-combo §7, decisions §3 #6 lock).
 * Must equal critical-pop CRITICAL_CHAIN_CAP (AC.17).
 */
export const CRITICAL_COMBO_CAP = 3;

// ---------------------------------------------------------------------------
// ScoreComboSystem
// ---------------------------------------------------------------------------

export class ScoreComboSystem {
  private _combo = 0;
  private _comboTimer = 0;
  private _totalScore = 0;
  private _previousMilestone = 0;

  /**
   * Frame-guard: Set of chained balloon ids from current criticalPop:fired event.
   * Cleared at start of each update() frame (score-combo §3.2, M-SC-1 lock).
   *
   * D-P2-05: rebuilt per Critical event (acceptable GC for M0 frequency ~1/30s).
   */
  private _chainedIdsToIgnore: Set<string> = new Set();

  // Bound handlers stored for potential off() use by GameLoop
  private readonly _onBalloonPopped: (p: BalloonPoppedPayload) => void;
  private readonly _onCriticalPopFired: (p: CriticalPopFiredPayload) => void;

  constructor() {
    // Bind handlers so GameLoop can register them via eventBus.on()
    this._onBalloonPopped = (p) => this._handleBalloonPopped(p);
    this._onCriticalPopFired = (p) => this._handleCriticalPopFired(p);
  }

  /**
   * Register EventBus listeners. Called by GameLoop.init() AFTER Visual Juice
   * placeholder is registered (P2 listener order lock — score-combo §9 IC).
   */
  attachListeners(): void {
    eventBus.on('balloon:popped', this._onBalloonPopped);
    eventBus.on('criticalPop:fired', this._onCriticalPopFired);
  }

  // ---------------------------------------------------------------------------
  // GameLoop contract (score-combo §3.5)
  // ---------------------------------------------------------------------------

  /** Reset all state. Called by GameLoop.reset() on RETRY. */
  reset(): void {
    this._combo = 0;
    this._comboTimer = 0;
    this._totalScore = 0;
    this._previousMilestone = 0;
    this._chainedIdsToIgnore.clear();
  }

  /**
   * Per-frame update. Must clear frame-guard first, then advance combo timer.
   * @param dtSec seconds (ticker.deltaMS / 1000)
   */
  update(dtSec: number): void {
    // Frame-guard reset — MUST be first line (score-combo §3.2 §3.1 state machine)
    this._chainedIdsToIgnore.clear();

    if (this._combo > 0) {
      this._comboTimer += dtSec;
      if (this._comboTimer >= COMBO_RESET_SEC) {
        const finalCombo = this._combo;
        this._combo = 0;
        this._comboTimer = 0;
        this._previousMilestone = 0; // new streak starts fresh
        eventBus.emit('combo:reset', { finalCombo });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Read-only API (score-combo §3.5 — Power-up M1 + RETRY UX)
  // ---------------------------------------------------------------------------

  getCombo(): number {
    return this._combo;
  }

  getTotalScore(): number {
    return this._totalScore;
  }

  // ---------------------------------------------------------------------------
  // Private: event handlers
  // ---------------------------------------------------------------------------

  private _handleBalloonPopped(event: BalloonPoppedPayload): void {
    // Frame-guard: ignore chained balloons (M-SC-1 lock, score-combo §3.2)
    if (this._chainedIdsToIgnore.has(event.id)) return;

    // Critical body is handled exclusively via criticalPop:fired (score-combo §3.2 matrix)
    if (event.isCritical) return;

    this._combo += 1;
    this._comboTimer = 0;

    const delta = this._computeScore(event.size, this._combo);
    this._totalScore += delta;

    eventBus.emit('score:updated', {
      totalScore: this._totalScore,
      delta,
      combo: this._combo,
      size: event.size,
      x: event.x,
      y: event.y,
      sizeMultiplier: SIZE_MULTIPLIER[event.size],
      comboMultiplier: this._comboMultiplier(this._combo),
    });

    this._checkMilestone(this._combo - 1, this._combo);
  }

  private _handleCriticalPopFired(event: CriticalPopFiredPayload): void {
    // Rebuild frame-guard set from chained balloon ids (D-P2-05)
    this._chainedIdsToIgnore = new Set(event.chainedBalloons.map((b) => b.id));

    const criticalSize = event.criticalSize ?? 'Large'; // AC.14 defensive fallback (E10)

    // 1. Critical body — uses criticalSize (M-CP-1 lock)
    const prevCombo = this._combo;
    this._combo += 1;
    this._comboTimer = 0;

    const bodyDelta = this._computeScore(criticalSize, this._combo);
    this._totalScore += bodyDelta;

    eventBus.emit('score:updated', {
      totalScore: this._totalScore,
      delta: bodyDelta,
      combo: this._combo,
      size: criticalSize,
      x: event.x,
      y: event.y,
      sizeMultiplier: SIZE_MULTIPLIER[criticalSize],
      comboMultiplier: this._comboMultiplier(this._combo),
    });

    // 2. Chained balloons — sequential, each gets its own score:updated emit
    // chainedBalloons already capped at CRITICAL_CHAIN_CAP by CriticalPopSystem
    for (const chained of event.chainedBalloons) {
      this._combo += 1;
      const chainDelta = this._computeScore(chained.size, this._combo);
      this._totalScore += chainDelta;

      eventBus.emit('score:updated', {
        totalScore: this._totalScore,
        delta: chainDelta,
        combo: this._combo,
        size: chained.size,
        x: chained.x,
        y: chained.y,
        sizeMultiplier: SIZE_MULTIPLIER[chained.size],
        comboMultiplier: this._comboMultiplier(this._combo),
      });
    }

    // Milestone check: from prevCombo (before body) to final combo (after all chained)
    this._checkMilestone(prevCombo, this._combo);
  }

  // ---------------------------------------------------------------------------
  // Private: score formula (score-combo §4.1)
  // ---------------------------------------------------------------------------

  /**
   * delta = BASE_SCORE × SIZE_MULTIPLIER[size] × comboMultiplier(combo)
   * @param combo current combo value after increment (≥ 1)
   */
  private _computeScore(size: BalloonSize, combo: number): number {
    return BASE_SCORE * SIZE_MULTIPLIER[size] * this._comboMultiplier(combo);
  }

  /**
   * comboMultiplier(N) = 1 + (N - 1) × COMBO_MULTIPLIER_FACTOR
   * comboMultiplier(1) = 1.0
   */
  private _comboMultiplier(combo: number): number {
    return 1 + (combo - 1) * COMBO_MULTIPLIER_FACTOR;
  }

  // ---------------------------------------------------------------------------
  // Private: milestone check (score-combo §3.4)
  // ---------------------------------------------------------------------------

  /**
   * Emits combo:milestone if the combo crosses MILESTONE_COMBO threshold.
   * Single-emit per streak (no re-emit for 6, 7, 8...).
   * Reset previousMilestone to 0 on combo reset so next streak re-triggers.
   */
  private _checkMilestone(prevCombo: number, newCombo: number): void {
    if (prevCombo < MILESTONE_COMBO && newCombo >= MILESTONE_COMBO) {
      eventBus.emit('combo:milestone', { tier: MILESTONE_COMBO, combo: newCombo });
      this._previousMilestone = MILESTONE_COMBO;
    }
  }
}
