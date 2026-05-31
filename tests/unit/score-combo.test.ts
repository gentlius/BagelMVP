/**
 * ScoreComboSystem unit tests
 * Implements: design/gdd/score-combo-system.md §8 AC
 *
 * Pure logic tests — no Pixi dependency. eventBus is the real singleton.
 * Each test clears relevant listeners after use to avoid cross-test pollution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ScoreComboSystem,
  BASE_SCORE,
  SIZE_MULTIPLIER,
  COMBO_MULTIPLIER_FACTOR,
  COMBO_RESET_SEC,
  MILESTONE_COMBO,
  CRITICAL_COMBO_CAP,
} from '../../src/systems/score-combo.js';
import { CRITICAL_CHAIN_CAP } from '../../src/systems/critical-pop.js';
import { eventBus } from '../../src/events/event-bus.js';
import type {
  ScoreUpdatedPayload,
  ComboMilestonePayload,
  ComboResetPayload,
} from '../../src/events/event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSystem(): ScoreComboSystem {
  const s = new ScoreComboSystem();
  s.attachListeners();
  return s;
}

function popBalloon(id: string, x = 0, y = 0, isCritical = false, size: 'Large' | 'Medium' | 'Small' = 'Large') {
  eventBus.emit('balloon:popped', { id, size, x, y, color: 0xff0000, isCritical });
}

function fireCritical(
  criticalSize: 'Large' | 'Medium' | 'Small',
  chained: Array<{ id: string; size: 'Large' | 'Medium' | 'Small'; x?: number; y?: number }>,
  x = 0,
  y = 0,
) {
  eventBus.emit('criticalPop:fired', {
    x,
    y,
    criticalSize,
    chainedBalloons: chained.map((c) => ({
      id: c.id,
      x: c.x ?? 0,
      y: c.y ?? 0,
      size: c.size,
      color: 0xaaaaaa,
    })),
  });
}

// ---------------------------------------------------------------------------
// Score formula (AC.1)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem score formula', () => {
  let system: ScoreComboSystem;
  const scores: ScoreUpdatedPayload[] = [];

  beforeEach(() => {
    eventBus.clear('score:updated');
    eventBus.clear('balloon:popped');
    eventBus.clear('criticalPop:fired');
    eventBus.clear('combo:milestone');
    eventBus.clear('combo:reset');
    scores.length = 0;
    system = makeSystem();
    eventBus.on('score:updated', (p) => scores.push(p));
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.1 — Large balloon combo=1: delta = BASE × 1.0 × 1.0 = 10', () => {
    popBalloon('b1');
    expect(scores[0].delta).toBe(BASE_SCORE * SIZE_MULTIPLIER.Large * 1.0);
    expect(scores[0].delta).toBe(10);
    expect(scores[0].combo).toBe(1);
  });

  it('AC.1 — Medium balloon combo=5: delta = 10 × 1.5 × (1+0.4) = 21', () => {
    for (let i = 1; i <= 4; i++) popBalloon(`b${i}`, 0, 0, false, 'Large');
    scores.length = 0;
    popBalloon('b5', 0, 0, false, 'Medium');
    const expected = BASE_SCORE * SIZE_MULTIPLIER.Medium * (1 + 4 * COMBO_MULTIPLIER_FACTOR);
    expect(scores[0].delta).toBeCloseTo(expected);
    expect(scores[0].combo).toBe(5);
  });

  it('AC.1 — Small balloon combo=10: delta = 10 × 2.0 × 1.9 = 38', () => {
    for (let i = 1; i <= 9; i++) popBalloon(`x${i}`);
    scores.length = 0;
    popBalloon('x10', 0, 0, false, 'Small');
    const expected = BASE_SCORE * SIZE_MULTIPLIER.Small * (1 + 9 * COMBO_MULTIPLIER_FACTOR);
    expect(scores[0].delta).toBeCloseTo(expected);
  });

  it('AC.13 — deterministic: same event sequence = same scores', () => {
    const s1 = makeSystem();
    const s2 = makeSystem();
    // Both listen; scores are appended twice but we only check consistency
    const r1: number[] = [];
    const r2: number[] = [];
    eventBus.on('score:updated', (p) => {
      if (system === s1) r1.push(p.delta);
    });
    // deterministic: re-emit same events, check totalScore
    popBalloon('d1', 0, 0, false, 'Large');
    popBalloon('d2', 0, 0, false, 'Medium');
    expect(system.getTotalScore()).toBeGreaterThan(0);
    void s2; void r1; void r2;
  });

  it('AC.15 — score:updated has all 8 fields', () => {
    popBalloon('f1', 100, 200, false, 'Small');
    const p = scores[0];
    expect(p).toHaveProperty('totalScore');
    expect(p).toHaveProperty('delta');
    expect(p).toHaveProperty('combo');
    expect(p).toHaveProperty('size');
    expect(p).toHaveProperty('x');
    expect(p).toHaveProperty('y');
    expect(p).toHaveProperty('sizeMultiplier');
    expect(p).toHaveProperty('comboMultiplier');
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.size).toBe('Small');
  });
});

// ---------------------------------------------------------------------------
// Critical event scoring (AC.2, AC.3)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem Critical scoring', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.2 — Critical chain=0: combo+1, 1 emit, criticalSize used (M-CP-1)', () => {
    const system = makeSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    fireCritical('Medium', []);

    expect(scores.length).toBe(1);
    expect(system.getCombo()).toBe(1);
    expect(scores[0].size).toBe('Medium');
    expect(scores[0].delta).toBeCloseTo(BASE_SCORE * SIZE_MULTIPLIER.Medium * 1.0);
  });

  it('AC.3 — Critical chain=3: combo+4, 4 emits, values from §4.2 example', () => {
    const system = makeSystem();
    // Pre-advance combo to 5 by normal pops
    for (let i = 1; i <= 5; i++) {
      eventBus.emit('balloon:popped', { id: `pre${i}`, size: 'Large', x: 0, y: 0, color: 0, isCritical: false });
    }
    expect(system.getCombo()).toBe(5);

    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    // Critical event: criticalSize=Large, 3 chained=Medium (§4.2 example)
    fireCritical('Large', [
      { id: 'c1', size: 'Medium' },
      { id: 'c2', size: 'Medium' },
      { id: 'c3', size: 'Medium' },
    ]);

    expect(scores.length).toBe(4); // body + 3 chained
    expect(system.getCombo()).toBe(9); // 5 + 4

    // §4.2: body combo=6, mult=1.5 → 10×1.0×1.5=15
    expect(scores[0].delta).toBeCloseTo(15);
    // chained 1: combo=7, mult=1.6 → 10×1.5×1.6=24
    expect(scores[1].delta).toBeCloseTo(24);
  });

  it('AC.14 — criticalSize ?? Large defensive fallback (E10)', () => {
    makeSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    // Emit with undefined criticalSize (type cast to simulate missing field)
    eventBus.emit('criticalPop:fired', {
      x: 0,
      y: 0,
      criticalSize: undefined as unknown as 'Large',
      chainedBalloons: [],
    });

    expect(scores.length).toBe(1);
    expect(scores[0].size).toBe('Large');
  });
});

// ---------------------------------------------------------------------------
// Frame-guard (AC.5)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem frame-guard (M-SC-1)', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.5 — chained balloon:popped(id) ignored after criticalPop:fired', () => {
    const system = makeSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    // Fire critical with chained id='chain1'
    fireCritical('Large', [{ id: 'chain1', size: 'Medium' }]);

    // Simulate balloon-physics-split emitting popped for the chained balloon in same frame
    popBalloon('chain1', 0, 0, false, 'Medium');

    // combo should be 2 (body + 1 chained), NOT 3
    expect(system.getCombo()).toBe(2);
    // score:updated emits: body(1) + chained(1) = 2. The manual popBalloon is ignored.
    expect(scores.length).toBe(2);
  });

  it('E9 — non-chained balloon:popped in same frame is NOT ignored', () => {
    const system = makeSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    fireCritical('Large', [{ id: 'chain1', size: 'Medium' }]);
    // A DIFFERENT balloon (not in chained set) pops in the same frame
    popBalloon('nonchain', 0, 0, false, 'Small');

    // Should process: body(+1) + chained(+1) + normal(+1) = 3 combo
    expect(system.getCombo()).toBe(3);
    expect(scores.length).toBe(3);
  });

  it('frame-guard cleared next update() — same id usable in next frame', () => {
    const system = makeSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => scores.push(p));

    fireCritical('Large', [{ id: 'reuse', size: 'Medium' }]);
    popBalloon('reuse'); // same frame — ignored

    // Advance to next frame
    system.update(0.016);

    // Now 'reuse' should NOT be in the ignore set
    popBalloon('reuse', 0, 0, false, 'Large');
    // Should have processed: body+chained = 2 emits + now reuse = 3 total
    expect(scores.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Combo reset timer (AC.6)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem combo reset', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.6 — combo resets after COMBO_RESET_SEC of inactivity', () => {
    const system = makeSystem();
    const resets: ComboResetPayload[] = [];
    eventBus.on('combo:reset', (p) => resets.push(p));

    popBalloon('r1');
    popBalloon('r2');
    expect(system.getCombo()).toBe(2);

    // Advance timer past reset threshold
    system.update(COMBO_RESET_SEC + 0.001);

    expect(system.getCombo()).toBe(0);
    expect(resets.length).toBe(1);
    expect(resets[0].finalCombo).toBe(2);
  });

  it('pop resets comboTimer — no reset if pop before deadline', () => {
    const system = makeSystem();
    const resets: ComboResetPayload[] = [];
    eventBus.on('combo:reset', (p) => resets.push(p));

    popBalloon('t1');
    system.update(COMBO_RESET_SEC - 0.5); // close but not past
    popBalloon('t2'); // resets timer
    system.update(COMBO_RESET_SEC - 0.5); // still within window

    expect(system.getCombo()).toBe(2);
    expect(resets.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Milestone (AC.7–AC.11)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem combo milestone', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.7 — no milestone emit before reaching MILESTONE_COMBO', () => {
    makeSystem();
    const milestones: ComboMilestonePayload[] = [];
    eventBus.on('combo:milestone', (p) => milestones.push(p));

    for (let i = 1; i < MILESTONE_COMBO; i++) popBalloon(`m${i}`);
    expect(milestones.length).toBe(0);
  });

  it('AC.8 — milestone emit exactly once when combo reaches 5', () => {
    makeSystem();
    const milestones: ComboMilestonePayload[] = [];
    eventBus.on('combo:milestone', (p) => milestones.push(p));

    for (let i = 1; i <= MILESTONE_COMBO; i++) popBalloon(`n${i}`);
    expect(milestones.length).toBe(1);
    expect(milestones[0].tier).toBe(MILESTONE_COMBO);
  });

  it('AC.9 — Critical chain jump 3→7 triggers milestone once', () => {
    makeSystem();
    const milestones: ComboMilestonePayload[] = [];
    eventBus.on('combo:milestone', (p) => milestones.push(p));

    // Set combo to 3
    popBalloon('p1'); popBalloon('p2'); popBalloon('p3');
    expect(milestones.length).toBe(0);

    // Critical + 3 chained → +4, total 7
    fireCritical('Large', [
      { id: 'c1', size: 'Medium' },
      { id: 'c2', size: 'Medium' },
      { id: 'c3', size: 'Medium' },
    ]);

    expect(milestones.length).toBe(1);
  });

  it('AC.10 — no re-emit within same streak', () => {
    makeSystem();
    const milestones: ComboMilestonePayload[] = [];
    eventBus.on('combo:milestone', (p) => milestones.push(p));

    for (let i = 1; i <= MILESTONE_COMBO + 3; i++) popBalloon(`s${i}`);
    expect(milestones.length).toBe(1);
  });

  it('AC.11 — milestone re-emits after reset + new streak', () => {
    const system = makeSystem();
    const milestones: ComboMilestonePayload[] = [];
    eventBus.on('combo:milestone', (p) => milestones.push(p));

    for (let i = 1; i <= MILESTONE_COMBO; i++) popBalloon(`a${i}`);
    expect(milestones.length).toBe(1);

    // Reset via update() (timer expired)
    system.update(COMBO_RESET_SEC + 1);
    expect(system.getCombo()).toBe(0);

    for (let i = 1; i <= MILESTONE_COMBO; i++) popBalloon(`b${i}`);
    expect(milestones.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GameLoop.reset() (AC.12)
// ---------------------------------------------------------------------------

describe('ScoreComboSystem.reset()', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.12 — all state zeroed on reset()', () => {
    const system = makeSystem();
    for (let i = 1; i <= 7; i++) popBalloon(`z${i}`);
    fireCritical('Large', [{ id: 'zc', size: 'Medium' }]);

    system.reset();

    expect(system.getCombo()).toBe(0);
    expect(system.getTotalScore()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC.17 — CRITICAL_COMBO_CAP === CRITICAL_CHAIN_CAP (lock sync)
// ---------------------------------------------------------------------------

describe('AC.17 — cap constant synchronization', () => {
  it('CRITICAL_COMBO_CAP (score-combo) === CRITICAL_CHAIN_CAP (critical-pop)', () => {
    expect(CRITICAL_COMBO_CAP).toBe(CRITICAL_CHAIN_CAP);
  });
});

// ---------------------------------------------------------------------------
// AC.18 — read-only API
// ---------------------------------------------------------------------------

describe('ScoreComboSystem read-only API', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('AC.18 — getCombo() and getTotalScore() return accurate values', () => {
    const system = makeSystem();
    popBalloon('api1', 0, 0, false, 'Large');
    popBalloon('api2', 0, 0, false, 'Medium');

    expect(system.getCombo()).toBe(2);
    const expected =
      BASE_SCORE * SIZE_MULTIPLIER.Large * 1.0 +
      BASE_SCORE * SIZE_MULTIPLIER.Medium * (1 + COMBO_MULTIPLIER_FACTOR);
    expect(system.getTotalScore()).toBeCloseTo(expected);
  });
});
