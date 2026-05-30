# Milestone M0: Prototype Validation

> **Status**: Active (2026-05-30 ~)
> **Goal**: 핵심 재미 가설 검증 → PROCEED / PIVOT / KILL 판정
> **Source Decision**: production/decisions/2026-05-30-prototype-scope.md
> **Internal**: 이 파일은 deliverable 패키징에서 제외 (사용자 본인의 의사결정 추적 도구)
> **Audience**: 사용자 (joywoni) + Director Group internal

---

## Goal

POP!의 4 pillars (P1 한 손가락 한 결정 / P2 화면이 점수보다 먼저 말한다 / P3 운은 자주 실력은 깊게 / P4 1탭이 다음 런으로) 가 코어 메커닉만으로 검증되는지 확인. 정답이 PROCEED면 M1 진입, 아니면 PIVOT 또는 KILL.

핵심 검증 가설: "더블탭 분열 루프 + 모멘텀 빌드업이 자발적 5런 반복을 유도하는가."

---

## Scope

### 작성할 deliverable (외부 제출)

`design/gdd/`:
- game-concept.md (기존, 그대로)
- systems-index.md (압축 5 시스템 + §Engine Bootstrap + §Conventions)
- input-system.md (기존 + P4 RETRY AC 추가 + PROCEED-only 마킹)
- balloon-physics-split-system.md (NEW)
- critical-pop-system.md (NEW)
- score-combo-system.md (NEW)
- visual-juice-system.md (NEW, §Audio Implementation Note 포함)

`design/art/`:
- art-bible.md (compressed in-place + Layered Translucency 1줄 추가)
- samples/01-character-balloon-sky.html (기존, Visual Contract)

### 빌드

Pixi v8 + Vite로 위 명세 그대로 구현한 playable prototype.

---

## Build Gates (5건, BLOCKING)

빌드 검증 게이트. 미통과 시 빌드 미완성으로 간주.

| Gate | 기준 |
|---|---|
| **GATE-01** | `npm run build` exit 0 + `dist/` 디렉토리 생성 |
| **GATE-02** | `npm run preview` HTTP 200 응답 |
| **GATE-03** | Playwright 모바일 viewport (390 × 844) — 60s 세션 중 `console.error` 0건, SCRIPT ERROR 패턴 0건 |
| **GATE-04** | Pixi `Ticker.deltaMS` 측정 — 60s 세션 P50 ≥ 58fps, P99 ≥ 55fps (iPhone 11 / Galaxy A52 기준 또는 동급 데스크탑 throttle 시뮬레이션) |
| **GATE-05** | Bundle 총량 < 600KB (`vite-bundle-visualizer` 측정) |

---

## Player Gates (6건, PROCEED 판정 기준)

테스터 ≥ 5명 대상. 정량 + 정성 혼합.

| Gate | 기준 | 검증 pillar |
|---|---|---|
| **PG-01** | 평균 세션 길이 ≥ 90초 (의도적 자동 종료 없이) | 코어 가설 |
| **PG-02** | 테스터 2/3 이상이 ≥ 3 연속 런 (한 런 종료 후 자발적 RETRY) | P4 |
| **PG-03** | 더블탭 인식률 ≥ 90% (튜토리얼 없이 30초 내 첫 발사 성공 비율) | P1 |
| **PG-04** | 첫 3런 안에 Critical Pop을 1회 이상 목격한 테스터 비율 ≥ 90% | P3 |
| **PG-05** | FPS 측정 평균 ≥ 55 floor (GATE-04와 별개 — 실기 측정) | P2 (간접) |
| **PG-06** | "조작감" 7-point Likert ≥ 4/5 (4/5 이상 테스터) | P1 |

---

## PROCEED / PIVOT / KILL 판정 매트릭스

판정 시점: Build Gates 5건 + Player Gates 6건 측정 완료 후.

| 판정 | 조건 | 액션 |
|---|---|---|
| **PROCEED** | Build Gates 5/5 + Player Gates ≥ 5/6 (PG-01 + PG-02 + PG-06 필수 통과) | M1 Pre-Production 진입 |
| **PIVOT** | Build Gates 5/5 + Player Gates 3/6 ~ 4/6, **but** 테스터 정성 피드백에서 "다른 메커닉을 보고 싶다"는 신호 ≥ 2/5 | 컨셉 재정의 (game-concept.md 부분 폐기). m1 retrofit task 일부 무효 가능. 사용자 결정 |
| **KILL** | Build Gates 5/5 + Player Gates ≤ 2/6 또는 PG-01·PG-02·PG-06 중 2개 이상 실패 | 프로젝트 일시 중단. 학습 비용 수용. sunk cost = 작성된 GDD + 빌드 시간 |
| **REBUILD** | Build Gates < 5/5 | 기술 문제 해결 후 재측정. 판정 미실시. R-PROTO-05 (60fps 미달) 우선 조사 |

> **R-PROTO-06 완화**: 인지부조화로 PIVOT/KILL 회피 금지. 위 수치 기준은 사전 lock-in. 측정 후 결과 그대로 판정.

---

## 실기 검증 (필수)

다음 중 1대 이상에서 GATE-04 + PG-05 측정:

- iPhone 11 (Safari 15+, iOS 14.x 이상)
- Samsung Galaxy A52 (Chrome 100+)

데스크탑 throttle 시뮬레이션만으로 PROCEED 불가. 실기 미검증 시 GATE-04 미통과로 간주.

---

## SemVer 태깅

매 빌드 cycle마다 git tag:

- `v0.1.0-proto.1`: 첫 빌드 완성 시점
- `v0.1.0-proto.2`: 첫 테스트 후 수정 시점
- `v0.1.0-proto.N`: PROCEED/PIVOT/KILL 판정 시점에 최종 태그

판정 결과는 해당 tag annotation에 1줄 명시 (예: "PROCEED — Player Gates 5/6").

---

## DoD (M0 Closed 조건)

P-RULE-02 적용: 아래 전 항목 [x] + producer + qa-lead 서명 후 M0 Closed.

### 산출물 작성
- [ ] design/gdd/systems-index.md 압축본 작성 (14 → 5 + §Engine Bootstrap + §Conventions)
- [ ] design/gdd/input-system.md 갱신 (P4 RETRY AC 추가, PROCEED-only 마킹)
- [ ] design/gdd/balloon-physics-split-system.md 작성 (character-harpoon + difficulty-spawn 흡수)
- [ ] design/gdd/critical-pop-system.md 작성 (Pity timer + Critical 출현 보장 AC)
- [ ] design/gdd/score-combo-system.md 작성
- [ ] design/gdd/visual-juice-system.md 작성 (§Audio Implementation Note 포함)
- [ ] design/art/art-bible.md 압축 + Layered Translucency 1줄 추가
- [ ] mini consistency check 1세션 통과 (QA Lead 주관, 1-pager 4종 작성 후)

### 빌드 검증
- [ ] vite.config.js + package.json 셋업
- [ ] vite-bundle-visualizer 초기 빌드부터 실행
- [ ] 최소 CI 설정 (GitHub Actions: `npm run build` 성공 게이트)
- [ ] Build Gates 5/5 통과 (GATE-01 ~ GATE-05)

### 테스트 + 판정
- [ ] 테스터 ≥ 5명 모집
- [ ] 실기 검증 1대 이상 (iPhone 11 또는 Galaxy A52)
- [ ] Player Gates 6건 측정 + 정성 피드백 수집
- [ ] PROCEED / PIVOT / KILL 판정 + git tag annotation
- [ ] 판정 결과 production/decisions/에 신규 기록 파일 추가
- [ ] M1 진입 여부 결정 (PROCEED) 또는 컨셉 재정의 (PIVOT) 또는 중단 (KILL)

---

## Risk Register (M0 한정)

`production/decisions/2026-05-30-prototype-scope.md` §8에서 가져옴:

| ID | Risk | Mitigation |
|---|---|---|
| R-PROTO-02 | docs 추정 3h — 빌드 구현 시간 미포함 (실제 6-9h) | M0 DoD 분리: docs DoD vs 빌드 DoD |
| R-PROTO-03 | 1-pager 압축 부족 → ambiguity | iterative 작성 (첫 1-pager → 빌드 시도 → 보강) |
| R-PROTO-05 | 60fps 미달 | 빌드 첫날 perf 측정 |
| R-PROTO-06 | sunk cost 인지부조화 | 위 PROCEED/PIVOT/KILL 매트릭스 수치 lock-in |
| R-PROTO-07 | Audio cut 인한 false negative | sfxr 7 SFX + CC0 BGM 강제 (visual-juice §Audio Implementation Note) |
| R-PROTO-08 | Pixi v8 API hallucination | systems-index §Engine Bootstrap snippet |

---

## 사용자 잔여 결정 (M0 진행 중 또는 종결 시)

다음 3건은 사용자 결정 필요. M0 종결 전까지 또는 PROCEED 진입 시 해소:

1. **출시 언어 결정**: KR only / EN only / 둘 다 — prototype은 KR로 충분 (Localization Lead 권장)
2. **BGM 소스 라이선스**: Soundimage.org Daniel Simion arcade loop 또는 freemusicarchive.org CC0 — visual-juice §Audio Implementation Note 작성 전에 결정
3. **draft/ 패키징 제외 방식 (결정됨)**: deliverable 패키징 단계 명시적 제외 (`.gitignore` 미사용) — 2026-05-30 option 1-B

---

## 다음 진입점

PROCEED → production/milestones/m1-pre-production.md (이미 작성, 활성 작업으로 전환)
PIVOT → 신규 production/decisions/YYYY-MM-DD-pivot.md 작성 + game-concept.md 재작성
KILL → production/decisions/YYYY-MM-DD-kill.md 작성 + 프로젝트 중단
