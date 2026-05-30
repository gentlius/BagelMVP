# Systems Index: POP!

> **Status**: Draft
> **Created**: 2026-05-29
> **Last Updated**: 2026-05-30 (스코프 축소 — Director Group 합의)
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

POP!은 한 손가락 입력(드래그+더블탭)으로 풍선을 분열시키는 1–3분 짧은 런 카오스 캐주얼 모바일 웹 게임이다. 핵심 5개 시스템으로 분해되며, 게임의 정체성을 결정하는 핵심 병목은 **Balloon Physics & Split System**과 **Score & Combo System**이다.

핵심 루프 — 드래그로 위치 잡고 → 더블탭으로 작살 발사 → 풍선 분열 → 베이스라인 시청각 주스 → 확률적 Critical 발현 → 점수 → 다음 풍선 — 은 5개 시스템의 협주로 작동한다. 4개의 필러(P1 한 손가락 한 결정 / P2 화면이 점수보다 먼저 말한다 / P3 운은 자주 실력은 깊게 / P4 1탭이 다음 런으로)가 모든 시스템 설계의 기준점.

이 인덱스는 **Pixi.js v8 (WebGL2) 타겟 핸드오프 deliverable** 목적으로 작성되었으며, 다른 팀(또는 다른 AI agent)이 읽고 곧바로 구현 가능한 수준의 명확성을 목표로 한다. 엔진 락인됨 (2026-05-29): Pixi.js v8 + JavaScript/TypeScript + Vite. 자세한 기술 스택은 `.claude/docs/technical-preferences.md` 참조. GDD 본문은 게임 디자인 명세(rules·formulas·AC) 위주로 작성되며, Pixi v8 idiom은 §Engine Bootstrap 또는 각 GDD의 Implementation Notes에 명시한다.

---

## Systems Enumeration

| # | System Name | Category | Status | Design Doc | Depends On |
|---|-------------|----------|--------|------------|------------|
| 1 | Input System | Core | Designed | [input-system.md](input-system.md) | (none) |
| 2 | Balloon Physics & Split System | Gameplay | Designed | [balloon-physics-split-system.md](balloon-physics-split-system.md) | Input System |
| 3 | Critical Pop System | Gameplay | Designed | [critical-pop-system.md](critical-pop-system.md) | Balloon Physics |
| 4 | Score & Combo System | Gameplay | Designed | [score-combo-system.md](score-combo-system.md) | Balloon Physics, Critical Pop |
| 5 | Visual Juice System | Presentation | Not Started | visual-juice-system.md | Input, Balloon Physics, Critical Pop, Score & Combo |

> **Character & Harpoon**: prototype 단계에서 Balloon Physics & Split System에 흡수되어 단일 시스템으로 구현된다 (Input System의 1차 Consumer 역할은 Balloon Physics 안에서 처리).
> **Difficulty & Spawn**: Balloon Physics & Split System의 Tuning Knobs 섹션에 인라인 정의 (`SPAWN_COUNT_0` / `SPAWN_COUNT_30` / `SPAWN_COUNT_60` — 시간비례 3단계 고정).
> **Audio**: Visual Juice System의 §Audio Implementation Note에 인라인 정의 (sfxr 7 SFX + CC0 BGM 1트랙 + Web Audio API 직접).

---

## §Engine Bootstrap

Pixi.js v8 entry point. 모든 시스템이 의존하는 단일 부트스트랩.

### Application 초기화 (Pixi v8 async API)

```js
import { Application } from 'pixi.js';

const app = new Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  background: '#B5D8E8',     // Frosted Sky 상단 색 (art-bible §6.2)
  antialias: false,           // 모바일 성능 우선 — Glow는 filter로 처리
});

document.body.appendChild(app.canvas);   // Pixi v8: app.view → app.canvas

window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
});
```

### GameLoop Contract (단일 진입점)

게임 루프 라이프사이클 관리. 모든 게임 상태 전환은 이 3-method API 경유.

```js
class GameLoop {
  constructor(app, systems) { /* DI: Pixi app + system 인스턴스 묶음 */ }

  reset() { /* 모든 시스템 초기화. 풍선 제거, 점수 0, 콤보 0 */ }
  start() { /* Ticker 가동 + 첫 풍선 스폰 시작 */ }
  end()   { /* Ticker 정지 + RETRY UX 표출 (data 보존) */ }
}

// Ticker는 app.ticker 사용 — Ticker.shared 금지 (multi-instance 안전성)
app.ticker.add((ticker) => {
  // ticker.deltaTime (frames at 60fps), ticker.deltaMS (ms)
  // 모든 시스템 update() 호출
});
```

### Z-layer Container 계층 (art-bible §6.3 참조)

```js
// 생성 순서가 곧 draw order
const bgContainer       = new Container(); app.stage.addChild(bgContainer);
const balloonContainer  = new Container(); app.stage.addChild(balloonContainer);
const harpoonContainer  = new Container(); app.stage.addChild(harpoonContainer);
const vfxContainer      = new Container(); app.stage.addChild(vfxContainer);
const uiContainer       = new Container(); app.stage.addChild(uiContainer);
```

내부 zIndex는 자유. 컨테이너 계층은 lock.

### 종료 시 메모리 정리

```js
app.destroy(true, { children: true, texture: true });
```

---

## §Conventions

전 시스템에 적용되는 코드 컨벤션. 위반 = 코드 리뷰 차단.

### RNG: rng wrapper 강제

모든 난수는 단일 `rng` 객체 경유. **`Math.random()` 직접 호출 금지** (dev-mode lint 차단 권장).

```js
// rng.js — 단일 소스
export const rng = {
  spawn:    { next: () => Math.random(),
              nextInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min },
  critical: { next: () => Math.random(),
              nextBool: (p = 0.5) => Math.random() < p },
  powerup:  { next: () => Math.random(),
              nextChoice: (arr) => arr[Math.floor(Math.random() * arr.length)] },
};
```

각 domain (spawn / critical / powerup) 분리 이유: cross-contamination 방지. spawn의 난수 소비가 critical 확률에 영향 주지 않음.

호출 예시:
- `rng.spawn.nextInt(0, screenWidth)` — 풍선 스폰 X 좌표
- `rng.critical.nextBool(0.10)` — Critical 10% 확률 판정
- `rng.powerup.nextChoice(['multishot', 'freeze', 'bomb'])` — Power-Up 선택

### UI 문자열: ui-strings.js 단일 파일

모든 플레이어 노출 문자열은 `src/ui-strings.js` 한 파일에 집중. Pixi `Text` 인스턴스 생성 시 직접 문자열 리터럴 금지.

```js
// src/ui-strings.js
export const UI = {
  gameOver: '게임 오버',
  retry:    'Try Again',
  score:    (n) => `점수 ${n}`,
  combo:    (n) => `콤보 ${n}`,
};
```

```js
// 사용처
import { UI } from './ui-strings.js';
const scoreText = new Text({ text: UI.score(currentScore), style: scoreStyle });
```

### Tick 함수: setTimeout/setInterval 금지

모든 시간 기반 로직은 `app.ticker.add()` 경유. `setTimeout` / `setInterval` 사용 금지 (tab 비활성·DPR 변동 대응).

### 글로벌 변수 금지

`window.*` 직접 할당 금지. 모듈 export / import만 사용.

### 외부 런타임 fetch 금지

게임은 완전 self-contained. CDN 의존성 0건. 모든 자산은 build 시 bundle.

---

## Categories

| Category | Description | POP!의 시스템 |
|----------|-------------|---------------|
| **Core** | 입력 처리 기반 | Input System |
| **Gameplay** | 게임을 fun하게 만드는 시스템 | Balloon Physics & Split, Critical Pop, Score & Combo |
| **Presentation** | Gameplay 이벤트를 시청각으로 변환하는 cross-cutting 피드백 계층 | Visual Juice (오디오 흡수) |

> **제외된 카테고리**: Progression, Economy, Narrative, Meta, Persistence — 본 게임 스코프에 해당 없음.

---

## Dependency Map

### Foundation Layer

1. **Input System** — 터치 이벤트 → 드래그-이동 / 더블탭-발사 해석. R1 핵심 (입력감 검증). 다른 시스템이 입력 이벤트를 listen.

### Core Layer

2. **Balloon Physics & Split System** — depends on: Input System
   - 캐릭터 entity (위치·렌더·드래그 따라가기) + 작살 entity (스폰·궤적·발사 후 추적)
   - 풍선 시뮬(바운스·중력)·1→2 분열·종단 사이즈·작살-vs-풍선 충돌 감지
   - 시간비례 풍선 수 곡선 + 스폰 위치·초기 사이즈 결정 (rng.spawn 사용)
   - **병목 — 3개 시스템이 이 시스템에 의존**

### Feature Layer

3. **Critical Pop System** — depends on: Balloon Physics
   - 황금 풍선 (10% + Pity timer 90초), 화면 다크닝 트리거, 근접 풍선 자동 연쇄
   - rng.critical 사용 (페어플레이 contract)
4. **Score & Combo System** — depends on: Balloon Physics, Critical Pop
   - 점수 수식, 콤보 추적, 종단 보너스. **콤보 상태의 단일 소유자**
   - Critical × Combo 카운트 규칙: Critical +1, 연쇄팝 각 +1 (cap +3)

### Presentation Layer

5. **Visual Juice System** — depends on: Input, Balloon Physics, Critical Pop, Score & Combo
   - 스크린쉐이크·파티클·시간감속·글로우·플래시. 모든 gameplay event를 listen하여 차등 발현
   - 5콤보 글로우 피크 (캐릭터 주변 ring)
   - §Audio Implementation Note (sfxr 7 SFX + CC0 BGM 1트랙) 포함
   - 카메라/뷰포트 호스팅 포함

---

## Recommended Design Order

5개 시스템 risk-first 순서. 각 시스템 GDD는 자기 의존 시스템의 인터페이스를 "가정 명시"로 작성하고, 의존 시스템 GDD 완료 시 정합성을 재검증.

| Order | System | Risk | Layer | Est. Effort | Rationale |
|-------|--------|------|-------|-------------|-----------|
| 1 | **Input System** (Designed) | **R1** | Foundation | M (완료) | 최대 디자인 리스크 (더블탭 입력감). A/B 계획 문서화 강제 |
| 2 | (병렬) `/art-bible` | — | — | M (완료) | Visual Contract + Z-layer + 6색 팔레트 락인 |
| 3 | **Balloon Physics & Split System** | **R4** | Core | M-L (1-pager 100-200줄) | 병목 + 성능 리스크. character-harpoon + difficulty-spawn 흡수 |
| 4 | **Critical Pop System** | **R2** | Feature | M (1-pager 100-150줄) | 페어플레이 (Pity timer + rng.critical) 락인 |
| 5 | **Score & Combo System** | — | Feature | M (1-pager 80-100줄) | 점수 수식 + 콤보 단일 소유권 |
| 6 | **Visual Juice System** | **R3** | Presentation | M-L (1-pager 120-150줄) | 이벤트 우선순위 매트릭스 + 성능 예산 + Audio Implementation Note 포함 |

**범례**: S = 1 작업 세션 / M = 2–3 세션 / L = 4+ 세션. 1 세션 ≈ 1.5h 인간 시간 (AI-agent 협업 기준).

**총 추정**: ~3-4 세션 (1-pager 4종) + mini consistency check 1세션 = **~5 세션** docs 작업.

---

## Circular Dependencies

**검출되지 않음.** "Score ↔ Critical" 잠재 사이클은 단방향 데이터 흐름으로 해소:

- Balloon Physics가 분열 이벤트를 emit
- Critical Pop이 분열 이벤트를 listen + Critical 판정 emit
- Score & Combo가 두 이벤트를 listen + 점수 갱신
- Visual Juice가 모든 이벤트를 listen (read-only)

순환 없음. 모든 시스템이 emit → listen 단방향.

---

## High-Risk Systems

조기 검증 또는 GDD 작성 시 특별 주의.

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| **Input System** | Design | R1 — 더블탭 발사가 자연스럽지 않거나, 첫 탭의 의미가 모호하여 입력감 저하 | GDD에 단발탭/더블탭 두 변형 명세 + A/B 5명 베타테스트 절차 포함. AC에 "5명 중 4명이 자연스럽다고 평가" 포함 |
| **Critical Pop System** | Design | R2 — 운 의존도가 높아 "운 나쁘면 재미없다" 박탈감 | Pity timer 90초 강제 스폰 + rng.critical 결정성. AC에 "첫 3런 안에 90% 테스터가 Critical 목격" |
| **Visual Juice System** | Design + Performance | R3 — 동시 이벤트 정보 과부하 / R4 — 모바일 60fps | 이벤트 우선순위 매트릭스 (Critical > 콤보 피크 > 일반) + 성능 예산 (파티클 수 캡, 풀링 전략). AC에 "60fps@iPhone 11 / Galaxy A 시리즈" |
| **Balloon Physics & Split System** | Technical | R4 — 다중 풍선 + 충돌 + 분열 = 가장 무거운 시뮬레이션 | 성능 budget (최대 동시 풍선 수, 충돌 알고리즘 선택지) + 풀링 전략 |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems | 5 |
| Design docs designed | 4 (Input, Balloon Physics, Critical Pop, Score & Combo) |
| Design docs in progress | 0 |
| Design docs Not Started | 1 (Visual Juice) |

---

## Non-GDD Design Documents

| Document | Path | Status | Purpose |
|----------|------|--------|---------|
| Game Concept | `design/gdd/game-concept.md` | Draft | 컨셉·필러·MVP 정의 소스 |
| Art Bible | `design/art/art-bible.md` | Draft Complete (압축 in-place) | Visual Identity Anchor + Palette + Z-layer + Layered Translucency + Frosted Sky 절차 코드 + Bundle Budget |
| Visual Contract Sample | `design/art/samples/01-character-balloon-sky.html` | Done | art-bible integration test |

---

## Next Steps

- [x] ~~`/design-system input-system`~~ — 완료 2026-05-30
- [x] ~~`/art-bible`~~ — 완료 2026-05-30 (압축 후 in-place 유지)
- [x] ~~`/design-system balloon-physics-split-system`~~ — 완료 2026-05-30 (post-review v1.1, 330줄, BLOCKING 2 + MAJOR 8 + MINOR 6 반영)
- [x] ~~`/design-system critical-pop-system`~~ — 완료 2026-05-30 (post-review v1.1, 290줄, BLOCKING 3 + MAJOR 7 + MINOR 7 + 양방향 lock 2 반영)
- [x] ~~`/design-system score-combo-system`~~ — 완료 2026-05-30 (post-review v1.1, 331줄, BLOCKING 1 + MAJOR 5 + MINOR 7 + AC.17·18 신규 + 양방향 lock 2 반영)
- [ ] `/design-system visual-juice-system` — 1-pager 120-150줄. §Audio Implementation Note 포함
- [ ] mini consistency check (1세션, QA Lead 주관) — 4 1-pager 완료 후 cross-system formula 일관성 검증
- [ ] Pixi v8 + Vite 프로젝트 셋업 (devops-engineer)
- [ ] 프로토타입 빌드 → Build Gates 5/5 → 실기 검증 → Player Gates 측정 → PROCEED/PIVOT/KILL 판정
