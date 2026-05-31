/**
 * UI Strings — POP!
 *
 * Implements: systems-index §Conventions (UI 문자열: ui-strings.js 단일 파일)
 * Design Doc: design/gdd/systems-index.md §Conventions, score-combo-system.md §3.3, visual-juice-system.md
 *
 * ALL player-facing strings MUST reference this module.
 * Pixi Text instantiation with inline string literals is forbidden.
 *
 * Language: English default. Korean mappings in comments.
 * To switch language: change the return values in this file only (single-source).
 *
 * Phase 2 Decision (D-P2-02): User has not yet decided KR/EN for launch.
 * English chosen as prototype default. Korean mapping preserved in comments.
 * One-line toggle at launch decision time.
 */

export const UI = {
  // -------------------------------------------------------------------------
  // Score & Combo (score-combo-system.md §3.3)
  // -------------------------------------------------------------------------

  /** Score display text. Example: "Score: 1540" */
  score: (n: number): string => `Score: ${n}`,
  // KR: `점수: ${n}`

  /** Combo display text. Example: "Combo x3" */
  combo: (n: number): string => `Combo x${n}`,
  // KR: `콤보 ${n}`

  /** Combo reset (optional — combo:reset event, visual-juice §3.1 priority 8) */
  comboReset: (): string => `Combo!`,
  // KR: `콤보!`

  // -------------------------------------------------------------------------
  // Game state (visual-juice-system.md, input-system.md)
  // -------------------------------------------------------------------------

  /** Game over screen header */
  gameOver: 'GAME OVER',
  // KR: '게임 오버'

  /** Retry / RETRY button label (input-system.md AC.9 RETRY UX) */
  retry: 'RETRY',
  // KR: 'Try Again'

  /** Pre-game ready prompt (M0 may not display) */
  ready: 'READY?',
  // KR: '준비?'

  /** Game start signal (M0 may not display) */
  go: 'GO!',
  // KR: '출발!'

  // -------------------------------------------------------------------------
  // Score popup (visual-juice §3.5)
  // Delta is displayed as integer with leading "+".
  // -------------------------------------------------------------------------

  /** Floating score popup text. Example: "+21" */
  scoreDelta: (delta: number): string => `+${Math.floor(delta)}`,

  // -------------------------------------------------------------------------
  // Combo milestone (score-combo §3.4, visual-juice §3.1 priority 3)
  // -------------------------------------------------------------------------

  /** Milestone reached label. Example: "5 COMBO!" */
  comboMilestone: (tier: number): string => `${tier} COMBO!`,
  // KR: `${tier}콤보!`

  // -------------------------------------------------------------------------
  // Final score display (game-over screen, RETRY UX — score-combo §3.5 getTotalScore)
  // -------------------------------------------------------------------------

  /** Final score shown on game-over screen */
  finalScore: (n: number): string => `Score: ${n}`,
  // KR: `최종 점수: ${n}`
};
