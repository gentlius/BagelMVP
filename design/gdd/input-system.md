# Input System

> **Status**: Designed (pending /design-review)
> **Author**: gentlius + Claude (game-designer, ux-designer assist)
> **Last Updated**: 2026-05-30
> **Implements Pillar**: P1 — 한 손가락, 한 번에 한 결정
> **Handoff target**: Other AI agent (spec-heavy, prose-minimal style)
> **Engine target**: Pixi.js v8 (Federated Events API for pointer handling)

---

## Overview

Input System은 POP!에서 플레이어 의도의 단일 소스다. 브라우저 pointer 이벤트(모바일 터치, 데스크탑 마우스)를 수신하여 상태머신으로 해석하고, 두 가지 high-level 플레이어 액션 — **drag-to-move**와 **fire** — 을 타입 있는 이벤트로 다운스트림 시스템에 발행한다. Pixi.js v8 Federated Events(`eventMode: 'static'`, `pointerdown`/`pointermove`/`pointerup`) 위에 구축되며, P1 필러(한 손가락, 한 번에 한 결정)를 만족시키는 player→game 계약을 소유한다: 모든 입력은 정확히 한 시점에 한 가지 결정으로 매핑되고, drag(이동)와 fire(액션)는 별개의 시간 슬롯에 존재한다. R1(더블탭 입력감 불확실성)은 이 시스템 안에서 동일한 다운스트림 이벤트 계약을 공유하는 두 입력 변형 — **single-tap-fire(V1)** 과 **double-tap-fire(V2)** — 를 명세함으로써 완화되며, 어떤 소비 시스템도 변경 없이 A/B 비교가 가능하다.

## Player Fantasy

**감정 목표**: "내 손가락 하나로 모든 게 통제된다" — 단순함이 권능감이 되는 순간.

플레이어가 카오스 한복판에서 풍선 사이로 빠르게 캐릭터를 끌고 다니다가 정확한 순간에 탭하여 작살을 쏜다. 손가락 하나의 두 액션(드래그→탭)은 매끄럽게 분리되어 입력 충돌이 없고, 매 입력의 결과가 즉시 시각·촉각으로 응답한다. 마치 잘 만든 게이밍 마우스의 클릭처럼, **입력 자체에서 만족이 발생**한다 — Balloon이 터지기 *전에* 손가락이 이미 옳다는 것을 안다.

**Reference & 어떻게 이 감각을 만드는가**:

- **Vampire Survivors** — 모든 공격이 자동, 플레이어 입력은 **이동(드래그/조이스틱)뿐**. "화면은 발사체·폭발·적·플래시·데미지 숫자로 가득 찬 카오스"가 되지만 입력은 한 가지로 제한 → **입력 단순성이 mass appeal의 핵심**. 출처: [Vampire Survivors — Controls Explained (gamepressure.com)](https://www.gamepressure.com/newsroom/vampire-survivors-controls-explained/z14ebf)

- **Geometry Dash** — 한 가지 입력(탭 = 점프/비행), 음악 리듬에 동기된 타이밍이 모든 깊이. "한 번의 실수 = 즉시 재시작" 루프가 "타이밍 학습 → 일관성"을 강제 → **단순 입력의 실력 천장이 음악과 결합해 무한**. 출처: [Geometry Dash 공식 사이트 (RobTop Games)](https://geometry-dash.us/)

- **Suika Game** — 컨테이너 위 탭해서 과일 드롭. "Tetris와 달리 과일은 물리 영향을 받아 서로 튕기고 굴러간다" → **한 탭의 의도는 명확하지만 결과는 카오스**. 입력 단순성과 결과 카오스의 분리가 통제감(의도감)을 보존. 출처: [Suika Game — Wikipedia](https://en.wikipedia.org/wiki/Suika_Game)

POP!이 의도적으로 *안 하는* 것: 복잡한 콤보, 제스처 인식, 동시 두 손가락, 화면 가장자리 의존 제스처. 모든 깊이는 **타이밍과 위치**에서만 나온다. 이게 P1 필러의 본질이며, Input System은 이 약속의 첫 번째 집행자다.

## Detailed Rules

### State Machine

> **Note**: 모든 상태 전이는 단일 상태 기계 인스턴스 내에서 관리되며, Side Effects는 명시된 순서대로 **synchronous** 실행. V2 모드의 더블탭 보호는 `lastTapTime` reset 로직 하나로 처리 (별도 transition 억제 없음 — KISS).

| 현재 상태 | 트리거 이벤트 | 조건 | 다음 상태 | Side Effects (순서대로) |
|----------|------------|------|----------|----------------------|
| `IDLE` | `pointerdown` | — | `POINTER_DOWN` | `startPos = currentPos`; `startTime = now` |
| `POINTER_DOWN` | `pointermove` | `delta > DRAG_THRESHOLD` | `DRAGGING` | `lastTapTime = 0` (V2 더블탭 무효화); emit `input:dragStart({x, y})` |
| `POINTER_DOWN` | `pointermove` | `delta ≤ DRAG_THRESHOLD` | `POINTER_DOWN` | (전이 없음) |
| `POINTER_DOWN` | `pointerup` | V1: `duration ≤ TAP_MAX_DURATION` AND `(now - lastDragEndTime) ≥ V1_GUARD_MS` | `IDLE` | emit `input:fire({})` |
| `POINTER_DOWN` | `pointerup` | V1: `duration ≤ TAP_MAX_DURATION` AND `(now - lastDragEndTime) < V1_GUARD_MS` | `IDLE` | (no fire — 가드 타임 내, 드래그 종료 직후 미세 탭 오발 방지) |
| `POINTER_DOWN` | `pointerup` | V2: `duration ≤ TAP_MAX_DURATION` AND `(now - lastTapTime) ≤ DOUBLE_TAP_WINDOW` AND `dist(startPos, lastTapPos) ≤ DOUBLE_TAP_MAX_DISTANCE` | `IDLE` | emit `input:fire({})`; `lastTapTime = 0` |
| `POINTER_DOWN` | `pointerup` | V2: `duration ≤ TAP_MAX_DURATION` (첫 탭 성공 조건) | `IDLE` | `lastTapTime = now`; `lastTapPos = startPos` |
| `POINTER_DOWN` | `pointerup` | `duration > TAP_MAX_DURATION` (롱프레스) | `IDLE` | `lastTapTime = 0` (무효화) |
| `DRAGGING` | `pointermove` | — | `DRAGGING` | emit `input:dragMove({x, y})` |
| `DRAGGING` | `pointerup` | — | `IDLE` | `lastDragEndTime = now`; emit `input:dragEnd({x, y})` |
| ANY | `pointercancel` | — | `IDLE` | If was `DRAGGING`: `lastDragEndTime = now`; emit `input:dragCancel({})` |

### Events Emitted

**좌표계**: 모든 payload의 `x`/`y`는 **게임 World 좌표**. Input System은 Pixi Federated Event의 `event.global` (CSS pixel) → 게임 좌표 변환을 책임진다 (DPR 및 stage scale 반영).

| Event | Payload | Trigger Timing | 1차 Consumer |
|-------|---------|----------------|------------|
| `input:fire` | `{}` | V1: 단일 탭 release 성공 / V2: 유효 시간 내 연속 2회 탭 성공 | **Character & Harpoon System** (작살 스폰 트리거) |
| `input:dragStart` | `{ x: number, y: number }` | `POINTER_DOWN` → `DRAGGING` 최초 전이 시점 | **Character & Harpoon System** (드래그 시작점 기록) |
| `input:dragMove` | `{ x: number, y: number }` | `DRAGGING` 중 매 `pointermove` 발생 | **Character & Harpoon System** (캐릭터 목적지 좌표 실시간 갱신) |
| `input:dragEnd` | `{ x: number, y: number }` | `DRAGGING` → `IDLE` (정상 release) | **Character & Harpoon System** (드래그 관성·감속 제어) |
| `input:dragCancel` | `{}` | `DRAGGING` 중 `pointercancel` (OS 알림, 화면 이탈 등) | **Character & Harpoon System** (캐릭터 이동 강제 중지) |

> **Prototype scope (decisions §2.2)**: "Character & Harpoon System"은 **Balloon Physics & Split System**으로 흡수됨 (1차 Consumer 표 갱신은 M1 retrofit — Bidirectional lock).

> **2차 Consumer — Visual Juice (AudioContext unlock, 브라우저 autoplay 정책)**: `input:fire`와 `input:dragStart`에 `.once()` 등록하여 첫 사용자 제스처 발생 시 `audioManager.unlock()` (`ctx.resume()`) 호출. 그 전까지 모든 audio call은 silent fallback (visual-juice §3.7 + §Audio Note + AC.20 참조). 구현 시 1차 Consumer 외에 이 hook 연결 누락 금지.

### Public Interface (Pixi v8 idiom)

```typescript
import { Application, EventEmitter } from 'pixi.js';

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputSystemOptions {
  variant: 'V1_SINGLE_TAP' | 'V2_DOUBLE_TAP';
  dragThreshold: number;           // 게임 좌표 기준 드래그 판정 px (default: 10)
  tapMaxDuration: number;          // 탭으로 인정되는 최대 누름 시간 ms (default: 250)
  doubleTapWindow: number;         // 더블탭 최대 시간 간격 ms (V2 only, default: 300)
  doubleTapMaxDistance: number;    // 더블탭 최대 거리 px (V2 only, default: 30)
  v1GuardMs: number;               // 드래그 종료 후 V1 탭 인식 유예 ms (V1 only, default: 50)
}

// Pixi v8 generic 타입 — 컴파일 시점 페이로드 검증
export class InputSystem extends EventEmitter<{
  'input:fire': [];
  'input:dragStart': [Vec2];
  'input:dragMove': [Vec2];
  'input:dragEnd': [Vec2];
  'input:dragCancel': [];
}> {
  private app: Application;
  private options: InputSystemOptions;
  private state: 'IDLE' | 'POINTER_DOWN' | 'DRAGGING' = 'IDLE';

  // 내부 상태
  private startPos: Vec2 = { x: 0, y: 0 };
  private startTime: number = 0;
  private lastTapPos: Vec2 = { x: 0, y: 0 };
  private lastTapTime: number = 0;
  private lastDragEndTime: number = 0;

  constructor(app: Application, options: Partial<InputSystemOptions> = {}) {
    super();
    this.app = app;
    this.options = {
      variant: 'V1_SINGLE_TAP',
      dragThreshold: 10,
      tapMaxDuration: 250,
      doubleTapWindow: 300,
      doubleTapMaxDistance: 30,
      v1GuardMs: 50,
      ...options,
    };
  }

  /** Pixi v8 Stage에 Federated Event 리스너 등록 */
  public attach(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;  // 화면 전체에서 입력 수신
    stage.on('pointerdown', this.handlePointerDown, this);
    stage.on('pointermove', this.handlePointerMove, this);
    stage.on('pointerup', this.handlePointerUp, this);
    stage.on('pointerupoutside', this.handlePointerUp, this);
    stage.on('pointercancel', this.handlePointerCancel, this);
  }

  /** 리스너 해제 + cleanup */
  public detach(): void {
    const stage = this.app.stage;
    stage.off('pointerdown', this.handlePointerDown, this);
    stage.off('pointermove', this.handlePointerMove, this);
    stage.off('pointerup', this.handlePointerUp, this);
    stage.off('pointerupoutside', this.handlePointerUp, this);
    stage.off('pointercancel', this.handlePointerCancel, this);
    this.resetInternalState();
  }

  public getState(): 'IDLE' | 'POINTER_DOWN' | 'DRAGGING' {
    return this.state;
  }

  public setVariant(variant: 'V1_SINGLE_TAP' | 'V2_DOUBLE_TAP'): void {
    this.options.variant = variant;
    this.resetInternalState();
  }

  private resetInternalState(): void {
    this.state = 'IDLE';
    this.lastTapTime = 0;
    this.lastDragEndTime = 0;
  }

  // 내부 핸들러 (handlePointerDown/Move/Up/Cancel)는 위 State Machine 표대로 구현
}
```

### Two Input Variants (R1 mitigation)

**V1 — Single-Tap Fire**
- 짧은 탭(`duration ≤ TAP_MAX_DURATION`, `delta ≤ DRAG_THRESHOLD`) release → 즉시 `input:fire`
- **장점**: 입력 마찰 최저, 즉시 응답 (latency 최소)
- **단점**: 드래그 끝점 손가락 떼기 순간이 탭으로 인식될 위험
- **헤징**: `lastDragEndTime`을 추적하여 드래그 종료 후 `V1_GUARD_MS` (default: 50ms) 내 탭은 fire 발행 안 함

**V2 — Double-Tap Fire**
- 두 번의 짧은 탭이 `DOUBLE_TAP_WINDOW` ms 이내 + `DOUBLE_TAP_MAX_DISTANCE` px 이내 → `input:fire`
- **장점**: 의도 명확, 드래그 종료와 충돌 없음
- **단점**: 입력 마찰·latency 증가
- **헤징**: 첫 탭 후 두 번째 입력이 드래그로 전이되면 `lastTapTime` 즉시 reset (State Machine `POINTER_DOWN → DRAGGING` Side Effect로 보장). Consumer는 V1/V2 분기 몰라도 정상 작동.

**A/B Test Plan**:
1. `setVariant()` 한 줄로 변형 교체 (동일 Public Interface 공유)
2. **URL 런타임 주입**: `main.ts` 진입점에서 `?variant=v1` / `?variant=v2` 파싱 후 `setVariant()` 호출 — 빌드 재컴파일 불필요
   ```typescript
   const variant = new URLSearchParams(location.search).get('variant');
   if (variant === 'v2') inputSystem.setVariant('V2_DOUBLE_TAP');
   ```
3. 5명 베타테스터 각각 두 변형 시연
4. **정량 지표 logging** (localStorage):
   - 세션별 배열 `pop_ab_log = [{ variant, score, durationMs, firePerSecond, runCount }, ...]`
   - 게임 오버 화면에서 dev 콘솔 `console.table(JSON.parse(localStorage.pop_ab_log))`로 즉시 시각화
5. **정성 지표**: 시연 후 1문장 "어느 쪽이 자연스럽나" + 자유 코멘트
6. **결정 기준**:
   - 5명 중 4명 이상 같은 변형 선호 → 그 변형 채택
   - 정성·정량 동률 시 → V1 채택 (입력 마찰 최저, P4 필러 정신)

## Formulas

### F1: Pointer Distance (입력 거리 판정 수식)

두 입력 좌표 간의 유클리드 거리를 측정한다.

$$distance(p_1, p_2) = \sqrt{(p_1.x - p_2.x)^2 + (p_1.y - p_2.y)^2}$$

**성능 가이드 (구현자 지시)**: `pointermove` 핫패스에서 제곱근 연산 낭비를 방지하기 위해, 조건 검사 시 제곱 비교($distance^2 \le threshold^2$) 패턴 작성을 **허용/권장**한다. sqrt는 시각화·로깅 등 한 번만 표시하는 곳에서만.

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| $p_1, p_2$ | Vec2 (게임 월드 좌표, px) | 각 성분 $0 \sim$ 화면 대각선 길이 | 입력 장치의 시점·종점 좌표 |
| 출력값 | float (px) | $0 \sim$ 화면 대각선 길이 | 두 지점 간 직선 거리 |

**Example**: `startPos = (200, 400)`, `currentPos = (215, 405)` 일 때
$distance = \sqrt{15^2 + 5^2} = \sqrt{225 + 25} = \sqrt{250} \approx 15.8\text{ px}$
결과가 `DRAG_THRESHOLD (10 px)` 를 초과 → 상태 머신 DRAGGING 전이.

---

### F2: World Coordinate Transformation (좌표계 변환)

Pixi v8 Federated Event가 제공하는 `event.global` (브라우저 viewport / CSS pixel) 좌표를 장치 독립적인 게임 월드 좌표계로 변환한다.

**네이티브 API 적용 (우선순위 1)**:
```typescript
// InputSystem 내부 구현 시 반드시 이 메서드를 거쳐 변환된 좌표를 사용
const worldPos: Vec2 = app.stage.toLocal(event.global);
```

**수동 연산 Fallback (우선순위 2 — 스테이지가 단순 Scale/Translate 변환만 가질 때)**:

$$worldPos.x = \frac{event.global.x - stage.x}{stage.scale.x}$$

$$worldPos.y = \frac{event.global.y - stage.y}{stage.scale.y}$$

**좌표계 단일화 목적**: 게임 로직 시스템(Character & Harpoon, Balloon Physics 등)은 디바이스 해상도·DPR(Device Pixel Ratio)·뷰포트 스케일링에 종속되지 않는 일관된 좌표계만 바라봐야 함. Input System이 이 변환 책임을 단일 소유 → 하위 시스템 결합도 감소.

---

### F3: Threshold Default Values (입력 판정 임계 수치 매니페스트)

| 상수명 | Default | Tunable Range | 설계 근거 (Rationale) |
|--------|---------|---------------|----------------------|
| `DRAG_THRESHOLD` | 10 px | 5 – 20 px | Hammer.js (Tap `posThreshold = 10`) 표준 터치 휴리스틱. • 5 미만: 손가락 미세 떨림 오작동 • 20 초과: 정밀하고 작은 드래그 누락 |
| `TAP_MAX_DURATION` | 250 ms | 150 – 400 ms | Hammer.js (Tap `time = 250`) 표준. • 400 초과: 롱프레스 영역으로 진입 • 150 미만: 가벼운 탭 상당수 인식 실패 |
| `DOUBLE_TAP_WINDOW` | 300 ms | 200 – 500 ms | Hammer.js (Doubletap `interval = 300`) 웹 더블탭 표준. • 500 초과: 별개 두 탭이 더블탭 오발 위험 • 200 미만: 인간 연타 속도 한계로 성공률 급감 |
| `DOUBLE_TAP_MAX_DISTANCE` | 30 px | 15 – 50 px | Material Design Touch Target (48dp $\approx$ 30px CSS) 부합. 두 번째 탭이 첫 번째 탭의 유효 반경 내에 있어야 함 |
| `V1_GUARD_MS` | 50 ms | 30 – 100 ms | 드래그 종료(`pointerup`) 시 손가락 마찰 떨림 유예. 인간 프레임 인지 한계(~100ms) 이하로 조작감 답답함 제거 |

**출처 고지 (정직)**:
본 수치는 [Hammer.js (JS Touch Gestures Library)](https://hammerjs.github.io/), [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/), [Material Design Touch Targets](https://m2.material.io/develop/web/supporting/touch-target)의 검증된 휴리스틱을 default로 채택. **Apple HIG·Android Native의 정확한 ms/px 수치는 공개되지 않은 내부 구현 영역**이므로, 본 명세는 **HTML5/모바일 웹 컨텍스트**에서 최적 경험을 보장하는 수치임을 명시. 5인 베타테스트 후 Tuning Knobs 섹션을 통해 커스텀 오버라이드 가능.

---

### F4: Boolean Predicates (상태 머신 조건 평가식)

상태 머신(C.1)의 전이를 결정하는 논리 조건식. 모든 조건은 $O(1)$ 복잡도.

| Predicate 함수명 | 논리 조건 수식 | 적용 전이 위치 |
|------------------|---------------|----------------|
| `is_drag_intent()` | $distance(currentPos, startPos) > \text{DRAG\_THRESHOLD}$ | POINTER_DOWN → DRAGGING |
| `is_valid_tap_duration()` | $(now - startTime) \le \text{TAP\_MAX\_DURATION}$ | POINTER_DOWN → IDLE (발사 분기) |
| `is_v1_guard_clear()` | $(now - lastDragEndTime) \ge \text{V1\_GUARD\_MS}$ | V1 모드 발사 허용 여부 |
| `is_double_tap_time_valid()` | $(now - lastTapTime) \le \text{DOUBLE\_TAP\_WINDOW}$ | V2 모드 더블탭 시간 만족 |
| `is_double_tap_dist_valid()` | $distance(startPos, lastTapPos) \le \text{DOUBLE\_TAP\_MAX\_DISTANCE}$ | V2 모드 더블탭 거리 만족 |

총 state transition 비용: **< 0.01 ms / event** on iPhone 11 baseline (단순 산술·비교만 사용).

## Edge Cases

### E.1 입력 핸들링 (Input Handling)

- **If multi-touch (2개 이상 동시 터치 발생 시)**: 최초로 `pointerdown`을 발생시킨 첫 번째 활성 pointerId만 추적함. 후속 터치로 인한 `pointerdown` 및 관련 이벤트는 첫 번째 pointerId가 화면에서 해제(`pointerup` 또는 `pointercancel`)될 때까지 철저히 무시함. *근거: MVP는 단일 손가락 조작을 전제로 함 (P1 필러).*

- **If pointer가 DRAGGING 중 화면 밖으로 이동 후 해제 시**: Pixi v8 stage의 `pointerupoutside` 리스너가 이를 캡처하여 즉시 `emit input:dragEnd({x, y})`를 호출하고 IDLE 상태로 강제 전이함. 이때 페이로드 `{x, y}`는 화면을 이탈하기 전 마지막으로 기록된 유효한 게임 월드 좌표를 유지하여 송출함.

- **If 브라우저 탭이 DRAGGING 중 비활성화(`visibilitychange`) 시**: InputSystem 내부에서 즉시 강제 `pointercancel` 시뮬레이션을 가동하여 `emit input:dragCancel({})`을 호출하고 IDLE 상태로 전이함. *사용자가 게임 탭으로 복귀했을 때 캐릭터가 계속 이동하는 stuck 현상 방지.* `document.addEventListener('visibilitychange')`를 통해 시스템이 자체 소유 및 처리.

- **If 인터랙션 중 윈도우 resize가 발생 시**: 진행 중인 입력을 중단하지 않고 계속 유지함. Pixi v8 내부의 `app.stage.toLocal()` 변환 함수가 실시간으로 변경된 뷰포트 매트릭스를 반영하므로, 다음 `pointermove` 발생 시 자동으로 보정된 새 좌표를 출력함. 단, **상위 Consumer는 stale된 이전 좌표를 버리고 항상 가장 최근에 수신된 `dragMove` 페이로드만 참조해야 함**.

### E.2 임계 경계 판정 (Threshold Boundaries)

- **If `distance === DRAG_THRESHOLD` (정확히 동일)**: 드래그 의도가 아닌 것으로 판정함 (Strict `>` 비교 사용). POINTER_DOWN 상태를 유지하며, 플레이어가 최소 1px 이상 더 움직여 임계값을 초과하는 순간 DRAGGING으로 전이함.

- **If `duration === TAP_MAX_DURATION` (정확히 동일)**: 유효한 탭 조작으로 인정함 (Inclusion `≤` 비교 사용). 타 조건(거리 등) 충족 시 정상적으로 fire 분기를 실행함.

- **If V2 더블탭 조건이 단 1ms 또는 1px 차이로 실패 시**: 발사(fire)를 처리하지 않음 (NOT fire). 단, 현재의 터치 실패 시점의 좌표와 시간이 새롭게 `lastTapTime` 및 `lastTapPos`로 업데이트되어, 다음 터치를 위한 '새로운 첫 번째 탭'의 기준으로 대기함.

### E.3 변형(Variant)별 예외 조건

- **If V1 모드 가동 중 드래그 종료 직후 `V1_GUARD_MS` (50ms) 이내에 탭 발생 시**: 발사(fire)를 유효화하지 않음. 플레이어는 조작 미스로 인한 오발을 방지하기 위해 드래그 종료 후 최소 50ms가 지난 시점부터 정상적인 단일 탭 발사가 가능함.

- **If V2 모드 가동 중 두 번째 `pointerdown` 도중 `DRAG_THRESHOLD`를 초과하는 이동 발생 시**: 진행 중이던 더블탭 판정을 즉시 취소하고 (`lastTapTime = 0`), 상태 머신을 DRAGGING 상태로 전이함. 시스템은 이를 연속 연타가 아닌 '새로운 드래그 조작 의도'로 해석함.

- **If V2 모드 가동 중 `DOUBLE_TAP_WINDOW` (300ms) 만료될 때까지 두 번째 탭이 없을 시**: 별도의 무효화 이벤트를 발행하지 않고 침묵함. 다음 `pointerdown`이 들어오는 시점에 기존 타이머 정보는 자동으로 오버라이트되며, **V2 모드에서 단일 탭만으로는 절대로 발사 시스템이 트리거되지 않음** (의도된 사양).

### E.4 시스템 및 플랫폼 이벤트 (System Events)

- **If iOS Edge Swipe (화면 가장자리 제어 제스처) 충돌 시**: iOS 런타임이 이벤트를 선점하므로 Pixi v8 계층까지 pointer 이벤트가 도달하지 않을 수 있음. **InputSystem 단에서는 이를 복구하려 하지 않음**. 대신 UI/UX 기획 가이드라인에 따라 화면 최외각 20px 영역 이내에는 터치 가능한 핵심 오브젝트나 조작 영역을 배치하지 않는 방식으로 상위 계층에서 리스크를 헤징함 (UI System GDD enforce).

- **If `localStorage` 쓰기 실패 시 (Private Browsing 모드, 용량 초과 등)**: A/B 테스트 로깅 시스템은 에러를 `try/catch`로 래핑하여 완전히 묵인 (silently fail), 콘솔에 단 1회 경고(Warning)만 출력함. **본 에러가 게임 코어 루프나 플레이 진행을 절대 방해해서는 안 됨**.

- **If `performance.now()` 하드웨어 클럭 왜곡으로 시간 역행 발생 시**: 시간 연산식 직전에 `(now - startTime) >= 0` 검증식을 배치함. 만약 비정상적인 음수 값이 산출될 경우 해당 이벤트를 즉시 무효화하고 `startTime`을 현재의 `now` 값으로 강제 동기화함.

### E.5 성능 최적화 계층 (Performance Boundary)

- **If 고주사율 디바이스 (iPad Pro 120Hz, 게이밍 폰 144Hz 등)에서 입력 폭주 시**: InputSystem 계층 내부에서 **어떠한 디바운스(Debounce)나 스로틀링(Throttling)도 적용하지 않고** 브라우저가 발생하는 모든 raw `dragMove` 스트림을 그대로 송출함 *(스로틀링 적용 시 반응 속도 저하 유발)*. 상위 Consumer 시스템이 Pixi 내부 Ticker 프레임 단위에 맞춰 동기화 주기를 제어함.

- **If 초당 100회 이상의 극심한 입력 연타 발생 시**: 상태 머신의 모든 조건 평가는 $O(1)$ 산술 비교 연산으로만 구성되어 있으므로 디바이스 CPU 성능에 영향이 없음 (Baseline 디바이스 기준 100개 이벤트 처리 비용 < 0.01ms 미만 확인).

## Dependencies

### F.1 Upstream Dependencies — DEFINITIVE

| Dependency | Type | Interface | Hard / Soft |
|------------|------|-----------|-------------|
| Pixi.js v8 `Application` | Tech | constructor 주입 | **Hard** — `app.stage`로 Federated Events 부착, `app.screen`으로 hitArea 설정 |
| pixi.js `EventEmitter` | Tech | import | **Hard** — `class InputSystem extends EventEmitter<...>` 타입 안전 이벤트 발행 |
| Browser `document` (DOM) | Platform | global | **Hard** — `visibilitychange` 이벤트 listener (E.1.3) |
| Browser `performance.now()` | Platform | global | **Hard** — 시간 측정 (F4 predicates) |
| Browser `localStorage` | Platform | global | **Soft** — A/B 로깅 실패 시 게임 진행 정상 (E.4.2) |
| Browser `URLSearchParams` | Platform | global | **Soft** — URL 변형 주입(`?variant=v1`) 사용 시만 |

**시스템 레이어 upstream 의존성: 없음 (Foundation Layer)**. POP! MVP의 어떤 게임 시스템 GDD도 사전 작성 없이 본 시스템 단독 설계·구현·테스트 가능.

---

### F.2 Downstream Dependents — ⚠ PROVISIONAL

> **PROVISIONAL 마크 의미**: 하기 표는 systems-index.md의 의존 그래프 + 본 시스템 인터페이스 추정에 기반. **각 dependent 시스템 GDD 작성 완료 시 verify 필요** — 실제 소비 이벤트 목록·인터페이스 디테일이 미세 조정될 수 있음. 전체 MVP GDD 완료 후 `/consistency-check`로 일괄 검증.

| Dependent System | Events Consumed (예상) | Hard / Soft | Verify 시점 |
|------------------|-----------------------|-------------|-------------|
| **Character & Harpoon System** (#4) | `input:fire`, `input:dragStart`, `input:dragMove`, `input:dragEnd`, `input:dragCancel` | **Hard** | Character & Harpoon GDD 작성 시 (#4 — 이 GDD 다음) |
| Visual Juice System (#10) | (선택) `input:fire`, `input:dragStart` | Soft | Visual Juice GDD 작성 시 (#10) — MVP에는 미사용 명시 |
| Game State Manager (#1) | (이벤트 소비 없음 — 라이프사이클 제어자) | Control | Game State Manager GDD 작성 시 (#3 배치) |

**verify 항목 체크리스트** (각 dependent GDD 작성 후):
- [ ] 실제 소비 이벤트 목록이 위 표와 일치하는가
- [ ] 페이로드 스키마(Vec2 등)가 일치하는가
- [ ] Hard/Soft 분류가 정확한가
- [ ] 누락된 dependent 시스템이 있는가

---

### F.3 Bidirectional Consistency Requirements — ⚠ PROVISIONAL

> **PROVISIONAL 마크 의미**: 다음 GDD 작성 시 본 시스템 참조 명시 필요. 미명시 시 `/consistency-check` 차단 사유.

- **Character & Harpoon System GDD (#4)** Dependencies 섹션에 **"Input System (Hard upstream)"** 명시 + 5개 이벤트 페이로드 스키마 (Vec2) 일치 확인
- **Game State Manager GDD (#1)** Dependencies 섹션에 **"Input System (Control relationship — owns lifecycle)"** 명시 + `attach()`/`detach()` 호출 정책 정의 (예: `enterState('playing')` → `attach`, `exitState('playing')` → `detach`)
- **Visual Juice System GDD (#10)** Dependencies 섹션에 본 시스템을 **Soft listener**로 명시 (선택적 청취, 미수신 시에도 정상 동작)

---

### F.4 인터페이스 계약 요약 — DEFINITIVE

Input System은 **이벤트 emitter 역할만** 수행:

- **Outbound**: 5종 events (C.2 정의)
- **Inbound**: `attach()`/`detach()` 호출 (Game State Manager가 라이프사이클 제어), `setVariant()` 호출 (A/B 토글)

→ **Input System은 다른 어떤 시스템도 사전 인지 불필요** → 단독 unit 테스트 가능 → R1(더블탭 입력감) 검증을 isolated하게 수행 가능. 이게 Foundation Layer 우선 설계의 핵심 가치.

## Tuning Knobs

런타임 제어 및 밸런싱 명세. 모든 노브는 5인 베타테스트 결과에 따라 default 재조정 가능.

### G.1 정량적 노브 매니페스트 (Numeric Knobs)

모든 정량적 상수는 시스템 전역에서 동적으로 변경 가능해야 하며, 입력 레이어의 유기적 조작감 튜닝을 위한 핵심 Knob 역할 수행.

| Knob 변수명 | Default | Safe Range | Min 도달 시 부작용 | Max 도달 시 부작용 | 게임플레이 영향도 |
|------------|---------|-----------|------------------|------------------|-----------------|
| `DRAG_THRESHOLD` (px) | 10 | 5 – 20 | < 5: 미세 손떨림을 드래그로 오인, `dragMove` 이벤트 폭주 및 탭 감지력 상실 | > 20: 유저가 의도한 정밀하고 작은 캐릭터 이동(미세 드래그) 조작 씹힘 | 드래그 인식 민감도. P1 필러의 '한 손가락 정확성' 보장 |
| `TAP_MAX_DURATION` (ms) | 250 | 150 – 400 | < 150: 정상적 빠른 탭 다수 누락 (롱탭으로 오분류) | > 400: 의도적 이동 대기(롱프레스) 해제 시점에 오발(fire) 유발 | 탭 vs 롱프레스 경계선 |
| `DOUBLE_TAP_WINDOW` (ms) | 300 | 200 – 500 | < 200: 인간 연타 속도 한계 수렴, V2 발사 성공률 급감 | > 500: 긴 간격 별개 두 탭이 더블탭 발사로 오인 | V2 모드 더블탭 시간 범위 |
| `DOUBLE_TAP_MAX_DISTANCE` (px) | 30 | 15 – 50 | < 15: 두 번째 연타 시 손가락 미세 어긋남에 더블탭 실패 | > 50: 화면 다른 두 지점 탭이 더블탭 발사로 오작동 | V2 모드 연타 공간 오차 범위 |
| `V1_GUARD_MS` (ms) | 50 | 30 – 100 | < 30: 드래그 종료 후 손가락 떼기 마찰 오발 위험 급증 | > 100: 드래그 후 공격 탭 전환 시 조작 반응 답답함 | V1 드래그-탭 충돌 방지 락타임 |

### G.2 정성적 노브 매니페스트 (Categorical Knobs)

| Knob 변수명 | Values | Default | 영향도 및 목적 |
|------------|--------|---------|---------------|
| `variant` | `'V1_SINGLE_TAP'`, `'V2_DOUBLE_TAP'` | `'V1_SINGLE_TAP'` | R1 핵심 가설 검증용 A/B 스위치. P4 필러('1탭 입력 마찰 최저') 정신으로 default V1. |

### G.3 Knob 간 상호작용 및 결합 제약 조건

구현자(AI agent)는 특정 상수 override 시 다음 결합 법칙 인지 + 유기적 예외 처리 보장.

- **`DRAG_THRESHOLD` × `TAP_MAX_DURATION`**: 둘 다 최소(5px, 150ms)면 탭/드래그 경계 협소 → 무작위 섞임. 둘 다 최대(20px, 400ms)면 응답 속도 심각 저하. **기획 표준 10px/250ms 균형 비율 권장**.

- **`DOUBLE_TAP_WINDOW` × `DOUBLE_TAP_MAX_DISTANCE`** (V2 전용): 시간·거리 둘 다 최소화 → 물리적으로 연타 불가. 둘 다 최대화 → 난사 오작동 폭증. **300ms/30px 골든 비율 규정**.

- **`V1_GUARD_MS` × `DRAG_THRESHOLD`** (V1 전용): DRAG_THRESHOLD 줄여 민감도 ↑ 시 드래그 끝점 오발 빈도 기하급수 증가 → V1_GUARD_MS도 비례 증가 권장.

- **`variant` 변경 시 동적 변수 마스킹**: V1 활성 시 `DOUBLE_TAP_*` 연산 완전 스킵 (리소스 절약). V2 활성 시 `V1_GUARD_MS` 메카닉 무용 → 모드 스위칭 순간 InputSystem 내부 메모리(`lastTapTime`, `startPos`, `lastTapPos`, `lastDragEndTime`) **즉시 0/null로 전역 리셋(sanitize)** 필요 (C.3 `setVariant()` 내부 `resetInternalState()` 호출로 보장).

### G.4 노브 노출 위치 및 런타임 제어 아키텍처

구현자는 기획자 실시간 피드백 검증을 위해 아래 4가지 경로로 Tuning Knobs 인터페이스 바인딩 필수.

**1. 인터페이스 파라미터 바인딩 (C.3 규격 준수)**
모든 노브는 `InputSystemOptions` 객체를 통해 생성자 시점 주입.

**2. URL 쿼리스트링을 통한 실시간 주입**
애플리케이션 진입점(`main.ts`)에서 브라우저 주소창 파라미터 동적 override.

> 🚨 **Strict Type Casting**: URL 파라미터는 기본 문자열. `variant` 제외 **모든 정량적 노브는 주입 전 반드시 `Number()` 형변환** 후 시스템에 주입. 형변환 실패 시 default 사용.

호출 예시: `http://localhost:3000/?variant=V2_DOUBLE_TAP&dragThreshold=15&tapMaxDuration=200`

**3. 브라우저 개발자 콘솔 글로벌 객체 노출**
런타임 빌드 수정 없이 콘솔에서 즉시 모드·수치 변경 가능. 인스턴스를 `window.__inputSystem`에 할당.

```javascript
// 런타임 콘솔 조작 예시
window.__inputSystem.setVariant('V2_DOUBLE_TAP');
window.__inputSystem.options.dragThreshold = 15;
```

**4. 배포(Release) 빌드 정책**
MVP 검증·5인 A/B 종료 후 winner variant 채택 시 default 하드코드 고정.

> **Security & Integrity 정책**: 위 URL 쿼리스트링·콘솔 조작 기능은 `process.env.NODE_ENV === 'development'` 모드 또는 QA 특화 빌드 플래그에서만 활성화. **최종 production 빌드에서는 코드 유출·무결성 오염 방지를 위해 격리(제거) 처리**.

## Acceptance Criteria

### AC.1 — State Machine Transitions (상태 전이 검증)

**AC.1.1** — **GIVEN** InputSystem의 상태가 `IDLE`인 상황에서, **WHEN** `pointerdown` 이벤트가 수신되면, **THEN** 시스템 상태는 `POINTER_DOWN`으로 전이되고, `startPos`(게임 월드 좌표) 및 `startTime`(`performance.now()`)이 메모리에 기록되어야 한다.

**AC.1.2** — **GIVEN** 시스템 상태가 `POINTER_DOWN`이며 `startPos`가 $(200, 400)$인 상황에서, **WHEN** `pointermove` 이벤트에 의해 새로운 위치 $(215, 405)$가 수신되면 ($distance \approx 15.8\text{ px} > \text{DRAG\_THRESHOLD } 10$), **THEN** 시스템 상태는 `DRAGGING`으로 전이되고, `input:dragStart({x: 215, y: 405})` 이벤트가 전역에 정확히 1회 발행되어야 한다.

**AC.1.3** — **GIVEN** 시스템 상태가 `POINTER_DOWN`이며 `startPos`가 $(200, 400)$인 상황에서, **WHEN** `pointermove` 이벤트에 의해 새로운 위치 $(205, 403)$가 수신되면 ($distance \approx 5.8\text{ px} \le \text{DRAG\_THRESHOLD } 10$), **THEN** 시스템 상태는 `POINTER_DOWN`을 유지해야 하며, 어떠한 이벤트도 외부로 발행되어서는 안 된다.

**AC.1.4** — **GIVEN** 시스템 상태가 `DRAGGING`인 상황에서, **WHEN** 연속적인 `pointermove` 이벤트가 수신되면, **THEN** 이벤트가 수신될 때마다 `input:dragMove({x, y})`가 1:1로 동기 발행되어야 하며, 이때의 좌표는 Pixi `stage.toLocal()`을 거친 게임 월드 좌표여야 한다.

**AC.1.5** — **GIVEN** 시스템 상태가 `DRAGGING`인 상황에서, **WHEN** `pointerup` 이벤트가 수신되면, **THEN** 시스템 상태는 `IDLE`로 전이되고, `lastDragEndTime = performance.now()`가 기록되며, `input:dragEnd({x, y})` 이벤트가 1회 발행되어야 한다.

**AC.1.6** — **GIVEN** 시스템 상태가 `DRAGGING`인 상황에서, **WHEN** OS 레벨 인터럽트 등으로 인해 `pointercancel` 이벤트가 수신되면, **THEN** 시스템 상태는 `IDLE`로 전이되고, `lastDragEndTime = performance.now()`가 기록되며, `input:dragCancel({})` 이벤트가 1회 발행되어야 한다.

### AC.2 — V1 Single-Tap Fire 동작 검증

**AC.2.1** — **GIVEN** `variant` 옵션이 `'V1_SINGLE_TAP'`이고 드래그 이력이 없는(`lastDragEndTime = 0`) 상황에서, **WHEN** `pointerdown` 발생 후 $200\text{ ms}$ 이내에 DRAG_THRESHOLD 이동 없이 `pointerup`이 발생하면, **THEN** `input:fire({})` 이벤트가 정확히 1회 발행되어야 한다.

**AC.2.2** — **GIVEN** V1 모드 환경에서, **WHEN** `pointerdown` 발생 후 $500\text{ ms}$가 경과하여 `TAP_MAX_DURATION(250ms)`을 초과한 시점에 `pointerup`이 발생하면, **THEN** `input:fire` 이벤트는 발행되지 않아야 하며, 시스템 상태는 묵묵히 `IDLE`로 복귀해야 한다 (롱프레스 처리).

**AC.2.3** — **GIVEN** V1 모드 환경이고 직전 드래그 종료 시점으로부터 단 $30\text{ ms}$만 경과한 상황일 때 (`V1_GUARD_MS` 50ms 미만), **WHEN** 화면에 짧은 탭(`pointerdown` 후 즉시 `pointerup`)이 수신되면, **THEN** `input:fire` 이벤트는 가드 타임 락에 의해 발행되지 않아야 한다 (드래그 끝점 손떼기 오발 방지).

**AC.2.4** — **GIVEN** V1 모드 환경이고 직전 드래그 종료 시점으로부터 $60\text{ ms}$가 경과한 상황일 때 (`V1_GUARD_MS` 50ms 초과), **WHEN** 화면에 짧은 탭이 수신되면, **THEN** `input:fire({})` 이벤트가 정상적으로 1회 발행되어야 한다.

### AC.3 — V2 Double-Tap Fire 동작 검증

**AC.3.1** — **GIVEN** `variant` 옵션이 `'V2_DOUBLE_TAP'`이고 기존 연타 기록이 없는(`lastTapTime = 0`) 상황에서, **WHEN** 단일 짧은 탭(누름 유지 시간 $\le \text{TAP\_MAX\_DURATION}$)이 발생하면, **THEN** `input:fire` 이벤트는 발행되지 않아야 하며, `lastTapTime = performance.now()` 및 `lastTapPos = startPos`가 내부 버퍼에 기록되어야 한다.

**AC.3.2** — **GIVEN** V2 모드 환경이며 첫 번째 유효 탭 기록 후 $200\text{ ms}$가 경과한 상황일 때 (`DOUBLE_TAP_WINDOW` 300ms 이내), **WHEN** 첫 탭 지점과의 거리가 $30\text{ px}$ 이내인 영역(`DOUBLE_TAP_MAX_DISTANCE` 이내)에서 두 번째 짧은 탭의 `pointerup`이 완료되면, **THEN** `input:fire({})` 이벤트가 최종 1회 발행되어야 하며, `lastTapTime`은 즉시 0으로 완전 초기화되어야 한다.

**AC.3.3** — **GIVEN** V2 모드 환경이며 첫 번째 유효 탭 기록 후 $400\text{ ms}$가 경과한 상황일 때 (`DOUBLE_TAP_WINDOW` 300ms 초과), **WHEN** 두 번째 짧은 탭이 수신되면, **THEN** 기존 세션이 만료되었으므로 `input:fire` 이벤트는 발행되지 않아야 하며, 현재 수신된 탭이 '새로운 첫 번째 탭'으로 승격되어 `lastTapTime`에 현재 스탬프가 덮어씌워져야 한다.

**AC.3.4** — **GIVEN** V2 모드 환경이며 첫 번째 탭이 좌표 $(100, 200)$에서 발생한 상황에서, **WHEN** $200\text{ ms}$ 후 좌표 $(150, 250)$ 영역에서 두 번째 짧은 탭이 수신되면 ($distance \approx 70.7\text{ px} > \text{DOUBLE\_TAP\_MAX\_DISTANCE } 30$), **THEN** 거리가 초과되었으므로 `input:fire` 이벤트는 발행되지 않아야 하며, 해당 탭이 새 첫 탭으로 갱신되어야 한다.

**AC.3.5** — **GIVEN** V2 모드 환경이며 첫 탭이 유효하게 기록되어 `lastTapTime > 0`인 대기 상황에서, **WHEN** 두 번째 `pointerdown`이 들어온 직후 유저가 손가락을 밀어 `DRAG_THRESHOLD`를 초과하는 이동을 발생시키면, **THEN** 더블탭 시도가 취소된 것으로 판단하여 상태 머신은 즉시 `DRAGGING`으로 전이되고, `lastTapTime`은 0으로 리셋되며, `input:dragStart` 이벤트가 즉시 송출되어야 한다.

### AC.4 — Event Payload 정합성 검증

**AC.4.1** — **GIVEN** Pixi.js 캔버스 해상도 및 스테이지에 줌인/줌아웃, 해상도 대응 매트릭스 변환이 임의로 적용되어 있는 상황에서, **WHEN** `pointerdown` 시점의 브라우저 raw 픽셀 좌표(`event.global`)가 $(500, 600)$으로 인입되면, **THEN** 시스템이 송출하는 `dragStart`/`dragMove`/`dragEnd` 페이로드의 `x`, `y` 값은 반드시 `app.stage.toLocal()` 연산을 완벽히 거친 독립적인 '게임 월드 좌표' 구조체 규격이어야 한다.

**AC.4.2** — **GIVEN** InputSystem이 작동 중인 환경에서, **WHEN** 발사 조건이 만족되어 `input:fire` 이벤트가 송출될 때, **THEN** 해당 이벤트의 페이로드 데이터는 어떠한 부가 속성도 포함하지 않는 순수 빈 객체 `{}` 형식을 엄격히 유지해야 한다.

**AC.4.3** — **GIVEN** InputSystem이 작동 중인 환경에서, **WHEN** 드래그 조작에 의해 `input:dragMove` 이벤트가 송출될 때, **THEN** 페이로드 객체 구조는 정확히 `{ x: number, y: number }` 규격을 만족해야 하며, 인터페이스 명세에 정의된 `Vec2` 타입 가이드라인과 완벽히 일치해야 한다.

> **Prototype Scope Boundary**: AC.1–AC.4 + AC.9는 prototype 빌드에서 검증 필수. **AC.5–AC.8은 다음 단계 (Pre-Production) 도입 항목** — prototype 빌드 시 구현자는 AC.5–AC.8 절차를 stub 또는 minimal handler로 구현해도 무방. PROCEED 판정 후 정식 구현.

### AC.5 — Edge Cases (경계 조건 예외 검증)

**AC.5.1** — **GIVEN** 최초 터치 손가락(`pointerId = 1`)이 화면을 점유하여 활성화되어 있는 상황에서, **WHEN** 멀티터치 조작으로 인해 두 번째 손가락(`pointerId = 2`)의 `pointerdown` 이벤트가 추가 인입되면, **THEN** 두 번째 손가락으로 인한 모든 이벤트 스트림은 철저히 무시되어야 하며, 시스템 상태의 변화 및 외부 이벤트 발행이 일절 차단되어야 한다 (pointerId 1이 완전히 해제될 때까지 보호).

**AC.5.2** — **GIVEN** 시스템 상태가 `DRAGGING`을 유지하며 원활히 조작 중인 상황에서, **WHEN** 유저가 브라우저 탭을 전환하거나 홈 화면으로 이탈하여 `document.visibilitychange` 이벤트(hidden)가 감지되면, **THEN** 내부 가드 시스템이 즉시 `input:dragCancel({})`을 발행하고 상태를 `IDLE`로 강제 안전 전환해야 한다.

**AC.5.3** — **GIVEN** 드래그 조작 상태(`DRAGGING`)가 진행 중인 상황에서, **WHEN** 모바일 기기 회전 등으로 인해 브라우저의 윈도우 resize 이벤트가 트리거되면, **THEN** 입력 시스템의 중단 없이 갱신된 새로운 뷰포트 매트릭스 연산 결과가 즉시 반영되어, 후속 `input:dragMove` 페이로드는 정상적인 새 월드 좌표계 기준 수치로 보정 출력되어야 한다.

**AC.5.4** — **GIVEN** 유저가 브라우저 시크릿 모드(Private Browsing) 등을 사용하여 `localStorage` 쓰기 권한이 차단된 특수 상황일 때, **WHEN** A/B 테스트 정량 로그 데이터 적재 시도가 발생하면, **THEN** 예외를 외부로 전파하여 런타임 크래시를 내지 않고 내부 `try/catch` 블록을 통해 조용히 실패(silently fail)해야 하며, 개발자 콘솔에 단 1회의 `console.warn` 알림만 출력한 채 게임 플레이 코어 루프는 정상 진행을 보장해야 한다.

### AC.6 — Performance (성능 한계 검증)

**AC.6.1** — **GIVEN** Pixi v8 메인 루프 Ticker가 $60\text{ FPS}$ 환경에서 안정적으로 구동되는 상황에서, **WHEN** 입력 장치로부터 1초 동안 총 60회의 `pointermove` 이벤트가 밀도 높게 수신될 때, **THEN** 상태 머신의 상태 추적 및 조건 평가 연산에 소모된 순수 CPU 타임의 누계 합산값은 반드시 $0.6\text{ ms}$ 미만(이벤트 단일 처리당 $0.01\text{ ms}$ 이하, iPhone 11 Baseline 기준)이어야 한다.

**AC.6.2** — **GIVEN** 고주사율 디바이스 조작 환경에서 1초 동안 100회 이상의 인위적인 폭주 입력(rapid interaction 스트레스 테스트)이 가해지는 상황에서, **WHEN** 입력 시스템이 해당 물리 스트림을 전량 수신하여 상위 컨슈머 계층으로 바이패스할 때, **THEN** 연산 병목으로 인한 캔버스 드롭 프레임이 단 1프레임도 발생하지 않아야 하며 (drop frame = 0), 브라우저 프레임 레이트는 $60\text{ FPS}$ 이상을 견고하게 유지해야 한다.

**AC.6.3** — **GIVEN** Pixi v8 Application 환경이 브라우저 DOM에 최초로 마운트되는 시점에, **WHEN** 시스템 진입 루틴에서 `InputSystem.attach()` 메서드가 구동되면, **THEN** Pixi stage 객체 상에 Federated Event 리스너 5종(`pointerdown`, `pointermove`, `pointerup`, `pointerupoutside`, `pointercancel`)과 브라우저 DOM 스코프 상에 `visibilitychange` 리스너 1종이 정상적으로 바인딩 완료되어야 한다.

### AC.7 — A/B Test Infrastructure (실험 인프라 정합성)

**AC.7.1** — **GIVEN** 유저가 브라우저 주소창에 파라미터 `?variant=V2_DOUBLE_TAP`을 주입하여 게임 웹에 접속한 상황일 때, **WHEN** `main.ts` 진입 구문이 구동되며 `URLSearchParams` 컴포넌트를 파싱하는 시점에, **THEN** `InputSystem.setVariant('V2_DOUBLE_TAP')` 코드가 자동으로 호출되어, 최초 인게임 입력 레이어 모드가 V2(더블탭 방식) 사양으로 셋업 및 시작되어야 한다.

**AC.7.2** — **GIVEN** 유저가 브라우저 주소창에 파라미터 `?dragThreshold=15`를 주입하여 진입한 상황일 때, **WHEN** 초기 셋업 모듈이 구동될 때, **THEN** 문자열 데이터 `'15'`가 원시 타입 숫자 `15`로 명시적 형변환 처리(`Number()`)되어, 최종 런타임 인스턴스의 `options.dragThreshold` 상숫값에 오염 없이 정확히 적용되어야 한다.

**AC.7.3** — **GIVEN** 플레이어가 1회의 인게임 플레이 스테이지를 완전히 완수하거나 사망하여 게임 오버 점수 연산 화면으로 진입하는 순간에, **WHEN** 결과 데이터 로깅 파이프라인이 구동되면, **THEN** `localStorage.getItem('pop_ab_log')` 배열을 역직렬화한 후, 당해 세션 결과 객체 `{ variant, score, durationMs, firePerSecond, runCount }`를 push하고, 다시 `JSON.stringify`를 거쳐 재적재 작업이 완결되어야 한다.

**AC.7.4** — **GIVEN** 개발 환경용 Development 빌드 사양 플래그가 활성화된 런타임 환경에서, **WHEN** 기획자가 브라우저 개발자 도구 콘솔에서 `window.__inputSystem.setVariant('V1_SINGLE_TAP')` 구문을 직접 호출하면, **THEN** 그 즉시 시스템 입력 계층이 V1 모드로 안전하게 실시간 스위칭되어야 하며, 내부 연산용 타임스탬프 버퍼들은 사이드 이펙트 방지를 위해 0 또는 `null`로 일제히 초기화되어야 한다.

**AC.7.5** — **GIVEN** 실제 배포 표준 빌드 사양 환경(`process.env.NODE_ENV === 'production'`)에서 게임이 구동될 때, **WHEN** 외부 해킹 및 데이터 변조 목적으로 개발자 콘솔에서 글로벌 객체 `window.__inputSystem` 인터페이스에 접근을 시도하면, **THEN** 보안 및 격리 정책에 의거하여 해당 객체는 철저히 감춰져 `undefined` 구조로만 출력되어야 한다.

### AC.8 — A/B Test 결정 절차 명세 (5인 정성+정량 밸런싱)

**AC.8.1** — **GIVEN** 5명의 지정 베타 테스터 그룹이 V1(단일 탭) 및 V2(더블 탭) 입력 변형 사양을 교대로 플레이 완수시킨 최종 시점에, **WHEN** 밸런싱 세션 최종 의사결정 컨퍼런스를 소집하면, **THEN** 의사결정을 돕기 위한 데이터 레이어로 (a) 테스터별 경험 코멘트 10개 세트(정성 데이터)와 (b) 스토리지 로그 스택으로부터 산출해 낸 변형 사양별 '평균 스코어 격차량' 및 '초당 발사 비율 수치'(정량 데이터) 레포트가 콘솔 및 테이블 형태로 시각화되어 준비되어야 한다.

**AC.8.2** — **GIVEN** 상기 정성/정량 데이터 수집이 성공적으로 도출된 상황에서, **WHEN** 본 GDD Section C.4의 결정 휴리스틱을 적용하면, **THEN** 의사결정 시스템은 다음 2가지 분기 조건 중 하나를 확정 선언해야 한다.
- (a) 테스터 5명 중 4명 이상이 명확하게 특정 하나의 조작 사양에 높은 유저 경험 점수를 부여했을 경우: 지체 없이 해당 사양을 프로덕션 릴리즈용 최종 Winner 스펙으로 확정 승인함.
- (b) 정성/정량 만족 지표 데이터가 상호 동률(Tight Split) 현상이 발생할 경우: MVP 본연의 목적인 '입력 제어 마찰력의 최소화(P4 필러 정신)' 기조를 준수하기 위해, 기본 탑재 모델인 V1 사양(Single-Tap Fire)을 최종 런칭 스펙으로 자동 채택함.

### AC.9 — P4 RETRY 마찰 제로 (1탭 재시작 검증)

P4 필러("1탭이 다음 런으로") 의 입력 측 보장. 사망 상태에서 다음 런 시작까지의 입력 비용을 1탭 이내로 제한.

**AC.9.1** — **GIVEN** 게임이 사망(GameLoop end() 호출 직후)으로 RETRY UX가 표출된 상황에서, **WHEN** 플레이어가 화면 어느 영역이든 1회 탭(`pointerdown` → `pointerup` 단일 사이클)을 발생시키면, **THEN** Input System은 단일 탭만으로 `input:retry` 이벤트를 즉시 발행해야 하며, V1·V2 모드 모두에서 동일 동작(더블탭 강제 적용 금지).

**AC.9.2** — **GIVEN** RETRY 상태에서 플레이어가 첫 탭을 발생시킨 시점부터, **WHEN** 다음 런 첫 풍선이 화면에 표출되기까지의 시간을, **THEN** 300ms 이하로 보장한다 (S5→S2 전환 0.3초 — art-bible §2.2와 정합). 더 긴 lag은 P4 위반.

**AC.9.3** — **GIVEN** RETRY 상태에서 입력을 받기 시작한 직후, **WHEN** 플레이어의 멀티터치 또는 우발적 드래그가 발생하면, **THEN** 단일 탭으로 간주하여 `input:retry`를 1회만 발행 (멀티 탭 누적 발행 금지, 드래그 시작 후에도 첫 손가락의 pointerup 시점에 retry로 처리).

## Open Questions

진짜 미결 항목만. 이미 본 spec에서 해소된 리스크는 OQ로 남기지 않음 (reader 혼선 방지).

**OQ.1** — **V1/V2 최종 선택**
- 설명: 5인 베타테스트 후 winner variant 확정
- **Owner**: game-designer + qa-lead
- **Resolution target**: MVP playtest phase (Input System 구현 완료 후 5–7일)
- **Resolution method**: AC.8.1·AC.8.2 절차

**OQ.2** — **V2 모드 "tap-window-expired" 알림 이벤트 추가 검토**
- 설명: 현재 V2의 첫 탭 후 `DOUBLE_TAP_WINDOW` 만료 시 silent. UI System / Visual Juice가 "1탭 했어요" 시각 피드백을 주고 만료 시 해제하려면 명시적 알림 필요할 수 있음
- **Owner**: UI System GDD 작성자 + Visual Juice GDD 작성자
- **Resolution target**: Visual Juice GDD (#10) 또는 UI System GDD (#14) 설계 시
- **Default**: silent (no event). 필요 입증되면 `input:tapWindowExpired` 추가

**OQ.3** — **고주사율 디바이스(120/144 Hz) `dragMove` 스로틀링 정책 재확인**
- 설명: 현재 명세는 raw stream (스로틀링 없음). Consumer (Character & Harpoon)가 frame budget 안에서 처리 못하면 backpressure 발생 가능
- **Owner**: Character & Harpoon GDD 작성자
- **Resolution target**: Character & Harpoon GDD (#4) 설계 시 — consumer 측 처리 정책과 함께 재논의

## Implementation Checklist

Approved 조건: 본 섹션 전 체크박스 완료 + QA Lead 서명.

### I.1 진입점 및 라이프사이클 아키텍처 (Entry Point)

구현자는 인스턴스화 및 리스너 바인딩 시 아래 명시된 모듈 구조와 호출 경로를 엄격히 준수.

- **인스턴스 초기화 주체**: main entry (systems-index §Engine Bootstrap + §Wiring Contract W-RULE-04)
  - 호출 가이드: Pixi.js Application 컨텍스트 초기화 직후, URL 파라미터 파싱 결과(`Number` 형변환 완료본)를 주입하며 생성자 호출
  - 코드 구조: `const inputSystem = new InputSystem(app, parseUrlOptions());`

- **라이프사이클 매니저**: game state manager component
  - 게임 상태 매니저가 인게임 핵심 루프 `'playing'` 상태로 진입/이탈할 때 시스템 제어권 트리거
  - 진입(`enterState('playing')`): `inputSystem.attach();` — Pixi v8 Federated Listener 5종 + DOM Window Listener 1종 등록
  - 이탈(`exitState('playing')`): `inputSystem.detach();` — 등록된 모든 리스너 일제 해제 및 내부 메모리 버퍼 초기화

- **다운스트림 이벤트 구독 주체 (Consumers)**:
  - balloon-physics-split System (character + harpoon 흡수) 모듈이 주입받은 InputSystem 인스턴스의 표준 EventEmitter API를 사용하여 5대 입력 신호(`input:fire`, `input:dragStart`, `input:dragMove`, `input:dragEnd`, `input:dragCancel`)를 상시 구독

### I.2 런타임 의존성 무결성 확인 (Sanity Check)

구현 자산 커밋 전, 아래 외부 API 및 환경 스코프에 대한 참조 안정성 확보 필수.

- [ ] `pixi.js` 모듈: v8 핵심 사양인 `Application`, `EventEmitter` export 인터페이스 존재 확인
- [ ] `app.stage` 컨텍스트: `eventMode = 'static'`, `hitArea = app.screen` 지원 및 `on()` / `off()` 메서드를 통한 5대 Federated Pointer 이벤트 바인딩 규격 작동 확인
- [ ] 좌표 변환 API: `app.stage.toLocal(event.global)` 메서드가 정상적으로 전역 픽셀을 로컬 게임 월드 좌표로 연산 확인
- [ ] 브라우저 글로벌: `document.addEventListener('visibilitychange', ...)`, `performance.now()`, `URLSearchParams` 지원 확인
- [ ] 스토리지 샌드박스: `localStorage` 입출력 구문이 `try/catch` 블록으로 안전하게 래핑되어 예외 격리 확인

### I.3 AC ↔ 자동화 테스트 매핑 매트릭스 (Vitest Spec)

테스트 구동 환경: Unit/Integration 테스트는 `environment: 'happy-dom'` 또는 `'jsdom'` 조건. Perf 테스트는 고정 루프 연산 스펙 측정.

| 사양 ID | Test Method | 매핑 유닛 테스트 함수명 |
|---------|-------------|----------------------|
| AC.1.1 | unit | `test('IDLE → POINTER_DOWN on pointerdown')` |
| AC.1.2 | unit | `test('POINTER_DOWN → DRAGGING on movement > dragThreshold')` |
| AC.1.3 | unit | `test('POINTER_DOWN stays on movement ≤ dragThreshold')` |
| AC.1.4 | unit | `test('DRAGGING emits dragMove per pointermove with world coords')` |
| AC.1.5 | unit | `test('DRAGGING → IDLE on pointerup emits dragEnd')` |
| AC.1.6 | unit | `test('DRAGGING → IDLE on pointercancel emits dragCancel')` |
| AC.2.1~4 | unit | `test('V1: short tap within max duration emits fire')` / `test('V1: long press exceeding max duration suppresses fire')` / `test('V1: tap within guard time window is suppressed')` / `test('V1: tap after guard time window passes successfully fires')` |
| AC.3.1~5 | unit | `test('V2: first tap does not fire but records stamp and pos')` / `test('V2: second tap within window and max distance successfully fires')` / `test('V2: second tap outside window timing updates new first tap')` / `test('V2: second tap exceeding distance constraint suppresses fire')` / `test('V2: immediate drag intent during second down cancels double-tap')` |
| AC.4.1~3 | unit | `test('all exported coords are properly localized via stage.toLocal')` / `test('fire event payload strictly returns empty object {}')` / `test('dragMove payload maintains exact type structural match with Vec2')` |
| AC.5.1 | unit | `test('secondary pointerdown events with different pointerId are completely ignored')` |
| AC.5.2 | unit | `test('visibilitychange to hidden triggers dragCancel during active drag')` |
| AC.5.3 | integration | `test('subsequent dragMove coordinates accurately map to new viewport after resize')` |
| AC.5.4 | unit | `test('localStorage blocker scenarios are silently caught with console.warn')` |
| AC.6.1 | perf | `test('processing 60 pointermoves sequentially consumes less than 0.6ms CPU time')` |
| AC.6.2 | perf | `test('rapid stress stream of 100 events/sec maintains zero frame drops')` |
| AC.6.3 | unit | `test('attach registers exactly 6 active native/federated listeners')` / `test('detach purges all 6 registered listeners leaving zero memory leaks')` |
| AC.7.1~2 | integration | `test('initialization natively parses ?variant string values')` / `test('url parameters apply numerical type parsing before injection')` |
| AC.7.3 | integration | `test('game over pipeline successfully serializes session arrays to localStorage')` |
| AC.7.4 | integration | `test('window.__inputSystem exposes dynamic variant switching in development')` |
| AC.7.5 | integration | `test('global window binding resolves to undefined in production environments')` |
| AC.8.1~2 | playtest — evidence 별도 폴더 기록 | 5인 베타테스터 실기 플레이 후 정성 회의록 + 최종 결정 sign-off로 검증 |

### I.4 빌드 프로덕션 및 게이트 키핑 (Build Verification)

- [ ] `npm run test:unit` (Vitest) — 상기 명시된 모든 단위/통합 테스트 케이스 100% 통과(Pass)
- [ ] `npm run test:perf` — 스트레스 고주사율 벤치마크 조건 만족
- [ ] `npm run build` (Vite) — 오류 없이 빌드 완료, 깔끔한 ESM 번들 결과물 도출
- [ ] **경량화 번들 풋프린트 측정**: 트리셰이킹 완료된 InputSystem 단독 코드 크기 < **5KB minified** (gzip 후 < **2KB**)
- [ ] **실기 스모크 테스트**: 로컬 배포본을 iPhone 11 / Galaxy A52 실기 브라우저에서 각각 5분 연속 조작 — 터치 stuck·레이턴시 저하·입력 씹힘 발생 빈도 **0건** 달성
- [ ] QA Lead 서명: _______ / 날짜: _______

### I.5 최종 승인 프로세스 (Sign-off Criteria)

- [ ] **GDD 섹션 완결성**: 본 문서의 9개 필수 설계 섹션 모두 채워졌으며, 미결 사항 OQ.1~OQ.3은 하위 마일스톤으로 안전하게 deferred 처리 확인
- [ ] **시스템 인덱싱 동기화**: `design/gdd/systems-index.md` 내 본 시스템 Status 플래그를 `Designed`로 정상 업데이트
- [ ] **크로스 레퍼런스 검증**: 후속 GDD(Character & Harpoon, Visual Juice, UI System) 내부에서 본 시스템의 인터페이스 및 이벤트 명확히 인용 + 종속성 매핑 완료를 QA 단계에서 상호 검증
