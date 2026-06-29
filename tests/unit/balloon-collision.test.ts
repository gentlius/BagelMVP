import { describe, it, expect } from 'vitest';
import {
  resolveBalloonPair,
  resolveBalloonCollisions,
} from '../../src/systems/balloon-physics-split.js';

/**
 * Balloon-Balloon 속력 보존 바운스 — Unit Tests (D-P6-BBCOL-03)
 *
 * Implements: design/gdd/balloon-physics-split-system.md §3.10 / §4.4 / AC.26–30
 * Pure-function tests (no Pixi). 충돌 시 방향은 바뀌되 각 버블 속도 크기 |v| 는 보존.
 * mass ∝ radius² (큰 버블은 거의 직진, 작은 버블이 크게 튕김).
 */

interface TestBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
const mk = (x: number, y: number, vx = 0, vy = 0): TestBody => ({ x, y, vx, vy });
const dist = (a: TestBody, b: TestBody) => Math.hypot(b.x - a.x, b.y - a.y);
const speed = (b: TestBody) => Math.hypot(b.vx, b.vy);

describe('resolveBalloonPair: detection (AC.26 broad-phase)', () => {
  it('returns false when balloons do not overlap', () => {
    const a = mk(0, 0, 50, 60);
    const b = mk(100, 0, -50, -60);
    expect(resolveBalloonPair(a, 10, b, 10)).toBe(false);
    // untouched
    expect(a.x).toBe(0);
    expect(b.x).toBe(100);
    expect(a.vx).toBe(50);
    expect(b.vy).toBe(-60);
  });

  it('returns true when overlapping', () => {
    const a = mk(0, 0, 100, 0);
    const b = mk(15, 0); // dist 15 < sumR 20
    expect(resolveBalloonPair(a, 10, b, 10)).toBe(true);
  });

  it('E10: identical position (distSq=0) → no-op, no NaN, no crash (AC.30)', () => {
    const a = mk(50, 50, 100, 100);
    const b = mk(50, 50, -100, -100);
    expect(resolveBalloonPair(a, 10, b, 10)).toBe(false);
    expect(a.x).toBe(50);
    expect(b.x).toBe(50);
    expect(Number.isNaN(a.vx)).toBe(false);
    expect(Number.isNaN(b.vy)).toBe(false);
  });
});

describe('resolveBalloonPair: positional separation (AC.26 / AC.28)', () => {
  it('removes overlap — post-resolve distance ≥ sum of radii', () => {
    const a = mk(0, 0, 100, 0);
    const b = mk(12, 0, -100, 0); // sumR=20, overlap=8
    resolveBalloonPair(a, 10, b, 10);
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9);
  });

  it('inverse-mass weighting — lighter (smaller) balloon pushed more (AC.28)', () => {
    // a: r=40 (heavy, m=1600), b: r=10 (light, m=100); both stationary so only separation runs
    const a = mk(0, 0);
    const b = mk(45, 0); // sumR=50, overlap=5
    resolveBalloonPair(a, 40, b, 10);
    const moveA = Math.abs(a.x - 0);
    const moveB = Math.abs(b.x - 45);
    expect(moveB).toBeGreaterThan(moveA);
    expect(moveB / moveA).toBeCloseTo(1600 / 100, 4); // ∝ invMass
    expect(moveA + moveB).toBeCloseTo(5, 6); // total = overlap
  });
});

describe('resolveBalloonPair: speed-preserving bounce (AC.27 / D-P6-BBCOL-03)', () => {
  it('head-on equal mass: directions reverse, each speed preserved', () => {
    const a = mk(0, 0, 100, 0);
    const b = mk(15, 0, -100, 0); // approaching, n=(1,0)
    resolveBalloonPair(a, 10, b, 10);
    // speeds preserved
    expect(speed(a)).toBeCloseTo(100, 6);
    expect(speed(b)).toBeCloseTo(100, 6);
    // directions reversed
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('light ball into heavy stationary: light bounces back at full speed, heavy stays put', () => {
    // light a (r=10) at +200 hits heavy b (r=40) stationary
    const a = mk(0, 0, 200, 0);
    const b = mk(45, 0, 0, 0); // sumR=50, overlapping
    resolveBalloonPair(a, 10, b, 40);
    expect(speed(a)).toBeCloseTo(200, 4); // |v| preserved
    expect(a.vx).toBeLessThan(0); // reversed
    // heavy was stationary (speed 0) → speed preserved means it stays 0
    expect(speed(b)).toBeCloseTo(0, 6);
  });

  it('arbitrary 2D velocities: each speed magnitude preserved, direction changed', () => {
    const a = mk(0, 0, 137, -42);
    const b = mk(13, 5, -88, 19); // overlapping (dist≈13.9 < sumR 30), approaching
    const sa0 = speed(a);
    const sb0 = speed(b);
    const aDir0 = { x: a.vx, y: a.vy };
    resolveBalloonPair(a, 12, b, 18);
    expect(speed(a)).toBeCloseTo(sa0, 4); // |v_a| preserved
    expect(speed(b)).toBeCloseTo(sb0, 4); // |v_b| preserved
    // direction actually changed (not identical to pre-collision)
    const changed = Math.abs(a.vx - aDir0.x) > 1e-6 || Math.abs(a.vy - aDir0.y) > 1e-6;
    expect(changed).toBe(true);
  });

  it('mass ∝ r²: heavy balloon direction barely deflects vs light balloon', () => {
    // heavy a moving +x, light b stationary in its path → a should keep going mostly +x
    const a = mk(0, 0, 100, 0); // r=40 heavy
    const b = mk(45, 0, 0, 0); // r=10 light
    resolveBalloonPair(a, 40, b, 10);
    expect(speed(a)).toBeCloseTo(100, 4); // speed preserved
    expect(a.vx).toBeGreaterThan(0); // heavy keeps moving forward (barely deflected)
    // light ball was stationary → stays 0 (speed preserved)
    expect(speed(b)).toBeCloseTo(0, 6);
  });

  it('already separating (vrn ≤ 0): no velocity change, separation only', () => {
    // overlapping but moving apart (a left, b right)
    const a = mk(0, 0, -50, 0);
    const b = mk(15, 0, 50, 0);
    resolveBalloonPair(a, 10, b, 10);
    expect(a.vx).toBe(-50); // unchanged
    expect(b.vx).toBe(50);
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9); // still separated
  });
});

describe('resolveBalloonCollisions: spawn-immunity skip (AC.29 / E9)', () => {
  type IB = TestBody & { spawnImmunityRadius: number };
  const ib = (x: number, y: number, immunity = 0, vx = 0, vy = 0): IB => ({
    x,
    y,
    vx,
    vy,
    spawnImmunityRadius: immunity,
  });
  const r10 = () => 10;

  it('skips a pair when either balloon is still immune (split siblings overlapped)', () => {
    const left = ib(100, 100, 75, -120, -250);
    const right = ib(100, 100, 75, 120, -250);
    const before = { lx: left.x, rx: right.x, lvx: left.vx, rvx: right.vx };
    resolveBalloonCollisions([left, right], r10);
    expect(left.x).toBe(before.lx);
    expect(right.x).toBe(before.rx);
    expect(left.vx).toBe(before.lvx); // velocity untouched too
    expect(right.vx).toBe(before.rvx);
  });

  it('resolves normally once immunity has lifted (speed preserved)', () => {
    const a = ib(0, 0, 0, 200, 0);
    const b = ib(15, 0, 0, -200, 0); // overlapping, approaching, both immunity 0
    resolveBalloonCollisions([a, b], r10);
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9); // separated
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(200, 4); // |v| preserved
    expect(a.vx).toBeLessThan(0); // bounced
  });

  it('immune balloon is skipped even against a non-immune partner', () => {
    const immune = ib(0, 0, 75, 0, 0);
    const normal = ib(15, 0, 0, -200, 0); // would overlap immune
    resolveBalloonCollisions([immune, normal], r10);
    expect(immune.x).toBe(0); // immune untouched
    expect(normal.x).toBe(15);
    expect(normal.vx).toBe(-200);
  });

  it('onPairResolved fires once per overlapping resolved pair', () => {
    const a = ib(0, 0, 0, 100, 0);
    const b = ib(15, 0, 0, -100, 0); // overlap
    const c = ib(500, 0, 0); // far away
    const resolved: Array<[IB, IB]> = [];
    resolveBalloonCollisions([a, b, c], r10, (x, y) => resolved.push([x, y]));
    expect(resolved.length).toBe(1);
    expect(resolved[0][0]).toBe(a);
    expect(resolved[0][1]).toBe(b);
  });
});

describe('determinism (AC.10 preserved)', () => {
  it('same input → identical output across runs', () => {
    const run = () => {
      const a = mk(0, 0, 137, -42);
      const b = mk(13, 5, -88, 19);
      resolveBalloonPair(a, 12, b, 18);
      return { ax: a.x, ay: a.y, avx: a.vx, avy: a.vy, bx: b.x, by: b.y, bvx: b.vx, bvy: b.vy };
    };
    expect(run()).toEqual(run());
  });
});
