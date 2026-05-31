/**
 * EventBus unit tests (T-12 검증)
 * Implements: src/events/event-bus.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/events/event-bus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('on() — registers listener and receives payload', () => {
    const handler = vi.fn();
    bus.on('game:over', handler);
    bus.emit('game:over', {});
    expect(handler).toHaveBeenCalledOnce();
  });

  it('on() — FIFO dispatch order guaranteed', () => {
    const order: number[] = [];
    bus.on('game:start', () => order.push(1));
    bus.on('game:start', () => order.push(2));
    bus.on('game:start', () => order.push(3));
    bus.emit('game:start', {});
    expect(order).toEqual([1, 2, 3]);
  });

  it('emit() — delivers typed payload', () => {
    const handler = vi.fn();
    bus.on('score:updated', handler);
    bus.emit('score:updated', {
      totalScore: 100,
      delta: 10,
      combo: 3,
      size: 'Large',
      x: 50,
      y: 200,
      sizeMultiplier: 1.0,
      comboMultiplier: 1.2,
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ totalScore: 100, delta: 10, combo: 3 }),
    );
  });

  it('off() — removes listener; no further calls', () => {
    const handler = vi.fn();
    bus.on('game:over', handler);
    bus.off('game:over', handler);
    bus.emit('game:over', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() — fires exactly once then auto-removes', () => {
    const handler = vi.fn();
    bus.once('game:start', handler);
    bus.emit('game:start', {});
    bus.emit('game:start', {});
    expect(handler).toHaveBeenCalledOnce();
  });

  it('once() — can be cancelled via off() before first call', () => {
    const handler = vi.fn();
    bus.once('game:start', handler);
    bus.off('game:start', handler);
    bus.emit('game:start', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear(type) — removes all listeners for that type only', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('game:over', h1);
    bus.on('game:start', h2);
    bus.clear('game:over');
    bus.emit('game:over', {});
    bus.emit('game:start', {});
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('clear() — removes all listeners for all types', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('game:over', h1);
    bus.on('game:start', h2);
    bus.clear();
    bus.emit('game:over', {});
    bus.emit('game:start', {});
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('emit() with no listeners — does not throw', () => {
    expect(() => bus.emit('game:over', {})).not.toThrow();
  });

  it('once() mutation during iteration — snapshot prevents infinite loop', () => {
    // once() listeners remove themselves during emit; snapshot prevents issues
    const handler = vi.fn();
    bus.once('game:start', handler);
    expect(() => bus.emit('game:start', {})).not.toThrow();
    expect(handler).toHaveBeenCalledOnce();
  });
});
