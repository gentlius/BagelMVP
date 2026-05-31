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
| 5 | Visual Juice System | Presentation | Designed | [visual-juice-system.md](visual-juice-system.md) | Input, Balloon Physics, Critical Pop, Score & Combo |

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

> **Wiring 의무**: factory 호출 후 `attachListeners(eventBus)` 별도 호출, 1×1 texture sprite의 width/height 명시, Pixi EventEmitter → EventBus forward — 모두 §Wiring Contract 의무 항목. 위반 시 typecheck/build/test 통과해도 visual/audio 효과가 발현되지 않을 수 있음 (사일런트 실패).

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

### UI 문자열: ui-strings 모듈 단일 소유

모든 플레이어 노출 문자열은 `ui-strings` 모듈 (conventions 영역) 한 파일에 집중. Pixi `Text` 인스턴스 생성 시 직접 문자열 리터럴 금지.

```js
// ui-strings module
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

## §Wiring Contract — 시스템 wiring 의무 항목

본 절은 시스템 간 wiring 시 준수해야 할 3개 의무를 정의한다. 위반 시 typecheck/build/test 모두 통과(console.error 0)해도 visual/audio 효과가 발현되지 않는 **사일런트 실패** 상태가 된다 — 자동 검증으로 검출되지 않으므로 모든 dev/AI agent가 wiring 시점에 명시적으로 준수해야 한다.

### W-RULE-01: Factory + attachListeners 분리 패턴

**규칙**: `attachVisualJuice(opts)`, `attachHUD(...)`, `attachAboutModal(...)` 같은 factory 함수는 **instance + resource만 생성**. EventBus listener 등록은 **별도 `instance.attachListeners(bus)` 호출 의무**.

**의무 호출 순서** (GameLoop.init() 안):
1. `this._visualJuice = attachVisualJuice({ ... })` — instance + sub-systems + textures 초기화
2. `this._visualJuice.attachListeners(eventBus)` — **명시적 listener 등록** (P2 lock 보존: `score-combo.attachListeners()`보다 먼저)
3. `this._scoreCombo.attachListeners()` (P2 lock 두 번째)

**누락 증상**: 모든 시각 효과 사일런트. `balloon:popped` / `balloon:split` / `criticalPop:fired` 모두 ignore. console.error 0 (no-op이지 error 아님). e2e test 통과.

**왜 분리?**: factory가 listener 자동 등록 시 호출 시점 제어 불가 — P2 lock("화면이 점수보다 먼저 말한다") 보존 위해 명시적 분리. visual-juice 모듈은 `attachListeners(eventBus)` API를 별도 export하고 docstring으로 "MUST be called BEFORE ScoreComboSystem.attachListeners()" 명시. 정답 wiring 패턴은 §Wiring Contract W-RULE-04 skeleton 참조.

### W-RULE-02: 1×1 Texture sprite는 width/height 명시 의무

**규칙**: Pixi v8 `Graphics.rect(0, 0, 1, 1).fill(color); renderer.generateTexture(g)` 패턴은 **1×1 픽셀 texture**. 이 texture로 생성한 sprite는 default width/height 1×1 — 화면에 1픽셀 점으로 보임. **full-screen 또는 의도 size로 사용 시 sprite 생성 후 즉시 width/height + x/y 명시 의무**.

**예시** (visual-juice 모듈 initTextures의 flash sprite + darken overlay):
```typescript
const flashG = new Graphics();
flashG.rect(0, 0, 1, 1).fill(0xffffff);
const flashTex = renderer.generateTexture(flashG);
flashG.destroy();

this._flashSprite = new Sprite(flashTex);
this._flashSprite.width = this._app.screen.width;   // ← 의무
this._flashSprite.height = this._app.screen.height; // ← 의무
this._flashSprite.x = 0;                            // ← 권장 (default 0이지만 명시)
this._flashSprite.y = 0;
```

**누락 증상**: 1픽셀 점이 (0, 0)에 표시. 사용자가 "엉망진창" 인지. typecheck PASS, console.error 0.

### W-RULE-03: Pixi EventEmitter ↔ EventBus forward 의무

**규칙**: InputSystem이 Pixi EventEmitter를 상속 (input-system §Detailed Rules) — `emit('input:fire')`는 Pixi-internal 채널이며 EventBus 구독자에게 전달되지 않는다. **다른 시스템 (AudioManager, VisualJuice, AudioContext unlock hook)이 listen하려면 GameLoop가 EventBus로 forward할 의무**.

**의무 패턴** (GameLoop.init() input 핸들러):
```typescript
this._input.on('input:fire', () => {
  this._balloonSystem.onFire();
  eventBus.emit('input:fire', {});  // ← forward 의무
});
```

**누락 증상**:
- AudioContext.resume() 미호출 → 모바일 web 첫 user gesture 후에도 SFX/BGM 사일런트 가능 (브라우저별 차이)
- harpoon-fire SFX 발동 0건 → 작살 발사 무음

**적용 범위**: `input:fire` (필수). `input:dragStart/Move/End/Cancel`은 EventBus listener 0건 — forward 불필요 (current). 향후 cross-system listener 추가 시 동일 패턴 적용 의무.

### W-RULE-04: main.ts + GameLoop.init() integration skeleton

W-RULE-01/02/03 의무를 정확히 만족하는 정답 wiring 예시. 외부 dev/AI agent는 신규 구현/리팩터링 시 본 구조를 그대로 따라야 한다 (main entry 부트스트랩 + GameLoop.init() 패턴이 권위 출처).

```typescript
// src/main.ts skeleton
import { Application, Container } from 'pixi.js';
import { GameLoop } from './systems/game-loop.js';
import { attachHUD } from './ui/hud.js';
import { attachAboutModal } from './ui/about-modal.js';
import { audioManager } from './audio/audio-manager.js';
import { eventBus } from './events/event-bus.js';
import { createFrostedSkyBackground } from './vfx/background.js';

async function bootstrap() {
  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    background: '#B5D8E8', // Frosted Sky fallback (art-bible §1.2)
    antialias: false,
  });

  const gameContainer = document.getElementById('game');
  if (!gameContainer) throw new Error('Game container element not found');
  gameContainer.appendChild(app.canvas);

  // 5-container hierarchy (§Engine Bootstrap L1~L5 순서 의무)
  const bgContainer = new Container();
  const balloonContainer = new Container();
  const harpoonContainer = new Container();
  const vfxContainer = new Container();
  const uiContainer = new Container();
  app.stage.addChild(bgContainer);
  bgContainer.addChild(createFrostedSkyBackground(app)); // sky sprite > app.init background
  app.stage.addChild(balloonContainer);
  app.stage.addChild(harpoonContainer);
  app.stage.addChild(vfxContainer);
  app.stage.addChild(uiContainer);

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  return { app, containers: { bgContainer, balloonContainer, harpoonContainer, vfxContainer, uiContainer } };
}

bootstrap().then(({ app, containers }) => {
  // AudioManager: globalThis 등록 + listener (W-RULE-01 factory/attachListeners 분리)
  (globalThis as unknown as { audioManager: typeof audioManager }).audioManager = audioManager;
  audioManager.attachListeners(eventBus);

  // GameLoop: factory + init (attachListeners 자동 호출 없음 — W-RULE-01)
  const gameLoop = new GameLoop(app, containers);
  gameLoop.init();

  // HUD overlay (uiContainer L5, sortableChildren 필요)
  containers.uiContainer.sortableChildren = true;
  attachHUD(containers.uiContainer, app);

  // About 모달 (pause/resume API 의존)
  attachAboutModal({
    uiContainer: containers.uiContainer,
    app,
    pause: () => gameLoop.pause(),
    resume: () => gameLoop.resume(),
  });

  gameLoop.start();
}).catch((err) => {
  // DOM fallback — process.exit 브라우저에 없음
  const fallback = document.getElementById('game');
  if (fallback) {
    const msg = err instanceof Error ? err.message : String(err);
    fallback.innerHTML = `<pre style="color:#900;padding:1rem;font-family:monospace;">POP! init failed: ${msg}</pre>`;
  }
});
```

```typescript
// src/systems/game-loop.ts init() skeleton — W-RULE 의무 호출 순서
init(): void {
  const { balloonContainer, harpoonContainer } = this._containers;

  // 1. 시스템 instantiate
  this._balloonSystem = new BalloonPhysicsSplitSystem({
    app: this._app, balloonContainer, harpoonContainer, eventBus,
  });
  this._criticalPop = new CriticalPopSystem(this._balloonSystem);
  this._balloonSystem.criticalPop = this._criticalPop; // direct hook (D-P2-04, M0 §3.1)
  this._scoreCombo = new ScoreComboSystem();
  this._input = new InputSystem(this._app);
  this._input.attach(); // PointerEvent listener 등록 의무 — 누락 시 모든 input ignore

  // 2. Visual Juice: factory + attachListeners (W-RULE-01, P2 lock 첫 번째)
  this._visualJuice = attachVisualJuice({
    app: this._app,
    bgContainer: this._containers.bgContainer,
    balloonContainer: this._containers.balloonContainer,
    harpoonContainer: this._containers.harpoonContainer,
    vfxContainer: this._containers.vfxContainer,
    uiContainer: this._containers.uiContainer,
    characterPosition: () => {
      const c = this._balloonSystem.getCharacter();
      return { x: c.x, y: c.y };
    },
    getCharacterSprite: () => this._balloonSystem.getCharacter().sprite,
  });
  this._visualJuice.attachListeners(eventBus); // ← W-RULE-01 의무 (factory가 자동 호출 안 함)

  // 3. Score & Combo attachListeners (P2 lock 두 번째 — FIFO 순서 = dispatch 순서)
  this._scoreCombo.attachListeners();

  // 4. Critical Pop: isCritical balloon:popped 수신
  eventBus.on('balloon:popped', (p) => this._criticalPop.onBalloonPopped(p));

  // 5. Input wiring + EventBus forward (W-RULE-03)
  this._input.on('input:fire', () => {
    this._balloonSystem.onFire();
    eventBus.emit('input:fire', {}); // ← forward 의무 (AudioContext unlock + harpoon-fire SFX)
  });
  this._input.on('input:dragStart', (p) => this._balloonSystem.onDragStart(p.x));
  this._input.on('input:dragMove', (p) => this._balloonSystem.onDragMove(p.x));
  this._input.on('input:dragEnd', () => this._balloonSystem.onDragEnd());
  this._input.on('input:dragCancel', () => this._balloonSystem.onDragEnd());

  // 6. RETRY wiring
  eventBus.on('input:retry', () => this.reset());

  // 7. AudioContext unlock on first user gesture (visual-juice §3.7, D-P2-07)
  eventBus.once('input:fire', () => {
    const am = (globalThis as unknown as { audioManager?: { unlock?: () => void } }).audioManager;
    am?.unlock?.();
  });

  // 8. Ticker single entry
  this._app.ticker.add((ticker) => this.update(ticker));
}
```

**핵심 의무 self-audit 체크리스트** (외부 dev 구현 후 즉시 확인):
- [ ] `attachVisualJuice()` 호출 직후 `_visualJuice.attachListeners(eventBus)` 별도 호출 (W-RULE-01)
- [ ] `_visualJuice.attachListeners()`가 `_scoreCombo.attachListeners()`보다 먼저 호출 (P2 lock)
- [ ] visual-juice 내부 1×1 texture sprite는 생성 후 즉시 `width = app.screen.width` / `height = app.screen.height` 명시 (W-RULE-02)
- [ ] `_input.on('input:fire')` 핸들러에 `eventBus.emit('input:fire', {})` forward 포함 (W-RULE-03)
- [ ] `globalThis.audioManager = audioManager` 등록 (AudioContext unlock hook 의존)
- [ ] `audioManager.attachListeners(eventBus)` 별도 호출 (W-RULE-01 — AudioManager도 동일 패턴)
- [ ] `_input.attach()` 호출 (PointerEvent listener 등록 — 누락 시 모든 입력 무시)
- [ ] `uiContainer.sortableChildren = true` (About 모달 zIndex 50/100이 HUD 위에 표시)

### 자동 검증 한계

W-RULE-01/02/03 위반은 console error를 발생시키지 않는다. typecheck + unit test + e2e smoke (console.error 0 기반) 모두 통과해도 사일런트 실패가 가능하므로, wiring 변경 후에는 **manual visual 검증이 필요**하다 (실기 실행 후 풍선 pop → 시각 효과·SFX 발현 확인).

M1 polish 권장: Playwright screenshot diff (baseline vs current 비교)로 visual no-op 자동 검출.

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
| Design docs designed | **5 (all — Input, Balloon Physics, Critical Pop, Score & Combo, Visual Juice)** |
| Design docs in progress | 0 |
| Design docs Not Started | 0 |

---

## Non-GDD Design Documents

| Document | Path | Status | Purpose |
|----------|------|--------|---------|
| Game Concept | `design/gdd/game-concept.md` | Draft | 컨셉·필러·MVP 정의 소스 |
| Art Bible | `design/art/art-bible.md` | Draft Complete (압축 in-place) | Visual Identity Anchor + Palette + Z-layer + Layered Translucency + Frosted Sky 절차 코드 + Bundle Budget |
| Visual Contract Sample | `design/art/samples/01-character-balloon-sky.html` | Done | art-bible integration test |
| UX Spec: HUD | `design/ux/hud.md` | Draft | Score/Combo/GAME OVER/RETRY 레이아웃 + 이벤트 wiring |
| UX Spec: About Modal | `design/ux/about-modal.md` | Draft | ⓘ 버튼 + 크레딧 모달 레이아웃 + pause/resume 계약 |

---

## Next Steps

- [x] ~~`/design-system input-system`~~ — 완료 2026-05-30
- [x] ~~`/art-bible`~~ — 완료 2026-05-30 (압축 후 in-place 유지)
- [x] ~~`/design-system balloon-physics-split-system`~~ — 완료 2026-05-30 (post-review v1.1, 330줄, BLOCKING 2 + MAJOR 8 + MINOR 6 반영)
- [x] ~~`/design-system critical-pop-system`~~ — 완료 2026-05-30 (post-review v1.1, 290줄, BLOCKING 3 + MAJOR 7 + MINOR 7 + 양방향 lock 2 반영)
- [x] ~~`/design-system score-combo-system`~~ — 완료 2026-05-30 (post-review v1.1, 331줄, BLOCKING 1 + MAJOR 5 + MINOR 7 + AC.17·18 신규 + 양방향 lock 2 반영)
- [x] ~~`/design-system visual-juice-system`~~ — 완료 2026-05-31 (post-review v1.1, 534줄, BLOCKING 3 + MAJOR 6 + MINOR 8 + audio-director v2 §Audio Note 흡수)
- [ ] mini consistency check (1세션, QA Lead 주관) — 4 1-pager 완료 후 cross-system formula 일관성 검증
- [ ] Pixi v8 + Vite 프로젝트 셋업 (devops-engineer)
- [ ] 프로토타입 빌드 → Build Gates 5/5 → 실기 검증 → Player Gates 측정 → PROCEED/PIVOT/KILL 판정
