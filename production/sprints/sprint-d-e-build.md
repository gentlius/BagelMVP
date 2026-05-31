# Sprint D+E.Build — POP! Autonomous Build Sprint

> **Date**: 2026-05-31 ~ (open-ended, autonomous execution)
> **Author**: producer (Director Group autonomous build mode)
> **Milestone**: M0 Prototype Validation
> **Source mandate**: `production/session-state/active.md` §AUTONOMOUS BUILD MODE
> **Status**: Active
> **Review mode**: lean (no PR-SPRINT gate — autonomous Director Group mandate)

---

## 1. Sprint Goal & Definition of Done

### Goal

POP! M0 prototype의 모든 **빌드 인프라(Phase D)** 와 **5 시스템 통합 구현 + Build Gates 5/5
통과 + 브라우저 실행 가능 빌드(Phase E.Build)** 를 Director Group 자율 위임 방식으로 한
sprint 안에 완성한다. 사용자는 sprint 종료 시점에 `npm run dev` 한 줄로 게임을 직접
플레이할 수 있어야 한다.

### Definition of Done (블로킹)

**기술 DoD** (이 sprint에서 달성):

- [ ] `package.json` + `vite.config.ts` + `tsconfig.json` 작성 + `npm install` 클린 통과
- [ ] `src/main.ts` 부트스트랩 (Pixi v8 §Engine Bootstrap snippet 그대로) — 검은 화면 + 캔버스 마운트 확인
- [ ] 5 시스템(input / balloon-physics-split / critical-pop / score-combo / visual-juice) 통합 구현 — 5 GDD `§9 Implementation Checklist` 각 항목 [x]
- [ ] HUD overlay (Score + Combo + RETRY 버튼) 구현 — `ui-strings.js` 단일 소유
- [ ] SFX 7개 (PowerShell 합성 6 + freesound UI 클릭 1, 또는 6 합성 + 1 placeholder) `assets/audio/sfx/` 배치 + Web Audio loader 연동
- [ ] Pixi v8 GlowFilter 적용 (Neon Glassblowing, art-bible §1.2)
- [ ] `tests/unit/` 골격 + 핵심 수식 unit test 5개 이상 통과 (Vitest)
- [ ] `tests/e2e/smoke.spec.ts` Playwright 모바일 viewport 60s 세션 → console.error 0
- [ ] **GATE-01**: `npm run build` exit 0 + `dist/` 생성
- [ ] **GATE-02**: `npm run preview` HTTP 200
- [ ] **GATE-03**: Playwright 모바일(390×844) 60s, console.error 0건
- [ ] **GATE-04**: Pixi `Ticker.deltaMS` P50 ≥ 58fps / P99 ≥ 55fps (데스크탑 throttle CPU 4x 시뮬레이션, 실기는 사용자 측정으로 분리)
- [ ] **GATE-05**: Bundle `dist/` 총량 < 600KB (vite-bundle-visualizer report)
- [ ] `.github/workflows/ci.yml` (build + unit + e2e + bundle size 4-gate)
- [ ] `assets/audio/LICENSE_REGISTRY.md` 스켈레톤 작성 (BGM 3 슬롯 placeholder + SFX 7개 PowerShell 합성 기재)
- [ ] `npm run dev` 단일 명령으로 브라우저에서 60fps 게임 플레이 가능
- [ ] `production/decisions/2026-05-31-build-decisions.md` 자율 결정 누적 기록

**명시적 제외** (이 sprint 범위 밖, 사용자 단계):

- ❌ Player Gates 6건 측정 (PG-01 ~ PG-06) — 테스터 ≥ 5명 모집 후 별도
- ❌ iPhone 11 / Galaxy A52 실기 60fps 검증 — 사용자가 디바이스에서 직접
- ❌ BGM 3 트랙 freesound 다운로드 + Audacity 처리 — 사용자가 빌드 받은 후 직접
- ❌ PROCEED / PIVOT / KILL 최종 판정 — Player Gates + 실기 검증 완료 후
- ❌ M1 retrofit 항목 (BitmapText, ADR 작성, game-state-manager 정식 GDD)

### 사용자 손 필요 작업 (sprint 종료 후)

| 작업 | 출처 | 예상 소요 |
|---|---|---|
| BGM 3 트랙 freesound.org 다운로드 (Seth_Makes_Sounds #684184 외 2) + Audacity 루프포인트 + OGG q6 + LUFS -16 | visual-juice §Audio Note | 1-2h 사용자 |
| iPhone 11 Safari 또는 Galaxy A52 Chrome에서 빌드 실행 + FPS 측정 | m0 §실기 검증 | 30분 사용자 |
| Player Gates 6건 — 테스터 5명 모집 + 세션 진행 + 인터뷰 + Likert | m0 §Player Gates | 별도 1주 사용자 |

---

## 2. Capacity & Velocity

- **Phase 1 (devops-engineer)**: 2 sessions ≈ 3h
- **Phase 2 (gameplay-programmer)**: 4-5 sessions ≈ 6-7.5h ← **가장 큰 단일 위험**
- **Phase 3 (병렬 3 sub-agent)**: 각 2 sessions, wall clock 2 sessions ≈ 3h
- **Phase 4 (qa-lead)**: 2 sessions ≈ 3h
- **Phase 5 (producer 보고)**: 1 session ≈ 1.5h
- **총합**: 11-12 sessions = 16-18h AI-agent focused time
- **버퍼 20%**: 추가 2-3 sessions for Phase 2 ambiguity + Phase 4 gate retry

---

## 3. Autonomous Decision Protocol

**모든 sub-agent prompt에 다음 문구를 그대로 복사 — 자율성 보장**:

> Director Group 자율 빌드 모드. 사용자 escalation은 다음 5가지에 한정:
> (1) 게임 컨셉 변경, (2) 스코프 확대/축소, (3) 수익화 도입, (4) 내러티브 기둥 변경,
> (5) 4 pillars (P1/P2/P3/P4) 중 하나의 폐기.
>
> 그 외 모든 결정 — implementation choice / formula tweak / edge case 해석 /
> GDD 모호성 / 코드 구조 / 테스트 전략 / 충돌 해소 — 은 자율 결정한다.
>
> 충돌·모호함 발견 시:
> 1. 관련 director 2명 이상의 시각에서 판단 (예: gameplay-programmer는
>    game-designer + technical-director 양쪽 시각 동시 적용)
> 2. 결정 사항을 `production/decisions/2026-05-31-build-decisions.md`에
>    즉시 append (버퍼링 금지 — P-RULE-01)
> 3. 빌드 작업 계속 진행

---

## 4. Environment Boilerplate (sub-agent prompt 필수 복사)

```
환경: Windows 11 + PowerShell + nvm-windows 1.2.2
Node v24.16.0 LTS Active + npm 11.13.0

매 PowerShell 호출 앞에:
  $env:PATH = "C:\nvm4w\nodejs;" + $env:PATH

npm/npx/vite 호출은 .cmd 변형 (ExecutionPolicy Restricted — .ps1 막힘):
  npm.cmd install
  npm.cmd run build
  npx.cmd vite
  npx.cmd playwright install chromium
  npx.cmd vitest run

working directory: d:\developer\github.com\BagelMVP
```

---

## 5. Sub-Agent Task Breakdown

### Phase 1 — 빌드 인프라 (순차, 1 sub-agent)

| ID | Task | Owner | 입력 | 출력 | Dependencies | 검증 | Est |
|----|------|-------|------|------|------|------|-----|
| **T-01** | `package.json` 작성 — dependencies (pixi.js@^8.0.0, pixi-filters@^6.x), devDependencies (vite, vitest, @playwright/test, typescript, vite-bundle-visualizer), scripts (dev/build/preview/test/test:e2e/analyze) | devops-engineer | technical-preferences.md | `package.json` | — | `npm.cmd install` exit 0, `node_modules/pixi.js/package.json` version "^8" | 0.5 sess |
| **T-02** | `vite.config.ts` 작성 — base path '/', build.target 'es2022', server.host true, build.rollupOptions.output.manualChunks (pixi 분리 + bgm lazy) | devops-engineer | technical-preferences.md, art-bible §8.5 | `vite.config.ts` | T-01 | `npx.cmd vite build` exit 0 (empty src 상태에서도) | 0.5 sess |
| **T-03** | `tsconfig.json` strict + ESM + DOM lib + bundler moduleResolution | devops-engineer | technical-preferences.md | `tsconfig.json` | T-01 | `npx.cmd tsc --noEmit` exit 0 | 0.25 sess |
| **T-04** | `src/main.ts` 부트스트랩 — Pixi v8 App.init async + DPR + Z-layer 5 컨테이너 + Ticker 가동 + canvas mount | devops-engineer | systems-index §Engine Bootstrap | `src/main.ts`, `index.html` | T-01, T-02 | `npm.cmd run dev` 후 브라우저에서 frosted sky 색 배경(#B5D8E8) 확인 | 0.5 sess |
| **T-05** | `tests/` 골격 + 첫 unit test — Balloon Physics 분열 사이즈 수식 1개 (`tests/unit/balloon-split.test.ts`) — passes trivially with stub formula | devops-engineer | balloon-physics-split §4 | `tests/unit/balloon-split.test.ts`, `tests/setup.ts` | T-01 | `npx.cmd vitest run` exit 0, 1 test passes | 0.25 sess |
| **T-06** | `.github/workflows/ci.yml` — 4-job (build / unit / e2e / bundle-size) GitHub Actions, Node 24 setup, npm cache, fail-fast off | devops-engineer | technical-preferences.md | `.github/workflows/ci.yml` | T-01 ~ T-05 | YAML syntax valid (`actionlint` 또는 vscode yaml lint) | 0.5 sess |
| **T-07** | `assets/audio/LICENSE_REGISTRY.md` 스켈레톤 — BGM 3 슬롯 placeholder 표 + SFX 7개 PowerShell 합성 행 + 누락 0건 정책 1줄 | devops-engineer | visual-juice §Audio Note, §LICENSE_REGISTRY.md 관리 | `assets/audio/LICENSE_REGISTRY.md` | — | 파일 존재 + BGM 3행 + SFX 7행 | 0.25 sess |
| **T-08** | `.gitignore` 추가 (node_modules, dist, coverage, playwright-report, test-results, .env, dist/stats.html) | devops-engineer | — | `.gitignore` 추가 | — | `git status` 클린 | 0.1 sess |
| **T-09** | Phase 1 Done 보고서 + 결정 기록 append | devops-engineer | — | `production/decisions/2026-05-31-build-decisions.md` (생성 또는 append) | T-01 ~ T-08 | 파일 존재 + Phase 1 결정 5건 이상 기재 | 0.25 sess |

**Phase 1 합계**: ~3 sessions (devops-engineer 1명)

### Phase 2 — 5 시스템 통합 구현 (순차, 1 sub-agent — 단일 책임자가 인터페이스 일관성 보장)

> **단일 책임자 이유**: 5 시스템 간 이벤트 페이로드 (8건) + 양방향 lock 4건 + P2 listener 순서 lock + AudioContext unlock + Critical×Combo 카운트 규칙 — 한 두뇌가 가지고 있어야 모호성 해소가 즉시 가능. 병렬화 시 인터페이스 충돌 위험.

| ID | Task | Owner | 입력 | 출력 | Dependencies | 검증 | Est |
|----|------|-------|------|------|------|------|-----|
| **T-10** | `src/conventions/rng.ts` — spawn / critical / powerup 3 도메인 분리 (Mulberry32 시드 가능) + Math.random() 호출 0건 grep | gameplay-programmer | systems-index §Conventions | `src/conventions/rng.ts` | T-04 | grep `Math.random` 결과 `src/` 안에 vfx-particle 1곳만 (vfxRandom 예외) | 0.25 sess |
| **T-11** | `src/conventions/ui-strings.ts` — `UI.score(n)` / `UI.combo(n)` / `UI.gameOver` / `UI.retry` 단일 소유 | gameplay-programmer | systems-index §Conventions | `src/conventions/ui-strings.ts` | T-04 | 모든 Pixi `Text` 생성 시 `UI.*` 참조 grep 통과 | 0.25 sess |
| **T-12** | `src/events/event-bus.ts` — emit / on / off / once 4-method tiny event emitter (외부 의존 0) | gameplay-programmer | 5 GDD §6 Dependencies | `src/events/event-bus.ts` | T-04 | unit test 1개 통과 (`tests/unit/event-bus.test.ts`) | 0.25 sess |
| **T-13** | `src/systems/input-system.ts` — touch+mouse drag, double-tap window 300ms, AudioContext unlock 진입점 (`once`) | gameplay-programmer | input-system.md (전체) | `src/systems/input-system.ts` | T-12 | unit test 더블탭 인식 + drag throttle 통과 | 0.75 sess |
| **T-14** | `src/systems/balloon-physics-split.ts` — Balloon entity (id 필드 M-SC-1) + 분열 1→2 + 종단 사이즈 + 작살 충돌 + spawn ticker 누적 (BLOCKING fix from review) + dt 단위 변환 | gameplay-programmer | balloon-physics-split-system.md (전체) | `src/systems/balloon-physics-split.ts`, `src/entities/balloon.ts`, `src/entities/harpoon.ts`, `src/entities/character.ts` | T-12, T-13 | unit test 분열 사이즈 수식 + spawn count 시간곡선 통과 | 1.25 sess |
| **T-15** | `src/systems/critical-pop.ts` — 10% + Pity timer 90s + chain detection + `criticalPop:fired.criticalSize` (M-CP-1 lock) | gameplay-programmer | critical-pop-system.md (전체) | `src/systems/critical-pop.ts` | T-12, T-14 | unit test Pity timer 90s + chain detection + criticalSize 페이로드 통과 | 0.75 sess |
| **T-16** | `src/systems/score-combo.ts` — 점수 수식 + 콤보 단일 소유 + Critical+1+chain cap+3 lock + `score:updated` 8필드 + frame-guard (balloon id) | gameplay-programmer | score-combo-system.md (전체) | `src/systems/score-combo.ts` | T-12, T-14, T-15 | unit test 수식 (Large/Medium/Small × combo × critical) + Critical×Combo 카운트 통과 | 0.75 sess |
| **T-17** | `src/systems/game-loop.ts` — reset / start / end 3-method contract + 5 시스템 DI + P2 listener 순서 (Visual Juice 먼저, Score & Combo 그 다음) | gameplay-programmer | systems-index §Engine Bootstrap, visual-juice §3.7, score-combo §9 | `src/systems/game-loop.ts` | T-13 ~ T-16 | listener 등록 순서 grep + reset/start/end 호출 시 시스템 메서드 invocation 검증 | 0.5 sess |
| **T-18** | Phase 2 Done 보고 + 결정 append | gameplay-programmer | — | `production/decisions/2026-05-31-build-decisions.md` append | T-10 ~ T-17 | Phase 2 결정 5건 이상 + AC → 테스트 매핑 진척 표 | 0.25 sess |

**Phase 2 합계**: ~5 sessions (gameplay-programmer 1명, 순차 강제)

### Phase 3 — Presentation Layer 병렬 (3 sub-agent 동시 호출)

| ID | Task | Owner | 입력 | 출력 | Dependencies | 검증 | Est |
|----|------|-------|------|------|------|------|-----|
| **T-19** | `src/ui/hud.ts` — Score + Combo + RETRY 버튼 Pixi Text/Container 구현 (uiContainer L4). `ui-strings.ts` 참조. RETRY 탭 → `gameLoop.reset()` | ui-programmer | visual-juice AC.10 (RETRY 동기), score-combo §3, ui-strings.ts | `src/ui/hud.ts` | T-11, T-17 | dev 빌드에서 점수 갱신 시 텍스트 변경 + RETRY 탭 시 리셋 | 0.75 sess |
| **T-20** | `assets/audio/sfx/` PowerShell 자체 합성 7개 (SM `gen_sfx.ps1` 패턴) + `src/audio/audio-manager.ts` (Web Audio API 직접, AudioContext unlock, ducking, bgmStart/Stop, play 6-method) | sound-designer | visual-juice §Audio Note (전체) | `assets/audio/sfx/*.ogg` × 7, `tools/gen_sfx.ps1`, `src/audio/audio-manager.ts` | T-12, T-13 | 7 SFX 파일 생성 + AudioManager play() 호출 시 console.error 0 + AudioContext unlock 확인 | 1.0 sess |
| **T-21** | `src/vfx/visual-juice.ts` — Pop particle (ParticleContainer 200 + FIFO) / Critical 다크닝 (bgContainer ColorMatrixFilter) / 5콤보 ring (절차 생성 texture) / Score popup pool 20 / GlowFilter (pixi-filters@^6) 적용 | technical-artist | visual-juice-system.md (전체, 특히 §3.2-3.5, §4) | `src/vfx/visual-juice.ts`, `src/vfx/particle-pool.ts`, `src/vfx/score-popup-pool.ts` | T-12, T-14, T-15, T-16, T-20 | 통합 dev 빌드에서 풍선 pop 시 파티클 + Critical 시 다크닝 0.2s + 5콤보 시 ring 동시 확인 | 1.5 sess |
| **T-22** | Phase 3 통합 결정 append (ui-programmer 명목상 수행, 3 sub-agent 결정 통합) | ui-programmer | — | `production/decisions/2026-05-31-build-decisions.md` append | T-19, T-20, T-21 | Phase 3 결정 7건 이상 | 0.25 sess |

**Phase 3 합계**: wall clock 2 sessions (3 sub-agent 병렬, 가장 긴 path = T-21 1.5 sess)

### Phase 4 — Build Gates 검증 + QA (순차, 1 sub-agent)

| ID | Task | Owner | 입력 | 출력 | Dependencies | 검증 | Est |
|----|------|-------|------|------|------|------|-----|
| **T-23** | AC → 테스트 매핑 완성 — 5 GDD 80 AC 중 unit/integration 가능 항목을 `tests/unit/<system>/` + `tests/integration/<feature>/` 파일로 채움 (수식·페이로드·우선순위·FIFO·Pity timer 등) | qa-lead | 5 GDD §9 Implementation Checklist의 AC → 테스트 매핑 표 | `tests/unit/**/*.test.ts` 다수, `tests/integration/**/*.test.ts` 다수 | T-10 ~ T-21 | `npx.cmd vitest run` 통과 + 30개 이상 test passes | 1.5 sess |
| **T-24** | `tests/e2e/smoke.spec.ts` Playwright 모바일 viewport (390×844) 60s 세션 — page.on('console', ...) 에러 캡처, Ticker.deltaMS 측정 + bundle size assertion | qa-lead | m0 §3.1 GATE-03 / 04 / 05 | `tests/e2e/smoke.spec.ts`, `playwright.config.ts` | T-21 | Playwright 통과 → console.error 0 + P50/P99 FPS report + bundle <600KB | 1.0 sess |
| **T-25** | Build Gates 5/5 자동 검증 실행 + 매트릭스 작성 (GATE-01 ~ 05) | qa-lead | m0 §3.1 | `production/qa/build-gates-2026-05-31.md` 매트릭스 (PASS/FAIL × 5) | T-23, T-24 | 5/5 PASS 또는 FAIL 명시 (FAIL 시 sub-agent 재호출 트리거) | 0.5 sess |
| **T-26** | Phase 4 Done 보고 + 결정 append + Code Review Checklist (`.claude/docs/coding-standards.md` §Code Review Checklist) 통과 여부 명시 | qa-lead | coding-standards.md §Code Review Checklist | `production/decisions/2026-05-31-build-decisions.md` append | T-25 | Checklist 7개 카테고리 각 PASS/N/A 명시 | 0.25 sess |

**Phase 4 합계**: ~3 sessions

### Phase 5 — Producer 최종 보고 (순차, producer 본인)

| ID | Task | Owner | 입력 | 출력 | Dependencies | 검증 | Est |
|----|------|-------|------|------|------|------|-----|
| **T-27** | `production/decisions/2026-05-31-build-decisions.md` 통합 정리 — Phase 1-4 결정 시간순 + 모호성 해소 사례 + 누락 0건 검증 | producer | T-09, T-18, T-22, T-26 | 동일 파일 정리 | T-26 | 결정 20-30건 이상, 시간순, 책임자 명시 | 0.5 sess |
| **T-28** | `production/session-state/active.md` 갱신 — Phase D + E.Build COMPLETED 항목 이동, NEXT를 "사용자 손 작업 (BGM + 실기 + Player Gates)"로 재설정 | producer | active.md | active.md 편집 | T-27 | COMPLETED 절에 T-01 ~ T-27 누적, REMAINING 절에 사용자 작업 3건 | 0.25 sess |
| **T-29** | M0 milestone DoD 항목 cross-check + 미통과 항목 명시 (P-RULE-02) | producer | m0-prototype-validation.md §DoD | active.md 또는 m0 DoD 갱신 | T-28 | 빌드 검증 4 항목 [x] 확인, 산출물 8 항목 이미 [x] 확인, 테스트+판정 6 항목은 사용자 손으로 명시 [ ] | 0.25 sess |
| **T-30** | 사용자 최종 보고 문구 작성 — `npm run dev` 실행 명령 + Build Gates 매트릭스 + 자율 결정 요약 + 사용자 손 작업 목록 + Player Gates 측정 가이드 1줄 | producer | T-25 매트릭스, T-27 결정 | 본인 응답 텍스트 (파일 아님) | T-29 | 사용자가 바로 빌드 실행 가능한 형태 | 0.25 sess |

**Phase 5 합계**: ~1.25 sessions

---

## 6. Dependency Graph

```
Phase 1 (devops-engineer 순차)
T-01 ──┬── T-02 ──┐
       ├── T-03 ──┤
       ├── T-04 ──┼── T-06 (CI)
       ├── T-05 ──┘
       ├── T-07 (LICENSE_REGISTRY)
       └── T-08 (gitignore)
                  └── T-09 (Phase 1 보고)
                       │
                       ▼
Phase 2 (gameplay-programmer 순차, 단일 두뇌)
T-10 (rng) ──┬── T-12 (event-bus) ──┬── T-13 (input) ──┬── T-14 (balloon-physics) ──┐
T-11 (ui-strings) ──┘                                                                  ├── T-15 (critical-pop) ──┐
                                                                                       │                        ├── T-16 (score-combo) ──┐
                                                                                       │                        │                       ├── T-17 (game-loop) ──┘
                                                                                                                                                              │
                                                                                                                                                              ▼
                                                                                                                                                  T-18 (Phase 2 보고)
                                                                                                                                                              │
                                                                                                                                                              ▼
Phase 3 (3 sub-agent 병렬 동시 호출)
T-19 (HUD, ui-programmer) ────────────┐
T-20 (SFX + AudioManager, sound) ─────┼── T-22 (Phase 3 통합 보고)
T-21 (Visual Juice + VFX, tech-art) ──┘
                                       │
                                       ▼
Phase 4 (qa-lead 순차)
T-23 (AC → tests 매핑) ── T-24 (Playwright e2e) ── T-25 (Build Gates 5/5) ── T-26 (Phase 4 보고)
                                                                                       │
                                                                                       ▼
Phase 5 (producer)
T-27 (decisions 통합) ── T-28 (active.md) ── T-29 (M0 DoD cross-check) ── T-30 (사용자 보고)
```

**병렬화 기회**:
- Phase 1 안: T-01 완료 후 T-02 / T-03 / T-05 / T-07 / T-08 병렬 가능 (단일 sub-agent 안에서)
- Phase 3: T-19 / T-20 / T-21 진짜 병렬 (3 sub-agent 동시 호출, 약 1.5 session wall clock)

**순차 강제**:
- Phase 1 → 2 → 3 → 4 → 5 (between phases)
- Phase 2 안 T-13 → T-14 → T-15 → T-16 (시스템 의존성 따라)

---

## 7. Execution Order (main session 호출 시퀀스)

```
Step 1: Task(devops-engineer, prompt=Phase 1 패키지 + 환경 boilerplate + T-01~T-09)
Step 2: Task(gameplay-programmer, prompt=Phase 2 5시스템 통합 + 환경 boilerplate + T-10~T-18)
Step 3: 단일 메시지에 3개 Task 호출 병렬:
        - Task(ui-programmer, prompt=T-19 HUD)
        - Task(sound-designer, prompt=T-20 SFX + AudioManager)
        - Task(technical-artist, prompt=T-21 Visual Juice + VFX)
Step 4: Task(qa-lead, prompt=Phase 4 + T-23~T-26)
Step 5: producer (메인 세션 직접 수행, Task spawn 불필요) — T-27~T-30
```

**컨텍스트 한계 대응**:
- 각 Phase 종료 시 active.md `COMPLETED` 갱신 + `STATUS: IN PROGRESS` 유지
- 세션 컴팩션/크래시 시 active.md AUTO-RESUME으로 다음 Phase 진입점 명시

---

## 8. Build Gates 5/5 → Task 매핑

| Gate | 기준 | 책임 Task | 검증 시점 |
|---|---|---|---|
| **GATE-01** | `npm run build` exit 0 + `dist/` 생성 | T-21 (마지막 코드 commit) + T-25 | Phase 4 |
| **GATE-02** | `npm run preview` HTTP 200 | T-24 (Playwright fetch) + T-25 | Phase 4 |
| **GATE-03** | Playwright 모바일 60s console.error 0 | T-24 | Phase 4 |
| **GATE-04** | Pixi `Ticker.deltaMS` P50 ≥58fps / P99 ≥55fps (데스크탑 throttle CPU 4x) | T-24 (Playwright `page.evaluate` 측정) + T-25 | Phase 4 (실기는 사용자 별도) |
| **GATE-05** | Bundle `dist/` < 600KB | T-02 (manualChunks 설계) + T-25 (vite-bundle-visualizer 리포트) | Phase 4 |

**GATE FAIL 시 fallback**:
- GATE-01/02/03 FAIL → 해당 시스템 소유 sub-agent 재호출 (T-13 ~ T-21 중)
- GATE-04 FAIL → technical-artist + gameplay-programmer 공동 재호출 (vfx 부하 감축 또는 pool 축소)
- GATE-05 FAIL → devops-engineer 재호출 (manualChunks 추가 분할 또는 BGM lazy import 검증)

---

## 9. AC → 테스트 매핑 가이드 (~80개 분배)

5 GDD AC 총합 추정:
- input-system: ~9 AC
- balloon-physics-split: ~20 AC
- critical-pop: ~15 AC
- score-combo: ~18 AC
- visual-juice: ~21 AC
- **합계 ~83 AC**

| 종류 | 분배 비율 | 위치 | 자동화 | 책임 Task |
|---|---|---|---|---|
| **Unit (수식·페이로드·FIFO·상태)** | ~50 AC | `tests/unit/<system>/` | Vitest | T-23 (qa-lead 메인) + Phase 2 각 시스템 sub-agent (T-13~T-16) 자체 작성 권장 |
| **Integration (cross-system 이벤트)** | ~15 AC | `tests/integration/<feature>/` | Vitest | T-23 |
| **E2E / Perf (60fps, Bundle)** | ~5 AC | `tests/e2e/` | Playwright | T-24 |
| **Visual / Feel (smoke check, Likert)** | ~8 AC | `production/qa/evidence/` | manual (사용자 단계) | 사용자 손 |
| **Code review (grep, 권한 경계, listener 순서)** | ~5 AC | grep + ESLint custom | manual / CI | T-26 |

**가이드 원칙** (qa-lead가 T-23에서 구체 파일 채움):
- 각 시스템 GDD §9 Implementation Checklist의 "AC → 테스트 매핑" 표를 그대로 따라 파일 생성
- 동일 행동 검증 중복 시 통합 (예: rng wrapper 호출은 5 시스템 공통 → `tests/unit/rng.test.ts` 1개)
- "Visual / Feel" 항목은 자동화 불가 — `production/qa/evidence/feel-2026-05-31.md` placeholder만 생성

---

## 10. Risk Register

| ID | Risk | Prob | Impact | Owner | Mitigation |
|----|------|------|--------|-------|-----------|
| **R-SD-01** | Phase 2 (gameplay-programmer 단일 sub-agent) 컨텍스트 한계 도달 → 5 시스템 중간에 세션 절단 | **H (60%)** | H | producer | Phase 2를 T-13~T-17 5 sub-task로 명시. 컨텍스트 한계 시 active.md AUTO-RESUME으로 다음 task 단독 호출 (예: T-15만 새 sub-agent 호출). 단일 두뇌 보장은 코드 인터페이스 lock(이벤트 페이로드·M-CP-1·M-SC-1)으로 GDD가 이미 흡수 |
| **R-SD-02** | Pixi v8 API hallucination (gameplay-programmer는 Pixi 비전문, sub-agent가 v5/v6 API 출력) | M (40%) | H | gameplay-programmer | sub-agent prompt에 systems-index §Engine Bootstrap snippet 전체 + visual-juice §3.2 ParticleContainer 코드 그대로 복사. Phase 1 T-04에서 boilerplate를 src/main.ts에 박아둬 reference 구현 제공 |
| **R-SD-03** | Phase 3 병렬 3 sub-agent가 visual-juice.ts 인터페이스를 다르게 가정 → 통합 시 깨짐 | M (35%) | H | producer | T-21 (technical-artist)이 visual-juice.ts 단독 소유. T-19 (HUD)는 game-loop만 참조, T-20 (audio)는 audio-manager.ts 독립 모듈. visual-juice → audio-manager 의존만 단방향 |
| **R-SD-04** | GATE-04 60fps 미달 (데스크탑 throttle에서도) | M (30%) | H | qa-lead | Phase 3 T-21에서 ParticleContainer maxSize 200 + Score popup pool 20 + bgContainer ColorMatrixFilter 1회만 적용 등 visual-juice GDD §4 수치 그대로 유지. GATE-04 FAIL 시 즉시 POP_PARTICLE_CAP 100 또는 Glow 비활성으로 폴백 |
| **R-SD-05** | GATE-05 bundle 600KB 초과 (pixi-filters@^6 추가로 +50KB 위험) | M (35%) | M | devops-engineer | T-02에서 manualChunks로 pixi.js 단독 chunk + bgm lazy import 분리. Phase 4 T-25에서 stats.html 확인, 초과 시 pixi-filters를 GlowFilter 단일 import (tree-shaking) 또는 자체 셰이더로 대체 |
| **R-SD-06** | 5 GDD에 명시되지 않은 모호성 발견 (예: harpoon entity 위치 정확한 좌표 origin) | M (40%) | M | gameplay-programmer | Autonomous Decision Protocol §3 따라 즉시 자율 결정 + `production/decisions/2026-05-31-build-decisions.md` append. 사용자 escalation 금지 (4 pillars 변경 아닌 한) |
| **R-SD-07** | Windows PowerShell `.cmd` 변형 누락으로 sub-agent 명령 실패 (`npm` 단독 호출 시 PSReadLine 오류) | M (40%) | L | 모든 sub-agent | §4 Environment Boilerplate를 sub-agent prompt에 그대로 복사. 첫 명령 실패 시 즉시 `.cmd` 추가로 재시도 |
| **R-SD-08** | T-20 PowerShell SFX 합성 스크립트 (SM gen_sfx.ps1)가 POP! repo에 없음 → 새로 작성 필요 | H (70%) | M | sound-designer | sub-agent prompt에 명시: "SM repo `tools/gen_sfx.ps1` 패턴을 POP! `tools/gen_sfx.ps1`로 새로 작성. NAudio 또는 System.Media.SoundPlayer 활용. 7 SFX 파라미터는 visual-juice §Audio Note 표 그대로" |
| **R-SD-09** | BGM placeholder만 마련하고 빌드 → AudioManager.bgmStart() 호출 시 buffer 없음 console.warn | L (90% 발생 — 의도) | L | sound-designer | visual-juice E9 정의 그대로 (silent fallback, console.warn 1회 허용). 빌드는 정상 작동 |
| **R-SD-10** | Phase 4 T-24 Playwright 첫 실행 시 chromium 미설치 (CI 빠짐) | H (90%) | L | qa-lead | T-24 prompt에 `npx.cmd playwright install chromium` 선행 명시 |

---

## 11. Coordination Rules (sub-agent 간 충돌 해소)

**파일 소유권** (수정 충돌 방지):

| 파일 영역 | 단일 소유 sub-agent |
|---|---|
| `src/main.ts` + `index.html` + `vite.config.ts` + `tsconfig.json` + `package.json` + `.github/**` | devops-engineer (Phase 1 only) |
| `src/conventions/**` + `src/events/**` + `src/systems/**` + `src/entities/**` | gameplay-programmer (Phase 2 only) |
| `src/ui/**` | ui-programmer (Phase 3) |
| `src/audio/**` + `assets/audio/sfx/**` + `tools/gen_sfx.ps1` | sound-designer (Phase 3) |
| `src/vfx/**` | technical-artist (Phase 3) |
| `tests/**` (Vitest + Playwright) | qa-lead (Phase 4 메인, Phase 2 sub-agent도 자체 unit test 추가 가능) |
| `assets/audio/LICENSE_REGISTRY.md` | devops-engineer (Phase 1 스켈레톤) + sound-designer (Phase 3 SFX 행 채움) |
| `production/decisions/2026-05-31-build-decisions.md` | 모든 sub-agent append-only |
| `production/session-state/active.md` | producer only (Phase 5) |

**충돌 시 절차**:
1. 두 sub-agent가 동일 파일 수정 시도 (예: visual-juice.ts) → 후순위 sub-agent는 메인 세션에 보고 → 메인 세션이 단일 소유자에게 권한 위임
2. GDD 모호성 → §3 Autonomous Decision Protocol

---

## 12. Notes & Justification

### Sub-agent 구조 선택 정당화

사용자가 제안한 5-Phase 구조(devops → gameplay-programmer → 병렬 3 → qa-lead → producer)를 채택했다. 대안 검토:

- **대안 A**: Phase 2를 5 sub-agent 병렬 (시스템당 1명) → **거부**. 인터페이스 불일치 위험(이벤트 페이로드 8건 + 양방향 lock 4건)이 너무 큼. 5 GDD가 cross-system lock을 명시했지만 sub-agent prompt 차이로 미세한 시그니처 불일치 발생 가능.
- **대안 B**: Phase 3을 순차 (HUD → audio → vfx) → **거부**. 3개 모듈이 독립 (HUD는 game-loop, audio는 별도 모듈, vfx는 visual-juice 단독) → 병렬화 안전. wall clock 절감.
- **채택**: 사용자 제안 그대로. 정당화 = 인터페이스 일관성(Phase 2 단일) + 병렬화 기회(Phase 3) + 검증 분리(Phase 4).

### Phase 5 producer 자율 수행 정당화

T-27 ~ T-30은 메인 세션(나 = producer)이 직접 수행. Task spawn 불필요 — 결정 통합·active.md 갱신·DoD cross-check·보고 작성은 producer 본연 책임이며 sub-agent 위임 시 컨텍스트 손실.

### ADR 작성 명시적 제외

사용자 정책 (2026-05-30) — ADR 작성 안 함. 모든 구현 명세는 5 GDD에 흡수됨. 자율 결정사항은 `production/decisions/2026-05-31-build-decisions.md` 단일 파일에 누적. coding-standards.md §Code Review Checklist의 "ADR 동기화" 카테고리는 N/A로 표기 (T-26 qa-lead 검증 시).

### Player Gates 명시적 제외

PG-01 ~ PG-06은 테스터 ≥5명 모집 필요 — sub-agent 자율 영역 밖. 빌드 sprint 완료 후 사용자가 별도로 진행. 본 sprint DoD에서 명시적 제외, m0 §DoD §테스트+판정 항목은 [ ] 유지.

---

## 13. Done Checklist (sprint 종료 시)

- [ ] T-01 ~ T-30 전 항목 [x]
- [ ] Build Gates 5/5 PASS (`production/qa/build-gates-2026-05-31.md`)
- [ ] `production/decisions/2026-05-31-build-decisions.md` 자율 결정 누적 (20-30건 예상)
- [ ] `production/session-state/active.md` 갱신 (COMPLETED 이동, NEXT = 사용자 손 작업)
- [ ] M0 milestone §DoD 빌드 검증 4 항목 [x] (산출물 8 + 테스트+판정 6은 사용자 손)
- [ ] 사용자가 `npm run dev` 단일 명령으로 게임 플레이 가능 (Phase 5 T-30 최종 보고에 명시)
