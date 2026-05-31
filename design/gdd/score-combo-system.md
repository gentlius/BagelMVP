# Score & Combo System

> **Status**: Draft (M0 prototype 1-pager, post-review v1.1)
> **Author**: joywoni + Claude
> **Last Updated**: 2026-05-30 (정밀 리뷰 14건 반영 — BLOCKING 1 + MAJOR 5 + MINOR 7 + 신규 AC.17 + 양방향 lock 2건)
> **Implements Pillar**: P2 (화면이 점수보다 먼저 말한다) — Visual Juice listener 선등록으로 시각 응답 우선 보장 / P3 (운은 자주, 실력은 깊게) — Critical × Combo 시너지
> **Engine target**: Pixi.js v8
> **Scope note**: M0 prototype 범위 1-pager. 9섹션 헤더 유지하되 본문 압축. M1 PROCEED 후 정식 GDD 승격.

---

## 1. Overview

Score & Combo System은 POP!의 **콤보·점수 단일 권한자**다. 모든 pop 이벤트를 listen하여 콤보를 누적하고, 점수 수식을 적용하여 `score:updated` emit한다. 5콤보 마일스톤 도달 시 `combo:milestone` emit (Visual Juice 글로우 피크 trigger). Critical × Combo 카운트 규칙은 decisions §3 #6 lock 그대로 구현.

**책임 3건**:
- (a) **콤보 누적·리셋** — 매 pop +1, `COMBO_RESET_SEC` 무 pop 시 0 reset
- (b) **점수 계산·emit** — multiplicative 수식 (`BASE × SIZE × COMBO_MULT`), **각 풍선마다 개별 emit**
- (c) **5콤보 마일스톤** — combo == 5 도달 시 emit (Visual Juice 5콤보 글로우 ring trigger)

`rng` 미사용 (deterministic 수식). Power-up 시스템은 M1 진입 시 도입 — 본 시스템은 콤보·점수를 read-only로 노출 (`getCombo()`, `getTotalScore()`).

> **P2 lock**: `GameLoop.start()` 시 listener 등록 순서 = **Visual Juice 먼저, Score & Combo 그 다음**. Pixi v8 EventEmitter는 등록 순서대로 동기 발화 → 시각 응답이 점수 emit보다 먼저 실행됨. §6 권한 경계 참조.

---

## 2. Player Fantasy

**감정 목표**: 누적 카운트가 시각·청각 강도와 동기되어 "지금 흐름이 좋다"는 인지가 손가락보다 먼저 도착한다 — "한 번 더" 패턴의 핵심.

플레이어가 연속으로 풍선을 터뜨릴수록 콤보 숫자가 올라가고, 점수가 multiplier 배수로 폭발한다. 5콤보 도달 순간 캐릭터 주변에 글로우 ring이 발현되며 "지금이다" 인지 → 더 많은 풍선을 정밀하게 노린다 → 더 큰 콤보 → 더 큰 보상. Critical pop과 chain은 1 이벤트로 최대 +4 콤보를 한 번에 안긴다 (P3 약속). 3초 무 pop 시 리셋되는 압박이 카오스 펌프를 유지.

---

## 3. Detailed Rules

### 3.1 Combo State Machine

```
state: { combo: number (default 0), comboTimer: number (default 0), totalScore: number (default 0), previousMilestone: number (default 0) }

매 frame (update(dt)):
  this._chainedIdsToIgnore.clear()   // §3.2 frame-guard reset — 매 frame 시작 시
  if combo > 0:
    comboTimer += dt   // dt = ticker.deltaMS / 1000
    if comboTimer >= COMBO_RESET_SEC:
      const finalCombo = combo
      combo = 0
      comboTimer = 0
      emit `combo:reset({ finalCombo })` (Visual Juice 페이드 효과 — 선택 listener, M0 Visual Juice GDD 미작성 시 0 listener 무동작)

pop 이벤트 수신 시 (criticalPop:fired 또는 balloon:popped):
  combo += deltaCombo (§3.2 매트릭스)
  comboTimer = 0   // pop 발생 시 combo 값 무관 항상 0으로 reset (E5 정합 — combo 0→1 첫 pop도 reset)
  emit `score:updated` (§3.3 — 풍선마다 개별)
  if combo crossed MILESTONE_COMBO (5): emit `combo:milestone` (§3.4)
```

### 3.2 이벤트 listen 매트릭스 (Critical × Combo 카운트, decisions §3 #6 lock)

**Frame-guard (ID 기반 — M-SC-1 lock 활용)**:
```js
// state
this._chainedIdsToIgnore = new Set()    // 매 frame update(dt) 첫 줄에서 clear

// criticalPop:fired 처리 시
onCriticalPopFired(event) {
  this._chainedIdsToIgnore = new Set(event.chainedBalloons.map(b => b.id))
  // 이후 본체 + chained 합산 처리 (§3.3)
}

// balloon:popped 처리 시
onBalloonPopped(event) {
  if (this._chainedIdsToIgnore.has(event.id)) return   // chained 이벤트 무시 (M-SC-1 id 사용)
  // 정상 처리 (§3.3)
}
```

| 이벤트 | Source | 처리 | deltaCombo |
|--------|--------|------|-----------|
| `criticalPop:fired` | critical-pop | 본체 + chained 합산 점수 계산. `_chainedIdsToIgnore` Set 갱신 (frame-guard ON) | **1 + min(chainedBalloons.length, 3)** (cap +4) |
| `balloon:popped({ isCritical: true })` | balloon-physics-split (Critical 풍선 명중) | 무시 — Critical 이벤트는 `criticalPop:fired` 단일 채널 (중복 카운트 방지) | 0 |
| `balloon:popped({ id ∈ _chainedIdsToIgnore })` | balloon-physics-split (removeBalloon 호출 결과 — chained) | ID 일치로 frame-guard 무시 (E9 정밀 식별) | 0 |
| `balloon:popped({ isCritical: false, id ∉ _chainedIdsToIgnore })` | balloon-physics-split (일반 작살 pop) | 정상 처리 | +1 |

> **ID 기반 식별의 정확성 (E9 해소)**: M-SC-1 lock으로 `balloon:popped` payload에 `id` 필드 추가. Critical chain 동일 frame 안 일반 pop과 chained pop을 ID로 정확히 구별 → 일반 pop 누락 0건.

### 3.3 점수 emit 패턴 (각 풍선마다 개별)

```js
// 일반 pop
onBalloonPopped(event) {
  if (this._chainedIdsToIgnore.has(event.id)) return
  if (event.isCritical) return            // Critical은 criticalPop:fired 단일 채널

  combo += 1
  comboTimer = 0
  const delta = computeScore(event.size, combo)   // BASE × SIZE × multiplier
  totalScore += delta
  emit `score:updated`, { totalScore, delta, combo, size: event.size, x: event.x, y: event.y, sizeMultiplier: SIZE_MULTIPLIER[event.size], comboMultiplier: comboMultiplier(combo) }
  checkMilestone(combo - 1, combo)
}

// Critical event (본체 + chained 순차 emit)
onCriticalPopFired(event) {
  this._chainedIdsToIgnore = new Set(event.chainedBalloons.map(b => b.id))

  // 1. Critical 본체 처리 — criticalSize 사용 (M-CP-1 lock)
  combo += 1
  comboTimer = 0
  const bodyDelta = computeScore(event.criticalSize, combo)
  totalScore += bodyDelta
  emit `score:updated`, { totalScore, delta: bodyDelta, combo, size: event.criticalSize, x: event.x, y: event.y, sizeMultiplier: SIZE_MULTIPLIER[event.criticalSize], comboMultiplier: comboMultiplier(combo) }
  const prevCombo = combo

  // 2. Chained 풍선 순차 처리 (cap 3 이미 적용됨)
  for (const chained of event.chainedBalloons) {
    combo += 1
    const chainDelta = computeScore(chained.size, combo)
    totalScore += chainDelta
    emit `score:updated`, { totalScore, delta: chainDelta, combo, size: chained.size, x: chained.x, y: chained.y, sizeMultiplier: SIZE_MULTIPLIER[chained.size], comboMultiplier: comboMultiplier(combo) }
  }

  checkMilestone(prevCombo - 1, combo)  // 본체 처리 전 combo부터 최종 combo까지 5 cross 검사
}
```

- **각 풍선마다 개별 `score:updated` emit** — Visual Juice가 각 풍선 위치(x, y)에서 Score popup float (art-bible §2.1 S2)
- `score:updated` payload에 `x, y` 포함 → Visual Juice popup 위치 직접 사용 (별도 `balloon:popped` listen 불필요)

### 3.4 5콤보 마일스톤

```js
checkMilestone(prevCombo, newCombo) {
  if (prevCombo < MILESTONE_COMBO && newCombo >= MILESTONE_COMBO) {
    emit `combo:milestone`, { tier: MILESTONE_COMBO, combo: newCombo }
    previousMilestone = MILESTONE_COMBO
  }
}
```

- 동일 streak 안에서 5 → 6, 7, ... 추가 증가 시 재emit 안 함 (`prevCombo >= 5`이므로 조건 false)
- combo 0 reset 후 다시 5 도달 시 재emit (새 streak — `previousMilestone`은 reset에서 0으로 복귀)
- M0 단계 마일스톤 1개 (5). M1에서 10/20 검토 — `checkMilestone`을 for 루프 구조로 retrofit 가능

### 3.5 GameLoop Contract + Read-only API

```js
// GameLoop hooks
reset() {
  combo = 0; comboTimer = 0; totalScore = 0; previousMilestone = 0
  this._chainedIdsToIgnore.clear()
}
start() { app.ticker.add(update); /* listener 등록은 GameLoop.start() 직전 1회만 — §9 IC */ }
end()   { app.ticker.remove(update) /* 상태 freeze */ }

// Read-only API (Power-up M1 + RETRY UX)
getCombo() { return combo }                       // M0 미사용이지만 stub 구현 — M1 Power-up read-only
getTotalScore() { return totalScore }             // M0 구현 — Game Over RETRY UX read-only 참조 (§6)
```

---

## 4. Formulas

### 4.1 점수 수식

```
delta = BASE_SCORE × SIZE_MULTIPLIER[size] × comboMultiplier(combo)
totalScore += delta

comboMultiplier(N) = 1 + (N - 1) × COMBO_MULTIPLIER_FACTOR
                   = 1 + (N - 1) × 0.1     (combo ≥ 1 전제 — combo 0 상태는 pop 처리 *전*이므로 multiplier 계산 안 함)

SIZE_MULTIPLIER = { Large: 1.0, Medium: 1.5, Small: 2.0 }
BASE_SCORE = 10
```

`comboMultiplier(1) = 1.0` (E5 첫 pop), `comboMultiplier(5) = 1.4`, `comboMultiplier(10) = 1.9`, `comboMultiplier(50) = 5.9`.

### 4.2 예시 계산

| 상황 | 식 | delta |
|------|-----|-------|
| Large 일반 1콤보 | 10 × 1.0 × 1.0 | 10 |
| Medium 일반 5콤보 | 10 × 1.5 × 1.4 | 21 |
| Small 일반 10콤보 | 10 × 2.0 × 1.9 | 38 |
| Large Critical 단독 (chain 0, combo 0 → 1) | 본체: 10 × 1.0 × 1.0 = **10** | 10 (combo +1) |
| Critical 본체 + 3 chained (combo 5 → 9, criticalSize=Large, chained all Medium) | 본체(combo 5→6, mult 1.5): 10×1.0×1.5=**15**. chained 1(6→7, mult 1.6): 10×1.5×1.6=**24**. chained 2(7→8, mult 1.7): 10×1.5×1.7=**25.5**. chained 3(8→9, mult 1.8): 10×1.5×1.8=**27**. **합 91.5** | **4 emit, 총 +91.5 누적** |

> **콤보 처리 순서 (Critical chain)**: critical-pop이 단일 `criticalPop:fired` emit. Score & Combo는 (1) `event.criticalSize` 본체부터 처리 (combo +1, multiplier 적용) (2) `chainedBalloons` 각 element 순차 처리 (combo +1씩, multiplier 적용). 최종 combo = (시작) + 1 + chain count. **각 단계마다 별도 `score:updated` emit** (§3.3).

### 4.3 5콤보 trigger 조건

```
이전 combo: P (Critical event는 본체 처리 *전* combo)
새 combo:   N (모든 처리 *후* combo)
trigger 조건: P < 5 AND N >= 5
```

예: P=3, deltaCombo=+4 (Critical with chain 3) → N=7 ≥ 5 → emit (1회만). 이후 N=8, 9, ... 재emit 안 함.

---

## 5. Edge Cases

| ID | 상황 | 동작 |
|----|------|-----|
| E1 | 동일 frame 2 풍선 pop (cap 30 풀가동) | 이벤트 큐 순서대로 sequential 처리. combo +1 + +1 = +2. 각 별도 score 계산·emit |
| E2 | `criticalPop:fired` + 같은 frame 안 chained `balloon:popped({ isCritical: false })` | frame-guard로 `id ∈ _chainedIdsToIgnore` 무시 (§3.2). 단일 `criticalPop:fired` 처리로 모든 chain 카운트 완결 |
| E3 | COMBO_RESET_SEC 3s 카운트다운 중 `GameLoop.reset()` (RETRY) | reset() 시 combo = 0, comboTimer = 0, totalScore = 0, previousMilestone = 0. `_chainedIdsToIgnore.clear()`. 이전 streak 종료 emit 없음 |
| E4 | totalScore overflow | JS Number.MAX_SAFE_INTEGER = 2^53-1 ≈ 9×10^15. 1런 1–3분 + max combo 100+ + 30 active 가정 시 도달 불가. 검증 필요 0 |
| E5 | combo 0 상태 첫 pop | combo: 0 → 1. `comboTimer = 0` reset (combo 값 무관 항상 reset, §3.1). `comboMultiplier(1) = 1.0`. delta = BASE × SIZE × 1.0 |
| E6 | 작살이 어떤 풍선에도 안 맞고 화면 위로 (miss) | pop event 미발생. combo 영향 0. comboTimer 계속 누적 (3s 도달 시 리셋) |
| E7 | 5콤보 도달 후 동일 streak 안에서 10, 15 콤보 | 5 마일스톤만 emit 1회. 10·20 마일스톤은 M1 추가 검토 |
| E8 | `criticalPop:fired` payload에 `chainedBalloons: []` (chain 0) | combo +1 (Critical 본체만, `criticalSize` 사용). `_chainedIdsToIgnore` empty Set. 본체 score emit 1회. 5콤보 trigger 검사 정상 |
| E9 | 동일 frame `criticalPop:fired` + 일반 pop (다른 위치, 비-chained) | M-SC-1 lock으로 `balloon:popped.id`가 `_chainedIdsToIgnore`에 없음 → 정상 처리 (+1 combo, score emit). chained는 ID 일치로 무시. **누락 risk 0** |
| E10 | `criticalPop:fired.criticalSize` 미수신 (M-CP-1 미반영 — 방어적 가정) | `event.criticalSize ?? 'Large'` 기본값 사용 (AC.14 graceful degradation) |

---

## 6. Dependencies

**Upstream** (listen):
- `balloon-physics-split` — `balloon:popped({ id, size, x, y, color, isCritical })` listen. **`id` 필드 M-SC-1 lock 적용됨 (balloon-physics-split §3.1 + §6)**
- `critical-pop` — `criticalPop:fired({ x, y, criticalSize, chainedBalloons: [{id, x, y, size, color}, ...] })` listen. **`criticalSize` 필드 M-CP-1 lock 적용됨 (critical-pop §3.3 + §6)**
- `systems-index §Engine Bootstrap` — `app.ticker` (`ticker.deltaMS / 1000`), `GameLoop.reset/start/end`

**Downstream** (emit):
- `score:updated({ totalScore, delta, combo, size, x, y, sizeMultiplier, comboMultiplier })` → UI (점수 표시), Visual Juice (Score popup float at `{x, y}` — art-bible §2.1 S2)
  - **각 풍선마다 개별 emit** (단일 합산 아님). Critical event 시 본체 + chained 각각 emit
  - **UI 성능 안전망**: UI는 동일 frame 내 복수 `score:updated` 중 최신 `totalScore`만 display update (Pixi Text re-render 최소화). M0 prototype 권장 패턴
- `combo:milestone({ tier: 5, combo })` → Visual Juice (5콤보 글로우 ring — art-bible §4.2 HERO tier 변형)
- `combo:reset({ finalCombo })` → Visual Juice (선택 — M0 Visual Juice GDD 미작성 시 0 listener, JS EventEmitter는 silent 무시)

**Read-only API** (Power-up M1 + RETRY UX):
- `getCombo()` — read-only combo 값. M0 stub 구현 (`return this.combo`). M1 Power-up Drop System 사용
- `getTotalScore()` — read-only totalScore. M0 Game Over RETRY UX 사용 (final score 표시)

> **권한 경계 (P2 lock)**: `GameLoop.start()` 시 listener 등록 순서 = **Visual Juice 먼저, Score & Combo 그 다음** (P2 "화면이 점수보다 먼저 말한다" 기술적 구현). Pixi v8 EventEmitter는 등록 순서대로 동기 발화 → Visual Juice 시각 응답이 score 계산보다 먼저. 본 시스템은 **콤보·점수 단일 권한자** — balloon-physics-split는 entity 시뮬·removal만, critical-pop은 Critical 판정·연쇄팝만, Visual Juice는 시각만.

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|-----------|--------|
| `BASE_SCORE` | 10 | 5–50 | 모든 점수의 베이스. 큰 수일수록 player 인지 보상 ↑ |
| `SIZE_MULTIPLIER.Large` | 1.0 | 1.0 | (anchor) Large balloon 점수 배수 |
| `SIZE_MULTIPLIER.Medium` | 1.5 | 1.2–2.0 | Medium balloon 보상 — Large 대비 ↑ (작은 타겟 정밀 보상) |
| `SIZE_MULTIPLIER.Small` | 2.0 | 1.5–3.0 | Small balloon 보상 — 가장 작은 타겟, 가장 큰 배수 |
| `COMBO_MULTIPLIER_FACTOR` | 0.1 | 0.05–0.20 | 콤보 1당 multiplier 증가량. ↑ = combo 누적 보상 ↑ (인플레이션 risk) |
| `COMBO_RESET_SEC` | 3.0 s | 2.0–5.0 | 무 pop 시 콤보 리셋. ↓ = 빠른 카오스 펌프 / ↑ = 관대 |
| `MILESTONE_COMBO` | 5 | 3–10 | 첫 마일스톤 콤보. ↓ = 빠른 시각 보상 / ↑ = 더 어려운 도전 |
| `CRITICAL_COMBO_CAP` | 3 | 2–5 | Critical chain combo cap (decisions §3 #6 lock — critical-pop §7 `CRITICAL_CHAIN_CAP`와 정합 유지 필수 — AC.17) |

---

## 8. Acceptance Criteria

| ID | 기준 | 검증 방법 |
|----|------|---------|
| AC.1 | 일반 풍선 pop → combo +1, score = BASE × SIZE × multiplier(combo) emit | unit test |
| AC.2 | Critical event (chain 0) → combo +1, score (Critical 본체, criticalSize 사용) emit | unit test |
| AC.3 | Critical event (chain 3) → combo +4 (1 + 3 cap), **본체 + 3 chained 각 별도 score 4회 emit**. 예: 시작 combo 5, criticalSize=Large, chained all Medium → 본체 10×1.0×1.5=15, chained 24+25.5+27=76.5, 합 91.5 (4 emit) | unit test (수치 정확 검증) |
| AC.4 | Critical event (chain 5 이론적) → combo +4 (cap), score 본체 + 3 chained만 (critical-pop §7 cap) | unit test |
| AC.5 | 동일 frame `criticalPop:fired` + chained `balloon:popped(id)` → **ID 기반 frame-guard로 chained 무시** (`_chainedIdsToIgnore.has(event.id)`). M-SC-1 lock 검증 | unit test (ID Set + balloon ID sequence mock) |
| AC.6 | `COMBO_RESET_SEC` 3s 무 pop → combo 0 reset + `combo:reset` emit (finalCombo 보존) | unit test (mock ticker) |
| AC.7 | combo 0 → 1 첫 pop → combo:milestone emit 안 함 (tier 5 미도달) | unit test |
| AC.8 | combo 4 → 5 도달 (일반 pop +1) → `combo:milestone({ tier: 5 })` emit 1회 | unit test |
| AC.9 | combo 3 → 7 점프 (Critical chain 3) → `combo:milestone({ tier: 5 })` emit 1회 (재emit 없음) | unit test |
| AC.10 | combo 5 streak 안 6, 7, 8 도달 → 마일스톤 재emit 안 함 | unit test |
| AC.11 | combo 0 reset 후 다시 5 도달 → 마일스톤 재emit (새 streak) | unit test |
| AC.12 | `GameLoop.reset()` 호출 시 combo=0, comboTimer=0, totalScore=0, previousMilestone=0, `_chainedIdsToIgnore.clear()` | unit test |
| AC.13 | score 수식 deterministic — 동일 이벤트 시퀀스 동일 결과 (rng 미사용) | unit test |
| AC.14 | `criticalPop:fired.criticalSize` 미수신 시 (M-CP-1 미반영 방어) graceful degradation: `?? 'Large'` 기본값 (Critical 본체 size = Large 가정) | unit test (defensive) |
| AC.15 | `score:updated` payload 정확 — `{ totalScore, delta, combo, size, x, y, sizeMultiplier, comboMultiplier }` 8필드 모두 포함. **각 풍선마다 개별 emit** | unit test |
| AC.16 | UI 점수 표시 정확 — `score:updated.totalScore` 그대로 표시 (포맷팅은 UI 책임). **동일 frame 복수 emit 시 UI는 최신 totalScore만 display update** | integration test (Visual Juice GDD 완성 후 자동화 — M0는 manual smoke) |
| AC.17 | `CRITICAL_COMBO_CAP === critical-pop CRITICAL_CHAIN_CAP` 값 일치 검증 (단일 소스는 M1 `assets/data/balance.json` retrofit) | unit test (assert 단언) |
| AC.18 | `getCombo()` / `getTotalScore()` read-only API 정확 반환 | unit test |

---

## 9. Implementation Checklist

> M0 prototype 범위. AC → 자동화 테스트 매핑은 Phase D 후 채움. M1 retrofit: 10/20 마일스톤 + Power-up read-only 콤보 + balance.json 단일 소스.

### 진입점 + Listener 등록 (P2 순서 lock)

- `app.init({...})` 완료 → `GameLoop.start()` **직전 1회만, 순서 lock**:
  1. **Visual Juice listener 먼저 등록** (`visualJuice.attachListeners(balloonSystem, criticalPopSystem)`) — P2 "화면이 점수보다 먼저 말한다"
  2. **Score & Combo listener 그 다음 등록**:
     - `balloonSystem.on('balloon:popped', scoreCombo.onBalloonPopped)`
     - `criticalPopSystem.on('criticalPop:fired', scoreCombo.onCriticalPopFired)`
- `GameLoop.start()` → `app.ticker.add((t) => scoreCombo.update(t.deltaMS / 1000))` 매 frame
- `GameLoop.reset()` → `scoreCombo.reset()`

> M1 retrofit 주의: M0 `checkMilestone(prev, new)` 단순 crossing 검사. M1에서 10/20 마일스톤 추가 시 for 루프 구조 필요 (한 번에 두 마일스톤 cross 가능, 예: 4 → 11).

### 호출 경로 (구현 시 grep 검증)

- [ ] `ScoreComboSystem.update(dt)` — **첫 줄: `this._chainedIdsToIgnore.clear()`** (frame-guard reset). comboTimer 누적 + COMBO_RESET_SEC 도달 시 reset + `combo:reset` emit
- [ ] `ScoreComboSystem.onBalloonPopped(event)` — `_chainedIdsToIgnore.has(event.id)` 체크 → isCritical=true 시 무시 → 정상 combo +1 + score emit (event.x, event.y 포함)
- [ ] `ScoreComboSystem.onCriticalPopFired(event)` — `_chainedIdsToIgnore` Set 갱신 (`event.chainedBalloons.map(b => b.id)`) + 본체 처리 (`event.criticalSize ?? 'Large'`) + chained 순차 처리 + 각각 `score:updated` emit (event.x, event.y 또는 chained.x, chained.y)
- [ ] `ScoreComboSystem.computeScore(size, combo)` — `BASE_SCORE × SIZE_MULTIPLIER[size] × comboMultiplier(combo)`. combo ≥ 1 전제
- [ ] `ScoreComboSystem.checkMilestone(prevCombo, newCombo)` — 5 crossing 검사 (`prevCombo < 5 && newCombo >= 5`) + 1회만 emit + `previousMilestone = 5` set
- [ ] `ScoreComboSystem.reset()` — 전 상태 0 + `_chainedIdsToIgnore.clear()`
- [ ] `ScoreComboSystem.getCombo()` — read-only API (M0 stub, M1 Power-up 사용)
- [ ] `ScoreComboSystem.getTotalScore()` — read-only API (M0 Game Over RETRY UX 사용)

### AC → 테스트 매핑 (Phase D 후 채움)

| AC | Test Method |
|----|-------------|
| AC.1–4 (점수·콤보 계산 + Critical chain) | unit |
| AC.5 (frame-guard ID Set) | unit (mock event sequence with IDs) |
| AC.6 (Combo reset 3s) | unit (mock ticker) |
| AC.7–11 (마일스톤) | unit |
| AC.12 (GameLoop reset) | unit |
| AC.13 (Determinism) | unit |
| AC.14 (Defensive criticalSize) | unit |
| AC.15 (Payload 정확 — 8필드) | unit |
| AC.16 (UI 표시 + 최신 totalScore) | integration (Visual Juice GDD 완성 후 자동화) — M0는 manual smoke |
| AC.17 (CRITICAL_COMBO_CAP 동기화) | unit (assert) |
| AC.18 (Read-only API) | unit |

### 빌드 검증

- [ ] `npm run build` exit 0 (GATE-01)
- [ ] balloon-physics-split + critical-pop M-SC-1 / M-CP-1 lock 보강 commit 완료 확인 (score-combo commit과 동시)
- [ ] M0 빌드 후 Visual Juice GDD 작성 시 AC.16 자동화 보강
