# Critical Pop System

> **Status**: Draft (M0 prototype 1-pager, post-review v1.1)
> **Author**: joywoni + Claude
> **Last Updated**: 2026-05-30 (정밀 리뷰 19건 반영 — BLOCKING 3 / MAJOR 7 / MINOR 7 + balloon-physics-split 양방향 lock 2건)
> **Implements Pillar**: P3 (운은 자주, 실력은 깊게)
> **Engine target**: Pixi.js v8
> **Scope note**: M0 prototype 범위 1-pager. 9섹션 헤더 유지하되 본문 압축. M1 PROCEED 후 정식 GDD 승격.

---

## 1. Overview

R2 risk (Critical 운 의존도 박탈감) 대상. 본 시스템은 4가지 책임을 갖는다:

- (a) **Critical 부여** — 매 풍선 spawn에 `rng.critical.nextBool(0.10)` lottery 적용 (10% 확률)
- (b) **Pity timer 90s** — 무 Critical 90초 경과 시 active balloon 중 character와 가장 가까운 1개를 Critical로 transmute (R2 mitigation, PG-04 보장)
- (c) **연쇄팝** — Critical balloon 명중 시 인근 active balloon 자동 연쇄 제거 (cap 3, decisions §3 #6 lock)
- (d) **이벤트 emit** — `criticalPop:fired` → Visual Juice (화면 다크닝) + Score & Combo (콤보 카운트)

`rng.critical` 사용 (페어플레이 contract, systems-index §Conventions). Math.random() 직접 호출 금지.

---

## 2. Player Fantasy

**감정 목표**: "운은 자주 보장, 실력 천장은 깊다" (P3 정합) — 운 호재가 시각적 축제로 응답, 동시에 90초 안에 반드시 한 번은 발생한다는 약속이 박탈감 차단.

플레이어가 카오스 한복판에서 갑자기 Gold로 변하는 풍선을 본다. "지금이다." 작살이 명중하는 순간 화면이 0.1초 다크닝되며 인근 풍선 최대 3개가 동시 연쇄 제거된다. 화면 전체가 응답하는 압도적 카타르시스 — Critical은 P3의 약속이고, Pity timer는 그 약속의 보증서다.

**실력 천장** (P3 깊이): (a) Critical balloon 위치 인지·조준 정밀도, (b) **연쇄팝 chain count 최대화를 위한 포지셔닝** — 풍선 밀집 지점 + Critical 동시 발생 시 최대 +3 chain × Score & Combo bonus. 단순 운 의존이 아닌 의사결정 깊이.

---

## 3. Detailed Rules

### 3.1 Critical 부여 (Lottery 모델)

- `balloon-physics-split`가 풍선 spawn 시 (balloon-physics-split §3.2) → spawn 직후 동일 frame에 `criticalPop.onBalloonSpawned(balloon)` 직접 hook 호출 (balloon-physics-split §9 IC에 명시 ✅, M0 prototype 단순화)
- 본 시스템 처리: `if (rng.critical.nextBool(CRITICAL_PROBABILITY) || pityTimer >= PITY_TIMEOUT) → setCritical(balloon)`. **Pity 누적 시 active=0 도달 후 다음 spawn 시점에 강제 분기 (E2)**
- **`setCritical(balloon)`** — Critical Pop System 단독 권한 (balloon-physics-split §6 인터페이스 계약 lock):

```js
// Pixi v8 Sprite + tint + filters 교체 패턴 (balloon-physics-split §3.1 lock)
balloon.isCritical    = true
balloon.color         = CRITICAL_GOLD_HEX            // 0xFFD700 (art-bible §1.3 canonical)
balloon.sprite.tint   = CRITICAL_GOLD_HEX            // Sprite tint 즉시 갱신
balloon.sprite.filters = [SHARED_CRITICAL_GOLD_GLOW] // GlowFilter 공유 인스턴스 교체 (distance 28px, alpha 0.85, outline 2px — art-bible §4.2 HERO tier)
pityTimer             = 0                            // reset
```

- **시각 transition**: 즉시 적용 (color tween 없음). spawn lottery는 spawn 순간에 결정되어 풍선은 처음부터 Gold로 렌더링. Pity transmute는 active balloon이 즉시 색·glow 교체 → 플레이어 인지
- M1 retrofit: emit/listen 모델 (`balloon:critical:assigned({ balloonId })` 이벤트)로 전환 (decisions §2.2)

> **Race condition 없음**: setCritical 호출은 단일 Ticker pass 안에서 완결. JS single-threaded + Pixi Ticker single-pass 구조에서 race 불가.

### 3.2 Pity Timer

매 frame:
```
pityTimer += dt   // dt = ticker.deltaMS / 1000 (초 단위)
```

`pityTimer >= PITY_TIMEOUT (90s)` 도달 시:
```js
if (activeBalloons.length > 0) {
  // character와 2D 거리 (제곱 비교, sqrt 미사용 — balloon-physics-split §3.9 패턴 통일)
  target = activeBalloons.reduce((best, b) => {
    const distSq = (b.x - character.x)**2 + (b.y - character.y)**2
    return (best === null || distSq < best.distSq) ? { b, distSq } : best
  }, null).b
  // 동률 시 reduce 순회 첫 발견 (deterministic — activeBalloons 순서 = spawn 순서, E8)
  setCritical(target)
} else {
  // pityTimer 유지 (감소 없음). 다음 spawn 시점 §3.1 분기에서 강제 setCritical (E2)
}
```

- 강제 부여로 PG-04 보장 (단일 런 90s 한도 안에서)
- `setCritical` 호출 시 pityTimer 자동 reset (§3.1)

### 3.3 연쇄팝 (Cascade)

**전제**: balloon-physics-split의 `Collision.balloonHarpoon` 처리는 **emit 전에 명중 풍선을 `activeBalloons`에서 제거** (balloon-physics-split §9 IC lock). 따라서 본 시스템의 연쇄 탐색 시 명중 Critical 풍선 자신은 candidates에 포함되지 않음 (self-exclusion 자동 보장).

`balloon:popped({ isCritical: true })` listen → 연쇄 처리:

```js
// 1. CHAIN_RADIUS 안 + 거리 오름차순 정렬 → cap 3 (가까운 풍선 우선)
const radiusSq = CRITICAL_CHAIN_RADIUS ** 2
const chainCandidates = activeBalloons
  .filter(b => ((b.x - event.x)**2 + (b.y - event.y)**2) < radiusSq)
  .sort((a, b) => {
    const dA = (a.x - event.x)**2 + (a.y - event.y)**2
    const dB = (b.x - event.x)**2 + (b.y - event.y)**2
    return dA - dB
  })
  .slice(0, CRITICAL_CHAIN_CAP)   // 최대 3개

// 2. balloon-physics-split의 public removal API 호출 — 각 chained balloon 즉시 제거 + `balloon:popped({ isCritical: false })` 강제 emit (재귀 방지)
chainCandidates.forEach(chained => balloonSystem.removeBalloon(chained.id))

// 3. emit (chainedBalloons는 항상 배열, chain 없으면 [])
emit `criticalPop:fired`, {
  x: event.x,
  y: event.y,
  criticalSize: event.size,         // 명중 시점 Critical 본체 size (M-CP-1 lock — score-combo §3.3)
  chainedBalloons: chainCandidates.map(b => ({ id: b.id, x: b.x, y: b.y, size: b.size, color: b.color }))
}
```

- **연쇄 재귀 방지**: `removeBalloon(id)`가 emit하는 `balloon:popped`는 `isCritical: false` 강제 (balloon-physics-split §9 IC lock). 본 시스템은 isCritical=true만 listen → 재귀 0
- **chained balloon은 분열 안 함** (M-3 결정 — 카오스 폭증 방지). `removeBalloon`은 즉시 제거 (split 분기 없음)
- **dist² 비교** (sqrt 미사용) — balloon-physics-split §3.9 패턴 통일

### 3.4 Visual Juice / Score & Combo trigger

- `criticalPop:fired` → Visual Juice listen: **화면 다크닝 시퀀스** (art-bible §1.3 + §2.1 S3 lock):
  - `ColorMatrixFilter` 0.1s transition in (`#1A3A55 → #2D2855 → #1A1A3A`)
  - 화이트 플래시 overlay 0.05s
  - 0.05s fade out 복귀 → 전체 ≤ 0.2초 완결 (art-bible §1.3)
  - **타이밍 제어 권한 = Visual Juice 단독** (`VJ_DARKEN_DURATION = 0.1s` 자체 상수 사용). `criticalPop:fired` payload에 duration 정보 미포함 (clean event 유지)
- `criticalPop:fired` → Score & Combo listen: 콤보 카운트 (Critical +1 + chainedBalloons.length, cap +3 합산; decisions §3 #6)

> **시각 동기 보장**: chained balloon 시각 제거는 Visual Juice 다크닝 시작과 동일 frame (instant 제거). 0.1s 다크닝 안에 chained 풍선이 사라진 결과가 명확히 표현됨 — Visual Juice GDD에서 enforce.

### 3.5 GameLoop Contract (systems-index §Engine Bootstrap)

- `reset()`: `pityTimer = 0`, `lastCriticalTime = 0`. 런 간 누적 안 함
- `start()`: `app.ticker.add(update)` (pityTimer 누적 시작). listener 등록은 `app.init()` 완료 후 `GameLoop.start()` 직전 1회만 (§9 IC)
- `end()`: ticker에서 제거, 상태 freeze

---

## 4. Formulas

### 4.1 Lottery 확률

```
P(Critical | spawn) = CRITICAL_PROBABILITY = 0.10
Expected lottery interval (without pity) = SPAWN_INTERVAL / P = 3s / 0.10 = 30s 이론적 평균
With Pity timer = max 90s 보장 (단일 런)

Chain count          = min(activeBalloons in CRITICAL_CHAIN_RADIUS, CRITICAL_CHAIN_CAP)
Combo bonus per Critical event = 1 (Critical 자체) + Chain count   (max 1 + 3 = 4)
```

### 4.2 PG-04 보장 메커니즘 (M-A 검증)

PG-04 ("첫 3런 안 90% 테스터 Critical 목격") 보장은 두 채널 합성:

**채널 1 — Lottery (단일 런 내)**:
```
P(Critical 발생 | 런 길이 T초) = 1 - (1 - 0.10)^(T / SPAWN_INTERVAL)
                                = 1 - 0.9^(T/3)

T=30s:  1 - 0.9^10 ≈ 65%
T=60s:  1 - 0.9^20 ≈ 88%
T=90s:  1 - 0.9^30 ≈ 96%  (+ Pity 강제 보완 — 단일 런 ≥90s 시 100%)
```

**채널 2 — 첫 3런 누적 lottery (각 런 30s 최단 시나리오)**:
```
P(3런 모두 Critical 없음) = (1 - 0.65)^3 = 0.35^3 ≈ 4.3%
P(첫 3런 안 Critical 1회 이상 목격) ≈ 96% ≥ 90% (PG-04 충족)
```

**전제**: 본 설계는 평균 런 길이 ≥30s 가정. 모든 런이 5s 미만으로 끝나는 극단 시나리오는 PG-04 보장 밖 — m0 §3.2 PG-01 (평균 세션 ≥90s) 충족 시 자동 해소.

> **Pity timer는 단일 런 ≥90s 시 보장 안전망** (런 간 누적 reset). 짧은 런 누적 PG-04는 lottery 채널 단독으로 보장 — Pity 미발동 시나리오에서도 96% 확률.

### 4.3 예시 (Chain combo)

Critical pop at (300, 400), CHAIN_RADIUS=150px → 인근 (200, 500), (400, 350), (350, 480) 3개 chain (거리 정렬 후 cap 3 적중) → combo +4. chainedBalloons 배열 길이 3.

---

## 5. Edge Cases

| ID | 상황 | 동작 |
|----|------|-----|
| E1 | spawn lottery로 Critical 부여 직후 즉시 명중 | Normal flow. `balloon:popped(isCritical: true)` emit → 연쇄팝 정상 |
| E2 | Pity 90s 도달 시 `activeBalloons.length = 0` | pityTimer 유지 (감소 없음). 다음 spawn 시 onBalloonSpawned hook에서 강제 setCritical 분기 (§3.1) |
| E3 | 연쇄 cap (3) 초과 인근 풍선 존재 | 거리 정렬 후 cap 적용. 초과분 무시. 다음 frame부터 normal collision |
| E4 | 동일 frame에 spawn 2개 → 2 lottery 독립 | 각각 `rng.critical.nextBool` 별도 호출. 둘 다 Critical 가능 (확률 1%) |
| E5 | Critical balloon이 분열 자식으로 spawn? | 발생 불가 — balloon-physics-split §3.4 자식 `isCritical = false` 강제 (M-1 lock) |
| E6 | `GameLoop.reset()` 시 pityTimer 누적 보존? | 0으로 reset (런 간 누적 안 함, §3.5) |
| E7 | Critical balloon 화면 가장자리 → CHAIN_RADIUS 안에 인근 0개 | Chain 0. 단일 Critical만 처리. combo +1, `chainedBalloons: []` (빈 배열, null 아님) |
| E8 | Pity 발동 nearest 동률 거리 2개 | `reduce` 순회 첫 발견 1개 선택 (deterministic — `activeBalloons` 순서 = spawn 순서, §3.2) |
| **E9** | **chain 반경 안에 또 다른 Critical balloon이 포함됨** (동시 spawn lottery 둘 다 적중) | **chained로 즉시 제거**. `balloonSystem.removeBalloon(id)` 호출 시 `balloon:popped({ isCritical: false })` 강제 emit (재귀 방지, balloon-physics-split §9 IC lock). 연쇄는 단일 Critical 이벤트당 1회만. chained Critical은 combo +1 (chain count에 포함) |

---

## 6. Dependencies

**Upstream** (listen / hook):
- `balloon-physics-split` — `balloon:popped({ isCritical: true })` listen (연쇄팝 trigger). `isCritical: false`는 listen 후 무시 (재귀 방지)
- `balloon-physics-split.spawn()` 직접 hook — `criticalPop.onBalloonSpawned(balloon)` 호출 (balloon-physics-split §9 IC lock, M0 prototype 단순화. M1 retrofit `balloon:spawned` event listen — balloon-physics-split §6 Bidirectional note 참조)
- `balloon-physics-split.removeBalloon(id)` public removal API — 연쇄팝 chained balloon 제거 호출 (balloon-physics-split §9 IC lock)
- `systems-index §Conventions` — `rng.critical.nextBool(0.10)` (Math.random() 금지)
- `systems-index §Engine Bootstrap` — `app.ticker` (`ticker.deltaMS / 1000`), `GameLoop.reset/start/end`
- `art-bible §1.3` — Critical Pop canonical hex (배경 `#1A3A55 → #2D2855 → #1A1A3A` + Gold `#FFD700`)
- `art-bible §2.1` — S3 Critical Moment darkening 시퀀스 (0.1s in + 0.05s 화이트 플래시 + 복귀; 전체 ≤0.2s)
- `art-bible §4.2` — Critical Gold glow 매핑 (HERO tier: distance 28px, alpha 0.85, outline 2px)

**Downstream** (emit / modify):
- `criticalPop:fired({ x, y, criticalSize, chainedBalloons: [{id, x, y, size, color}, ...] })` → Visual Juice (다크닝 trigger) + Score & Combo (콤보 카운트)
  - `criticalSize`: Critical 본체의 명중 시점 size (Large/Medium/Small). Score & Combo가 본체 점수 계산에 사용 (M-CP-1 lock — score-combo §3.3)
  - `chainedBalloons`는 **항상 배열**, chain 없으면 `[]` (수신자 null guard 불필요)
  - **timing 정보 미포함** — Visual Juice 자체 상수 (`VJ_DARKEN_DURATION = 0.1s`) 사용 (§3.4)
- balloon entity 직접 modify (`balloon.isCritical = true` + `sprite.tint` + `sprite.filters` 교체) — prototype 단순화, balloon-physics-split §3.1 + §6 lock된 인터페이스 계약 따름

> **권한 경계**: 본 시스템은 **Critical 판정·부여·연쇄팝 단독 권한자**. balloon-physics-split는 entity 시뮬레이션·removal만, Score & Combo는 카운트만, Visual Juice는 시각 효과만. 권한 명확 분리. setCritical 호출은 동일 Ticker pass 안에서 완결 — race 불가.

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|-----------|--------|
| `CRITICAL_PROBABILITY` | 0.10 | 0.05–0.20 | spawn 시 Critical lottery 확률. ↑ = 잦은 호재, P3 ↑ |
| `PITY_TIMEOUT` | 90 s | 60–180 | 강제 Critical transmute 발동 시간 (단일 런 ≥90s 시 보장) |
| `CRITICAL_CHAIN_RADIUS` | 150 px | 100–250 | 연쇄팝 탐색 반경. ↑ = 큰 카오스 정리 |
| `CRITICAL_CHAIN_CAP` | 3 | 2–5 | 연쇄팝 최대 풍선 수 (decisions §3 #6 lock — 변경 시 콤보 카운트 영향) |

---

## 8. Acceptance Criteria

| ID | 기준 | 검증 방법 |
|----|------|---------|
| AC.1 | **PG-04 — 첫 3런 안 90% 테스터 Critical 목격** (P3 보장, m0 §3.2). §4.2 lottery + Pity 합성 96% 이론값 | playtest (테스터 ≥5명, `production/qa/evidence/critical-witness-YYYY-MM-DD.md`) |
| AC.2 | `rng.critical.nextBool(0.10)` lottery — 1000 spawn Monte Carlo 통계 시 Critical 비율 10% ± 2% (`σ ≈ 0.0095`, ±2σ ≈ 96% CI) | unit test |
| AC.3 | Pity timer 90s 정확 — 무 Critical 90s 경과 시 즉시 transmute 발동 | unit test (mock ticker) |
| AC.4 | Pity 발동 시 character와 2D 거리 (`distSq`) 최소 active balloon 1개 Critical 부여. 동률 시 `reduce` 순회 첫 발견 (deterministic) | unit test |
| AC.5 | 연쇄팝 cap 3 — CHAIN_RADIUS 안 10개 있어도 정확히 3개만 chain (거리 오름차순 정렬 후 slice) | unit test |
| AC.6 | 연쇄 재귀 없음 — chained의 `balloon:popped(isCritical: false)`를 Critical Pop이 무시 (balloon-physics-split `removeBalloon` 호출 결과) | unit test |
| AC.7 | `criticalPop:fired` payload — `chainedBalloons.length = 실제 chain 수`, 각 element `{id, x, y, size, color}` 포함. **chain 0건 시 빈 배열 `[]` (null 아님)** | unit test |
| AC.8 | rng.critical determinism — 동일 seed 동일 lottery 시퀀스 (페어플레이) | unit test (seeded rng) |
| AC.9 | `GameLoop.reset()` 호출 시 `pityTimer = 0`, `lastCriticalTime = 0` (런 간 누적 안 함) | unit test |
| AC.10 | 화면 다크닝 trigger — `criticalPop:fired` emit 후 Visual Juice가 ColorMatrixFilter 0.1s in + 화이트 플래시 0.05s + 복귀 (Visual Juice GDD 미작성 시 manual smoke test) | integration test (Visual Juice GDD 완성 후 자동화) |
| AC.11 | Critical 부여 시 balloon entity `sprite.tint = 0xFFD700`, `sprite.filters = [SHARED_CRITICAL_GOLD_GLOW]` (HERO tier, art-bible §4.2 매핑) | unit test |
| AC.12 | Pity timer 발동 시 active=0 → 다음 spawn 강제 Critical (E2) | unit test |
| AC.13 | E9 — chain 반경 안 다른 Critical balloon 존재 시 chained로 정상 제거 + 재귀 없음 | unit test |

---

## 9. Implementation Checklist

> M0 prototype 범위. AC → 자동화 테스트 매핑은 Phase D 빌드 인프라 후 채움. M1 retrofit 시 emit/listen 모델 (`balloon:critical:assigned`, `balloon:spawned`)로 전환 — decisions §2.2 + balloon-physics-split §6 Bidirectional note.

### 진입점 + Listener 등록

- `app.init({...})` 완료 → `GameLoop.start()` **직전 1회만**:
  - `balloonSystem.on('balloon:popped', criticalPop.onBalloonPopped)` 등록
  - (`onBalloonSpawned`은 listener 아닌 직접 hook — balloon-physics-split §9 IC에 명시)
- `GameLoop.start()` → `app.ticker.add((t) => criticalPop.update(t.deltaMS / 1000))` 매 frame
- `GameLoop.end()` / `reset()` → `criticalPop.reset()` 호출

### 호출 경로 (구현 시 grep 검증)

- [ ] `CriticalPopSystem.update(dt)` — pityTimer 누적 + 90s 도달 시 transmute (§3.2)
- [ ] `CriticalPopSystem.onBalloonSpawned(balloon)` — lottery + Pity 누적 강제 분기 (§3.1, E2)
- [ ] `CriticalPopSystem.setCritical(balloon)` — entity sprite.tint + sprite.filters 교체 + pityTimer reset
- [ ] `CriticalPopSystem.onBalloonPopped(event)` — `event.isCritical = true` 분기 시 연쇄팝 실행 + `criticalPop:fired` emit
- [ ] `CriticalPopSystem.reset()` — pityTimer = 0, lastCriticalTime = 0
- [ ] `SHARED_CRITICAL_GOLD_GLOW` — GlowFilter 공유 인스턴스 (size 무관 단일, balloon-physics-split §3.1 lock)
- [ ] `CRITICAL_GOLD_HEX = 0xFFD700` (art-bible §1.3 canonical, game-concept.md `#FFC107` superseded)

### AC → 테스트 매핑 (Phase D 후 채움)

| AC | Test Method | 파일 |
|----|-----------|------|
| AC.1 (PG-04 목격) | playtest | `production/qa/evidence/critical-witness-YYYY-MM-DD.md` |
| AC.2 (Lottery 통계) | unit (Monte Carlo 1000회) | `tests/unit/critical-lottery.test.js` |
| AC.3 (Pity 90s) | unit (mock ticker) | `tests/unit/critical-pity.test.js` |
| AC.4 (Nearest 2D + 동률) | unit | `tests/unit/critical-pity.test.js` |
| AC.5 (Chain cap + 거리 정렬) | unit | `tests/unit/critical-chain.test.js` |
| AC.6 (재귀 방지) | unit | `tests/unit/critical-chain.test.js` |
| AC.7 (Payload + 빈 배열) | unit | `tests/unit/critical-event.test.js` |
| AC.8 (Determinism) | unit (seeded rng) | `tests/unit/critical-determinism.test.js` |
| AC.9 (Reset) | unit | `tests/unit/gameloop-reset.test.js` |
| AC.10 (Visual Juice integration) | integration (Visual Juice GDD 완성 후) — M0는 manual smoke | `tests/integration/critical-darken.test.js` |
| AC.11 (Visual entity 매핑) | unit | `tests/unit/critical-visual.test.js` |
| AC.12 (E2 active=0) | unit | `tests/unit/critical-pity.test.js` |
| AC.13 (E9 chained Critical) | unit | `tests/unit/critical-chain.test.js` |

### 빌드 검증

- [ ] `npm run build` exit 0 (GATE-01)
- [ ] PG-04 실측 (테스터 ≥5명, 첫 3런 안 90% Critical 목격)
- [ ] M0 빌드 후 Visual Juice GDD 작성 시 AC.10 자동화 보강
