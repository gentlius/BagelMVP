# Game State Manager

> **Status**: Designed (pending /design-review)
> **Author**: joywoni + Claude
> **Specialists consulted (lean mode 확장 검토)**:
> - `systems-designer` (Section A-C holistic): 4 CRITICAL + 5 HIGH + 6 MEDIUM + 3 LOW 반영
> - `qa-lead` (Section H AC): AC-12·14·18·19·22·23 재작성 + 4개 lifecycle edge ACs 추가 (총 31 ACs)
> - `creative-director` (Section B Player Fantasy): P1·P2·AP1 explicit invocation + Vampire Survivors 추가 + Sensation continuity 프레이밍
> - `ux-designer` (Section I·J·E): art-bible 충돌 4건 발견·해소 (dim 0.5→0.3, "TAP TO RESUME" 명확화, explicit tap resume MVP, 메뉴 데코 풍선 풀 분리)
> - `engine-programmer` (Section C·D·G·K Pixi v8): hook budget 명확화 + OQ.4 resolved + destroy() removeAllListeners + app.init Retina opts + Ticker.shared 금지 + debounce performance.now() implementation
> **Last Updated**: 2026-05-30
> **Implements Pillar**: P4 — 1탭이 다음 런으로 (state 전환은 마찰 제로)
> **Handoff target**: Other AI agent (spec-heavy, prose-minimal style)
> **Engine target**: Pixi.js v8 + JavaScript/TypeScript + Vite
> **States**: 6 (boot, boot_error, menu, playing, dead, paused)
> **Cross-doc정합성**: art-bible §6 S1·S7 정합 검증 완료. input-system.md §F 양방향 verify 완료.

---

## Overview

**Game State Manager**는 POP! 애플리케이션의 상태머신 단일 소유자다. 부팅 직후부터 종료까지 애플리케이션이 어느 모드(`boot` / `menu` / `playing` / `dead` / `paused`)에 있는지를 한 곳에서 보관하고, 모든 다른 시스템은 read-only로 현재 상태를 참조하거나 transition 이벤트를 listen한다. 시스템 자체는 게임플레이 로직을 모른다 — Balloon Physics·Score·Critical·Power-Up 등 도메인 시스템과 직접 소통하지 않는다. 오직 두 책임만 가진다: **(1)** 유효한 상태 전이만 허용하고 (invalid transition은 silent reject + dev-mode warning), **(2)** 전이 시점에 lifecycle 훅을 발화하여 의존 시스템(Input System의 `attach()`/`detach()`, Pixi `Application.ticker`의 start/stop, Audio System의 mute, Visual Juice의 reset 등)이 자신의 활성 윈도우를 알 수 있게 한다. P4 필러(1탭이 다음 런으로)의 기술적 backbone으로서, `dead → playing` RETRY 경로의 마찰을 코드 레벨에서 0으로 강제한다 — 광고·확인 다이얼로그·로딩 화면을 RETRY 경로에 끼우는 것이 이 시스템의 transition 정의에서 구조적으로 불가능하도록 설계된다.

## Player Fantasy

**이 시스템 자체에는 직접적인 player fantasy가 없다.** 대신 이 시스템은 POP!의 모든 다른 fantasy를 잇는 **끊기지 않는 실**이 되어야 한다 — Sensation(POP!의 1순위 MDA aesthetic)이 state 전환 중에 0으로 떨어지지 않게 보호한다. 도파민 라인이 끊기지 않는 것 자체가 이 시스템의 작동 증거다.

구체적으로 **P4 "1탭이 다음 런으로"** 를 코드 구조로 강제한다: `dead → playing` 전환에 async chain, `confirm()` 다이얼로그, 외부 SDK await, 모달 로딩 화면, 광고 인터스티셜(**AP1 "광고 인터스티셜 금지"**) 어느 것도 끼어들 수 없다. 사망과 다음 런 사이는 후회가 도착하기 전에 닫힌다.

동시에 **P1 "한 번에 한 결정"** 을 보호한다: 죽음 → 재시작은 단일 결정(탭하거나 안 하거나)이지, 다이얼로그 → 결과 → 확인 → 재시작의 결정 사슬이 아니다. 모달이 끼는 순간 P1이 깨진다.

그리고 **P2 "화면이 점수보다 먼저 말한다"** 의 의무도 진다: state 전환은 침묵하지 않는다. 사망 지점의 파티클 폭발, 화면 와이프, 즉각적인 월드 재구성 — 점수창이 뜨기 전에 화면이 "다음 런 시작"을 말한다. (실제 visual은 Visual Juice + Adaptive Background + UI System이 owns. GSM은 transition 이벤트로 *명령*만 한다.)

이 패턴은 **Geometry Dash가 수억 단위 다운로드 규모로** (출처: [Geometry Dash — Wikipedia](https://en.wikipedia.org/wiki/Geometry_Dash) 모바일 200M+), **Vampire Survivors가 같은 chaos-cascade 장르에서 게임오버→Retry→코른필드 즉시 복귀로**, **Suika Game이 같은 모바일 웹 플랫폼의 zero-ceremony retry로** 입증했다. POP!의 P4는 새로운 발명이 아니라 이 세 모범의 교차점에 있다.

플레이어 관점에서 이 시스템이 "잘 만들어졌다"의 증거: **실이 끊긴 순간을 한 번도 느끼지 못함**.

> **Design test (downstream agent용)**: 이 섹션을 읽은 후 "Tap to Continue" 버튼, fade-to-black transition, results 모달 추가를 고려한다면 — 이 텍스트가 명시적으로 **거부**한다. P1·P2·P4·AP1 명시 invocation은 silent 누락이 아닌 explicit 금지의 근거다.

> **Review note**: creative-director 비평 1회 반영 (P1·P2·AP1 invocation, Vampire Survivors 추가, "Sensation continuity / unbroken thread" 프레이밍). Geometry Dash 수치는 verified 수억 단위로 soften (구체 수치 차후 verification 필요 시 갱신).

## Detailed Design

### Core Rules

1. **단일 상태 소유**: 애플리케이션은 어느 시점에도 정확히 하나의 상태에 있다. `currentState: GameState` 단일 변수로 표현되며, 외부에서 직접 변경할 수 없다 (private + read-only public getter).

2. **명시 transition만 허용**: 모든 전이는 `requestTransition(to: GameState)` 메서드를 통해서만 발생. 비허용 (from, to) 쌍은 **silent reject** + dev-mode `console.warn`. throw 하지 않는다 (production game-breaking 방지).

3. **동기 transition**: 모든 transition은 한 동기 함수 호출 안에서 완료. 비동기 `await` · Promise chain · `setTimeout` 사용 금지. P4 마찰 부재의 코드 레벨 보장. **`requestTransition`의 시그니처는 `void` 반환으로 강제** — Promise 반환 불가하여 호출자가 await할 수 없음 (강제 동기 계약).

4. **Lifecycle hook 순서 + origin 전달**: 전이 시 (1) `onExit(currentState, { to })` → (2) `currentState = newState` → (3) `onEnter(newState, { from })` → (4) `emit('stateChanged', { from, to })`. **`from`/`to` 전달은 필수** — 같은 destination 상태라도 origin에 따라 부수 효과가 달라지는 경우(특히 `paused → playing` vs `menu/dead → playing`)를 의존 시스템이 구분해야 한다.

5. **재진입 금지 + 큐**: hook 실행 중 다른 `requestTransition` 호출은 큐잉되어 현재 hook 완료 후 처리. 큐 용량은 **1** (`MAX_QUEUED_TRANSITIONS = 1`, §D 참조). 큐 가득 차면 추가 요청은 silent reject + dev warn. 큐는 현재 hook chain 완료 후 동기적으로 1개 처리 (다중 처리 시 multi-frame stall 위험).

6. **boot은 초기 상태**: `new GameStateManager()` 직후 상태는 `boot`. `onEnter('boot')`는 생성자에서 호출하지 않고, 의존 시스템 등록 후 `start()` 명시 호출 시 발화.

7. **visibilitychange auto-pause + manual resume (art-bible §6 S7 정합)**:
   - **hidden → paused (자동)**: `playing` 상태에서 페이지가 hidden되면 자동 `paused` transition (게임 진행 보호 — 백그라운드에서 데스 방지).
   - **visible → playing은 자동 아님**: visible 복귀 시 GSM은 transition 트리거하지 않음. UI System이 "TAP TO RESUME" overlay를 표시하고 사용자 탭을 기다림 → UI가 `requestTransition('playing')` 호출 (art-bible §6 S7 → S2 정합).
   - 다른 상태(`menu`/`dead`/`boot`/`boot_error`)에서 visibility 이벤트는 무시.
   - **canonical check**: `document.visibilityState === 'hidden'` (이벤트 소스가 아님)
   - **listen 대상**: `document.addEventListener('visibilitychange', ...)` **AND** `window.addEventListener('pagehide'/'pageshow', ...)` — iOS Safari는 전화·알림 오버레이 시 visibilitychange를 firing하지 않을 수 있으며, BFCache 복귀는 `pageshow.persisted === true`로만 감지. `pagehide`의 `persisted` 여부 무관하게 hidden 처리. (P4가 iOS에서 깨지는 시나리오 방지)
   - **resume order (사용자 탭으로 `paused → playing`)**: (1) `app.ticker.start()` → (2) `inputSystem.attach()` → (3) `emit('stateChanged', ...)`. 이 순서가 무너지면 ticker 미시작 상태에서 입력 이벤트가 발생하여 race.
   - **Pixi v8 ticker 동작 보장**: `app.ticker.start()`은 동기적으로 callback을 발화하지 않음 — 다음 `requestAnimationFrame`에서 첫 callback. 따라서 `inputSystem.attach()`와 `emit()`이 동일 task 안에서 완료된 후 첫 update가 일어나므로 실제 race는 없음. 방어적 순서는 명세 계약으로 유지.
   - **debounce**: `VISIBILITY_DEBOUNCE_MS` (§G Tuning Knob) 적용 — Android 일부 브라우저가 OS 애니메이션 중 hidden/visible을 빠르게 toggle하는 경우 스푸리어스 pause 방지. **`performance.now()` timestamp 비교로 구현** (timer-free, `setTimeout` 사용 금지 — `technical-preferences.md` Forbidden Patterns).

### States and Transitions

**State enumeration** (6 states):

| State | 의미 | 활성 시스템 |
|-------|------|------------|
| `boot` | Pixi `Application.init()` await + 에셋 로딩 | (Save 읽기만) |
| `boot_error` | 에셋 로딩 실패 — "Reload Page" 정적 UI (**터미널 — 페이지 새로고침으로만 탈출**) | (UI 메시지만) |
| `menu` | Main Menu (START 버튼 + best score) | UI System, Audio (BGM) |
| `playing` | 게임 진행 (풍선·캐릭터·작살 시뮬레이션) | 전체 게임플레이 시스템 |
| `dead` | Score Screen (최종 점수 + RETRY/Menu 버튼) | UI System, Audio (BGM), Score → Save (write best) |
| `paused` | 일시 정지 (tab 비활성 자동, MVP에는 explicit 없음) | UI (paused overlay, CSS-only), Audio (mute/dim) |

**Transition table** (허용 전이만 — 그 외는 silent reject + dev warn):

| From | Event/Trigger | To | 비고 |
|------|--------------|------|------|
| `boot` | `assetsLoaded` (loader emit) | `menu` | 부팅 완료 |
| `boot` | `assetsLoadFailed` (loader emit, 타임아웃 포함) | `boot_error` | 회복 불가 — 페이지 새로고침만 가능 |
| `menu` | START 버튼 탭 (UI emit) | `playing` | 런 시작. `from='menu'` |
| `playing` | 풍선-캐릭터 충돌 (Balloon Physics emit) | `dead` | 게임 종료 |
| `playing` | 페이지 hidden (visibility / pagehide) | `paused` | auto, debounced (게임 보호) |
| `paused` | **"TAP TO RESUME" 탭** (UI System emit, visible 복귀 후 사용자 탭) | `playing` | `from='paused'` — **세션 상태 보존 (Score/콤보 reset 안 함)**. visibility visible 단독으로 자동 전이 안 함 (art-bible §6 S7 정합) |
| `dead` | RETRY 버튼 탭 (UI emit) | `playing` | **P4 critical** — 1탭 마찰 0. `from='dead'` (효과는 `menu`와 동일) |
| `dead` | Menu 버튼 탭 (UI emit) | `menu` | 대안 경로 |

**`onEnter('playing', { from })` 분기 규칙** (downstream 시스템의 첫 번째 질문):

| `from` | Score 리셋 | 풍선 리셋 | Spawn timer | RNG 새 시드 |
|--------|-----------|----------|-------------|------------|
| `menu` | ✅ Yes | ✅ Yes | ✅ run start time = now | ✅ `newRunSeed()` |
| `dead` (RETRY) | ✅ Yes | ✅ Yes | ✅ run start time = now | ✅ `newRunSeed()` |
| `paused` | ❌ No (세션 보존) | ❌ No (제자리) | ❌ 재개 (paused 누적 시간 차감) | ❌ 시드 보존 |

**비허용 transitions** (silent reject + dev warn):
- `playing → menu` (MVP에 서렌더 없음)
- `dead → paused` (이미 정지 상태)
- `dead → playing` via visibility resume (**by design** — `playing → dead` 전이 중 visibilitychange 경쟁 시 dead 도달 후 visible 복귀하면 점수 화면 유지가 의도된 동작)
- `menu → dead` (게임 시작 없이 dead 불가)
- `boot → playing` (반드시 menu 거침)
- `boot_error → *` (터미널 — 새로고침만)
- `paused → menu` / `paused → dead` (paused는 playing 왕복만)

**State graph (ASCII)**:

```
                         assetsLoaded
  boot ─────────────────────▶ menu ──START──▶ playing ──collision──▶ dead
   │                          ▲                │  ▲                    │
   │ assetsLoadFailed         │       hidden──▶▼  │◀──"TAP TO RESUME"  │
   ▼                          │              paused                    │
boot_error                    │              (세션 보존)                 │
(터미널 — reload)              │                                        │
                              └────────── Menu button ◀────────────────┤
                                                                       │
                                          RETRY button ─────loop──────▶┘
                                                (→ playing, from='dead')

  ※ visible 복귀는 GSM이 자동 transition 안 함 — UI가 overlay 표시 후 사용자 탭 대기
```

### Interactions with Other Systems

각 의존 시스템은 `gameStateManager.on('stateChanged', handler)` listen 또는 `gameStateManager.currentState` getter 폴링. lifecycle hook 호출 순서는 Core Rule #4에 정의됨. **모든 onEnter/onExit hook은 `{ from }` / `{ to }` 컨텍스트를 받음 — 의존 시스템은 origin에 따라 동작을 분기해야 한다.**

| System | 관계 | 인터페이스 |
|--------|------|----------|
| **Input System** | Control | `enterState('playing')` → `inputSystem.attach()` (단, `paused→playing`은 resume order 적용 — ticker 먼저). `exitState('playing')` → `inputSystem.detach()` (cf. input-system.md §F) |
| **Pixi `Application.ticker`** | Control | `enterState('paused')` → `app.ticker.stop()`. `exitState('paused')` → `app.ticker.start()`. 다른 상태에서는 항상 실행. **MVP 약속: paused 중 UI 애니메이션은 CSS-only — Pixi 객체는 정지** (이 약속이 깨지면 별도 ticker priority 분리 필요 — 그 경우 `new Ticker()` 인스턴스 사용, **`Ticker.shared` 사용 금지** — shared는 Pixi 플러그인 전역이라 stop 시 부작용). **Adaptive Background dim 적용 순서**: `app.ticker.stop()` 호출 *전*에 dim visual을 마지막 frame에 적용 (또는 dim은 CSS overlay) |
| **Balloon Physics & Split** | Control | `enterState('playing', from=menu/dead)` → 게임플레이 풍선 풀 reset 후 시뮬 시작. `enterState('playing', from=paused)` → 시뮬 재개 (reset 안 함). `enterState('dead')` → freeze (마지막 프레임 유지, ticker는 호출되지만 update 무시). `enterState('menu')` → 게임플레이 풍선 풀만 제거, **메뉴 데코 풍선 풀은 유지** (art-bible §6 S1: 메뉴는 풍선 1-2개 slow float 10s 주기). Balloon Physics는 두 풀을 분리 관리해야 함 |
| **Character & Harpoon** | Control | Balloon Physics와 동일 lifecycle (from 분기 동일) |
| **Difficulty & Spawn** | Control | `enterState('playing', from=menu/dead)` → spawn timer + run start time = now. `enterState('playing', from=paused)` → timer 재개 (paused 누적 시간 차감). `exitState('playing')` → spawn timer 중지 |
| **Seed/RNG (#2, Designed)** | Control | `enterState('playing', from=menu/dead)` → `rngSuite.newRunSeed()` (새 master seed 생성, 3 sub-instance 재초기화). `enterState('playing', from=paused)` → 호출 안 함 (시드 보존). cf. seed-rng-system.md §C Core Rule #4. PROVISIONAL 해소됨 2026-05-30 |
| **Critical Pop / Power-Up** | State Query + Lifecycle | `currentState === 'playing'`일 때만 트리거 평가. `enterState('dead')` → Power-Up active 효과 즉시 cancel (멀티샷·동결·메가폭탄 진행 중인 것 모두 종료) |
| **Score & Combo** | Control + Event | `enterState('playing', from=menu/dead)` → reset to 0. `enterState('playing', from=paused)` → **유지 (세션 점수 보존)**. `enterState('dead')` → lock final + emit `score:finalized({finalScore})`. `enterState('menu')` → reset to 0 |
| **Save System** | Event-driven (**GSM 직접 호출 없음**) | Save는 `score:finalized` 또는 `gameStateManager.stateChanged({to: 'dead'})` listen → 자체적으로 `writeBestScoreIfHigher` 결정. **GSM은 Save 레퍼런스 보유 안 함** (무지 원칙 일관성) |
| **Audio System** | Event | `stateChanged` listen → 상태별 mix preset (BGM 볼륨, SFX mute) |
| **Visual Juice** | Event | `enterState('dead')` → active VFX 즉시 페이드. `enterState('menu')` → reset. `enterState('paused')` → time scale 0 (게임 시간 정지), CSS UI는 계속 |
| **Adaptive Background** | State Query | `currentState` 기반 배경 톤 (menu/dead 정적, playing 동적, paused dim) |
| **UI System** | Bidirectional | UI가 버튼 탭 시 `requestTransition(...)` 호출. GSM의 `stateChanged` listen하여 screen 표시/숨김. `boot_error` 상태도 처리 (Reload 메시지) |

**Ownership 정리**:
- 상태 변수: **GSM 단일 소유** (다른 시스템은 read-only)
- transition 트리거: 다양한 시스템이 `requestTransition()` 호출 가능 (UI가 가장 많이 호출)
- lifecycle 효과: 각 시스템이 자기 책임 (GSM은 단순히 hook + event 발화만, **다른 시스템의 API 직접 호출 안 함**)
- **세션 상태 보존 책임**: `from=paused`인 `onEnter('playing')`은 모든 세션 상태(Score/Combo/풍선 위치/spawn timer/RNG 시드)를 보존. 시스템 작성자는 반드시 이 분기를 처리해야 함.

> **Review note**: systems-designer 비평 1회 반영 (4 CRITICAL + 5 HIGH 적용 완료). `gameplay-programmer` · `engine-programmer` 미상담 — Pixi `Application.init()` async 패턴, ticker priority 결정 시 추가 상담 권장.

## Formulas

> **Renamed: "Constants and Contracts"** — Game State Manager는 수치 계산을 수행하지 않는 순수 제어 시스템이므로 전통적 의미의 "Formulas"가 없다. 대신 시스템 boundary를 결정하는 **명명 상수**(named constants)와 **시간 계약**(timing contracts)이 §G(Tuning Knobs)와 분리되어 여기에 정의된다. 두 차이: §D는 *계약*(downstream 시스템이 알아야 하는 보장), §G는 *튜닝 가능한 값*(디자이너가 조정할 수 있는 노브).

### Named Constants

| Constant | Value | Type | Range | 의미 / Rationale |
|----------|-------|------|-------|------------------|
| `MAX_QUEUED_TRANSITIONS` | **1** | int | [1, 1] (변경 불가) | hook 실행 중 들어온 `requestTransition` 호출의 최대 큐잉 수. 1 이상으로 늘리면 multi-frame stall (큐 동기 drain 시) 또는 stale state 처리 (큐 다음 프레임 drain 시) 위험. 1보다 크게 만들 필요 발견 시 ADR 필수 |
| `RETRY_DEAD_STATE_MINIMUM_MS` | **0** | int | [0, 0] (변경 불가 — MVP P4 lock) | `dead` 상태 진입 후 `dead → playing` (RETRY) 허용까지의 최소 대기 시간. 0 = P4 약속의 코드 레벨 보장. Post-MVP에서 광고 인터럽트·확인 단계가 도입되면 이 값을 0보다 크게 변경 시 ADR 필수 |
| `BOOT_INIT_TIMEOUT_GUARD_MS` | **30000** | int | [10000, 60000] | `boot` 상태가 이 시간을 초과해도 `assetsLoaded` 이벤트가 안 오면 `assetsLoadFailed`로 간주하고 `boot_error`로 강제 전이. 30s 기본은 LTE/3G 환경 안전 margin |

> **Output range note**: 위 상수들은 출력이 아닌 *입력 boundary*다. 일반 formulas와 달리 "값 범위 → 출력 영향" 매핑이 없고, 대신 "값 변경 → 시스템 invariant 영향"으로 평가한다.

### Timing Contracts

| Contract | Budget | 측정 단위 | 위반 시 영향 |
|----------|--------|----------|-------------|
| **Hook 실행 시간** (단일 `onEnter`/`onExit` 호출) | **< 8ms** (target — worst-case 단일 hook), **< 16.67ms** (hard ceiling — 1 frame @ 60fps) | wall-clock | 8ms 초과: 단일 frame jitter. 16.67ms 초과: 동기 transition 동안 한 프레임 drop. **중요**: 8ms는 *worst-case 단일 hook* 목표. 대부분의 hook은 < 1ms여야 함. 12개 시스템이 동시에 8ms를 쓰면 96ms → AC-19 33ms 계약 위반. **AC-19 (transition 총 시간 < 33ms)가 binding ceiling**, 8ms는 advisory per-hook target |
| **`requestTransition` 호출~`stateChanged` emit 완료** (총 transition 시간) | **< 33ms** (2 frames) | wall-clock | 초과 시 RETRY 1탭과 다음 런 시작 사이에 시각적 stall. P4 약속의 정량 기준 |
| **`visibilitychange` 이벤트~`paused` 진입 완료** | **< 50ms** (debounce 포함) | wall-clock | 초과 시 백그라운드 진입 후에도 게임이 잠시 진행 → 모바일에서 의도치 않은 데스 위험 |
| **`pageshow.persisted=true` (BFCache 복귀) 감지~`playing` 재개** | **< 100ms** | wall-clock | 초과 시 iOS Safari BFCache에서 돌아왔을 때 입력 lock 잔존 위험 |

### Worked Example (P4 보장 시나리오)

플레이어가 RETRY 버튼을 탭한 시점부터 다음 런이 입력 받기 시작하는 시점까지:

```
t=0ms:     RETRY 버튼 pointerup → UI System이 requestTransition('playing') 호출
t=1ms:     onExit('dead', {to: 'playing'}) 시작
            ├─ UI: Score Screen 페이드아웃 시작 (CSS, non-blocking)
            ├─ Audio: dead BGM stop → playing BGM crossfade 시작
            └─ Visual Juice: active VFX 모두 cancel
t=4ms:     onExit('dead') 완료 (3ms)
t=4ms:     currentState = 'playing' (atomic)
t=5ms:     onEnter('playing', {from: 'dead'}) 시작
            ├─ Score & Combo: reset to 0
            ├─ Balloon Physics: pool reset + 시뮬 시작
            ├─ Character & Harpoon: 위치 reset
            ├─ Difficulty & Spawn: timer 시작, run start time = now
            ├─ Seed/RNG: newRunSeed() (PROVISIONAL)
            └─ Input System: attach() — pointer 이벤트 수신 시작
t=12ms:    onEnter('playing') 완료 (7ms)
t=13ms:    emit('stateChanged', {from: 'dead', to: 'playing'})
            ├─ UI: HUD 표시
            ├─ Adaptive Bg: playing 톤으로 전환
            └─ Audio: playing mix preset 적용
t=15ms:    transition 완료 — 사용자는 이미 다음 풍선을 노리는 중
```

**총 15ms** ≈ **1 frame** — Geometry Dash 수준의 P4 보장. 33ms 계약 안에 안전. 한 시스템이 hook에서 8ms 이상 쓰면 이 그림이 무너진다 → AC §H의 자동 회귀 테스트로 측정.

> **Review note**: systems-designer 비평 H-3 (MAX_QUEUED_TRANSITIONS), formula-shaped decision (4개 상수) 반영. 추가로 Post-MVP 시 RETRY 광고 흐름이 들어올 때 `RETRY_DEAD_STATE_MINIMUM_MS`가 단일 변경 지점 — 광고 SDK가 코드 여러 곳에 흩어지는 것을 사전 방지.

## Edge Cases

각 케이스는 명시적 조건과 결정된 outcome으로 기술. "handle gracefully"는 금지.

- **If `boot` 상태에서 `BOOT_INIT_TIMEOUT_GUARD_MS` (기본 30000ms) 초과해도 `assetsLoaded` 미도착**: loader가 `assetsLoadFailed`를 emit하지 않더라도 GSM 내부 타이머가 강제로 `boot → boot_error` 전이. 사용자는 "Reload Page" 메시지 + 새로고침 안내를 본다. 새로고침 외 회복 경로 없음.

- **If hook 실행 중 예외 throw**: `requestTransition` 내부의 try/catch가 예외를 잡고 `console.error`로 로깅 (production도 error 레벨). **상태 변수는 새 상태로 이미 변경된 후이므로** (Core Rule #4 step 2), 의존 시스템은 부분 초기화 상태에 있을 수 있다. MVP에서는 추가 복구 시도 안 함 — 사용자는 다음 transition 트리거(예: RETRY)에서 정상 동작 시도. 누적 errors는 dev-mode에서 빌드 차단 조건 (AC §H).

- **If 플레이어가 RETRY 버튼을 매우 빠르게 연속 탭** (1초에 5회 이상): 첫 탭 → `dead → playing` transition 성공. 두 번째 탭부터는 현재 상태가 `playing`이므로 `playing → playing` 시도 = 비허용 = silent reject. 큐도 비어 있어 영향 없음. P4 1탭이 보장되되, "탭 폭격으로 시스템 깨지기" 없음.

- **If `playing → dead` transition hook 실행 중 `visibilitychange` (탭 비활성)**: visibility 핸들러가 `requestTransition('paused')` 호출 → 큐잉 (Core Rule #5). `playing → dead` 완료 후 큐 drain → `dead → paused`는 비허용 → silent reject. 이후 visible 복귀 → `requestTransition('playing')` → `dead → playing` (via visibility) = 비허용 → silent reject. **최종 상태: `dead` 유지**. 사용자가 탭 복귀하면 점수 화면을 본다 (의도된 동작). 명시적 RETRY 탭만 다음 런으로 진행.

- **If iOS Safari에서 전화·알림 수신**: Safari가 `visibilitychange`를 firing하지 않는 경우, `pagehide` (persisted=false)가 fire됨. GSM의 `pagehide` 리스너가 `requestTransition('paused')` 호출. 통화 종료 후 `pageshow` (persisted=true) → `requestTransition('playing', from='paused')` → 세션 상태 보존하며 재개. 통화 도중 데스 없음 (P4 iOS 호환).

- **If `paused → playing` 재개 시 ticker 시작 전에 입력 발생**: Core Rule #7의 resume order(ticker → input → emit) 위반은 race condition. 발생 시 input attach 시점에 ticker가 멈춰 있으면 첫 `pointerdown`이 Pixi stage에 도달은 하지만 시뮬레이션 update가 안 도는 1 frame 발생. 가벼운 visual hitch — 게임플레이 영향 없음. AC §H의 frame timing test로 검증.

- **If `dead` 상태에서 ticker가 실행 중**: ticker는 매 프레임 호출되지만 Balloon Physics·Character·Power-Up 등은 `currentState === 'playing'` 가드로 update를 무시 (no-op). UI 시스템만 Score Screen 애니메이션(점수 카운트업 등)을 위해 ticker 콜백 활용. 성능 영향 무시 가능 — dead는 정적 화면이므로 ticker 콜백 자체가 비싸지 않음.

- **If Power-Up 효과(멀티샷·동결·메가폭탄)가 active 상태에서 데스**: `enterState('dead')`이 모든 Power-Up active 효과를 즉시 cancel (Interactions §C). 다음 RETRY 런은 깨끗한 상태로 시작. Power-Up 효과가 dead 화면에 visual artifact를 남기지 않음.

- **메뉴 화면 데코 풍선 (art-bible §6 S1 락인)**: art-bible §6 S1에서 메뉴는 **"풍선 1-2개만 부유 (10s 주기)"** 명시 — 데코 풍선 풀 존재. Balloon Physics는 **게임플레이 풀**(playing/dead/paused에서 사용, menu 진입 시 reset)과 **데코 풀**(menu/dead에서 표시, playing 진입 시 hide 또는 background로 이동)을 분리 관리. `enterState('menu')` → 게임플레이 풀만 제거. `enterState('playing')` → 데코 풀 hide. 분리 정책 세부는 Balloon Physics GDD (#5) 작성 시 락인.

- **If 페이지 새로고침 (F5 / Cmd+R) 또는 탭 종료**: 브라우저가 페이지 unload → GSM 인스턴스 파괴. `start()`에서 등록한 모든 리스너(visibilitychange, pagehide/show)는 페이지와 함께 사라짐. localStorage 베스트 스코어는 보존 (Save System 책임). 다음 페이지 로드 시 `boot`부터 재시작 — 의도된 동작.

- **If `requestTransition`이 같은 상태로 호출** (예: `playing → playing`): 비허용 transition → silent reject + dev warn. 시스템 작성자가 잘못된 호출을 한 것이므로 dev-mode 경고는 의도된 동작 (production에서는 무시).

- **If `requestTransition`이 `boot_error` from 호출**: `boot_error`는 터미널 — 모든 transition 비허용 → silent reject + dev warn. UI는 사용자가 새로고침할 때까지 "Reload Page" 표시.

- **If Android 브라우저가 OS 애니메이션 중 `visibilitychange`를 매우 빠르게 hidden→visible→hidden 반복 firing**: `VISIBILITY_DEBOUNCE_MS` (§G, 기본 100ms) 내의 toggle은 무시. 100ms 이상 hidden 유지된 경우에만 `paused` 전이. 스푸리어스 pause로 인한 frame stall 방지.

- **If `start()` 호출 전에 `requestTransition` 호출**: GSM은 아직 listener를 등록하지 않은 상태 — `requestTransition` 자체는 동작하지만 외부 이벤트(visibilitychange 등)는 무시됨. 개발자 실수 케이스로 dev-mode warning 권장. MVP에서 `start()` 호출 강제는 안 함 (단위 테스트가 hook을 직접 호출하는 경우 허용).

## Dependencies

### Upstream Dependencies (이 시스템이 의존하는 것)

**없음 (Foundation layer).** Game State Manager는 어떤 다른 시스템도 import하지 않는다 — 다만 다음 외부 환경에 의존:

| 외부 의존 | 인터페이스 | 비고 |
|----------|----------|------|
| **Pixi.js v8 `Application`** | 생성자에 `app: Application` 인스턴스 전달 (`new GameStateManager({ app, ... })`). GSM은 `app.ticker.start()`/`stop()`만 호출 | Pixi `Application.init()`은 async — GSM 생성자 호출 전에 await 완료된 인스턴스여야 함 |
| **Browser DOM API** | `document.addEventListener('visibilitychange', ...)`, `window.addEventListener('pagehide'/'pageshow', ...)` | iOS Safari 호환 위해 두 이벤트 모두 listen (Core Rule #7). **Post-MVP enhancement**: Chrome 68+의 `freeze`/`resume` (Page Lifecycle API)로 깊은 suspend 감지 강화 가능 — MVP 미적용 (visibilitychange + pagehide combo가 > 99% 케이스 커버) |
| **Asset Loader** (별도 모듈, 아키텍처 단계에서 분리) | `loader.on('assetsLoaded', ...)` / `loader.on('assetsLoadFailed', ...)` | Loader는 GSM 외부 모듈로 분리. GSM은 loader 레퍼런스를 생성자에서 받음. Loader 구현은 ADR로 분리 (Pixi Assets API 또는 자체 구현) |

### Downstream Dependents (이 시스템에 의존하는 것)

| System | 관계 | Interface 방향 | 상태 |
|--------|------|---------------|------|
| **Input System** | Control (GSM owns lifecycle) | GSM → Input (`attach()`/`detach()`) | Designed (input-system.md §F bidirectional verified) |
| **Pixi `Application.ticker`** | Control | GSM → `app.ticker` (`start()`/`stop()`) | N/A (Pixi 내장) |
| **Balloon Physics & Split** | Control + State Query | GSM → Balloon (lifecycle hooks); Balloon → GSM (`currentState` query, `playing → dead` trigger) | Undesigned (#5 — 아직 GDD 없음, PROVISIONAL) |
| **Character & Harpoon** | Control | GSM → Character (lifecycle hooks) | Undesigned (#4) |
| **Difficulty & Spawn** | Control | GSM → Difficulty (lifecycle hooks) | Undesigned (#7) |
| **Seed/RNG** | Control | GSM → RNG (`newRunSeed()` 호출 PROVISIONAL — 시드 정책은 RNG GDD에서 락인) | Undesigned (#3 same batch — 이 GDD 직후 작성 예정) |
| **Critical Pop** | State Query | Critical → GSM (`currentState` 폴링) | Undesigned (#6) |
| **Power-Up** | State Query + Event | Power-Up → GSM (`stateChanged` listen for cancel on dead) | Undesigned (#9) |
| **Score & Combo** | Event + Bidirectional | GSM → Score (lifecycle hooks); Score → GSM 없음. Score → Save (`score:finalized` event emit, GSM 경유 안 함) | Undesigned (#8) |
| **Save System** | Event-driven (**GSM과 직접 연결 없음**) | Save → Score (`score:finalized` listen) 또는 Save → GSM (`stateChanged` listen). GSM은 Save 레퍼런스 없음 | Undesigned (#13) |
| **Audio System** | Event | Audio → GSM (`stateChanged` listen) | Undesigned (#12) |
| **Visual Juice** | Event | Juice → GSM (`stateChanged` listen) | Undesigned (#10) |
| **Adaptive Background** | State Query | Bg → GSM (`currentState` 폴링 또는 `stateChanged` listen) | Undesigned (#11) |
| **UI System** | Bidirectional | UI → GSM (`requestTransition()` 호출), GSM → UI (`stateChanged` listen for screen show/hide), GSM → UI (`boot_error` 상태 표시 책임) | Undesigned (#14) |

### Bidirectional Verify 필요 (후속 GDD 작성 시)

각 downstream GDD 작성 시 다음 항목을 재검증:

- **Input System (Designed)**: ✅ input-system.md §F에서 already verified — GSM이 `attach()`/`detach()` 호출. resume order(ticker → input)는 input GDD에는 미반영 — input GDD 차기 revision에서 반영 권장.
- **Character & Harpoon (#4)**: GSM의 5 events (특히 `stateChanged`)를 어떻게 listen하는지, `from='paused'` 분기를 어떻게 처리하는지 명시 필요.
- **Balloon Physics (#5)**: `playing → dead` trigger를 누가 emit하는지 (Balloon이 충돌 감지 → `requestTransition('dead')` 호출). 풍선 풀 reset vs preserve 정책.
- **Seed/RNG (#3 same batch)**: `newRunSeed()` 시그니처와 시드 정책 (run 시작마다 새 시드 vs 메뉴 진입 시 시드 vs 영구 시드).
- **Score & Combo (#8)**: `score:finalized` 이벤트 명세 (payload: `{finalScore}`만? 또는 더 풍부?). Save와의 connection (이벤트 기반).
- **Save System (#13)**: Save가 GSM stateChanged를 listen할지 또는 Score의 score:finalized를 listen할지 결정 — 후자가 권장 (GSM이 Save를 모르도록 유지).
- **UI System (#14)**: 모든 transition 트리거 버튼 (START / RETRY / Menu)을 어디서 호출하는지, `boot_error` 상태 UI 명세.

### Dependency Graph (Local)

```
  [Browser DOM]            [Pixi Application]            [Asset Loader]
       │                          │                            │
       └───── visibility/         │                            │
             pagehide             │                            │
       │                          │                            │
       └─────────────┐    ┌───────┘    ┌───────────────────────┘
                     ▼    ▼            ▼
                  ┌─────────────────────────┐
                  │  Game State Manager     │ ◀─── (no upstream Game systems)
                  └─────────────────────────┘
                            │
                            │ stateChanged event + lifecycle hooks
                            ▼
        ┌────────┬──────────┴──────────┬─────────┬──────────┐
        ▼        ▼                     ▼         ▼          ▼
     Input  Character/Harpoon    Balloon/   UI System   Audio/Visual/
                                 Score/                  Adaptive Bg
                                 ...
```

## Tuning Knobs

§D (Constants and Contracts)는 **변경하면 안 되는 계약 상수**를 정의했다. §G는 **디자이너·QA가 실제로 조정할 수 있는 노브**다. 모든 노브는 `GameStateManager` 생성자 옵션으로 주입.

| Knob | Default | Safe Range | 너무 높이면 | 너무 낮추면 | 영향 시스템 |
|------|---------|-----------|-----------|-----------|-------------|
| `visibilityDebounceMs` | **100ms** | [50, 300] ms | 백그라운드 진입 후에도 게임 진행 → 데스 위험 증가 (P4 위반) | Android 일부 브라우저의 OS 애니메이션 toggle로 spurious pause → frame stall | Pixi ticker, Audio, Visual Juice (paused 전이 빈도). **구현 방법**: `performance.now()` timestamp 비교 — `setTimeout` 사용 금지 (technical-preferences.md Forbidden Patterns). 핸들러 안에서 `(now - lastEventTime) < debounceMs`이면 무시 |
| `bootInitTimeoutMs` | **30000ms** (30s) | [10000, 60000] ms | LTE/3G 환경에서 로딩 지연 시 사용자가 무한 대기 → 이탈 | 양호한 네트워크에서도 부분 로딩 실패로 `boot_error` 트리거 빈발 → 사용자가 의도치 않게 "Reload" 화면 봄 | Asset Loader, UI System (boot_error 화면) |
| `debug` | **`import.meta.env.DEV`** (Vite 자동) | `true` / `false` | `true` in production: console에 silent reject warning 노출 → 사용자 console에 노이즈 | `false` in dev: 잘못된 transition 호출이 묻혀서 디버깅 어려움 | 모든 시스템 (dev-mode warning visibility) |
| `enableAutoVisibilityPause` | **`true`** | `true` / `false` | (true가 정상) | `false`: 백그라운드에서도 게임 진행 → 모바일 P4 약속 위반. **자동화 테스트에서만 false 권장** (headless 환경에서 visibility 이벤트 misfire 방지) | Pixi ticker, Input, Audio |

### Tuning Strategy

- **베타테스트 시 우선 조정 대상**: `visibilityDebounceMs` — 디바이스마다 visibility firing 패턴이 다름. Android 저가형 기기에서 spurious pause 자주 발생 시 100 → 150ms로 올림.
- **운영 환경 변동 없음**: `bootInitTimeoutMs`는 30s 기본 유지 권장. 변경 사유는 ADR 필수.
- **`debug`**: Vite 빌드 환경 변수와 자동 연동. 수동 override는 비권장.
- **`enableAutoVisibilityPause`**: production에서는 항상 `true`. E2E 테스트(Playwright)에서 visibility 이벤트를 정확히 제어할 수 없는 경우에만 임시로 `false`.

### Knob Interactions

- `visibilityDebounceMs`와 `bootInitTimeoutMs`는 독립적 — 서로 영향 없음.
- `enableAutoVisibilityPause = false`로 설정하면 `visibilityDebounceMs`는 의미 없어짐 (visibility 리스너 자체가 등록 안 됨).
- `debug = false` (production)에서도 `console.error` (hook 예외)는 항상 출력 — 이는 사용자 디버깅이 아니라 telemetry/Sentry 같은 외부 수집을 위함.

> **Constants vs Knobs 가이드** (downstream 시스템 작성자 참고):
> - §D Constants (`MAX_QUEUED_TRANSITIONS`, `RETRY_DEAD_STATE_MINIMUM_MS`, hook 시간 계약): **변경 = ADR 필수**. 시스템 invariant.
> - §G Knobs: 디자이너 자유 조정. 단 safe range 벗어나면 코드 리뷰 시 검토.

## Visual/Audio Requirements

**Not applicable to this system directly.** Game State Manager는 시각·청각 출력을 소유하지 않는다. 단, 시스템이 *유발*하는 시각·청각 효과는 다음과 같으며 각각 해당 시스템 GDD에서 명세:

| Transition / State | Visual 효과 (소유 시스템) | Audio 효과 (소유 시스템) |
|---|---|---|
| `boot → menu` | 부팅 화면 페이드 → 메인 메뉴 등장 (UI System) | 메뉴 BGM 시작 (Audio System) |
| `menu → playing` | 메인 메뉴 페이드 → HUD 등장 (UI System) | 메뉴 BGM → 게임 BGM crossfade (Audio System) |
| `playing → dead` | 화면 다크닝 + 점수 화면 등장 (UI System + Adaptive Background) | 게임 BGM dim + 데스 SFX (Audio System) |
| `dead → playing` (RETRY) | 점수 화면 페이드 → HUD (UI System) | 데스 SFX off + 게임 BGM 재시작 (Audio System) |
| `playing → paused` | 화면 dim + paused overlay (UI System + Adaptive Background) | SFX mute, BGM 50% dim (Audio System) |
| `paused → playing` | overlay 페이드아웃 (UI System) | SFX unmute, BGM 정상 (Audio System) |
| `boot_error` | "Reload Page" 정적 UI (UI System §J) | 무음 (Audio 미초기화) |

GSM은 이 효과들을 *트리거*만 한다 (state change event 발화). 실제 visual/audio 구현은 각 소유 시스템이 자기 GDD에서 명세.

> **Asset Spec**: GSM은 자체 에셋 없음. boot_error UI 텍스트·아이콘은 UI System asset-spec에서 처리.

> **Review note**: 이 섹션은 art-bible §6 mood matrix와 정합성 확인 필요 (특히 paused dim 정도, dead darkening curve). UI System GDD 작성 시 다시 검토.

## UI Requirements

GSM이 *직접* 소유하는 UI 표면은 없다. 모든 화면(Main Menu, Gameplay HUD, Score Screen, paused overlay, boot_error)은 UI System (#14)이 owns. GSM은 다음을 통해 UI에 영향:

### GSM → UI 계약

| 이벤트 | UI 책임 |
|--------|---------|
| `stateChanged({to: 'boot'})` | 부팅 로딩 인디케이터 표시 |
| `stateChanged({to: 'boot_error'})` | **"Reload Page" 정적 UI** 표시 — 텍스트, 새로고침 안내 아이콘, *no button* (사용자가 브라우저 새로고침 사용) |
| `stateChanged({to: 'menu'})` | Main Menu (START 버튼, best score, 게임 타이틀) |
| `stateChanged({to: 'playing'})` | Gameplay HUD (점수, 콤보 글로우) + 메뉴/score screen 숨김 |
| `stateChanged({to: 'dead'})` | Score Screen (최종 점수, best 갱신 표시, RETRY 버튼, Menu 버튼) |
| `stateChanged({to: 'paused'})` | Paused overlay (CSS-only — Pixi ticker는 멈춤) — 반투명 dim + "Tap to resume" 또는 정적 텍스트 |

### UI → GSM 계약

| UI 액션 | GSM 호출 |
|---------|----------|
| START 버튼 탭 | `requestTransition('playing')` |
| RETRY 버튼 탭 | `requestTransition('playing')` (from='dead') |
| Menu 버튼 탭 (Score Screen) | `requestTransition('menu')` |

### Paused overlay 명세 (art-bible §6 S7 정합)

> **art-bible §6 S7 Pause가 ground truth** — 본 명세는 art-bible과 정확히 일치해야 한다. 충돌 발견 시 art-bible 우선.

- **MVP 기본 (art-bible §6 S7 정합)**: Pixi Ticker `stop()` + 화면 위 `rgba(0,0,0,0.3)` dim overlay + 중앙 **"TAP TO RESUME"** 글래스 패널 (art-bible §3 / §6 §S7).
- **MVP resume 방식**: **명시적 탭 to resume** — `visibilitychange visible` / `pageshow` 시 overlay 표시, 사용자가 "TAP TO RESUME" 패널 탭 → `requestTransition('playing')` 호출 → 0.2s dim fade out + Ticker start → playing 복귀.
- **GSM 시점에서의 transition trigger 차이** (art-bible 정합으로 §C 갱신됨):
  - `visibilitychange visible` / `pageshow` 단독으로는 GSM이 `playing` 전이를 자동 발화하지 않음 — UI System이 overlay를 표시하고 사용자 탭을 기다림.
  - 사용자가 "TAP TO RESUME" 탭 → UI System이 `requestTransition('playing')` 호출.
  - 단, GSM은 visibility hidden 시 즉시 `paused`로 전이 (이건 자동 — 게임 진행 중 보호).

### boot_error UI 명세 (ux-designer 권고 반영 2026-05-30)

- **레이아웃**: 화면 중앙, 텍스트 블록 + reload 버튼
- **내용**:
  - 메시지: "게임을 불러올 수 없습니다. 페이지를 새로고침하세요." (한국어 기본) / "Couldn't load the game. Please refresh the page." (영문 toggle, 로컬화 GDD 작성 시)
  - **Reload 버튼**: `<button onclick="window.location.reload()">새로고침 / Reload</button>` — HTML DOM 레이어 (Pixi 외부). ux-designer 권고: 에러 메시지 자체도 JS가 렌더링하므로 "JS context broken" 근거는 false — reload button 추가 가능.
- **시각**: art-bible §6 boot_error mood preset 또는 기본 Frosted Sky 톤 위 dim. 버튼은 art-bible §7 button style 적용 (Liquid Glass).
- **인터랙션**: reload 버튼 탭 → `window.location.reload()`. 폴백: 사용자가 브라우저 새로고침(F5 / pull-to-refresh / 주소창 새로고침).
- **실패 시나리오 정보 노출**: MVP는 generic 메시지만. Power user를 위한 상세 (network? bundle hash? CORS?)는 console에 로깅 (개발자만 확인). UI는 casual 유저 친화.

> **📌 UX Flag — Game State Manager**: paused overlay, boot_error 화면은 UI System GDD (#14) 작성 시 별도 UX 스펙 필요. `/ux-design` 호출 시 main-menu / gameplay-hud / score-screen 외에 **paused-overlay**와 **boot-error** 추가 권장 (혹은 score-screen 안에 통합 가능).

> **Review note**: lean mode — `ux-designer` 미상담. UI System GDD 작성 시 ux-designer 상담 권장.

## Acceptance Criteria

각 AC는 GIVEN-WHEN-THEN 포맷. 독립 QA 테스터(또는 자동화 테스트 러너)가 GDD 없이 검증 가능해야 함. 모든 AC는 Vitest 단위 테스트 또는 Playwright E2E로 자동화 가능.

### State Machine Correctness

- **AC-01** (Core Rule #1, 단일 상태): GIVEN GSM 인스턴스 생성 직후, WHEN `currentState` getter 호출, THEN `'boot'` 반환. 외부에서 `currentState` 변수에 직접 할당 시 TypeScript `readonly` 또는 런타임 setter 부재로 컴파일·런타임 에러.

- **AC-02** (Core Rule #2, 명시 transition): GIVEN `currentState === 'menu'`, WHEN `requestTransition('dead')` 호출 (비허용), THEN `currentState`는 `'menu'` 유지, `console.warn` 1회 호출 (dev-mode), `stateChanged` event 미발화.

- **AC-03** (Core Rule #3, 동기 transition): GIVEN `requestTransition('playing')` 호출, WHEN 함수 반환 직후 `currentState` 읽기, THEN 즉시 `'playing'` 반환 (Promise 또는 비동기 대기 없음). 함수 시그니처는 TypeScript에서 `void` 반환 — `await requestTransition(...)` 시도는 lint warning.

- **AC-04** (Core Rule #4, hook 순서): GIVEN 모든 hook을 spy로 wrap, WHEN `menu → playing` 전이, THEN spy 호출 순서가 정확히 `onExit('menu', {to: 'playing'})` → 내부 상태 변경 → `onEnter('playing', {from: 'menu'})` → `emit('stateChanged', {from: 'menu', to: 'playing'})`.

- **AC-05** (Core Rule #4, from/to 전달): GIVEN onEnter 핸들러 등록, WHEN `dead → playing` (RETRY), THEN 핸들러는 `{from: 'dead'}` payload 수신. 동일하게 `paused → playing` 시 `{from: 'paused'}` 수신.

- **AC-06** (Core Rule #5, 큐): GIVEN `onEnter('playing')` 안에서 `requestTransition('dead')` 호출하는 hook 등록, WHEN 외부 호출자가 `requestTransition('playing')` 반환받은 직후, THEN `currentState === 'playing'` (큐잉됨), 큐 drain 후 `currentState === 'dead'`.

- **AC-07** (Core Rule #5, 큐 오버플로 `MAX_QUEUED_TRANSITIONS=1`): GIVEN onEnter 안에서 연속 2개 transition request, WHEN 2번째 request 호출, THEN silent reject + console.warn (큐 용량 초과).

- **AC-08** (Core Rule #6, boot 초기 상태): GIVEN `new GameStateManager(opts)` 생성, WHEN `start()` 호출 전 `currentState` 읽기, THEN `'boot'` 반환, `onEnter('boot')` hook 미호출.

- **AC-09** (Core Rule #7, visibility 정상): GIVEN `currentState === 'playing'`, WHEN `document.visibilityState`를 mock으로 `'hidden'` 설정 + `visibilitychange` 이벤트 dispatch + `visibilityDebounceMs` (100ms) 대기, THEN `currentState === 'paused'`.

- **AC-10** (Core Rule #7, iOS Safari `pagehide` 호환): GIVEN `currentState === 'playing'`, WHEN `pagehide` 이벤트만 dispatch (visibilitychange 미발화), THEN `currentState === 'paused'`.

- **AC-11** (Core Rule #7, resume order): GIVEN `currentState === 'paused'` + spy on `app.ticker.start` 및 `inputSystem.attach`, WHEN `pageshow` 이벤트 dispatch, THEN spy 호출 순서가 정확히 `app.ticker.start()` → `inputSystem.attach()` → `emit('stateChanged', ...)`.

### State-Specific Behaviors

- **AC-12** (paused → playing 세션 보존, **M-4 회귀 방지** — qa-lead narrow scope): GIVEN `onEnter` 핸들러 등록, WHEN UI가 paused 상태에서 `requestTransition('playing')` 호출 (사용자 "TAP TO RESUME" 탭), THEN 핸들러는 `{from: 'paused'}` payload 수신. **GSM 단위 책임은 payload 정확성만**. 실제 Score/풍선/timer 보존 invariant는 downstream 시스템(Score, Balloon Physics, Difficulty) GDD 작성 시 그쪽 AC로 검증.

- **AC-13** (menu/dead → playing 리셋): GIVEN `currentState === 'dead'`, Score === 500, 풍선 N개 active, WHEN `requestTransition('playing')` (RETRY), THEN Score === 0, 풍선 === 0개, spawn timer === 0, RNG newRunSeed 호출됨.

- **AC-14** (P4 stake — `RETRY_DEAD_STATE_MINIMUM_MS=0`, qa-lead sharpen): GIVEN GSM 컴파일된 코드, WHEN `RETRY_DEAD_STATE_MINIMUM_MS` 상수 값 검사, THEN `=== 0`. (latency 측정은 AC-19로 통합 — 중복 제거.) 이 AC는 코드 상수 검사 — 동기 unit test, 어떤 시간 측정도 안 함. P4 약속의 명시적 stake-in-ground.

- **AC-15** (boot_error 터미널): GIVEN `currentState === 'boot_error'`, WHEN 어떤 `requestTransition(*)` 호출, THEN `currentState === 'boot_error'` 유지 + silent reject + console.warn.

- **AC-16** (boot timeout): GIVEN `currentState === 'boot'`, WHEN `bootInitTimeoutMs` (mock timer로 가속) 초과해도 `assetsLoaded` 미수신, THEN `currentState === 'boot_error'`로 자동 전이.

- **AC-17** (dead → playing via visibility 차단, **C-1 회귀 방지**): GIVEN `playing → dead` transition hook 실행 중 visibility hidden→visible 발생 → dead 도달 후 visible 복귀 핸들러 fire, WHEN visible 핸들러가 `requestTransition('playing')` 호출, THEN `currentState === 'dead'` 유지 (silent reject).

### Timing Contracts

- **AC-18** (hook 시간 budget warning, qa-lead revised: mocked perf.now): GIVEN `vi.spyOn(performance, 'now')`로 hook 실행 전후 0 / 9 반환 mock, WHEN transition 실행, THEN `console.warn` 1회 호출, 메시지가 `/hook .+ took \d+ms \(>8ms target\)/` 정규식 매칭. **CI 빌드 차단 아님** — 측정/경고 pathway만 검증 (실제 timing은 환경 의존, advisory).

- **AC-19** (transition 총 시간, qa-lead 3-layer split):
  - **Layer A (CI synthetic unit, blocking)**: GIVEN GSM with no-op hooks, WHEN `dead → playing` transition, THEN wall-clock (`performance.now()`) < **5ms**. GSM framework 자체 overhead 검증 (CI x86 환경).
  - **Layer B (nightly integration benchmark, non-blocking)**: GIVEN 12개 mock hook (각 ~0.5ms synthetic work, §D Worked Example 모사), WHEN 100회 transition 실행, THEN p95 < **33ms**. 트렌드 추적용.
  - **Layer C (manual real-device gate, release-blocking)**: iPhone 11 + Galaxy A52에서 Chrome DevTools Performance로 `dead → playing` 측정 < **33ms**. QA Lead sign-off in `production/qa/evidence/gsm-device-verification-[date].md`.

- **AC-20** (visibility debounce, §G): GIVEN `currentState === 'playing'` + `vi.useFakeTimers()`, WHEN visibilitychange를 50ms 간격으로 hidden→visible→hidden 빠르게 dispatch (debounce window 100ms 안), THEN `paused` 전이 발생 횟수 0 또는 1 (debounce 적용됨).

### Performance

- **AC-21** (60fps@iPhone 11 / Galaxy A52): GIVEN 게임 실행 중, WHEN `playing` 상태에서 state machine 활동, THEN GSM 자체 frame time 기여도 < 0.5ms (60fps budget 16.67ms의 3%).

- **AC-22** (메모리 누수, qa-lead + engine-programmer expanded scope): 다음 항목을 audit:
  - (a) **DOM listeners**: `vi.spyOn(document, 'removeEventListener')` + `vi.spyOn(window, 'removeEventListener')` — `destroy()` 호출 시 visibilitychange · pagehide · pageshow 모두 해제 검증
  - (b) **stateChanged handlers**: `destroy()` 호출 후 `gsm.listenerCount('stateChanged') === 0` (EventEmitter `removeAllListeners()` 호출 검증)
  - (c) **GSM 내부 큐**: `destroy()` 호출 후 큐 비어 있음 (큐잉된 pending transition은 cleared without executing)
  - (d) **Filter/ParticleContainer 정책 강제**: GSM이 직접 관리 안 함이지만, downstream 시스템에 부과하는 제약 — "Filter/ParticleContainer pool and reuse, never recreate per-cycle" — 은 각 downstream GDD AC에서 검증 (Visual Juice, Balloon Physics).
  - (e) **Heap delta (advisory, nightly only)**: 100회 cycle 후 `process.memoryUsage().heapUsed` 변화 < 10KB. `--expose-gc` flag 필요. CI blocking 아님 (false positive 위험).

### Failure Modes

- **AC-23** (hook 예외 — **continue-with-isolation policy**, qa-lead revised): GIVEN `onEnter('playing')`에 두 hook 등록 — hook A는 throw, hook B는 정상 — WHEN `menu → playing` 전이, THEN: `currentState === 'playing'` (상태 변경됨), **hook B가 정상 실행됨 (A 예외에도 불구하고)**, `console.error` 정확히 1회 출력 (hook A 예외). **MVP 선택 변경: abort → continue-with-isolation** (qa-lead 권고). 이유: abort는 hook 등록 순서에 따른 silent skip을 유발 — 어느 시스템이 초기화 안 됐는지 unobservable. continue는 각 시스템이 명시적으로 초기화 또는 명시적으로 error.

- **AC-24** (dev-mode warning): GIVEN `debug: true`, WHEN 비허용 transition 호출, THEN `console.warn` 출력. GIVEN `debug: false`, WHEN 동일 호출, THEN warn 출력 없음 (`console.error`는 hook 예외 시 항상 출력).

### Lifecycle Edge Cases (qa-lead added 2026-05-30)

- **AC-23b** (queue cleared on destroy): GIVEN onEnter('playing') 안에서 큐잉된 transition request 존재, WHEN `destroy()` 호출, THEN 큐 비워짐 + 큐잉된 transition 실행 안 함 (destroyed GSM에 대한 작업 방지).

- **AC-23c** (double `start()` 안전성): GIVEN `start()` 이미 한 번 호출됨, WHEN `start()` 다시 호출, THEN no-op 또는 `console.warn` 1회, **DOM listener 중복 등록 안 됨** (visibilitychange 한 번만 등록 — `vi.spyOn(document, 'addEventListener')` count 검증).

- **AC-23d** (boot timeout cancel): GIVEN `currentState === 'boot'`, boot timeout timer 실행 중, WHEN `assetsLoaded` 이벤트 발화 + `boot → menu` 전이 성공, THEN `bootInitTimeoutMs` 이후에도 `boot_error` 전이 발화 안 함 (timer cleared on successful boot).

- **AC-23e** (stateChanged listener 예외 격리): GIVEN `stateChanged` 이벤트 리스너 중 하나가 throw, WHEN transition 발생 → emit, THEN 다른 리스너는 정상 실행 (continue-with-isolation policy 일관성), `console.error` 1회 출력. transition 자체는 완료 (currentState 변경됨).

### Cross-System Integration

- **AC-25** (Input attach/detach): GIVEN `currentState === 'menu'`, `inputSystem.isAttached === false`, WHEN `menu → playing`, THEN `inputSystem.isAttached === true`. WHEN `playing → dead`, THEN `inputSystem.isAttached === false`.

- **AC-26** (Pixi ticker control): GIVEN `app.ticker.started === true`, WHEN `playing → paused`, THEN `app.ticker.started === false`. WHEN `paused → playing`, THEN `app.ticker.started === true`.

- **AC-27** (Save System 분리, **H-4 검증**): GIVEN GSM 인스턴스 + Save System 등록 안 함, WHEN `playing → dead` 전이, THEN GSM은 정상 동작 (Save 호출 시도 없음). Save System은 별도로 `score:finalized` 이벤트만 listen.

### Smoke Test Subset (qa-lead 권고)

다음 5 AC는 매 push마다 < 500ms 안에 실행. 실패 시 fail-fast로 full suite skip:

- AC-01 (initial state) — 모든 다른 AC의 precondition
- AC-02 (silent reject) — transition model 기초
- AC-03 (sync contract) — P4 architectural 약속
- AC-14 / AC-19 Layer A (P4 latency) — 핵심 pillar
- AC-23 (exception isolation) — silent corruption 방지

File: `tests/unit/game-state-manager/smoke.test.ts` 또는 CI workflow 태그.

### CI Pipeline (qa-lead)

- **Every push (smoke only)**: 위 5 AC, < 500ms, fail-fast
- **PR to main (blocking)**: 전 unit + cross-system integration (AC-19 Layer A 포함, Layer B 제외), Vite production build 성공, console.warn grep
- **Nightly (non-blocking, paged on failure)**: AC-19 Layer B p95, AC-22 (e) heap delta with `--expose-gc`
- **Release gate (manual)**: AC-19 Layer C real-device + iOS Safari pagehide/pageshow + Android visibilityDebounceMs 튜닝

> **Review note**: systems-designer + qa-lead 비평 모두 반영 완료. lean mode에서 두 specialist 모두 상담된 상태. AC 27 + 4 lifecycle edge cases = **31 ACs**.

## Open Questions

각 질문은 owner와 target resolution timing 명시.

- **OQ.1 — 메뉴 데코 풍선 정책 (M-3): ✅ RESOLVED 2026-05-30 per art-bible §6 S1**: 메뉴는 풍선 1-2개 부유 (10s 주기). Balloon Physics가 게임플레이 풀 + 데코 풀 분리 관리. `enterState('menu')`는 게임플레이 풀만 reset. 세부 분리 정책은 Balloon Physics GDD (#5)에서 락인.

- **OQ.2 — Save System 이벤트 소스 (H-4 follow-up)**: Save System이 베스트 스코어 write를 트리거하기 위해 (a) `score:finalized` 이벤트를 listen하는가, (b) `gameStateManager.stateChanged({to: 'dead'})` 이벤트를 listen하는가? 둘 다 정상 동작 — 어느 쪽이 더 깔끔한지는 Score & Combo + Save System GDD 작성 시 결정.
  - **Owner**: lead-programmer + systems-designer
  - **Target**: Score & Combo (#8) 또는 Save System (#13) GDD 작성 시
  - **현재 권장**: (a) `score:finalized` — Save가 Score를 query하기보다 Score가 push하는 게 더 명확

- **OQ.3 — Seed/RNG 시드 정책: ✅ RESOLVED 2026-05-30 per seed-rng-system.md**: **매 런 새 시드** 채택. RETRY 시에도 새 시드 (Date.now() 기반). `from=paused`만 시드 보존. 데일리 시드는 Post-MVP (리더보드 도입 시). Mulberry32 알고리즘 + 3 domain-specific 인스턴스(spawn/critical/powerup) + XOR magic constant 시드 파생.

- **OQ.4 — Asset Loader: ✅ RESOLVED 2026-05-30 per engine-programmer**: **Pixi v8 `Assets` API 직접 사용**. 10-20줄의 thin EventEmitter wrapper로 `assetsLoaded` / `assetsLoadFailed` 발화. Pixi `Assets`는 progress callback, bundle priority, cache 자동 — 충분. 한 가지 gap: 빌트인 retry 없음 → 30s `BOOT_INIT_TIMEOUT_GUARD_MS` 도달 시 `boot_error`로 fail-fast 허용 (MVP). Wrapping 클래스(`AssetLoader`)는 over-engineering — 직접 사용 권장. (Pixi v8 docs: https://pixijs.download/release/docs/assets.html)

- **OQ.5 — hook 예외 정책: ✅ RESOLVED 2026-05-30 per qa-lead**: **continue-with-isolation** 채택. 이유: abort policy는 hook 등록 순서에 따라 시스템이 silent하게 건너뛰어짐 → unobservable corruption. continue-with-isolation은 각 시스템이 명시적으로 초기화 or 명시적으로 error. AC-23 갱신됨. 변경 시 ADR 필수.

- **OQ.6 — `visibilityDebounceMs` 디바이스별 튜닝**: 100ms 기본이 Android 저가형 (Galaxy A-series)에서 충분한지 베타 데이터로 검증. 부족하면 150–200ms.
  - **Owner**: qa-lead + performance-analyst
  - **Target**: MVP 베타테스트

- **OQ.7 — paused overlay tap-to-resume: ✅ RESOLVED 2026-05-30 per art-bible §6 S7**: MVP에서 explicit tap (art-bible 정합). auto-resume only 가설 폐기. UI System (#14) GDD에서 "TAP TO RESUME" 패널 명세 owns.

- **OQ.8 — Score Screen countup 애니메이션 채널 (engine-programmer)**: 점수 카운트업 (예: 0 → 850 over 1s)을 Pixi ticker callback으로 구현 vs CSS `@keyframes` / `requestAnimationFrame`으로 구현. MVP commitment "paused 중 UI는 CSS-only"가 깨지지 않으려면 score countup도 CSS 권장 (Pixi ticker가 paused 중 stop이지만 dead 중에는 run이므로 ticker 사용도 무방 — 그러나 일관성 위해).
  - **Owner**: ui-programmer + ux-designer
  - **Target**: UI System (#14) GDD 작성 시점
  - **권장**: CSS `@keyframes` 또는 JS rAF counter — Pixi ticker 의존 없음. art-bible §7 typography numerals 사양과 함께 작업

## Implementation Checklist

Approved 조건: 아래 전 항목 체크 완료 + QA Lead 서명 + Lead Programmer ADR 서명.

### 진입점

GSM은 어디서 호출되는가:

- `src/main.ts` (또는 `main.js`) — 앱 부트스트랩 코드:
  ```typescript
  import { Application, Assets } from 'pixi.js';
  import { GameStateManager } from './core/game-state-manager';

  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,  // Retina 대응 (engine-programmer §1)
    autoDensity: true,                          // CSS pixel ↔ canvas pixel 자동
    antialias: true,
    powerPreference: 'high-performance',        // 모바일 GPU 우선
  });
  document.body.appendChild(app.canvas);

  // Pixi Assets API 직접 사용 (OQ.4 resolved). 10-20줄 thin wrapper로 emit
  // assetsLoaded / assetsLoadFailed 이벤트만 발화 — full AssetLoader 클래스 불필요.

  const gsm = new GameStateManager({ app, /* knobs from §G */ });

  // 의존 시스템 등록 (gsm.start() 전)
  gsm.on('stateChanged', (e) => inputSystem.handleStateChange(e));
  gsm.on('stateChanged', (e) => balloonPhysics.handleStateChange(e));
  // ... 기타 시스템

  gsm.start(); // ← onEnter('boot') 발화, 외부 리스너 등록
  ```

### Public API 표면

| Method / Property | Signature | 책임 |
|-------------------|-----------|------|
| `constructor(opts: GSMOptions)` | `new GameStateManager({ app: Application, loader: AssetLoader, ...knobs })` | 인스턴스 생성. 초기 상태 = 'boot'. listener 등록 안 함 (start까지 지연) |
| `start(): void` | — | `onEnter('boot')` 발화. visibilitychange/pagehide/pageshow listener 등록. boot timeout 타이머 시작 |
| `destroy(): void` | — | 모든 DOM listener 해제 (visibilitychange, pagehide, pageshow). **EventEmitter `this.removeAllListeners()` 호출** — stateChanged 핸들러 closure leak 방지 (engine-programmer §7). 큐 클리어 (pending transition 실행 안 함, AC-23b). 단위 테스트 cleanup 및 페이지 이동 hook. 호출 후 인스턴스 재사용 금지 |
| `requestTransition(to: GameState): void` | — | 메인 transition 트리거. `void` 반환 강제 (Core Rule #3, AC-03) |
| `currentState: GameState` (getter) | read-only | 외부 query용. setter 없음 (Core Rule #1, AC-01) |
| `on(event, handler): void` / `off(event, handler): void` | event emitter | 현재 이벤트: `'stateChanged'` (payload: `{from, to}`) 만 발화 |

### 호출 경로 체크리스트

- [ ] `src/main.ts`에서 GSM 인스턴스 1개만 생성, 다른 곳 인스턴스 생성 없음 (grep 검증)
- [ ] 모든 의존 시스템이 GSM 인스턴스를 생성자 주입 또는 service locator로 받음 (전역 `window.*` 금지)
- [ ] UI 버튼 (START / RETRY / Menu)이 `gsm.requestTransition(...)` 호출 (직접 상태 변경 금지)
- [ ] Balloon Physics가 풍선-캐릭터 충돌 감지 시 `gsm.requestTransition('dead')` 호출
- [ ] Asset Loader가 성공 시 `gsm.requestTransition('menu')`, 실패/타임아웃 시 `gsm.requestTransition('boot_error')` 호출
- [ ] 의존 외부 메서드 존재 확인:
  - [ ] `Application.ticker.start()` / `.stop()` (Pixi v8 — `pixi.js` import)
  - [ ] `document.addEventListener('visibilitychange', ...)` (DOM)
  - [ ] `window.addEventListener('pagehide'/'pageshow', ...)` (DOM, iOS Safari 호환)
  - [ ] `inputSystem.attach()` / `.detach()` (input-system.md §F)

### AC → 테스트 매핑

| AC 범위 | 테스트 파일 | 주요 테스트 함수 |
|--------|------------|----------------|
| AC-01 ~ AC-08 (State Machine Correctness) | `tests/unit/game-state-manager/core-rules.test.ts` | `test_initial_state_is_boot`, `test_invalid_transition_rejects_silently`, `test_request_transition_is_synchronous`, `test_lifecycle_hook_order`, `test_from_to_payload`, `test_transition_queue_processes_one`, `test_queue_overflow_rejects`, `test_boot_state_before_start` |
| AC-09 ~ AC-11 (Visibility / iOS Safari) | `tests/unit/game-state-manager/visibility.test.ts` | `test_visibilitychange_to_paused`, `test_pagehide_ios_safari_compat`, `test_resume_order_ticker_before_input` |
| AC-12 ~ AC-17 (State-Specific Behaviors) | `tests/unit/game-state-manager/state-behaviors.test.ts` | `test_paused_resume_preserves_session`, `test_retry_resets_state`, `test_retry_latency_under_33ms`, `test_boot_error_terminal`, `test_boot_timeout_to_error`, `test_visibility_during_dying_no_resume` |
| AC-18 ~ AC-20 (Timing Contracts) | `tests/unit/game-state-manager/timing.test.ts` | `test_hook_time_budget_warning`, `test_transition_total_time_under_33ms`, `test_visibility_debounce` |
| AC-21 ~ AC-22 (Performance) | `tests/integration/game-state-manager/performance.test.ts` | `test_frame_time_contribution_under_0_5ms`, `test_no_memory_leak_after_100_cycles` |
| AC-23 ~ AC-24 (Failure Modes) | `tests/unit/game-state-manager/failure-modes.test.ts` | `test_hook_exception_isolation`, `test_debug_flag_controls_warnings` |
| AC-25 ~ AC-27 (Cross-System Integration) | `tests/integration/game-state-manager/cross-system.test.ts` | `test_input_attach_detach_lifecycle`, `test_pixi_ticker_control`, `test_save_system_decoupled` |

### 빌드 검증

- [ ] `npm run build` (Vite production build) 성공 (ERROR 0)
- [ ] Bundle에 GSM 코드 포함 확인 (`dist/assets/main-*.js`에 `GameStateManager` 클래스 존재)
- [ ] `npm run preview` 실행 후 모바일 Chrome/Safari에서 첫 인터랙티브 < 2s (LTE 환경)
- [ ] iPhone 11 + Galaxy A52 실기에서 menu → playing → dead → playing(RETRY) 1 사이클 P4 latency 측정 < 33ms (Chrome DevTools Performance 또는 자체 측정 hook)
- [ ] iOS Safari 15+에서 백그라운드 → 포그라운드 시 세션 보존 확인 (Score 유지)
- [ ] **QA Lead 서명** _______

### 코드 리뷰 동기화

- [ ] ADR 작성: GSM 인스턴스 소유권 (singleton vs DI container vs service locator), Asset Loader 패턴 선택 (Pixi Assets 직접 vs wrapper)
- [ ] `.claude/docs/technical-preferences.md` Architecture Decisions Log에 새 ADR 등록
- [ ] `design/gdd/systems-index.md` Status: Not Started → Designed
- [ ] `design/registry/entities.yaml` constants 섹션에 cross-system 참조 가능한 상수 추가 검토:
  - `MAX_QUEUED_TRANSITIONS`
  - `RETRY_DEAD_STATE_MINIMUM_MS`
  - `BOOT_INIT_TIMEOUT_GUARD_MS`
- [ ] `tests/unit/test_api_contracts.ts` (또는 동등 파일)에 GSM Public API 표면 등록 (API contracts 즉시 등록 원칙)
- [ ] input-system.md §F 양방향 검증 완료 — resume order 보완 권장 (input GDD 다음 revision)
- [ ] **Lead Programmer 서명** _______ + **Technical Director ADR 서명** _______
