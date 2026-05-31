/**
 * Harpoon Entity — POP! (Pang 설치형 메커니즘)
 *
 * Implements: balloon-physics-split-system.md §3.5 Harpoon Entity
 * Design Doc: design/gdd/balloon-physics-split-system.md
 *
 * BUGFIX 2026-05-31: 작살은 총알이 아닌 **설치형 수직 라인** (Pang 원작):
 *   - 발사 위치 x에 고정 (캐릭터 이동해도 무관)
 *   - bottomY (캐릭터 머리 위)에서 시작 → topY를 빠르게 위로 자라남 → 천장(0) 도달
 *   - 풍선이 라인 segment에 닿으면 둘 다 사라짐 (one-hit)
 *   - 천장 도달 시 즉시 사라짐 (M0 단순화 — Pang은 잠시 머무름)
 *
 * Max 1 active harpoon at any time (E3 policy).
 */

import type { Sprite } from 'pixi.js';

/**
 * Runtime harpoon entity (설치형 line).
 * Container = harpoonContainer.
 * Sprite anchor = (0.5, 1.0) bottom-center — sprite.height가 라인 길이.
 */
export interface HarpoonEntity {
  /** 발사 위치 x (고정 — 캐릭터 이동해도 변경 안 함) */
  x: number;
  /** 라인 하단 y — 발사 시 character.y - HARPOON_SPAWN_OFFSET_Y, 고정 */
  bottomY: number;
  /** 라인 상단 y — bottomY에서 시작, 시간에 따라 0으로 감소 (위로 자람) */
  topY: number;
  /** 자라는 속도 px/s (positive — 매 frame topY가 감소) */
  growthSpeed: number;
  /** Pixi Sprite reference — anchor (0.5, 1.0), height 동적 갱신 */
  sprite: Sprite;
}
