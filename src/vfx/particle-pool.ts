/**
 * ParticlePool — POP! VFX
 *
 * Pop particle pool backed by Pixi v8 ParticleContainer.
 * FIFO eviction at POP_PARTICLE_CAP (200).
 * visual-juice-system.md §3.2 + §4.1
 *
 * Design: technical-artist
 * Dependency: pixi.js v8 ParticleContainer + Sprite
 */

import { Container, Sprite, Texture, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tuning knobs — visual-juice §7
// ---------------------------------------------------------------------------

// D-P6-SPLIT-01: 5단계 분열 — XL/XS particle count 추가
export const POP_PARTICLE_COUNT = {
  XL: 50,         // 큰 풍선 = 풍부한 파티클
  Large: 30,
  Medium: 20,
  Small: 10,
  XS: 6,          // 작은 풍선 = 가벼운 파티클
  CriticalBody: 50,
} as const;

export const POP_PARTICLE_SPEED_MIN = 80;  // px/s
export const POP_PARTICLE_SPEED_MAX = 200; // px/s
export const POP_PARTICLE_LIFETIME  = 1.2; // s — D-P6-SHARD-01 (사용자 인지) 0.5 → 1.2
export const POP_PARTICLE_CAP       = 200; // FIFO game code cap (= ParticleContainer maxSize)

// ---------------------------------------------------------------------------
// Particle state (runtime fields hung on Sprite)
// ---------------------------------------------------------------------------

export interface ParticleSprite extends Sprite {
  /** Remaining lifetime in seconds */
  lifetime: number;
  /** Velocity x/y in px/s */
  vx: number;
  vy: number;
  /** Angular velocity rad/s — tumbling shard rotation */
  angularVel: number;
}

// ---------------------------------------------------------------------------
// Pure helper — FIFO eviction logic (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Compute how many particles to evict from the front of activeList so that
 * adding `incoming` particles won't exceed cap.
 * Returns eviction count (0 if no eviction needed).
 */
export function computeEvictionCount(
  activeCount: number,
  incoming: number,
  cap: number,
): number {
  const overflow = activeCount + incoming - cap;
  return overflow > 0 ? overflow : 0;
}

// ---------------------------------------------------------------------------
// ParticlePool
// ---------------------------------------------------------------------------

/**
 * Pool of particle sprites backed by a single Pixi ParticleContainer.
 * Idle sprites are kept invisible off-screen; active sprites are tracked
 * in an ordered array for FIFO eviction (§E3).
 */
export class ParticlePool {
  private readonly _container: Container;
  private readonly _pool: ParticleSprite[] = [];
  private readonly _active: ParticleSprite[] = [];
  private static _particleTextures: Texture[] = [];

  constructor(parent: Container) {
    // D-P3-TA-04: Pixi v8 ParticleContainer.addChild() throws — requires addParticle()
    // with Particle objects (not Sprite). For 200-cap pool, regular Container is
    // sufficient: v8 auto-batching handles same-texture sprites efficiently.
    // Trade-off: marginal perf vs. ParticleContainer at >1000 particles (we're at 200).
    this._container = new Container();
    parent.addChild(this._container);

    // Pre-allocate pool sprites
    for (let i = 0; i < POP_PARTICLE_CAP; i++) {
      const s = this._makeSprite();
      this._pool.push(s);
      this._container.addChild(s);
      s.visible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Particle circle texture (shared, generated once)
  // ---------------------------------------------------------------------------

  // Glass shard textures — art-bible §1.2 Layered Translucency 4-layer 정합:
  // (1) frosted base alpha 0.30 (반투명, 뒤가 비침) → (2) inner brighter alpha 0.55 (내부 발광) →
  // (3) rim stroke alpha 0.95 sharp white (가장자리 반짝) → (4) specular hot-spot alpha 1.0 (광택).
  // 4 종류 sharp shape (2 triangle + 2 quad) — spawn 시 랜덤. 6+ vertex는 작게 그릴 때 둥글게 보임 → 거부.
  private static _getTextures(renderer: import('pixi.js').Renderer): Texture[] {
    if (ParticlePool._particleTextures.length > 0) return ParticlePool._particleTextures;

    // 32px canvas. 각 shard: [outer polygon, inner polygon (scale 0.6), specular dot center]
    const shards: { outer: number[]; inner: number[]; spec: [number, number] }[] = [
      // 1. Sharp triangle (등변 가까운)
      { outer: [16, 0, 30, 26, 2, 22],   inner: [16, 6, 24, 22, 8, 20],    spec: [14, 8] },
      // 2. Acute triangle (sliver)
      { outer: [22, 2, 28, 30, 6, 14],   inner: [22, 8, 25, 24, 11, 16],   spec: [20, 6] },
      // 3. Irregular quad (chunky)
      { outer: [12, 2, 30, 10, 22, 28, 2, 18], inner: [14, 8, 25, 12, 20, 24, 8, 18], spec: [16, 10] },
      // 4. Sharp quad (kite)
      { outer: [16, 0, 30, 16, 18, 30, 4, 14], inner: [16, 6, 25, 16, 19, 25, 9, 14], spec: [16, 8] },
    ];

    for (const s of shards) {
      const g = new Graphics();
      // Layer 1 — frosted base (alpha 0.45 — 0.30 너무 흐림 / 0.60 너무 진함 중간값)
      g.poly(s.outer).fill({ color: 0xffffff, alpha: 0.45 });
      // Layer 2 — inner brighter (alpha 0.65, 내부 광택 살짝 강조)
      g.poly(s.inner).fill({ color: 0xffffff, alpha: 0.65 });
      // Layer 3 — rim stroke (sharp white edge, art-bible §1.2 alpha 0.40 — sharp 위해 0.95)
      g.poly(s.outer).stroke({ width: 1.2, color: 0xffffff, alpha: 0.95 });
      // Layer 4 — specular hot-spot (작은 광택점)
      g.circle(s.spec[0], s.spec[1], 1.8).fill({ color: 0xffffff, alpha: 1.0 });
      ParticlePool._particleTextures.push(renderer.generateTexture(g));
      g.destroy();
    }
    return ParticlePool._particleTextures;
  }

  /**
   * Must be called once after Pixi renderer is available.
   * Pre-warms shard textures + assigns default (first) to pool sprites.
   * Actual texture is randomly picked per spawn (spawnBurst).
   */
  initTexture(renderer: import('pixi.js').Renderer): void {
    const texs = ParticlePool._getTextures(renderer);
    for (const s of this._pool) {
      s.texture = texs[0];
    }
  }

  // ---------------------------------------------------------------------------
  // Acquire / release
  // ---------------------------------------------------------------------------

  /** Acquire one sprite from idle pool. Returns null if pool is empty (should not happen with FIFO). */
  acquire(): ParticleSprite | null {
    return this._pool.pop() ?? null;
  }

  /** Return a sprite to idle pool. */
  release(s: ParticleSprite): void {
    s.visible = false;
    s.alpha = 0;
    s.lifetime = 0;
    s.vx = 0;
    s.vy = 0;
    s.angularVel = 0;
    s.rotation = 0;
    this._pool.push(s);
  }

  // ---------------------------------------------------------------------------
  // Spawn burst (FIFO cap management — §E3)
  // ---------------------------------------------------------------------------

  /**
   * Spawn a burst of particles at (x, y) with given color (0xRRGGBB) and count.
   * Performs FIFO eviction if needed (visual-juice §3.2, §E3).
   */
  spawnBurst(x: number, y: number, color: number, count: number): void {
    // FIFO eviction
    const evict = computeEvictionCount(this._active.length, count, POP_PARTICLE_CAP);
    for (let i = 0; i < evict; i++) {
      const old = this._active.shift();
      if (old) this.release(old);
    }

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;

      p.position.set(x, y);
      const angle = Math.random() * Math.PI * 2;
      const speed = POP_PARTICLE_SPEED_MIN
        + Math.random() * (POP_PARTICLE_SPEED_MAX - POP_PARTICLE_SPEED_MIN);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.lifetime = POP_PARTICLE_LIFETIME;
      p.tint = color;
      p.alpha = 1.0;
      p.scale.set(1.0);
      // Random shard texture (4 종류 — sharp triangle/quad 다양성)
      const texs = ParticlePool._particleTextures;
      if (texs.length > 0) {
        p.texture = texs[Math.floor(Math.random() * texs.length)];
      }
      // Glass shard tumbling — random angular velocity ±8 rad/s
      p.angularVel = (Math.random() - 0.5) * 16;
      p.rotation = Math.random() * Math.PI * 2; // initial random orientation
      p.visible = true;
      this._active.push(p);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Advance particle simulation by dt seconds.
   * alpha = lifetime / LIFETIME (linear fade)
   * scale = alpha (shrink in sync with fade)
   */
  update(dt: number): void {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this._active.splice(i, 1);
        this.release(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.angularVel * dt; // Glass shard tumbling
      const a = p.lifetime / POP_PARTICLE_LIFETIME;
      p.alpha = a;
      p.scale.set(a);
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /** Return all active particles to pool. */
  reset(): void {
    for (const p of this._active) this.release(p);
    this._active.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get activeCount(): number { return this._active.length; }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _makeSprite(): ParticleSprite {
    const s = new Sprite(Texture.WHITE) as ParticleSprite;
    s.anchor.set(0.5);
    s.lifetime = 0;
    s.vx = 0;
    s.vy = 0;
    s.angularVel = 0;
    return s;
  }
}
