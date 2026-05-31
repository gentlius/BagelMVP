/**
 * Cross-system integration tests — EventBus event chain
 *
 * Verifies end-to-end event propagation across ScoreComboSystem + CriticalPopSystem
 * without instantiating Pixi (no BalloonPhysicsSplitSystem, no renderer).
 *
 * Scenario covered:
 *   balloon:popped → score:updated (score chain)
 *   criticalPop:fired → score:updated (critical chain) + combo:milestone (at 5 combo)
 *   frame-guard: chained balloon:popped ignored after criticalPop:fired same frame
 *   P2 listener order: visual-juice slot fires before score:updated listener
 *
 * Story type: Integration (cross-system event propagation)
 * Gate level: BLOCKING
 * Test file: tests/integration/cross-system/event-chain.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eventBus } from '../../../src/events/event-bus.js';
import {
  ScoreComboSystem,
  BASE_SCORE,
  SIZE_MULTIPLIER,
  COMBO_RESET_SEC,
  MILESTONE_COMBO,
} from '../../../src/systems/score-combo.js';
import type {
  ScoreUpdatedPayload,
  ComboMilestonePayload,
  ComboResetPayload,
} from '../../../src/events/event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScoreSystem(): ScoreComboSystem {
  const s = new ScoreComboSystem();
  s.attachListeners();
  return s;
}

function emitPop(id: string, size: 'Large' | 'Medium' | 'Small' = 'Large', isCritical = false) {
  eventBus.emit('balloon:popped', { id, size, x: 0, y: 0, color: 0, isCritical });
}

function emitCritical(
  criticalSize: 'Large' | 'Medium' | 'Small',
  chainedIds: Array<{ id: string; size: 'Large' | 'Medium' | 'Small' }>,
) {
  eventBus.emit('criticalPop:fired', {
    x: 0,
    y: 0,
    criticalSize,
    chainedBalloons: chainedIds.map(({ id, size }) => ({ id, x: 0, y: 0, size, color: 0 })),
  });
}

// ---------------------------------------------------------------------------
// Scenario 1: balloon:popped → score:updated chain
// ---------------------------------------------------------------------------

describe('Integration: balloon:popped → score:updated chain', () => {
  let system: ScoreComboSystem;
  let scores: ScoreUpdatedPayload[];

  beforeEach(() => {
    eventBus.clear();
    system = makeScoreSystem();
    scores = [];
    eventBus.on('score:updated', (p) => scores.push(p));
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('single Large pop produces score:updated with correct delta', () => {
    emitPop('b1', 'Large');

    expect(scores.length).toBe(1);
    expect(scores[0].delta).toBe(BASE_SCORE * SIZE_MULTIPLIER.Large); // 10
    expect(scores[0].combo).toBe(1);
    expect(scores[0].totalScore).toBe(scores[0].delta);
  });

  it('3-pop sequence accumulates score monotonically', () => {
    emitPop('b1', 'Large');
    emitPop('b2', 'Medium');
    emitPop('b3', 'Small');

    expect(scores.length).toBe(3);
    expect(scores[2].totalScore).toBeGreaterThan(scores[1].totalScore);
    expect(scores[2].combo).toBe(3);
    // Combo multiplier should increase each step
    expect(scores[1].comboMultiplier).toBeGreaterThan(scores[0].comboMultiplier);
  });

  it('combo resets after COMBO_RESET_SEC — score:updated restarts with combo=1', () => {
    const resets: ComboResetPayload[] = [];
    eventBus.on('combo:reset', (p) => resets.push(p));

    emitPop('b1', 'Large');
    emitPop('b2', 'Large');
    expect(system.getCombo()).toBe(2);

    system.update(COMBO_RESET_SEC + 0.01); // trigger reset
    expect(resets.length).toBe(1);
    expect(resets[0].finalCombo).toBe(2);

    emitPop('b3', 'Large');
    expect(scores[2].combo).toBe(1); // restarted
    expect(system.getCombo()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: criticalPop:fired → score chain + combo:milestone
// ---------------------------------------------------------------------------

describe('Integration: criticalPop:fired → score + milestone chain', () => {
  let system: ScoreComboSystem;
  let scores: ScoreUpdatedPayload[];
  let milestones: ComboMilestonePayload[];

  beforeEach(() => {
    eventBus.clear();
    system = makeScoreSystem();
    scores = [];
    milestones = [];
    eventBus.on('score:updated', (p) => scores.push(p));
    eventBus.on('combo:milestone', (p) => milestones.push(p));
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('critical + 2 chained → 3 score:updated, combo=3, no milestone', () => {
    emitCritical('Large', [{ id: 'c1', size: 'Medium' }, { id: 'c2', size: 'Small' }]);

    expect(scores.length).toBe(3);
    expect(system.getCombo()).toBe(3);
    expect(milestones.length).toBe(0);
  });

  it('3 normal pops + critical + 1 chained crosses milestone=5', () => {
    emitPop('n1'); emitPop('n2'); emitPop('n3');
    expect(system.getCombo()).toBe(3);

    emitCritical('Large', [{ id: 'ch1', size: 'Medium' }]);
    // 3 + 2 = 5 total → milestone
    expect(system.getCombo()).toBe(5);
    expect(milestones.length).toBe(1);
    expect(milestones[0].tier).toBe(MILESTONE_COMBO);
  });

  it('critical + 3 chained at combo=0 → 4 score:updated emitted', () => {
    emitCritical('Medium', [
      { id: 'ch1', size: 'Small' },
      { id: 'ch2', size: 'Small' },
      { id: 'ch3', size: 'Small' },
    ]);

    expect(scores.length).toBe(4); // body + 3 chained
    expect(system.getCombo()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: frame-guard — duplicate balloon:popped ignored after criticalPop:fired
// ---------------------------------------------------------------------------

describe('Integration: frame-guard prevents duplicate scoring (M-SC-1)', () => {
  let system: ScoreComboSystem;
  let scores: ScoreUpdatedPayload[];

  beforeEach(() => {
    eventBus.clear();
    system = makeScoreSystem();
    scores = [];
    eventBus.on('score:updated', (p) => scores.push(p));
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('chained balloon:popped(same id) in same frame does NOT score twice', () => {
    emitCritical('Large', [{ id: 'chain1', size: 'Medium' }]);
    emitPop('chain1', 'Medium'); // same id, same frame — must be ignored

    expect(scores.length).toBe(2); // body + chained once = 2, NOT 3
    expect(system.getCombo()).toBe(2);
  });

  it('non-chained balloon:popped(different id) in same frame scores normally', () => {
    emitCritical('Large', [{ id: 'chain1', size: 'Medium' }]);
    emitPop('other', 'Small'); // different id — should score

    expect(scores.length).toBe(3); // body + chained + other = 3
    expect(system.getCombo()).toBe(3);
  });

  it('same id usable again after system.update() clears frame-guard', () => {
    emitCritical('Large', [{ id: 'reuse', size: 'Small' }]);
    emitPop('reuse'); // same frame — ignored

    system.update(0.016); // advance one frame

    emitPop('reuse', 'Large'); // next frame — should score
    expect(scores.length).toBe(3); // body + chained + reuse(next frame) = 3
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: P2 listener order — visual-juice slot fires before score:updated
// ---------------------------------------------------------------------------

describe('Integration: P2 listener order across score + visual-juice slots', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('visual-juice listener registered first fires before score:updated listener', () => {
    const dispatchOrder: string[] = [];

    // Simulate GameLoop.init() FIFO registration order
    eventBus.on('balloon:popped', () => dispatchOrder.push('visual-juice'));
    eventBus.on('balloon:popped', () => dispatchOrder.push('score-combo'));

    emitPop('ord1');

    expect(dispatchOrder[0]).toBe('visual-juice');
    expect(dispatchOrder[1]).toBe('score-combo');
  });

  it('criticalPop:fired: visual-juice slot fires before score:updated in chain', () => {
    const dispatchOrder: string[] = [];

    eventBus.on('criticalPop:fired', () => dispatchOrder.push('visual-juice'));

    const system = makeScoreSystem();
    const scores: ScoreUpdatedPayload[] = [];
    eventBus.on('score:updated', (p) => {
      dispatchOrder.push('score');
      scores.push(p);
    });

    emitCritical('Large', []);

    // visual-juice must appear before any score:updated
    const vjIndex = dispatchOrder.indexOf('visual-juice');
    const scoreIndex = dispatchOrder.indexOf('score');
    expect(vjIndex).toBeLessThan(scoreIndex);

    void system;
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: game:start → game:over lifecycle integration
// ---------------------------------------------------------------------------

describe('Integration: game lifecycle events', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('game:start emitted with empty payload', () => {
    const starts: unknown[] = [];
    eventBus.on('game:start', (p) => starts.push(p));

    eventBus.emit('game:start', {});
    expect(starts.length).toBe(1);
  });

  it('game:over emitted with empty payload', () => {
    const overs: unknown[] = [];
    eventBus.on('game:over', (p) => overs.push(p));

    eventBus.emit('game:over', {});
    expect(overs.length).toBe(1);
  });

  it('input:retry → score system reset reachable via eventBus chain', () => {
    const system = makeScoreSystem();

    // Build up some state
    emitPop('pre1'); emitPop('pre2');
    expect(system.getCombo()).toBe(2);
    expect(system.getTotalScore()).toBeGreaterThan(0);

    // RETRY chain: GameLoop listens to input:retry → calls system.reset()
    eventBus.on('input:retry', () => system.reset());
    eventBus.emit('input:retry', {});

    expect(system.getCombo()).toBe(0);
    expect(system.getTotalScore()).toBe(0);
  });
});
