import { describe, it, expect } from 'vitest';
import {
  resolveBalloonPair,
  resolveBalloonCollisions,
  BALLOON_COLLISION_RESTITUTION,
  type CollisionBody,
} from '../../src/systems/balloon-physics-split.js';

/**
 * Balloon-Balloon 짐볼 탄성 충돌 — Unit Tests (D-P6-BBCOL-01)
 *
 * Implements: design/gdd/balloon-physics-split-system.md §3.10 / §4.4 / AC.26–30
 * Pure-function tests (no Pixi). mass ∝ radius², restitution = 0.9.
 */

type Body = CollisionBody;
const mk = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, vx, vy });
const dist = (a: Body, b: Body) => Math.hypot(b.x - a.x, b.y - a.y);
const E = BALLOON_COLLISION_RESTITUTION; // 0.9

describe('resolveBalloonPair: detection (AC.26 broad-phase)', () => {
  it('returns false when balloons do not overlap', () => {
    const a = mk(0, 0);
    const b = mk(100, 0);
    expect(resolveBalloonPair(a, 10, b, 10, E)).toBe(false);
    // untouched
    expect(a.x).toBe(0);
    expect(b.x).toBe(100);
  });

  it('returns true when overlapping', () => {
    const a = mk(0, 0);
    const b = mk(15, 0); // dist 15 < sumR 20
    expect(resolveBalloonPair(a, 10, b, 10, E)).toBe(true);
  });

  it('E10: identical position (distSq=0) → no-op, no NaN, no crash (AC.30)', () => {
    const a = mk(50, 50, 100, 100);
    const b = mk(50, 50, -100, -100);
    expect(resolveBalloonPair(a, 10, b, 10, E)).toBe(false);
    // velocities/positions unchanged, no NaN
    expect(a.x).toBe(50);
    expect(b.x).toBe(50);
    expect(Number.isNaN(a.vx)).toBe(false);
    expect(Number.isNaN(b.vy)).toBe(false);
  });
});

describe('resolveBalloonPair: positional separation (AC.26)', () => {
  it('removes overlap — post-resolve distance ≥ sum of radii', () => {
    const a = mk(0, 0);
    const b = mk(12, 0); // sumR=20, overlap=8
    resolveBalloonPair(a, 10, b, 10, E);
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9);
  });

  it('equal mass → symmetric push (each moves half the overlap)', () => {
    const a = mk(0, 0);
    const b = mk(12, 0); // overlap 8 → each moves 4
    resolveBalloonPair(a, 10, b, 10, E);
    expect(a.x).toBeCloseTo(-4, 6);
    expect(b.x).toBeCloseTo(16, 6);
  });

  it('inverse-mass weighting — lighter (smaller) balloon moves more', () => {
    // a: r=40 (heavy, m=1600), b: r=10 (light, m=100)
    const a = mk(0, 0);
    const b = mk(45, 0); // sumR=50, overlap=5
    resolveBalloonPair(a, 40, b, 10, E);
    const moveA = Math.abs(a.x - 0);
    const moveB = Math.abs(b.x - 45);
    // invA=1/1600, invB=1/100 → b moves 16× more than a
    expect(moveB).toBeGreaterThan(moveA);
    expect(moveB / moveA).toBeCloseTo(1600 / 100, 4);
    // total separation = overlap
    expect(moveA + moveB).toBeCloseTo(5, 6);
  });
});

describe('resolveBalloonPair: velocity exchange (AC.27)', () => {
  it('head-on approach → relative normal velocity reverses (separating after)', () => {
    // b stationary at right, a moving right into it (approaching)
    const a = mk(0, 0, 200, 0);
    const b = mk(15, 0, 0, 0); // overlapping, n=(1,0)
    const vrnBefore = (a.vx - b.vx) * 1; // along +x normal = +200 (approaching)
    expect(vrnBefore).toBeGreaterThan(0);
    resolveBalloonPair(a, 10, b, 10, E);
    const vrnAfter = a.vx - b.vx;
    expect(vrnAfter).toBeLessThan(0); // now separating
  });

  it('equal mass head-on: relative speed scales by restitution (|vrn_after| = e·|vrn_before|)', () => {
    const a = mk(0, 0, 200, 0);
    const b = mk(15, 0, 0, 0);
    resolveBalloonPair(a, 10, b, 10, E);
    const vrnAfter = Math.abs(a.vx - b.vx);
    expect(vrnAfter).toBeCloseTo(E * 200, 4);
  });

  it('mass ratio ∝ r²: heavy balloon Δv ≪ light balloon Δv', () => {
    // light a (r=10) hits heavy b (r=40) which is stationary
    const a = mk(0, 0, 200, 0);
    const b = mk(45, 0, 0, 0); // sumR=50, overlapping at 45
    const va0 = a.vx;
    const vb0 = b.vx;
    resolveBalloonPair(a, 10, b, 40, E);
    const dvA = Math.abs(a.vx - va0);
    const dvB = Math.abs(b.vx - vb0);
    // invA=1/100, invB=1/1600 → a's Δv is 16× b's Δv
    expect(dvA).toBeGreaterThan(dvB);
    expect(dvA / dvB).toBeCloseTo(1600 / 100, 4);
  });

  it('already separating (vrn ≤ 0) → no velocity change, separation only', () => {
    // overlapping but moving apart (a left, b right)
    const a = mk(0, 0, -50, 0);
    const b = mk(15, 0, 50, 0);
    const va0 = a.vx;
    const vb0 = b.vx;
    resolveBalloonPair(a, 10, b, 10, E);
    expect(a.vx).toBe(va0); // unchanged
    expect(b.vx).toBe(vb0);
    // but still separated positionally
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9);
  });
});

describe('resolveBalloonPair: conservation (AC.28)', () => {
  it('conserves linear momentum (mass ∝ r²) on head-on collision', () => {
    const ra = 10;
    const rb = 40;
    const ma = ra * ra; // 100
    const mb = rb * rb; // 1600
    const a = mk(0, 0, 200, 30);
    const b = mk(45, 0, -50, 10);
    const pBefore = ma * a.vx + mb * b.vx;
    const pyBefore = ma * a.vy + mb * b.vy;
    resolveBalloonPair(a, ra, b, rb, E);
    const pAfter = ma * a.vx + mb * b.vx;
    const pyAfter = ma * a.vy + mb * b.vy;
    expect(pAfter).toBeCloseTo(pBefore, 4);
    expect(pyAfter).toBeCloseTo(pyBefore, 4);
  });

  it('e=0.9 (<1) → kinetic energy decreases (inelastic-ish, not energy-conserving)', () => {
    const ra = 10;
    const rb = 10;
    const ma = ra * ra;
    const mb = rb * rb;
    const a = mk(0, 0, 200, 0);
    const b = mk(15, 0, 0, 0);
    const keBefore = 0.5 * ma * a.vx ** 2 + 0.5 * mb * b.vx ** 2;
    resolveBalloonPair(a, ra, b, rb, E);
    const keAfter = 0.5 * ma * a.vx ** 2 + 0.5 * mb * b.vx ** 2;
    expect(keAfter).toBeLessThan(keBefore);
  });
});

describe('resolveBalloonCollisions: spawn-immunity skip (AC.29 / E9)', () => {
  type IB = Body & { spawnImmunityRadius: number };
  const ib = (x: number, y: number, immunity = 0, vx = 0, vy = 0): IB => ({
    x,
    y,
    vx,
    vy,
    spawnImmunityRadius: immunity,
  });
  const r10 = () => 10;

  it('skips a pair when either balloon is still immune (split siblings overlapped)', () => {
    // two siblings spawned at near-identical position, both immune
    const left = ib(100, 100, 75, -120, -250);
    const right = ib(100, 100, 75, 120, -250);
    const before = { lx: left.x, rx: right.x, lvx: left.vx, rvx: right.vx };
    resolveBalloonCollisions([left, right], r10, E);
    // untouched — no explosive separation
    expect(left.x).toBe(before.lx);
    expect(right.x).toBe(before.rx);
    expect(left.vx).toBe(before.lvx);
    expect(right.vx).toBe(before.rvx);
  });

  it('resolves normally once immunity has lifted', () => {
    const a = ib(0, 0, 0, 200, 0);
    const b = ib(15, 0, 0, 0, 0); // overlapping, both immunity 0
    resolveBalloonCollisions([a, b], r10, E);
    expect(dist(a, b)).toBeGreaterThanOrEqual(20 - 1e-9); // separated
    expect(a.vx - b.vx).toBeLessThan(0); // velocity exchanged
  });

  it('immune balloon is skipped even against a non-immune partner', () => {
    const immune = ib(0, 0, 75, 0, 0);
    const normal = ib(15, 0, 0, -200, 0); // would overlap immune
    resolveBalloonCollisions([immune, normal], r10, E);
    expect(immune.x).toBe(0); // immune untouched
    expect(normal.x).toBe(15);
    expect(normal.vx).toBe(-200);
  });

  it('onPairResolved fires once per overlapping resolved pair', () => {
    const a = ib(0, 0, 0);
    const b = ib(15, 0, 0); // overlap
    const c = ib(500, 0, 0); // far away
    const resolved: Array<[IB, IB]> = [];
    resolveBalloonCollisions([a, b, c], r10, E, (x, y) => resolved.push([x, y]));
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
      resolveBalloonPair(a, 12, b, 18, E);
      return { ax: a.x, ay: a.y, avx: a.vx, avy: a.vy, bx: b.x, by: b.y, bvx: b.vx, bvy: b.vy };
    };
    expect(run()).toEqual(run());
  });
});
