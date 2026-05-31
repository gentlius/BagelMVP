/**
 * Balloon Entity — POP!
 *
 * Implements: balloon-physics-split-system.md §3.1 Entities
 * Design Doc: design/gdd/balloon-physics-split-system.md
 *
 * M-SC-1 lock: `id` field required for Score & Combo frame-guard
 * (score-combo-system.md §3.2).
 */

import type { Sprite } from 'pixi.js';
import type { BalloonSize } from '../events/event-bus.js';
import type { BalloonColorId } from '../vfx/entity-textures.js';

export type { BalloonSize };

/**
 * Runtime balloon entity.
 * Container = balloonContainer (zIndex 0–4, sortableChildren must be true).
 * Anchor = (0.5, 0.5) center.
 */
export interface BalloonEntity {
  /** Unique identifier. Monotonic counter, spawn-assigned. Used for frame-guard (M-SC-1). */
  id: string;

  /** Center X position in logical pixels */
  x: number;
  /** Center Y position in logical pixels */
  y: number;

  /** Horizontal velocity px/s */
  vx: number;
  /** Vertical velocity px/s */
  vy: number;

  /** Balloon size category */
  size: BalloonSize;

  /** Tint color (art-bible §1.2 palette mid hex, or gold hex for critical) — derived from colorId */
  color: number;

  /** Color identifier (art-bible §4.2 palette key) — single source of truth for texture + glow lookup */
  colorId: BalloonColorId;

  /**
   * Whether this balloon is a Critical Gold balloon.
   * Set exclusively by CriticalPopSystem (balloon-physics-split §6 authority boundary).
   * Always false on spawn; CriticalPopSystem.setCritical() changes it.
   */
  isCritical: boolean;

  /** Pixi Sprite reference — tint and filters are managed here */
  sprite: Sprite;

  /**
   * Spawn immunity: when >0, character collision is suppressed.
   * Value = distance in px; immune while dist(balloon, character) < spawnImmunityRadius.
   * Set to SPAWN_IMMUNITY_RADIUS on child balloon creation (E7).
   */
  spawnImmunityRadius: number;
}
