/**
 * Critical Pop System — POP!
 *
 * Implements: design/gdd/critical-pop-system.md (전체)
 * Design Doc: design/gdd/critical-pop-system.md
 *
 * Responsibilities:
 *   (a) Critical 부여 — spawn 시 10% lottery (rng.critical)
 *   (b) Pity timer 90s — 무 Critical 90s 경과 시 nearest balloon transmute
 *   (c) 연쇄팝 — Critical balloon 명중 시 CHAIN_RADIUS 안 최대 3개 연쇄 제거
 *   (d) criticalPop:fired emit — Visual Juice + Score & Combo trigger
 *
 * Phase 2 Decision (D-P2-04): CriticalPopSystem이 BalloonPhysicsSplitSystem을
 * EventBus 외 직접 참조함. M0 prototype 단순화 (critical-pop §3.1, §6 Dependencies).
 * M1 retrofit: balloon:spawned EventBus listen으로 전환 (critical-pop §9 IC).
 *
 * GlowFilter (pixi-filters) Phase 3 technical-artist가 SHARED_CRITICAL_GOLD_GLOW
 * 인스턴스를 주입. Phase 2에서는 tint만 적용 (filters = null guard).
 */

import type { BalloonEntity } from '../entities/balloon.js';
import type { BalloonPoppedPayload, CriticalPopFiredPayload } from '../events/event-bus.js';
import { eventBus } from '../events/event-bus.js';
import { rng } from '../conventions/rng.js';
import type { BalloonPhysicsSplitSystem } from './balloon-physics-split.js';

// ---------------------------------------------------------------------------
// Constants (Tuning Knobs — critical-pop §7)
// ---------------------------------------------------------------------------

/** Spawn lottery probability — 10% (critical-pop §3.1) */
export const CRITICAL_PROBABILITY = 0.10;

/** Pity timer threshold in seconds — 90s (critical-pop §3.2, PG-04 보장) */
export const PITY_TIMEOUT = 90;

/** Chain detection radius in pixels — 150px (critical-pop §7) */
export const CRITICAL_CHAIN_RADIUS = 150;

/** Max chained balloons per event — cap 3 (critical-pop §7, decisions §3 #6 lock) */
export const CRITICAL_CHAIN_CAP = 3;

/** Critical Gold tint hex (art-bible §1.3 canonical, game-concept.md #FFC107 superseded) */
export const CRITICAL_GOLD_HEX = 0xffd700;

// ---------------------------------------------------------------------------
// CriticalPopSystem
// ---------------------------------------------------------------------------

export class CriticalPopSystem {
  private _balloonSystem: BalloonPhysicsSplitSystem;
  private _pityTimer = 0;

  /**
   * @param balloonSystem Direct reference for getActiveBalloons(), getCharacter(),
   *   removeBalloon() (M0 prototype direct hook pattern — critical-pop §3.1, §6)
   */
  constructor(balloonSystem: BalloonPhysicsSplitSystem) {
    this._balloonSystem = balloonSystem;
  }

  // ---------------------------------------------------------------------------
  // GameLoop contract (critical-pop §3.5)
  // ---------------------------------------------------------------------------

  /** Reset all runtime state. Called by GameLoop.reset() between runs. */
  reset(): void {
    this._pityTimer = 0;
  }

  /**
   * Per-frame update. Accumulates pity timer; triggers transmute at PITY_TIMEOUT.
   * @param dtSec seconds (ticker.deltaMS / 1000)
   */
  update(dtSec: number): void {
    this._pityTimer += dtSec;

    if (this._pityTimer >= PITY_TIMEOUT) {
      this._tryPityTransmute();
    }
  }

  // ---------------------------------------------------------------------------
  // Direct hook — called by BalloonPhysicsSplitSystem on each spawn (§3.1, M0 pattern)
  // ---------------------------------------------------------------------------

  /**
   * Called immediately after a balloon is spawned (same Ticker pass).
   * Applies lottery and, if pityTimer saturated with no active balloons, force-assigns.
   *
   * E2: if pityTimer >= PITY_TIMEOUT and activeBalloons was 0 at update time,
   * the timer is still saturated when this is called → force setCritical.
   */
  onBalloonSpawned(b: BalloonEntity): void {
    const pityForced = this._pityTimer >= PITY_TIMEOUT;
    const lotteryWin = rng.critical.nextBool(CRITICAL_PROBABILITY);

    if (pityForced || lotteryWin) {
      this._setCritical(b);
    }
  }

  /**
   * Listen handler for balloon:popped.
   * Only processes isCritical=true events; ignores false to prevent cascade recursion.
   * Registered by GameLoop.init() on EventBus.
   */
  onBalloonPopped(payload: BalloonPoppedPayload): void {
    if (!payload.isCritical) return;
    this._handleCriticalHit(payload);
  }

  // ---------------------------------------------------------------------------
  // Private: setCritical — single authority for Critical assignment (§6 권한 경계)
  // ---------------------------------------------------------------------------

  private _setCritical(b: BalloonEntity): void {
    b.isCritical = true;
    b.color = CRITICAL_GOLD_HEX;
    // D-P6-CRIT-VIS-01 (사용자): balloon-physics-split에 시각 위임
    // (texture gold swap + scale ×1.1 + hero GlowFilter). tint 직접 set 제거.
    this._balloonSystem.applyCriticalVisual(b);
    this._pityTimer = 0; // reset on assignment (critical-pop §3.1)
  }

  // ---------------------------------------------------------------------------
  // Private: Pity transmute — nearest balloon by dist² (§3.2)
  // ---------------------------------------------------------------------------

  private _tryPityTransmute(): void {
    const active = this._balloonSystem.getActiveBalloons();
    if (active.length === 0) {
      // E2: keep pityTimer saturated; next onBalloonSpawned will force setCritical
      return;
    }

    const character = this._balloonSystem.getCharacter();
    const cx = character.x;
    const cy = character.y;

    // dist² comparison — no sqrt (§3.2, balloon-physics-split §3.9 pattern)
    // Tie-break: reduce first-found (deterministic — activeBalloons = spawn order, E8)
    let best: BalloonEntity | null = null;
    let bestDistSq = Infinity;
    for (const b of active) {
      const dx = b.x - cx;
      const dy = b.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = b;
      }
    }

    if (best !== null) {
      this._setCritical(best);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: cascade on Critical hit (§3.3)
  // ---------------------------------------------------------------------------

  private _handleCriticalHit(payload: BalloonPoppedPayload): void {
    const active = this._balloonSystem.getActiveBalloons();
    const radiusSq = CRITICAL_CHAIN_RADIUS * CRITICAL_CHAIN_RADIUS;
    const px = payload.x;
    const py = payload.y;

    // Filter by radius (dist²), sort ascending, cap CRITICAL_CHAIN_CAP
    const candidates = (active as BalloonEntity[])
      .filter((b) => {
        const dx = b.x - px;
        const dy = b.y - py;
        return dx * dx + dy * dy < radiusSq;
      })
      .sort((a, b) => {
        const dA = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
        const dB = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
        return dA - dB;
      })
      .slice(0, CRITICAL_CHAIN_CAP);

    // Remove chained balloons via public API (emits balloon:popped isCritical=false)
    for (const chained of candidates) {
      this._balloonSystem.removeBalloon(chained.id);
    }

    // Build payload — chainedBalloons always an array, [] when chain=0 (E7, AC.7)
    const chainedPayload: CriticalPopFiredPayload['chainedBalloons'] = candidates.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      size: b.size,
      color: b.color,
    }));

    // emit criticalPop:fired (M-CP-1 lock — criticalSize = Critical 본체 size)
    eventBus.emit('criticalPop:fired', {
      x: payload.x,
      y: payload.y,
      criticalSize: payload.size,
      chainedBalloons: chainedPayload,
    });
  }
}
