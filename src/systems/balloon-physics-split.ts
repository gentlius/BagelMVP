/**
 * Balloon Physics & Split System — POP!
 *
 * Implements: design/gdd/balloon-physics-split-system.md (전체)
 * Design Doc: design/gdd/balloon-physics-split-system.md
 *
 * BLOCKING fixes applied (sprint plan §5 T-14):
 *   1. dt unit conversion: Pixi Ticker.deltaMS / 1000 → seconds (AC.15, §3.3)
 *   2. Spawn timer accumulator pattern: drift-free (§3.8.1)
 *
 * M-SC-1 lock: BalloonEntity.id field present for Score & Combo frame-guard.
 * All units: logical pixels (CSS pixels, 1080p reference).
 */

import { Container, Sprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import type { BalloonEntity } from '../entities/balloon.js';
import type { BalloonSize } from '../events/event-bus.js';
import type { HarpoonEntity } from '../entities/harpoon.js';
import type { CharacterEntity } from '../entities/character.js';
import type { EventBus } from '../events/event-bus.js';
import type { CriticalPopSystem } from './critical-pop.js';
import { rng } from '../conventions/rng.js';
import {
  BALLOON_PALETTE,
  type BalloonColorId,
  getBalloonTexture,
  getCharacterTexture,
  getHarpoonLineTexture,
} from '../vfx/entity-textures.js';

// ---------------------------------------------------------------------------
// Constants (Tuning Knobs — balloon-physics-split §7)
// ---------------------------------------------------------------------------

export const BALLOON_BASE_DIAMETER = 80; // px (Large 기준)
// D-P6-SPLIT-01 (사용자): 5단계 분열 — XL (시작) → Large → Medium → Small → XS (terminal)
export const SIZE_RATIO: Record<string, number> = {
  XL: 2.0,      // 160 px — 시작 크기 (D-P6-SPLIT-01)
  Large: 1.0,
  Medium: 0.7,
  Small: 0.48,
  XS: 0.24,     // 19.2 px — 최소 크기 (D-P6-SPLIT-01)
};
// art-bible §3.3: Small +6px hitbox extension for harpoon only
export const SMALL_HARPOON_HITBOX_EXTRA = 6;

export const GRAVITY = 400; // px/s²
export const BOUNCE_RESTITUTION = 0.85;
export const SPLIT_VEL_X = 120; // px/s
export const SPLIT_VEL_Y = 250; // px/s
export const HARPOON_GROWTH_SPEED = 800; // px/s — Pang 원작 ~ (사용자 D-P6-SPD-01: 2400 → 800, ~0.8s에 천장 도달)
export const HARPOON_LINE_WIDTH = 10;      // px — 작살 라인 가로폭 (시각 + 충돌 hitbox 공통). D-P6-HARP-01 (사용자): 6 → 10 (식별성)
export const HARPOON_TINT = 0x00E5FF;      // 네온 시안 (HSL 192/100/50). D-P6-HARP-01: 채도 ↑ for 식별성

// D-P6-CTRL-01: Virtual stick character controls (사용자 "조이스틱으로 밀고다니는 듯한 조작감").
// 드래그 시작점 = stick center. 손가락 offset (currentX - startX) → 캐릭터 vx.
// 떼면 vx = 0 (즉시 멈춤). 워프 없음.
export const STICK_SENSITIVITY = 2;  // offset px → vx px/s 비율 (100px 드래그 → 200 px/s). D-P6-CTRL-02: 6 → 2 (사용자 1/3 감속)
export const STICK_MAX_VX = 270;     // px/s — 캐릭터 최대 수평 속도. D-P6-CTRL-02: 800 → 270 (사용자 1/3 감속)

// D-P6-DEATH-01: 사망 연출 (캐릭터가 풍선처럼 바운싱하며 화면 밖으로 떨어짐)
export const DEATH_KICK_VY = -650;            // px/s — 초기 위로 튕김
export const DEATH_KICK_VX = 250;             // px/s — 좌우 튕김 절대값 (방향은 충돌 위치 반대)
export const DEATH_BOUNCE_DAMP = 0.7;         // 벽 바운스 감쇠
export const DEATH_ANGULAR_VEL = 5;           // rad/s — sprite 회전 (구르는 느낌)
export const DEATH_OFFSCREEN_MARGIN = 200;    // px — y > screen.height + 이값 시 sprite hide
export const HARPOON_SPAWN_OFFSET_Y = 4; // px above character foot

export const CHARACTER_HITBOX_RADIUS = 24; // px — D-P6-HITBOX-01 (사용자): 32 → 24 (sprite.width/2 정합, +8px 마진 제거)
export const SPAWN_IMMUNITY_RADIUS = 75; // px

export const SPAWN_COUNT_0 = 2;
export const SPAWN_COUNT_30 = 4;
export const SPAWN_COUNT_60 = 6;
export const BALLOON_MAX_ACTIVE = 30;
export const SPAWN_INTERVAL = 3; // seconds
export const SPAWN_MARGIN = 40; // px
export const SPAWN_Y_TOP = -40; // px (above screen)

// D-P6-WIRE-01: balloon palette는 art-bible §4.2 정합 — entity-textures.ts BALLOON_PALETTE Record 단일 소유.
// spawn 시 SPAWN_COLOR_IDS에서 랜덤 선택. gold는 critical 전용 — 일반 spawn 제외.
export const SPAWN_COLOR_IDS: BalloonColorId[] = ['magenta', 'cyan', 'lime', 'amber', 'mint', 'violet'];
export const CRITICAL_GOLD_HEX = BALLOON_PALETTE.gold.mid; // 0xFFD700

// ---------------------------------------------------------------------------
// Helper: unique id generator
// ---------------------------------------------------------------------------

let _idCounter = 0;
export function nextBalloonId(): string {
  return `b${++_idCounter}`;
}
export function resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// BalloonPhysicsSplitSystem
// ---------------------------------------------------------------------------

export interface BalloonPhysicsOptions {
  app: Application;
  balloonContainer: Container;
  harpoonContainer: Container;
  eventBus: EventBus;
  criticalPop?: CriticalPopSystem; // injected after creation
}

export class BalloonPhysicsSplitSystem {
  private readonly _app: Application;
  private readonly _balloonContainer: Container;
  private readonly _harpoonContainer: Container;
  private readonly _bus: EventBus;

  /** Injected by GameLoop after CriticalPopSystem is created */
  public criticalPop: CriticalPopSystem | null = null;

  private _activeBalloons: BalloonEntity[] = [];
  private _harpoon: HarpoonEntity | null = null;
  private _character!: CharacterEntity;

  private _spawnTimer = 0;
  private _elapsedTime = 0;

  // D-P6-CTRL-01: virtual stick state
  private _dragStartX: number | null = null;  // null = not dragging
  private _characterVx = 0;                    // px/s — applied in update()

  // Shared GlowFilter instances (§3.1).
  // D-P6-PERF-01: GlowFilter는 stateless (uniform만) — sprite 간 공유 안전.
  // 매 spawn마다 new GlowFilter() 회피로 framebuffer + GC churn 제거.
  private readonly _harpoonGlowFilter: GlowFilter = new GlowFilter({
    distance: 10,
    outerStrength: 1.2,
    innerStrength: 0,
    color: HARPOON_TINT,
    quality: 0.3,
  });
  // Critical hero glow (gold 고정 — D-P6-CRIT-VIS-01)
  private readonly _criticalGlowFilter: GlowFilter = new GlowFilter({
    distance: 28,
    outerStrength: 2.0,
    innerStrength: 0,
    color: 0xFFD700,
    quality: 0.5,
  });
  // Supporting balloon glow — color별 lazy cache (6색 max). D-P6-GLOW-01.
  private readonly _supportingGlowFilters: Map<BalloonColorId, GlowFilter> = new Map();
  private _getSupportingGlowFilter(colorId: BalloonColorId): GlowFilter {
    let f = this._supportingGlowFilters.get(colorId);
    if (!f) {
      f = new GlowFilter({
        distance: 12,
        outerStrength: 0.8,
        innerStrength: 0,
        color: BALLOON_PALETTE[colorId].glow,
        quality: 0.3, // 모바일 perf (R-SD-04)
      });
      this._supportingGlowFilters.set(colorId, f);
    }
    return f;
  }

  constructor(options: BalloonPhysicsOptions) {
    this._app = options.app;
    this._balloonContainer = options.balloonContainer;
    this._harpoonContainer = options.harpoonContainer;
    this._bus = options.eventBus;

    this._balloonContainer.sortableChildren = true; // §3.1 mandatory
    this._initCharacter();
  }

  // ---------------------------------------------------------------------------
  // GameLoop contract (§3.8)
  // ---------------------------------------------------------------------------

  reset(): void {
    // Remove all balloon sprites
    for (const b of this._activeBalloons) {
      this._balloonContainer.removeChild(b.sprite);
    }
    this._activeBalloons = [];

    // Remove harpoon
    if (this._harpoon) {
      this._harpoonContainer.removeChild(this._harpoon.sprite);
      this._harpoon = null;
    }

    // Reset character position + D-P6-DEATH-01 dying state clear (RETRY UX)
    const sw = this._app.screen.width;
    const sh = this._app.screen.height;
    const floorY = sh - 80;
    this._character.x = sw / 2;
    this._character.y = floorY;
    this._character.vx = 0;
    this._character.vy = 0;
    this._character.angularVel = 0;
    this._character.isDying = false;
    this._character.sprite.x = sw / 2;
    this._character.sprite.y = floorY;
    this._character.sprite.rotation = 0;
    this._character.sprite.visible = true;

    // virtual stick state clear
    this._dragStartX = null;
    this._characterVx = 0;

    this._spawnTimer = 0;
    this._elapsedTime = 0;
    resetIdCounter();
  }

  start(): void {
    // Spawn initial batch
    for (let i = 0; i < SPAWN_COUNT_0; i++) {
      if (this._activeBalloons.length < BALLOON_MAX_ACTIVE) {
        this._spawnOneBalloon();
      }
    }
  }

  end(): void {
    // State freeze — Ticker will be removed by GameLoop
    // No additional cleanup needed; entity state preserved for RETRY UX
  }

  // ---------------------------------------------------------------------------
  // Per-frame update (dt in seconds — §3.3 BLOCKING fix)
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    this._elapsedTime += dt;

    this._updateCharacter(dt); // D-P6-CTRL-01 (virtual stick) + D-P6-DEATH-01 (dying physics)
    this._updateBalloons(dt);
    this._updateHarpoon(dt);
    if (!this._character.isDying) {
      this._checkCollisions();
      this._updateSpawnTimer(dt);
    }
  }

  // D-P6-CTRL-01: virtual stick. D-P6-DEATH-01: dying mode 분기.
  private _updateCharacter(dt: number): void {
    if (this._character.isDying) {
      this._updateCharacterDying(dt);
      return;
    }
    if (this._characterVx === 0) return;
    const half = this._character.width / 2;
    const sw = this._app.screen.width;
    const nextX = this._character.x + this._characterVx * dt;
    this._character.x = Math.max(half, Math.min(sw - half, nextX));
    this._character.sprite.x = this._character.x;
  }

  // D-P6-DEATH-01: 사망 연출 — gravity + wall bounce + rotation + 화면 밖 hide
  private _updateCharacterDying(dt: number): void {
    const c = this._character;
    const sw = this._app.screen.width;
    const sh = this._app.screen.height;
    const half = c.width / 2;

    // Gravity
    c.vy += GRAVITY * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;

    // Wall bounce (좌우 가장자리만 — floor는 통과해서 화면 밖으로 떨어짐)
    if (c.x - half < 0) {
      c.x = half;
      c.vx = Math.abs(c.vx) * DEATH_BOUNCE_DAMP;
    } else if (c.x + half > sw) {
      c.x = sw - half;
      c.vx = -Math.abs(c.vx) * DEATH_BOUNCE_DAMP;
    }

    // Sprite sync + rotation
    c.sprite.x = c.x;
    c.sprite.y = c.y;
    c.sprite.rotation += c.angularVel * dt;

    // 화면 밖으로 떨어지면 hide (메모리는 보존 — RETRY 시 reset)
    if (c.y > sh + DEATH_OFFSCREEN_MARGIN) {
      c.sprite.visible = false;
    }
  }

  // D-P6-DEATH-01: dying mode 진입 — velocity 부여, 작살 즉시 제거, drag state clear
  private _triggerDeath(impactX: number): void {
    const c = this._character;
    if (c.isDying) return;
    c.isDying = true;

    // 충돌 위치 반대로 튕김 (character.x - impactX의 부호 = 반대 방향)
    const dirSign = c.x >= impactX ? 1 : -1;
    c.vx = DEATH_KICK_VX * dirSign;
    c.vy = DEATH_KICK_VY;
    c.angularVel = DEATH_ANGULAR_VEL * dirSign;

    // 작살 즉시 제거 (사망 후 작살 남으면 부자연)
    if (this._harpoon) {
      this._harpoonContainer.removeChild(this._harpoon.sprite);
      this._harpoon = null;
    }

    // virtual stick state clear
    this._dragStartX = null;
    this._characterVx = 0;
  }

  // ---------------------------------------------------------------------------
  // Input handlers (called by GameLoop after InputSystem events)
  // ---------------------------------------------------------------------------

  onFire(): void {
    if (this._harpoon) return; // max 1 active (E3)

    const sx = this._character.x;
    const bottomY = this._character.y - HARPOON_SPAWN_OFFSET_Y;
    this._harpoon = this._createHarpoon(sx, bottomY);
    this._bus.emit('harpoon:fired', { x: sx, y: bottomY });
  }

  // D-P6-CTRL-01: virtual stick — drag start = stick center, offset → velocity.
  onDragStart(x: number): void {
    this._dragStartX = x;
    this._characterVx = 0;
  }

  onDragMove(x: number): void {
    if (this._dragStartX === null) return; // safety — dragMove without dragStart
    const offset = x - this._dragStartX;
    // offset → velocity, clamped to MAX_VX
    const raw = offset * STICK_SENSITIVITY;
    this._characterVx = Math.max(-STICK_MAX_VX, Math.min(STICK_MAX_VX, raw));
  }

  onDragEnd(): void {
    this._dragStartX = null;
    this._characterVx = 0; // immediate stop (no inertia — Pang feel)
  }

  // ---------------------------------------------------------------------------
  // Public removal API — called by CriticalPopSystem cascade (§9 IC lock)
  // Emits balloon:popped({ isCritical: false }) to prevent recursion
  // ---------------------------------------------------------------------------

  removeBalloon(id: string): void {
    const idx = this._activeBalloons.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const b = this._activeBalloons[idx];
    this._activeBalloons.splice(idx, 1);
    this._balloonContainer.removeChild(b.sprite);

    this._bus.emit('balloon:popped', {
      id: b.id,
      size: b.size,
      x: b.x,
      y: b.y,
      color: b.color,
      isCritical: false, // forced false — cascade recursion prevention (critical-pop §3.3)
    });
  }

  // Read-only access for CriticalPopSystem
  getActiveBalloons(): ReadonlyArray<BalloonEntity> {
    return this._activeBalloons;
  }

  getCharacter(): CharacterEntity {
    return this._character;
  }

  // D-P6-CRIT-VIS-01 (사용자): Critical Gold 풍선 시각 differentiation.
  // critical-pop._setCritical()이 isCritical=true set 후 호출.
  // texture swap (정확한 gold radial gradient) + scale ×1.1 + hero GlowFilter (outerStrength ×2).
  applyCriticalVisual(b: BalloonEntity): void {
    // 1. Texture swap — gold radial gradient (BALLOON_PALETTE.gold)
    b.sprite.texture = getBalloonTexture(this._app, 'gold');
    b.sprite.tint = 0xFFFFFF; // tint reset — texture가 이미 gold
    // 2. Scale ×1.1 — 현재 sprite.width 기준 (entity diameter)
    const diameter = BALLOON_BASE_DIAMETER * SIZE_RATIO[b.size];
    b.sprite.width = diameter * 1.1;
    b.sprite.height = diameter * 1.1;
    // 3. Hero GlowFilter — outerStrength 2.0 (supporting 0.8의 2.5×), color gold
    // D-P6-PERF-01: shared instance (_criticalGlowFilter)
    b.sprite.filters = [this._criticalGlowFilter];
  }

  // ---------------------------------------------------------------------------
  // Private: balloon motion & physics
  // ---------------------------------------------------------------------------

  private _updateBalloons(dt: number): void {
    const sw = this._app.screen.width;
    const floorY = this._character.y;

    for (const b of this._activeBalloons) {
      // Gravity
      b.vy += GRAVITY * dt;

      // Position update
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wall bounce (X)
      if (b.x < 0) {
        b.x = 0;
        b.vx = Math.abs(b.vx);
      } else if (b.x > sw) {
        b.x = sw;
        b.vx = -Math.abs(b.vx);
      }

      // Floor bounce (E2 — floor = character foot)
      const r = this._balloonRadius(b);
      if (b.y + r > floorY) {
        b.y = floorY - r;
        b.vy = -Math.abs(b.vy) * BOUNCE_RESTITUTION;
      }

      // Sync sprite
      b.sprite.x = b.x;
      b.sprite.y = b.y;
    }
  }

  // BUGFIX 2026-05-31: 설치형 작살 — sprite.y 이동(총알) → topY 감소(라인 자람).
  // sprite anchor (0.5, 1.0) bottom-center, height = bottomY - topY로 위로 자람.
  private _updateHarpoon(dt: number): void {
    if (!this._harpoon) return;

    this._harpoon.topY -= this._harpoon.growthSpeed * dt;
    if (this._harpoon.topY < 0) this._harpoon.topY = 0;

    // sprite height = 라인 길이 (anchor (0.5, 1.0) bottom-center → 위로 자람)
    this._harpoon.sprite.height = this._harpoon.bottomY - this._harpoon.topY;

    // 천장 도달 → 즉시 제거 (M0 단순화; Pang 원작은 잠시 머무름 — polish 단계)
    if (this._harpoon.topY <= 0) {
      this._harpoonContainer.removeChild(this._harpoon.sprite);
      this._harpoon = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: collision detection
  // ---------------------------------------------------------------------------

  private _checkCollisions(): void {
    if (!this._checkGameOverFirst()) return;
    this._checkHarpoonBalloon();
  }

  /** Returns false if game over was detected (skip further checks, E4). */
  private _checkGameOverFirst(): boolean {
    const cx = this._character.x;
    const cy = this._character.y;
    const cr = CHARACTER_HITBOX_RADIUS;

    for (const b of this._activeBalloons) {
      // Spawn immunity check (E7)
      const dx = b.x - cx;
      const dy = b.y - cy;
      const distSq = dx * dx + dy * dy;

      if (b.spawnImmunityRadius > 0) {
        if (distSq < b.spawnImmunityRadius * b.spawnImmunityRadius) {
          continue; // still immune
        } else {
          b.spawnImmunityRadius = 0; // immunity lifted
        }
      }

      const r = this._balloonRadius(b);
      const sum = r + cr;
      if (distSq < sum * sum) {
        // Game over (E4: game over wins over simultaneous harpoon hit)
        // D-P6-DEATH-01: 사망 연출 진입 (캐릭터 velocity 부여, 작살 제거)
        this._triggerDeath(b.x);
        this._bus.emit('game:over', {});
        return false;
      }
    }
    return true;
  }

  // BUGFIX 2026-05-31: 설치형 작살 — point 충돌(총알) → line segment 충돌.
  // 풍선이 라인의 vertical segment [topY, bottomY]에 닿으면 hit.
  private _checkHarpoonBalloon(): void {
    if (!this._harpoon) return;
    const hx = this._harpoon.x;
    const hHalfWidth = HARPOON_LINE_WIDTH / 2;

    for (let i = this._activeBalloons.length - 1; i >= 0; i--) {
      const b = this._activeBalloons[i];

      // art-bible §3.3: Small +6px extension for harpoon collision only
      let br = this._balloonRadius(b);
      if (b.size === 'Small' || b.size === 'XS') br += SMALL_HARPOON_HITBOX_EXTRA;

      // X overlap: balloon center within line x-range ± balloon radius
      const dx = Math.abs(b.x - hx);
      if (dx > br + hHalfWidth) continue;

      // Y overlap: balloon must intersect vertical segment [topY, bottomY]
      if (b.y - br > this._harpoon.bottomY) continue; // balloon below line
      if (b.y + br < this._harpoon.topY) continue;    // balloon above line

      this._hitBalloon(b);
      // Remove harpoon
      this._harpoonContainer.removeChild(this._harpoon.sprite);
      this._harpoon = null;
      break; // one hit per frame
    }
  }

  /** Process a balloon hit. Removes from active list BEFORE emitting (critical-pop §3.3 self-exclusion). */
  private _hitBalloon(b: BalloonEntity): void {
    // Remove from active list FIRST (§9 IC lock: emit after removal)
    const idx = this._activeBalloons.indexOf(b);
    if (idx !== -1) this._activeBalloons.splice(idx, 1);
    this._balloonContainer.removeChild(b.sprite);

    if (b.isCritical) {
      // Critical Gold: no split, immediate removal, isCritical=true (§3.4)
      this._bus.emit('balloon:popped', {
        id: b.id,
        size: b.size,
        x: b.x,
        y: b.y,
        color: b.color,
        isCritical: true,
      });
    } else {
      // Normal split
      // D-P6-SPLIT-01: 5단계 분열 chain
      if (b.size === 'XL') {
        this._splitBalloon(b, 'Large');
      } else if (b.size === 'Large') {
        this._splitBalloon(b, 'Medium');
      } else if (b.size === 'Medium') {
        this._splitBalloon(b, 'Small');
      } else if (b.size === 'Small') {
        this._splitBalloon(b, 'XS');
      } else {
        // XS: terminal pop — no split (가장 작은 크기)
        this._bus.emit('balloon:popped', {
          id: b.id,
          size: b.size,
          x: b.x,
          y: b.y,
          color: b.color,
          isCritical: false,
        });
      }
    }
  }

  private _splitBalloon(parent: BalloonEntity, childSize: 'Large' | 'Medium' | 'Small' | 'XS'): void {
    const leftId = nextBalloonId();
    const rightId = nextBalloonId();

    const left = this._createBalloon(leftId, parent.x, parent.y, childSize, parent.colorId, {
      vx: -SPLIT_VEL_X,
      vy: -SPLIT_VEL_Y,
    });
    const right = this._createBalloon(rightId, parent.x, parent.y, childSize, parent.colorId, {
      vx: SPLIT_VEL_X,
      vy: -SPLIT_VEL_Y,
    });

    // M-1: children always isCritical=false (§3.4)
    left.isCritical = false;
    right.isCritical = false;

    // E7: spawn immunity
    left.spawnImmunityRadius = SPAWN_IMMUNITY_RADIUS;
    right.spawnImmunityRadius = SPAWN_IMMUNITY_RADIUS;

    this._activeBalloons.push(left, right);
    this._balloonContainer.addChild(left.sprite, right.sprite);

    // Hook CriticalPopSystem for each child (M0 prototype direct hook, §3.1)
    if (this.criticalPop) {
      this.criticalPop.onBalloonSpawned(left);
      this.criticalPop.onBalloonSpawned(right);
    }

    // Emit split event (Visual Juice squash/stretch)
    this._bus.emit('balloon:split', {
      parent: { id: parent.id, x: parent.x, y: parent.y, size: parent.size, color: parent.color },
      children: [
        { id: leftId, x: left.x, y: left.y, size: left.size, color: left.color },
        { id: rightId, x: right.x, y: right.y, size: right.size, color: right.color },
      ],
    });

    // Emit popped for parent (after split children created)
    this._bus.emit('balloon:popped', {
      id: parent.id,
      size: parent.size,
      x: parent.x,
      y: parent.y,
      color: parent.color,
      isCritical: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Private: spawn logic
  // ---------------------------------------------------------------------------

  private _updateSpawnTimer(dt: number): void {
    this._spawnTimer += dt;
    while (this._spawnTimer >= SPAWN_INTERVAL) {
      this._spawnTimer -= SPAWN_INTERVAL; // preserve remainder (drift-free, §3.8.1 BLOCKING fix)
      this._trySpawn();
    }
  }

  private _trySpawn(): void {
    const target = this._spawnCountAt(this._elapsedTime);
    if (
      this._activeBalloons.length < target &&
      this._activeBalloons.length < BALLOON_MAX_ACTIVE
    ) {
      this._spawnOneBalloon();
    }
  }

  private _spawnCountAt(t: number): number {
    if (t < 30) return SPAWN_COUNT_0;
    if (t < 60) return SPAWN_COUNT_30;
    return SPAWN_COUNT_60;
  }

  private _spawnOneBalloon(): void {
    const sw = this._app.screen.width;
    const x = rng.spawn.nextInt(SPAWN_MARGIN, sw - SPAWN_MARGIN);
    const y = SPAWN_Y_TOP;
    const colorIdx = rng.spawn.nextInt(0, SPAWN_COLOR_IDS.length - 1);
    const colorId = SPAWN_COLOR_IDS[colorIdx];
    const vx = rng.spawn.nextInt(-150, 150);

    const id = nextBalloonId();
    // D-P6-SPLIT-01: 시작 크기 = XL (이전 Large)
    const b = this._createBalloon(id, x, y, 'XL', colorId, { vx, vy: 0 });

    this._activeBalloons.push(b);
    this._balloonContainer.addChild(b.sprite);

    this._bus.emit('balloon:spawned', {
      id: b.id,
      x: b.x,
      y: b.y,
      size: b.size,
      color: b.color,
      isCritical: false,
    });

    // Critical Pop hook (M0 prototype direct call, §3.1)
    if (this.criticalPop) {
      this.criticalPop.onBalloonSpawned(b);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: entity factories
  // ---------------------------------------------------------------------------

  // D-P6-WIRE-01: entity texture는 src/vfx/entity-textures.ts (technical-artist 단독 소유)에서
  // import. art-bible §6 canonical 샘플 HTML 정합. system 측 cache 제거 — entity-textures가 자체 캐싱.

  private _createBalloon(
    id: string,
    x: number,
    y: number,
    size: BalloonSize,
    colorId: BalloonColorId,
    vel: { vx: number; vy: number },
  ): BalloonEntity {
    const diameter = BALLOON_BASE_DIAMETER * SIZE_RATIO[size];
    const sprite = new Sprite(getBalloonTexture(this._app, colorId));
    sprite.width = diameter;
    sprite.height = diameter;
    sprite.anchor.set(0.5, 0.5);
    // D-P6-GLOW-01: art-bible §4.2 supporting glow — Neon Glassblowing 미학.
    // Critical 풍선은 applyCriticalVisual에서 hero glow로 swap.
    // D-P6-PERF-01: color별 shared instance (lazy cache, 6색 max)
    sprite.filters = [this._getSupportingGlowFilter(colorId)];
    sprite.x = x;
    sprite.y = y;

    return {
      id,
      x,
      y,
      vx: vel.vx,
      vy: vel.vy,
      size,
      color: BALLOON_PALETTE[colorId].mid, // event payload용 — visual-juice GlowFilter가 사용
      colorId,
      isCritical: false,
      sprite,
      spawnImmunityRadius: 0,
    };
  }

  private _createHarpoon(x: number, bottomY: number): HarpoonEntity {
    // 설치형 작살: entity-textures.getHarpoonLineTexture (art-bible §6 canonical).
    // sprite anchor (0.5, 1.0) bottom-center → 위로 자람 (sprite.height 동적).
    // D-P6-HARP-01: tint 네온 시안 + GlowFilter 식별성 강화.
    const sprite = new Sprite(getHarpoonLineTexture(this._app));
    sprite.width = HARPOON_LINE_WIDTH;
    sprite.height = 0; // 시작 0, _updateHarpoon에서 자람
    sprite.anchor.set(0.5, 1.0);
    sprite.tint = HARPOON_TINT;
    // D-P6-PERF-01: shared instance (멤버 _harpoonGlowFilter) — 발사마다 GC 회피
    sprite.filters = [this._harpoonGlowFilter];
    sprite.x = x;
    sprite.y = bottomY;
    this._harpoonContainer.addChild(sprite);

    return { x, bottomY, topY: bottomY, growthSpeed: HARPOON_GROWTH_SPEED, sprite };
  }

  private _initCharacter(): void {
    const sw = this._app.screen.width;
    const sh = this._app.screen.height;
    const floorY = sh - 80; // FLOOR_Y_DEFAULT = screen.height - 80

    const sprite = new Sprite(getCharacterTexture(this._app));
    sprite.width = 48;
    sprite.height = 72;
    sprite.anchor.set(0.5, 1.0); // bottom-center (§3.1)
    sprite.x = sw / 2;
    sprite.y = floorY;
    sprite.zIndex = 5; // above balloons (§3.1)
    this._balloonContainer.addChild(sprite);

    this._character = {
      x: sw / 2,
      y: floorY,
      width: 48,
      height: 72,
      sprite,
      // D-P6-DEATH-01: dying state 초기값
      vx: 0,
      vy: 0,
      angularVel: 0,
      isDying: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper: balloon collision radius
  // ---------------------------------------------------------------------------

  private _balloonRadius(b: BalloonEntity): number {
    return (BALLOON_BASE_DIAMETER * SIZE_RATIO[b.size]) / 2;
  }
}
