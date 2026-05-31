/**
 * Character Entity — POP!
 *
 * Implements: balloon-physics-split-system.md §3.1 Entities, §3.6 Character Entity
 * Design Doc: design/gdd/balloon-physics-split-system.md
 *
 * Anchor = (0.5, 1.0) bottom-center.
 * character.y = foot position (FLOOR_Y).
 * character.x = horizontal center, clamped to [width/2, screen.width - width/2].
 */

import type { Sprite } from 'pixi.js';

/**
 * Runtime character entity.
 * Container = balloonContainer (zIndex 5, above balloons).
 * Anchor = (0.5, 1.0) bottom-center.
 */
export interface CharacterEntity {
  /** Horizontal center X */
  x: number;
  /** Foot Y position (bottom-center anchor) — equals FLOOR_Y normally; dying mode에서 자유낙하 */
  y: number;
  /** Sprite width for clamping calculations */
  width: number;
  /** Sprite height (reference only) */
  height: number;
  /** Pixi Sprite reference */
  sprite: Sprite;

  // D-P6-DEATH-01: 사망 연출 (game:over 후 풍선 물리로 화면 밖으로 튕김)
  /** Death-mode velocity px/s — 사망 중에만 사용 (alive 상태에서는 0) */
  vx: number;
  vy: number;
  /** Death-mode angular velocity rad/s — sprite.rotation에 적용 */
  angularVel: number;
  /** true면 update가 dying 물리 적용 (gravity + wall bounce + 화면 밖) */
  isDying: boolean;
}
