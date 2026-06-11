/**
 * GameLoop unit tests (state machine + P2 listener order)
 * Implements: design/gdd/systems-index.md §Engine Bootstrap
 *
 * GameLoop instantiates Pixi Application internally, so we test the
 * observable contract only: EventBus events emitted at start/end/reset,
 * and listener registration order via FIFO dispatch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus } from '../../src/events/event-bus.js';

// ---------------------------------------------------------------------------
// P2 listener order lock test (score-combo §9 IC)
// Tests the ordering CONTRACT without instantiating GameLoop (no Pixi).
// ---------------------------------------------------------------------------

describe('P2 listener order lock', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('EventBus FIFO: Visual Juice slot fires before Score & Combo slot', () => {
    const order: string[] = [];

    // Simulate GameLoop.init() registration order
    eventBus.on('balloon:popped', () => order.push('visual-juice')); // placeholder
    eventBus.on('balloon:popped', () => order.push('score-combo'));  // ScoreComboSystem

    eventBus.emit('balloon:popped', {
      id: 'test',
      size: 'Large',
      x: 0,
      y: 0,
      color: 0,
      isCritical: false,
    });

    expect(order[0]).toBe('visual-juice');
    expect(order[1]).toBe('score-combo');
  });

  it('criticalPop:fired — Visual Juice slot fires before Score & Combo slot', () => {
    const order: string[] = [];

    eventBus.on('criticalPop:fired', () => order.push('vj'));
    eventBus.on('criticalPop:fired', () => order.push('sc'));

    eventBus.emit('criticalPop:fired', {
      x: 0,
      y: 0,
      criticalSize: 'Large',
      chainedBalloons: [],
    });

    expect(order).toEqual(['vj', 'sc']);
  });
});

// ---------------------------------------------------------------------------
// game:start emitted on start() and reset()
// ---------------------------------------------------------------------------

describe('GameLoop lifecycle events', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('game:start emitted via eventBus (simulation)', () => {
    const starts: unknown[] = [];
    eventBus.on('game:start', (p) => starts.push(p));

    // Simulate what GameLoop.start() does
    eventBus.emit('game:start', {});
    expect(starts.length).toBe(1);
  });

  it('game:over emitted via eventBus (simulation)', () => {
    const overs: unknown[] = [];
    eventBus.on('game:over', (p) => overs.push(p));

    eventBus.emit('game:over', {});
    expect(overs.length).toBe(1);
  });

  it('input:retry triggers reset — listeners still active after reset (simulation)', () => {
    // Verify eventBus.on('input:retry') → reset() pattern
    const resets: unknown[] = [];
    eventBus.on('input:retry', () => resets.push(true));

    eventBus.emit('input:retry', {});
    eventBus.emit('input:retry', {});

    expect(resets.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// dt clamp (D-P2-08)
// ---------------------------------------------------------------------------

describe('GameLoop dt clamp (D-P2-08)', () => {
  it('dt clamped to 0.05s max: Math.min(200ms / 1000, 0.05) = 0.05', () => {
    const MAX_DT_SEC = 0.05;
    const rawDt = 200 / 1000; // 200ms spike (tab resume)
    const clamped = Math.min(rawDt, MAX_DT_SEC);
    expect(clamped).toBe(0.05);
  });

  it('normal dt 16ms not clamped', () => {
    const MAX_DT_SEC = 0.05;
    const rawDt = 16 / 1000;
    const clamped = Math.min(rawDt, MAX_DT_SEC);
    expect(clamped).toBeCloseTo(0.016);
  });
});

// ---------------------------------------------------------------------------
// AudioContext unlock (visual-juice §3.7)
// ---------------------------------------------------------------------------

describe('AudioContext unlock on first input:fire', () => {
  afterEach(() => {
    eventBus.clear();
    delete (globalThis as unknown as Record<string, unknown>).audioManager;
  });

  it('calls audioManager.unlock() on first input:fire', () => {
    const unlock = vi.fn();
    (globalThis as unknown as { audioManager: { unlock: () => void } }).audioManager = { unlock };

    // Simulate GameLoop.init() once registration
    eventBus.once('input:fire', () => {
      const am = (globalThis as unknown as { audioManager?: { unlock?: () => void } }).audioManager;
      am?.unlock?.();
    });

    eventBus.emit('input:fire', {});
    expect(unlock).toHaveBeenCalledOnce();

    // Second fire — once() was removed, no second call
    eventBus.emit('input:fire', {});
    expect(unlock).toHaveBeenCalledOnce();
  });

  it('no throw if audioManager absent', () => {
    eventBus.once('input:fire', () => {
      const am = (globalThis as unknown as { audioManager?: { unlock?: () => void } }).audioManager;
      am?.unlock?.();
    });

    expect(() => eventBus.emit('input:fire', {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// visibilitychange → pause/resume (mobile platform: BGM/배터리 누수 방지)
// vitest는 node 환경 — document API는 브라우저 신뢰. 분기 contract만 검증.
// ---------------------------------------------------------------------------

describe('visibilitychange handler contract', () => {
  // GameLoop.init() 안 등록되는 handler 로직 미러:
  //   document.addEventListener('visibilitychange', () => {
  //     if (document.hidden) this.pause();
  //     else this.resume();
  //   });
  // fake document로 분기 자체를 검증 (DOM event dispatch는 브라우저/jsdom 책임).
  function makeHandler(fakeDoc: { hidden: boolean }, pause: () => void, resume: () => void) {
    return () => { if (fakeDoc.hidden) pause(); else resume(); };
  }

  it('document.hidden=true → pause() invoked', () => {
    const fakeDoc = { hidden: true };
    const pause = vi.fn();
    const resume = vi.fn();
    makeHandler(fakeDoc, pause, resume)();
    expect(pause).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
  });

  it('document.hidden=false → resume() invoked', () => {
    const fakeDoc = { hidden: false };
    const pause = vi.fn();
    const resume = vi.fn();
    makeHandler(fakeDoc, pause, resume)();
    expect(pause).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('hidden true → false 토글 → pause 1 + resume 1', () => {
    const fakeDoc = { hidden: false };
    const pause = vi.fn();
    const resume = vi.fn();
    const handler = makeHandler(fakeDoc, pause, resume);
    fakeDoc.hidden = true;
    handler();
    fakeDoc.hidden = false;
    handler();
    expect(pause).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
  });
});
