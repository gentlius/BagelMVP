# Milestone M1: Pre-Production

> **Status**: Pending (M0 PROCEED 결정 후 실행 시작)
> **Goal**: 검증된 핵심 재미 위에 Pre-Production 산출물 완성 → Production 진입 준비
> **Predecessor**: production/milestones/m0-prototype-validation.md (PROCEED 종료 필수)
> **Source Decision**: production/decisions/2026-05-30-prototype-scope.md
> **Internal**: 이 파일은 deliverable 패키징에서 제외

---

## 활성화 조건

M0 PROCEED 판정 직후 본 마일스톤을 sprint로 분해해서 실행 시작. M0가 PIVOT 또는 KILL이면 본 파일의 작업 항목은 일부 또는 전부 무효.

---

## 1. Retrofit Tasks (sprint-01 첫 작업)

prototype에서 의도적으로 단순화한 구현을 정식 시스템으로 교체.

### 1.1 RNG: Math.random() → Mulberry32 결정론

**Prototype 상태**: `rng()` thin wrapper가 Math.random()을 내부 호출. 게임 코드는 wrapper만 호출 (systems-index.md §Conventions 강제).

**M1 작업**: wrapper 내부 구현을 Mulberry32로 교체. **wrapper 한 파일만 수정 — 호출자 변경 0건.**

**명세 (보존)**: [design/gdd/draft/seed-rng-system.md](../../design/gdd/draft/seed-rng-system.md)
- 491줄, 12 섹션, 17 ACs
- Mulberry32 알고리즘 명세
- 3 domain-specific 인스턴스 (spawn / critical / powerup) cross-contamination 방지
- seed 주입 방식 (URL query `?seed=XXX`, localStorage 저장)
- systems-designer 1회 critique 통과 (2026-05-30)

**M1 진입 시 액션**:
1. draft/seed-rng-system.md를 design/gdd/seed-rng-system.md로 이동 (재critique 불필요)
2. systems-index.md §Conventions 섹션에서 "rng 내부 구현은 Mulberry32" 명시 (구현자에게는 변경 비가시 — wrapper 인터페이스 동일)
3. 결정론 회귀 테스트 추가 (AC-05 fixed seed 재현성, AC-06 chi-square 균등성)
4. Math.random() codebase grep — `rng()` wrapper 밖에서 호출되면 violation

### 1.2 GameLoop: 단일 "playing" → 6-state machine

**Prototype 상태**: GameLoop 클래스가 reset() / start() / end() 3-method contract을 노출하는 단일 진입점.

**M1 작업**: GameLoop을 6-state state machine으로 확장. 외부 API (reset / start / end)는 유지 — 호출자 변경 0건. 내부 구현이 state machine으로 교체.

**명세 (보존)**: [design/gdd/draft/game-state-manager.md](../../design/gdd/draft/game-state-manager.md)
- 636줄, 12 섹션, 31 ACs
- 6 states: boot / boot_error / menu / playing / dead / paused
- lifecycle hook 순서 (onExit → setState → onEnter → emit)
- iOS Safari pagehide/pageshow 대응
- visibility debounce (performance.now())
- 큐 용량 MAX_QUEUED_TRANSITIONS = 1
- art-bible 충돌 4건 해소 완료
- **5 specialist critique 통과** (systems-designer + qa-lead + creative-director + ux-designer + engine-programmer) — 재critique 불필요

**M1 진입 시 액션**:
1. draft/game-state-manager.md를 design/gdd/game-state-manager.md로 이동
2. systems-index.md §Engine Bootstrap에서 GameLoop contract 명시는 유지, 내부 구현 노트 갱신
3. UI 결합: menu / dead / paused state는 ui-system GDD (작성 예정) 가 hook
4. P-RULE: GSM 도입과 ui-system 작성을 같은 sprint 내 묶음 (P4 검증 의존)

---

## 2. 신규 GDD 작성 (M1 본작업)

prototype에서 cut한 9 시스템을 정식 GDD로 작성. 9-section 표준 (.claude/rules/design-docs.md) 적용.

| # | 시스템 | 우선순위 | 의존 |
|---|---|---|---|
| 1 | character-harpoon-system | High | input-system, game-state-manager |
| 2 | difficulty-spawn-system | High | seed-rng, balloon-physics |
| 3 | power-up-system | Mid | seed-rng, balloon-physics, score-combo |
| 4 | adaptive-background-system | Mid | critical-pop, power-up |
| 5 | audio-system | High | character-harpoon, balloon-physics, critical, power-up, score-combo |
| 6 | save-system | Mid | score-combo |
| 7 | ui-system | High | game-state-manager, score-combo, save |

> **참고**: character-harpoon은 prototype 단계에서 balloon-physics-split-system.md에 흡수되어 구현된다. M1에서 분리된 정식 GDD로 작성 시 prototype 구현을 분리·리팩터링.
> **참고**: difficulty-spawn은 prototype 단계에서 balloon-physics-split-system.md Tuning Knobs에 인라인 (SPAWN_COUNT_0/30/60). M1에서 정식 시스템 GDD로 확장.

---

## 3. art-bible 격리 섹션 재통합

prototype에서 design/art/draft/로 격리한 art-bible 섹션을 design/art/art-bible.md 본문으로 재통합:

- §2 Mood (S1·S4–S7 추가)
- §3 Shape Language Tier hierarchy
- §5 Character Design animation timing spec
- §6.x Adaptive Background full spec (Z-layer §6.3은 prototype에서 이미 본문 유지)
- §7 UI/HUD Visual Direction (전체)
- §8 Asset Standards per-category AI 생성 프롬프트
- §9 Reference Direction
- Accessibility 섹션

draft/art-bible-extras.md (또는 분할 파일) → art-bible.md 본문 흡수.

---

## 4. UX 작성

`/ux-design` skill 사용:

- design/ux/main-menu.md
- design/ux/gameplay-hud.md
- design/ux/score-screen.md

ui-system GDD 작성 *전*에 UX spec 완료 (P-RULE: UI는 UX 정의 후 구현).

---

## 5. asset-spec 매니페스트

`/asset-spec` skill 사용. 모든 art 자산에 대해:

- AI 생성 프롬프트
- 파일명 (sfx_..., mus_..., spr_..., tex_... 명명 규칙)
- 라이선스 정보
- 압축 사양

---

## 6. engine-agnostic implementation spec

`docs/engine-agnostic-implementation-spec.md` (수동 작성) — 단, 엔진 lock-in (Pixi v8) 상태이므로 작성 가치 재평가 필요. M1 sprint 계획 시 producer + technical-director 판단.

후보: 이 작업을 skip하고 Pixi v8 specific implementation guide로 대체.

---

## 7. QA Plan + Design Review

`/qa-plan` — Test Evidence by Story Type 표 기반 logic test 케이스
`/design-review × all GDDs` — 일관성·완결성 검증 (해소된 prototype 1-pager + 신규 9 시스템 GDD)

---

## DoD (M1 Closed 조건)

- [ ] Retrofit task 2건 완료 (rng Mulberry32 + GameLoop 6-state machine)
- [ ] draft/ 디렉토리 비움 (2 파일 모두 design/gdd/로 복귀)
- [ ] 신규 9 시스템 GDD 작성 완료 + Approved
- [ ] art-bible.md 격리 섹션 재통합 완료
- [ ] UX × 3 작성 + /ux-review 통과
- [ ] asset-spec 매니페스트 완료
- [ ] /qa-plan 완료
- [ ] /design-review × all GDDs 통과 (`/review-all-gdds`)
- [ ] systems-index.md "Post-Proto Backlog" 섹션 폐기 — 모든 시스템이 정식 시스템으로 통합
- [ ] Test Evidence by Story Type 표 기준 BLOCKING evidence 100%

---

## 다음 진입점

M1 완료 → production/milestones/m2-production.md (작성 예정, M1 종결 직전)

---

## Recovery 비용 추정 (Producer)

| Task | Recovery Time | Notes |
|---|---|---|
| draft/seed-rng → design/gdd/ 이동 | 10-15분 | 인덱스 등록만 |
| draft/game-state-manager → design/gdd/ 이동 | 15-30분 | 인덱스 등록 + ui-system 결합 검토 |
| 9 시스템 GDD 작성 | ~6 sessions (~9h) | 시스템당 평균 1 session |
| art-bible 격리 섹션 재통합 | 1 session | 본문 복원 |
| UX × 3 + asset-spec | 2 sessions | |
| qa-plan + design-review | 1 session | |
| **합계** | **~10-12 sessions ≈ 15-18h** | M1 전체 estimate |
