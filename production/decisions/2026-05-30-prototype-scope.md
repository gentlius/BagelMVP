# 의사결정 기록: 프로토타입 스코프 축소 (Director Group 11명 합의)

**Date**: 2026-05-30
**Decision Authority**: Director Group (11명 정밀 검토) + 사용자 최종 ENDORSE
**Status**: Accepted
**Supersedes**: implicit "Pre-Production Documentation" 트랙 (active.md 진행 중이었음)
**Trigger**: 사용자 재검토 요청 — "AI 에이전트 활용 고속 프로토타이핑 → 핵심 재미 검증" 목표 대비 산출물 분량 과다 의심

---

## 1. Context

POP! 프로젝트는 2026-05-29 ~ 30 사이 다음 산출물을 작성했다 (sunk cost 3464줄):

| 문서 | 줄수 | 비고 |
|---|---|---|
| `design/gdd/game-concept.md` | 444 | 4 pillars + Visual Anchor (Neon Glassblowing on Frosted Sky) + AP1 |
| `design/gdd/systems-index.md` | 243 | 14 시스템 dependency-sorted |
| `design/gdd/input-system.md` | 592 | R1 risk, 더블탭 코어 |
| `design/gdd/game-state-manager.md` | 636 | 6 states / 31 ACs / 5 specialist critique 통과 |
| `design/gdd/seed-rng-system.md` | 491 | Mulberry32 / 17 ACs |
| `design/art/art-bible.md` | 1058 | Visual Contract + Z-layer + 풍선 6색 + bundle budget + A11y |

원래 잔여 계획 (~10 sessions = ~15h human focused):
- 10 시스템 GDD 미작성 / UX × 3 / asset-spec / engine-agnostic impl-spec / qa-plan / design-review × all

사용자 명시 목표는 "AI 에이전트(Claude Code)에게 HTML5 캐주얼 게임 프로토타입을 구현시킬 수 있는 기획문서 작성. 시장 데이터 기반 의사결정 문화." 즉 deliverable의 audience는 다른 AI agent이며, 검증 우선 빠른 사이클이 목표. 그러나 실제 트랙은 Pre-Production / Vertical Slice 분량으로 drift했음.

---

## 2. Decision

**프로토타입 스코프로 축소한다.** Director Group 11명 (creative-director, technical-director, producer, game-designer, lead-programmer, art-director, audio-director, qa-lead, narrative-director, release-manager, localization-lead) 전원 정밀 검토 후 OBJECT 0건, ENDORSE 또는 CONDITIONAL ENDORSE 11/11.

### 2.1 Verdict 분포

| Verdict | 수 | Director |
|---|---|---|
| ENDORSE (강력) | 1 | producer |
| ENDORSE (조건부) | 1 | game-designer |
| ENDORSE (with flags) | 1 | release-manager |
| NO MATERIAL IMPACT | 2 | narrative-director, localization-lead |
| CONCERN (방향 동의, 보강 필수) | 6 | creative-director, technical-director, lead-programmer, art-director, audio-director, qa-lead |
| OBJECT | 0 | — |

### 2.2 KEEP / COMPRESS / ISOLATE / CUT 최종 결정

**KEEP (full)**:
- `design/gdd/game-concept.md` — 4 pillars + Visual Anchor의 원천
- `design/gdd/input-system.md` — R1 코어. AC.5/6/7/8 (edge case · A/B infra)는 `> [PROCEED only]` callout 마킹으로 prototype context budget 절약

**COMPRESS**:
- `design/gdd/systems-index.md` — 14 → 5 코어 시스템 (input + balloon-physics-split + critical-pop + score-combo + visual-juice). 나머지 9개는 "Post-Proto Backlog" 섹션으로 강등
- `design/art/art-bible.md` — 다음 섹션만 유지 또는 추출:
  - §1 Visual Identity Statement (Anchor + 팔레트 + Visual Contract) — KEEP
  - §4 Color System (6색 hex + glow + Critical) — KEEP
  - §6.2 Frosted Sky 절차 생성 코드 (30줄) — KEEP
  - **§6.3 Z-layer 아키텍처 (5줄) — KEEP (격리 금지, Tech Dir + Art Dir 합의)**
  - §8.5 Bundle Budget line (총 600KB) — KEEP
  - §2 Mood (S2·S3만), §3 Shape (size/proportion만), §5 Character (idle + Critical pose만) — COMPRESS
  - §2 S1·S4–S7, §3 Tier hierarchy, §5 animation timing, §7 UI 전체, §8 per-category 프롬프트, §9 Reference, Accessibility — ISOLATE to `design/art/draft/`

**NEW 1-pager × 4 (각 100-200줄, 9섹션 GDD 표준 우회 — ADR-001로 정당화)**:
- `design/gdd/balloon-physics-split-system.md` (character-harpoon 흡수 + difficulty-spawn 인라인 `SPAWN_COUNT_0/30/60`)
- `design/gdd/critical-pop-system.md` (Pity timer + Critical×Combo 카운트 규칙 "Critical +1, 연쇄 각 +1 cap +3" 선잠금)
- `design/gdd/score-combo-system.md` (점수 수식 + 콤보 단위 정의 + 5콤보 트리거)
- `design/gdd/visual-juice-system.md` (Critical 다크닝 + Pop particle + 5콤보 글로우 피크 + 이벤트 우선순위 + audio implementation note)

**NEW 단일 entry point**:
- `design/prototype-spec.md` — 14 Mandatory Additions 흡수 (아래 §3 참조). 다른 1-pager보다 우선 작성.

**ISOLATE → `design/gdd/draft/`**:
- `game-state-manager.md` (PROCEED 후 sprint-01에서 retrofit. 재critique 불필요 — 5 specialist 이미 통과)
- `seed-rng-system.md` GDD 본문 (단, prototype-spec.md에 `rng()` thin wrapper 5-7줄 inline 필수 — Math.random() 직접 호출 금지)

**ISOLATE → `design/art/draft/`**:
- art-bible.md의 위 COMPRESS 목록에서 ISOLATE 분류된 섹션

**CUT (PROCEED 후 작성)**:
- 9 시스템 GDD: power-up, difficulty-spawn (단독 GDD), adaptive-bg, audio-system, save, ui-system, character-harpoon (별도 GDD), seed-rng (본문)
- `/ux-design × 3` (Menu / HUD / Score Screen)
- `/asset-spec per-asset 매니페스트` (대신 minimal 1페이지 asset list 유지 — Art Dir 권장)
- `docs/engine-agnostic-implementation-spec.md` (Pixi v8 lock-in으로 불필요)
- `/qa-plan` 전체 skill (대신 prototype-spec.md inline QA section)
- `/design-review × all GDDs` (대신 1-pager 4종 작성 후 mini consistency check 1세션 — QA Lead 권장)

---

## 3. 14 Mandatory Additions (prototype-spec.md 흡수)

전 Director가 합의한 단일 entry point 구조. prototype-spec.md 작성 시 다음 14개를 모두 포함:

| # | 항목 | 요청자 | 분량 |
|---|---|---|---|
| 1 | Pixi v8 boilerplate (App.init async, DPR, Ticker, canvas mount) | Tech Dir, Lead Prog | 20-30줄 |
| 2 | `rng()` thin wrapper template (Math.random() wrapping) | Creative Dir, Tech Dir, Lead Prog, QA Lead | 5-7줄 |
| 3 | GameLoop 3-method contract (reset / start / end) | Lead Prog | 5줄 |
| 4 | Z-layer 5줄 lock (`bgContainer < balloonContainer < harpoonContainer < vfxContainer < uiContainer`) | Tech Dir, Art Dir | 5줄 |
| 5 | AP1 (No Predatory Monetization) 1줄 재명시 | Creative Dir | 1줄 |
| 6 | P4 RETRY AC ("데스→탭 ≤1") + Critical 출현 보장 AC ("첫 3런 안 90% 목격") | Narrative Dir | 4줄 |
| 7 | PROCEED/PIVOT/KILL 기준: 5 Build Gates + 6 Player Gates | QA Lead | 30줄 |
| 8 | Performance budget hard floor (60fps iPhone 11, <30 draw calls, <600KB) | Tech Dir, Release Mgr | 5줄 |
| 9 | Bundle analyzer 첫 빌드부터 실행 (`vite-bundle-visualizer`) | Release Mgr | 2줄 |
| 10 | Audio implementation note (sfxr 7 SFX + CC0 BGM 1트랙 + Web Audio API 직접) | Audio Dir | 15줄 |
| 11 | 실기 검증 (iPhone 11 Safari 15 또는 Galaxy A52 Chrome 60fps) | Release Mgr | 2줄 |
| 12 | ui-strings.js 단일 파일 집중 강제 | Localization Lead | 3줄 |
| 13 | Layered Translucency 4-layer 규칙 ("frosted sky → balloon glass body → neon rim → bloom") | Creative Dir | 1줄 |
| 14 | SemVer pre-release 태그 (v0.1.0-proto.N) + 정적 호스팅 결정 | Release Mgr | 3줄 |

### 3.1 QA Lead Build Gates (BLOCKING)

- **GATE-01**: `npm run build` exit 0 + dist/ 생성
- **GATE-02**: `npm run preview` HTTP 200
- **GATE-03**: Playwright 모바일 viewport (390×844) 60s 세션, console.error 0
- **GATE-04**: Pixi Ticker.deltaMS — P50 ≥58fps, P99 ≥55fps
- **GATE-05**: Bundle <600KB

### 3.2 QA Lead Player Gates (PROCEED 기준)

- **PG-01**: 평균 세션 ≥90s
- **PG-02**: 2/3 테스터 ≥3 연속 런 ("한 번 더")
- **PG-03**: 더블탭 인식률 ≥90% (P1 검증)
- **PG-04**: Critical 목격 첫 3런 안 90% 테스터 (P3 검증)
- **PG-05**: FPS ≥55 floor
- **PG-06**: "조작감" Likert ≥4/5 (4/5 테스터)

---

## 4. ADR Triggers (필수 작성)

다음 2건의 ADR을 1-pager 작성 *전*에 작성한다 (Tech Dir + Producer 공동 서명):

- **ADR-001**: Prototype-Scoped Documentation Bypass
  - `.claude/rules/design-docs.md` 9섹션 hard rule을 prototype 단계 한정 우회
  - Consequences: `/design-review` skill prototype 1-pager에 비활성화, PROCEED 시 9섹션 GDD로 승격
- **ADR-002**: State Machine / RNG Determinism Deferral
  - game-state-manager + seed-rng-system 본문 격리 결정의 회수 비용 + retrofit trigger 명시
  - Recovery Trigger: PROCEED 결정 직후 sprint-01 첫 task

---

## 5. Milestone 구조 재설계 (Producer 권장)

```
M0: Prototype Validation (NEW, NOW)
  DoD:
    [ ] 8 docs 작성 완료 (game-concept, input-system, systems-index 압축본,
        art-bible 압축본, 4× 1-pager, prototype-spec.md)
    [ ] ADR-001 + ADR-002 작성 + 서명
    [ ] Pixi v8 프로토타입 빌드 동작 (5 Build Gates 통과)
    [ ] PROCEED/PIVOT/KILL 판정 결과 문서화 (6 Player Gates 측정)
    [ ] 판정에 따라 다음 마일스톤 정의

M1: Pre-Production (M0 PROCEED 시 진입)
  DoD:
    [ ] sprint-01 첫 task: game-state-manager + seed-rng retrofit (ADR-002)
    [ ] 잔여 9 시스템 GDD 작성
    [ ] UX × 3 / impl-spec / qa-plan / design-review × all 완료
    [ ] draft/ 문서 재통합 + 인덱스 등록

M2: Production (M1 완료 후) — TBD
```

`production/milestones/m0-prototype-validation.md` 신설.

---

## 6. 잔여 사용자 결정 (PROCEED 시점 또는 별도)

다음 3건은 Director Group 결정 불가, 사용자 권한:

1. **출시 언어 결정**: KR only / EN only / 둘 다 — prototype은 KR로 충분
2. **BGM 소스 라이선스**: Soundimage.org Daniel Simion arcade loop 또는 freemusicarchive.org CC0
3. **mini consistency check 1세션 수용**: QA Lead 권장 — 1-pager 4종 작성 후 cross-system formula 일관성 검증

사용자 ENDORSE 시점에 #3은 **수용** 결정됨 (option A "ENDORSE 전부").

---

## 7. Recovery 분석 (Producer)

| Doc | Sunk Cost | If ISOLATED | PROCEED Recovery | PIVOT Survival |
|---|---|---|---|---|
| game-state-manager.md | 636줄 / 5 critique / 31 ACs | 거의 0 | **15-30분** (이동 + 인덱스 등록) | 부분 생존 |
| seed-rng-system.md | 491줄 / Mulberry32 / 17 ACs | 거의 0 | **10-15분** | **100% 생존** (엔진 비종속) |
| art-bible.md (Z-layer/bundle/A11y) | ~858줄 → draft/ | 거의 0 | **5-10분** | 부분 생존 |
| **합계 PROCEED recovery** | — | — | **30-55분** | — |

시간 절약 (원래 ~15h vs prototype ~3h docs + ~6-9h 빌드 = ~10-13h) 대비 무시 가능.

---

## 8. New Risks (Risk Register 등록 필요)

| ID | Risk | Prob | Impact | Mitigation |
|---|---|---|---|---|
| R-PROTO-01 | Prototype PIVOT 시 game-state-manager 부분 폐기 | M (30%) | M | draft/에 보존, PROCEED 시 즉시 복귀 가능 |
| R-PROTO-02 | "1.5-2 sessions = 3h" docs 추정 — 빌드 구현 시간 미포함 | H (60%) | M | M0 DoD에 빌드 시간 별도 estimate. 빌드 자체 6-9h 가능성 |
| R-PROTO-03 | 4× 1-pager 압축 부족 — 빌드 시 ambiguity 발생 | M (40%) | L | iterative 작성 (첫 1-pager → 빌드 시도 → 부족분 보강 → 다음) |
| R-PROTO-04 | draft/ 폴더 영구 임시 상태 (Pre-Production 진입 못 함) | M (35%) | M | M0 판정 시점에 draft/ 처리 결정 명시 |
| R-PROTO-05 | Prototype 60fps 미달 (iPhone 11 기준) | M (30%) | H | 빌드 첫날 perf 측정 |
| R-PROTO-06 | Sunk cost 인지부조화로 PIVOT/KILL 판정 회피 | H (50%) | H | prototype-spec.md에 수치 기반 판정 기준 사전 명시 |
| R-PROTO-07 | Audio cut 인한 false negative ("재미없다"가 실은 무음 때문) | M (35%) | H | sfxr 7 SFX + CC0 BGM 1트랙 구현 강제 (Mandatory #10) |
| R-PROTO-08 | Pixi v8 API hallucination (LLM이 v5/v6 코드 출력) | H (55%) | M | Mandatory #1 boilerplate snippet + ADR-001 anchor 박스 |

---

## 9. 다음 단계 (Producer iterative 권장 순서)

1. ✅ 사용자 GO 결정 (2026-05-30 — option A)
2. ⏳ active.md 갱신 (Director Group review task 종결 + M0 진입 명시)
3. ⏳ ADR-001 + ADR-002 작성 (`docs/architecture/` 신설)
4. ⏳ M0 마일스톤 신설 (`production/milestones/m0-prototype-validation.md`)
5. ⏳ prototype-spec.md 작성 (14 Mandatory Additions 흡수 — 다른 1-pager보다 우선)
6. ⏳ draft/ 디렉토리 이동 (game-state-manager + seed-rng GDD 본문)
7. ⏳ art-bible scope-extract (격리 섹션 → draft/, KEEP 섹션 그대로 유지)
8. ⏳ systems-index.md 압축 (14 → 5 + Post-Proto Backlog 섹션)
9. ⏳ 1-pager 4종 작성 (balloon-physics-split → critical-pop → score-combo → visual-juice, iterative)
10. ⏳ mini consistency check 1세션 (QA Lead 주관)
11. ⏳ devops-engineer: 최소 CI (Vite build success) + bundle analyzer
12. ⏳ prototype 빌드 착수 (이후 코드 구현 단계)

---

## 10. 서명

- **사용자 (joywoni)**: ENDORSE 전부 — 2026-05-30 option A 선택
- **Director Group 11명**: 위 verdict 매트릭스 참조
- **Decision Record**: `production/decisions/2026-05-30-prototype-scope.md` (본 문서)

본 결정은 Accepted 상태로, 이후 변경은 새 ADR 또는 `/propagate-design-change`를 통해 처리한다.
