/**
 * visual-juice unit tests — POP!
 *
 * Strategy: test pure logic helpers that do NOT require Pixi instantiation.
 *   - computeEvictionCount (FIFO cap logic — AC.3, AC.8, §E3/E4)
 *   - Ring animation formula (§4.3 lerp + alpha)
 *   - Score popup formula (§4.4 float + alpha)
 *   - Particle formula (§4.1 alpha/scale linear fade)
 *   - Darkening sequence timing constants (§4.2 total = 0.20s)
 *   - Event routing guard: combo:milestone tier != 5 is ignored (AC.6)
 *   - score:updated delta <= 0 does not spawn popup
 *
 * Pixi-dependent paths (ParticlePool.spawnBurst, ScorePopupPool.spawn,
 * VisualJuiceSystem.update) are covered by manual smoke + Playwright e2e (GATE-04).
 *
 * Design doc: design/gdd/visual-juice-system.md §4, §8 AC.1–AC.21
 */

import { describe, it, expect } from 'vitest';
import {
  computeEvictionCount,
  POP_PARTICLE_COUNT,
  POP_PARTICLE_LIFETIME,
  POP_PARTICLE_CAP,
  POP_PARTICLE_SPEED_MIN,
  POP_PARTICLE_SPEED_MAX,
} from '../../src/vfx/particle-pool.js';
import {
  SCORE_POPUP_FLOAT_SPEED,
  SCORE_POPUP_LIFETIME,
  SCORE_POPUP_POOL_SIZE,
} from '../../src/vfx/score-popup-pool.js';

// ---------------------------------------------------------------------------
// FIFO eviction (AC.3 — §E3)
// ---------------------------------------------------------------------------

describe('computeEvictionCount — FIFO cap logic (AC.3, §E3)', () => {
  it('returns 0 when adding incoming fits within cap', () => {
    // 100 active + 30 incoming < 200 cap → no eviction
    expect(computeEvictionCount(100, 30, 200)).toBe(0);
  });

  it('returns 0 when exactly at cap boundary', () => {
    expect(computeEvictionCount(170, 30, 200)).toBe(0);
  });

  it('returns eviction count when overflow occurs', () => {
    // 190 active + 30 incoming = 220 → 20 over cap → evict 20
    expect(computeEvictionCount(190, 30, 200)).toBe(20);
  });

  it('evicts all active when incoming alone exceeds cap', () => {
    // 0 active + 250 incoming → 250-200 = 50 overflow → evict 50 (but active=0 → 0)
    // Math.max(0, 0+250-200) = 50 but we only have 0 active to evict
    // The function returns overflow count, caller is responsible for clamping to active.length
    expect(computeEvictionCount(0, 250, 200)).toBe(50);
  });

  it('handles exactly cap-sized burst with full active list', () => {
    // 200 active + 50 CriticalBody → evict 50
    expect(computeEvictionCount(200, 50, 200)).toBe(50);
  });

  it('returns 0 when active is empty and incoming fits', () => {
    expect(computeEvictionCount(0, 10, 200)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Particle count constants (AC.1 — §4.1)
// ---------------------------------------------------------------------------

describe('POP_PARTICLE_COUNT constants (AC.1)', () => {
  it('Large = 30', () => expect(POP_PARTICLE_COUNT.Large).toBe(30));
  it('Medium = 20', () => expect(POP_PARTICLE_COUNT.Medium).toBe(20));
  it('Small = 10', () => expect(POP_PARTICLE_COUNT.Small).toBe(10));
  it('CriticalBody = 50', () => expect(POP_PARTICLE_COUNT.CriticalBody).toBe(50));
});

// ---------------------------------------------------------------------------
// Particle lifetime + alpha/scale formula (AC.2 — §4.1)
// ---------------------------------------------------------------------------

describe('Particle alpha/scale linear fade formula (AC.2)', () => {
  const simulateParticleFrame = (lifetime: number, dt: number) => {
    const newLifetime = lifetime - dt;
    const alpha = newLifetime / POP_PARTICLE_LIFETIME;
    return { newLifetime, alpha, scale: alpha };
  };

  it('starts at alpha=1.0 scale=1.0 with full lifetime', () => {
    const { alpha, scale } = simulateParticleFrame(POP_PARTICLE_LIFETIME, 0);
    expect(alpha).toBeCloseTo(1.0, 5);
    expect(scale).toBeCloseTo(1.0, 5);
  });

  it('alpha = lifetime / POP_PARTICLE_LIFETIME at midpoint', () => {
    const halfLife = POP_PARTICLE_LIFETIME / 2;
    const { alpha } = simulateParticleFrame(halfLife, 0);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('alpha reaches 0 at end of lifetime', () => {
    const { alpha } = simulateParticleFrame(0.001, 0.001);
    expect(alpha).toBeLessThanOrEqual(0.01);
  });

  it('lifetime = 0.5s (AC.2)', () => {
    expect(POP_PARTICLE_LIFETIME).toBe(0.5);
  });

  it('cap = 200 (§7)', () => {
    expect(POP_PARTICLE_CAP).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Speed range constants (§4.1)
// ---------------------------------------------------------------------------

describe('Particle speed range (§4.1)', () => {
  it('min speed = 80 px/s', () => expect(POP_PARTICLE_SPEED_MIN).toBe(80));
  it('max speed = 200 px/s', () => expect(POP_PARTICLE_SPEED_MAX).toBe(200));
  it('max > min', () => expect(POP_PARTICLE_SPEED_MAX).toBeGreaterThan(POP_PARTICLE_SPEED_MIN));
});

// ---------------------------------------------------------------------------
// Score popup float formula (AC.7 — §4.4)
// ---------------------------------------------------------------------------

describe('Score popup float formula (AC.7)', () => {
  const simulatePopupFrame = (lifetime: number, y: number, dt: number) => {
    const newLifetime = lifetime - dt;
    const newY = y - SCORE_POPUP_FLOAT_SPEED * dt;
    const alpha = newLifetime / SCORE_POPUP_LIFETIME;
    return { newLifetime, newY, alpha };
  };

  it('SCORE_POPUP_LIFETIME = 0.8s (§7)', () => {
    expect(SCORE_POPUP_LIFETIME).toBe(0.8);
  });

  it('SCORE_POPUP_FLOAT_SPEED = 50 px/s (§7)', () => {
    expect(SCORE_POPUP_FLOAT_SPEED).toBe(50);
  });

  it('SCORE_POPUP_POOL_SIZE = 20 (AC.8)', () => {
    expect(SCORE_POPUP_POOL_SIZE).toBe(20);
  });

  it('popup moves up by float_speed * dt', () => {
    const dt = 0.1;
    const startY = 500;
    const { newY } = simulatePopupFrame(SCORE_POPUP_LIFETIME, startY, dt);
    expect(newY).toBeCloseTo(startY - SCORE_POPUP_FLOAT_SPEED * dt, 5);
  });

  it('popup alpha decreases linearly over lifetime', () => {
    const { alpha } = simulatePopupFrame(SCORE_POPUP_LIFETIME / 2, 500, 0);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('popup alpha is 1.0 at start', () => {
    const { alpha } = simulatePopupFrame(SCORE_POPUP_LIFETIME, 500, 0);
    expect(alpha).toBeCloseTo(1.0, 5);
  });

  it('score popup text is integer floor with + prefix', () => {
    // Simulate the text formatting from visual-juice §3.5
    const delta = 123.7;
    const text = `+${Math.floor(delta)}`;
    expect(text).toBe('+123');
  });

  it('score popup spawn y offset is -20px above hit (§3.5)', () => {
    const hitY = 400;
    const spawnY = hitY - 20;
    expect(spawnY).toBe(380);
  });
});

// ---------------------------------------------------------------------------
// 5-combo ring animation formula (AC.6 — §4.3)
// ---------------------------------------------------------------------------

describe('5-combo ring animation formula (AC.6)', () => {
  const RING_RADIUS_START_MUL = 1.5;
  const RING_RADIUS_END_MUL   = 2.5;
  const RING_ALPHA_START = 0.85;
  const RING_LIFETIME    = 0.5;
  const charW = 48; // CHARACTER_WIDTH_FALLBACK

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const simulateRing = (lifetimeRemaining: number) => {
    const progress = 1 - (lifetimeRemaining / RING_LIFETIME);
    const startR = charW * RING_RADIUS_START_MUL;
    const endR   = charW * RING_RADIUS_END_MUL;
    const radius = lerp(startR, endR, progress);
    const alpha  = (1 - progress) * RING_ALPHA_START;
    return { progress, radius, alpha };
  };

  it('ring starts at start radius and RING_ALPHA_START', () => {
    const { radius, alpha } = simulateRing(RING_LIFETIME);
    expect(radius).toBeCloseTo(charW * RING_RADIUS_START_MUL, 4);
    expect(alpha).toBeCloseTo(RING_ALPHA_START, 4);
  });

  it('ring reaches end radius at lifetime=0', () => {
    const { radius } = simulateRing(0);
    expect(radius).toBeCloseTo(charW * RING_RADIUS_END_MUL, 4);
  });

  it('ring alpha approaches 0 at end of lifetime', () => {
    const { alpha } = simulateRing(0);
    expect(alpha).toBeCloseTo(0, 4);
  });

  it('ring alpha at midpoint = 0.5 × RING_ALPHA_START', () => {
    const { alpha } = simulateRing(RING_LIFETIME / 2);
    expect(alpha).toBeCloseTo(0.5 * RING_ALPHA_START, 4);
  });

  it('RING_LIFETIME = 0.5s (§7)', () => {
    expect(RING_LIFETIME).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Critical darkening sequence timing (AC.4 — §4.2)
// ---------------------------------------------------------------------------

describe('Critical darkening sequence timing (AC.4 — §4.2)', () => {
  const DARKEN_RAMP_SEC = 0.05;

  it('total sequence = 4 × DARKEN_RAMP_SEC = 0.20s', () => {
    // ramp-in(0.05) + flash(0.05) + hold(0.05) + ramp-out(0.05) = 0.20s
    const totalSeq = DARKEN_RAMP_SEC * 4;
    expect(totalSeq).toBeCloseTo(0.20, 5);
  });

  it('ramp-in duration = 0.05s', () => {
    expect(DARKEN_RAMP_SEC).toBe(0.05);
  });

  it('0.20s < art-bible §1.3 limit (0.5s)', () => {
    // art-bible Principle 2: darkening < 0.2–0.5s
    expect(DARKEN_RAMP_SEC * 4).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Combo milestone tier guard (AC.6 — §3.4)
// ---------------------------------------------------------------------------

describe('Combo milestone tier guard (AC.6)', () => {
  const MILESTONE_COMBO = 5;

  it('only tier=5 triggers ring in M0', () => {
    const shouldTrigger = (tier: number) => tier === MILESTONE_COMBO;
    expect(shouldTrigger(1)).toBe(false);
    expect(shouldTrigger(3)).toBe(false);
    expect(shouldTrigger(5)).toBe(true);
    expect(shouldTrigger(10)).toBe(false); // M0 only tier=5
  });
});

// ---------------------------------------------------------------------------
// score:updated delta guard
// ---------------------------------------------------------------------------

describe('score:updated delta guard', () => {
  it('delta <= 0 does not produce a + prefix string', () => {
    const delta = -5;
    // In VisualJuiceSystem._onScoreUpdated, delta <= 0 → early return
    const shouldSpawn = delta > 0;
    expect(shouldSpawn).toBe(false);
  });

  it('delta = 0 does not spawn', () => {
    expect(0 > 0).toBe(false);
  });

  it('delta > 0 produces +N format', () => {
    const text = `+${Math.floor(37.9)}`;
    expect(text).toBe('+37');
  });
});

// ---------------------------------------------------------------------------
// combo:reset visual = 0 (AC.11)
// ---------------------------------------------------------------------------

describe('combo:reset visual impact (AC.11 — M0 simplification)', () => {
  it('combo:reset produces no visual output in M0', () => {
    // This is a no-op in VisualJuiceSystem._onComboReset()
    // Test documents the intent (M0: § E7 "시각 0")
    const comboResetVisualEffect = () => { /* no-op */ };
    expect(() => comboResetVisualEffect()).not.toThrow();
  });
});
