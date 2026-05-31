/**
 * RNG Wrapper — POP!
 *
 * Implements: systems-index §Conventions (RNG: rng wrapper 강제)
 * Design Doc: design/gdd/systems-index.md §Conventions
 *
 * All random numbers MUST pass through this module.
 * Math.random() direct calls are forbidden in game logic (vfx-only exception: visual-juice §3.2 vfxRandom).
 *
 * Three isolated domains prevent cross-contamination:
 *   spawn    — balloon spawn position, color, velocity
 *   critical — critical pop lottery
 *   powerup  — power-up selection (M1; stub in M0)
 *
 * Each domain uses a separate Mulberry32 PRNG instance so that
 * consuming spawn RNG does not shift the critical lottery sequence.
 *
 * Phase 2 Decision (D-P2-01): systems-index snippet used Math.random() directly.
 * Replaced with Mulberry32 seeded PRNG for determinism (AC.10 balloon-physics-split,
 * AC.8 critical-pop). vfxRandom for visual-only jitter is NOT in this module —
 * that belongs to Phase 3 technical-artist (visual-juice §3.2 vfxRandom).
 */

// ---------------------------------------------------------------------------
// Mulberry32 PRNG
// Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
// License: public domain
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Domain factory
// ---------------------------------------------------------------------------

interface RngDomain {
  /** Raw [0, 1) float */
  next(): number;
  /** Uniform integer in [min, max] inclusive */
  nextInt(min: number, max: number): number;
  /** true with probability p */
  nextBool(p?: number): boolean;
  /** Random element from array */
  nextChoice<T>(arr: T[]): T;
  /** Replace underlying PRNG with a new seeded instance */
  setSeed(seed: number): void;
}

function makeDomain(initialSeed: number): RngDomain {
  let rng = mulberry32(initialSeed);

  return {
    next() {
      return rng();
    },
    nextInt(min: number, max: number): number {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    nextBool(p = 0.5): boolean {
      return rng() < p;
    },
    nextChoice<T>(arr: T[]): T {
      return arr[Math.floor(rng() * arr.length)];
    },
    setSeed(seed: number): void {
      rng = mulberry32(seed);
    },
  };
}

// ---------------------------------------------------------------------------
// Public RNG object — three isolated domains
// ---------------------------------------------------------------------------

/**
 * Global RNG with three isolated domains.
 *
 * Usage:
 *   rng.spawn.nextInt(0, screenWidth)         // balloon spawn X
 *   rng.critical.nextBool(0.10)               // 10% critical lottery
 *   rng.powerup.nextChoice(['multi', 'bomb']) // power-up (M1)
 */
export const rng = {
  /** Balloon spawn domain: position, color, velocity */
  spawn: makeDomain(0xdeadbeef),
  /** Critical pop domain: lottery, pity resolution */
  critical: makeDomain(0xcafebabe),
  /** Power-up domain: selection (M1 stub) */
  powerup: makeDomain(0xfeedface),
};

export type { RngDomain };
