# Balloon Physics & Split System

> **Status**: Draft (M0 prototype 1-pager, post-review v1.1)
> **Author**: joywoni + Claude
> **Last Updated**: 2026-05-30 (정밀 리뷰 13건 반영)
> **Implements Pillar**: P2 (화면이 점수보다 먼저 말한다) + P3 (운은 자주 실력은 깊게)
> **Engine target**: Pixi.js v8
> **Scope note**: M0 prototype 범위 1-pager. character + harpoon entity 흡수, difficulty-spawn 인라인 (decisions §2.2). 9섹션 헤더 유지하되 본문 압축. M1 PROCEED 후 정식 GDD 승격 (m1-pre-production.md §retrofit).

---

## 1. Overview

본 시스템은 POP!의 **병목**이다 — Critical Pop / Score & Combo / Visual Juice 3개 시스템이 모두 본 시스템의 이벤트에 의존한다. character entity, harpoon entity, 풍선 시뮬레이션 (낙하·바운스·분열·종단), 시간비례 spawn 곡선을 단일 시스템으로 흡수한다 (decisions §2.2). Input System으로부터 fire/drag 이벤트를 listen하고, 하방 시스템에 `balloon:split` / `balloon:popped` / `game:over` 이벤트를 emit한다.

R4 risk (다중 풍선 + 충돌 + 분열 = 가장 무거운 시뮬레이션) 대상. 성능 budget (`BALLOON_MAX_ACTIVE` cap, 단순 원-원 충돌, GlowFilter 공유 인스턴스) 명시.

> **단위 컨벤션**: 모든 px 수치는 **1080p 논리 픽셀** (CSS pixel) 기준. Pixi `autoDensity: true` + `resolution: window.devicePixelRatio`로 DPR 자동 변환 (systems-index §Engine Bootstrap).

---

## 2. Player Fantasy

**감정 목표**: "혼돈을 통제하고, 더 큰 혼돈으로 보답받는다 — 분열의 황홀경" (game-concept.md §Core Fantasy)

플레이어는 화면 아래에서 캐릭터를 끌고 다니다가 정확한 위치에서 더블탭한다. 작살이 위로 날아가 풍선을 맞추는 순간, 풍선은 둘로 갈라지면서 좌우로 위로 한 번 튕긴다 — Pang 원작의 시그니처 분열감이다. Large→Medium→Small 3단계가 한 발에서 시작된 카오스를 키우고, 정밀한 한 발이 그 카오스를 정리한다. **단 한 번 풍선이 캐릭터에 닿으면 끝**이라는 긴장이 위로 쏘는 모든 결정에 무게를 부여한다.

---

## 3. Detailed Rules

### 3.1 Entities

| Entity | Container | Anchor | Max Active | 주요 상태 |
|--------|-----------|--------|-----------|---------|
| `character` | `balloonContainer` (zIndex 5) | **(0.5, 1.0) bottom-center** → `character.y` = **발 위치** | 1 (영구) | `x`, `y` (=발), `width`, `height` (참고용); 충돌은 `CHARACTER_HITBOX_RADIUS` 사용 |
| `harpoon` | `harpoonContainer` | (0.5, 0.5) center | **1** (정책) | `x`, `y` (center), `vy` = `-HARPOON_SPEED` |
| `balloon` | `balloonContainer` (zIndex 0–4) | (0.5, 0.5) center | **`BALLOON_MAX_ACTIVE` (30)** | **Sprite** entity. `id` (unique, spawn 시 monotonic 증가), `x`, `y` (center), `vx`, `vy`, `size`∈{Large, Medium, Small}, `color`, `isCritical`, `sprite.tint` (color 반영), `sprite.filters` (공유 GlowFilter 1개 참조) |

**필수 설정**:
- `balloonContainer.sortableChildren = true` (character zIndex 5 작동 필수 — Pixi v8 default = false)
- balloon 머티리얼: **art-bible §1.2 Layered Translucency** 4층 (`balloon glass body` 층) — **Pixi Sprite + `sprite.tint` (color) + `sprite.filters` (GlowFilter) 조합으로 구현**. Graphics 재드로우 패턴 사용 금지 (성능)
- **GlowFilter 인스턴스 = 사이즈별 공유 4종** (Large / Medium / Small / Critical Gold). 풍선마다 새 인스턴스 생성 금지 — `BALLOON_MAX_ACTIVE`(30) 동시 시 draw call 누적·GATE-04 미달 방지 (`pixi-filters` v6.x; art-bible §4.7)
- **Critical Gold = size 무관 단일 공유 인스턴스** (Critical 풍선은 항상 Large spawn 후 transmute이므로 1개로 충분 — critical-pop §3.1)
- **Critical 부여 시 (Critical Pop System 권한, critical-pop §3.1)**: balloon entity에 `sprite.tint = CRITICAL_GOLD_HEX (0xFFD700)` + `sprite.filters = [SHARED_CRITICAL_GOLD_GLOW]` 직접 교체

> art-bible §6.3 (decisions §2.2 옵션 A): character는 balloonContainer 내 zIndex로 처리, ambient effects 별도 컨테이너는 M1 재검토.

### 3.2 Spawn 규칙

- **위치**: `x = rng.spawn.nextInt(SPAWN_MARGIN, screen.width - SPAWN_MARGIN)`, `y = SPAWN_Y_TOP` (화면 상단 위 음수)
- **사이즈**: 항상 `Large`로 spawn (작은 풍선은 분열로만 생성)
- **컬러**: `BALLOON_PALETTE_6[rng.spawn.nextInt(0, 5)]` — Critical Gold 제외 (Critical Pop System이 별도 emit)
  > §Conventions `rng.spawn`은 `next` / `nextInt` 만 정의 (nextChoice 없음 — powerup 도메인에만 존재). 인덱스 접근 사용.
- **초기 velocity**: `vx = rng.spawn.nextInt(-150, 150)` px/s, `vy = 0`
- **타이밍**: §3.8.1 Ticker 누적 패턴 (setTimeout 금지 — §Conventions)

### 3.3 Motion (매 frame)

> **`dt` 단위 변환 필수**: Pixi v8 Ticker에서 `ticker.deltaMS / 1000`로 초 단위 변환. GRAVITY·SPLIT_VEL은 모두 초 단위 가정. `ticker.deltaTime` (frame 단위) 사용 금지.

```js
app.ticker.add((ticker) => {
  const dt = ticker.deltaMS / 1000;   // 초 단위 변환
  balloonSystem.update(dt);
});
```

```
vy += GRAVITY * dt
x  += vx * dt
y  += vy * dt
```

- 화면 X 가장자리 (`x < 0` or `x > screen.width`): `vx = -vx` (탄성 반사)
- 화면 하단 (`y > FLOOR_Y`): `vy = -|vy| * BOUNCE_RESTITUTION`, `y` clamp
  - **`FLOOR_Y = character.y`** — anchor bottom-center 이므로 `character.y` 자체가 발 위치. 풍선이 캐릭터 발 아래로 절대 못 감.
- 화면 상단 통과는 허용 (분열 직후 잠시 화면 밖 가능, 자연 복귀)

> **시각 효과 책임 경계 (M-3)**: art-bible §3.3의 "squash & stretch ±5%" + "floating 6s 주기"는 **Visual Juice System 책임**. 본 GDD 물리(GRAVITY + BOUNCE_RESTITUTION + 화면 가장자리 반사)가 canonical 운동. Visual Juice는 본 시스템의 위치를 read-only로 수신하여 시각 효과만 발현.

### 3.4 Split 규칙 (작살 명중 시)

| 명중 풍선 종류 | 결과 |
|----------|------|
| Large (일반) | Medium × 2 생성 (parent 위치, 좌·우, 위로 튐) |
| Medium (일반) | Small × 2 생성 (동일 패턴) |
| Small (일반) | 즉시 제거 (분열 없음, 종단) |
| **Critical Gold (모든 사이즈)** | **즉시 제거 (분열 없음).** Critical Pop System이 `balloon:popped({ isCritical: true })` listen하여 연쇄팝 trigger (critical-pop-system.md §3.3) |

자식 풍선 (일반 분열 시) 초기 velocity:
- 좌 자식: `vx = -SPLIT_VEL_X`, `vy = -SPLIT_VEL_Y`
- 우 자식: `vx = +SPLIT_VEL_X`, `vy = -SPLIT_VEL_Y`
- 컬러: parent 컬러 상속
- **자식의 `isCritical = false` 강제** (M-1 결정) — 분열 자식은 항상 일반 풍선. Critical 판정 권한은 Critical Pop System 독점

명중 시 emit: `balloon:popped({ id: parent.id, size: parent.size, x: parent.x, y: parent.y, color: parent.color, isCritical: parent.isCritical })` — parent entity 상태 그대로 reflect. **`id` 필드는 Score & Combo의 frame-guard ID 기반 식별에 사용 (score-combo §3.2 M-SC-1 lock)**.

### 3.5 Harpoon Entity

- `input:fire` 수신 시: active harpoon 없으면 1개 spawn (`x = character.x`, `y = character.y - HARPOON_SPAWN_OFFSET_Y`, `vy = -HARPOON_SPEED`). 있으면 무시
  - `character.y`는 발 위치 (anchor bottom-center). `HARPOON_SPAWN_OFFSET_Y`는 발 → launcher 끝(머리 위) 수직 거리
- 매 frame: `y += vy * dt` (수평 이동 없음)
- 화면 상단 도달 (`y < 0`): 제거
- 풍선과 충돌: 풍선 split + 자기 제거

### 3.6 Character Entity

- `input:dragMove({x, y})` 수신 시: `character.x = clamp(x, character.width/2, screen.width - character.width/2)`. `y`는 변경 안 함 (발 위치 고정)
- `input:dragStart`, `input:dragEnd`, `input:dragCancel`: 위치 변경 없음 (prototype 단순화 — 관성·smoothing은 M1)

### 3.7 Game Over

- 풍선 ↔ character 충돌: **원-원 거리 비교** (§3.9 충돌 모델 통일)
  ```
  dx = balloon.x - character.x
  dy = balloon.y - character.y       // character.y = 발 위치
  if (dx*dx + dy*dy) < (balloon.radius + CHARACTER_HITBOX_RADIUS)²: game over
  ```
- `CHARACTER_HITBOX_RADIUS`는 의도적 hitbox 크기 (실 체형 캡슐형 ↔ 원 근사의 상하/좌우 비대칭 오차 인정). §7 Tuning Knob
- 조건 충족 → emit `game:over`, GameLoop.end() 호출
- 1-hit kill (HP 없음)

### 3.8 GameLoop Contract (systems-index §Engine Bootstrap)

- `reset()`: 전 entity 제거, character 중앙 정렬 (`character.x = screen.width/2`, `character.y = FLOOR_Y_DEFAULT`), spawn timer 0, time 0
- `start()`: `app.ticker.add(update)` + 첫 spawn batch (`SPAWN_COUNT_0` 개)
- `end()`: `app.ticker.remove(update)`, entity 상태 freeze (RETRY UX는 별도 시스템 — input-system AC.9)

#### 3.8.1 Spawn Timer 누적 패턴 (setTimeout 금지 — §Conventions)

```js
// 매 frame 누적, SPAWN_INTERVAL 도달 시 trySpawn 호출
this._spawnTimer += dt;                 // dt in seconds
if (this._spawnTimer >= SPAWN_INTERVAL) {
  this._spawnTimer -= SPAWN_INTERVAL;   // 누적 잔여 보존 (drift 방지)
  this.trySpawn(currentTime);           // §3.2 조건 (active < target) 확인 후 1개 spawn
}
```

### 3.9 충돌 알고리즘 (전 entity 원-원 통일)

- **모든 충돌 원-원 거리 비교** (`dx² + dy² < (r1+r2)²`, sqrt 미사용)
- balloon-harpoon: harpoon 1개 fixed → O(n) (n=cap 30)
- balloon-character: character 1개 fixed → O(n)
- 합 O(n), n=30 → 30 비교/frame, 무시 가능 비용
- **Small 풍선 hitbox 확장 (art-bible §3.3)**: balloon-harpoon 충돌 시 Small 풍선 충돌 반경 = `visual radius + 6px` (touch target 보장). **character 충돌은 미적용** (게임플레이 난이도 보존)
- character 반경 = `CHARACTER_HITBOX_RADIUS` (§7)

---

## 4. Formulas

### 4.1 Size scaling

```
diameter_px = BALLOON_BASE_DIAMETER × SIZE_RATIO[size]
SIZE_RATIO_LARGE  = 1.00 → 80 px
SIZE_RATIO_MEDIUM = 0.70 → 56 px
SIZE_RATIO_SMALL  = 0.48 → 38 px   (art-bible §3.3 lock)
```

### 4.2 Split velocity

```
child_left:  vx = -SPLIT_VEL_X,  vy = -SPLIT_VEL_Y
child_right: vx = +SPLIT_VEL_X,  vy = -SPLIT_VEL_Y
```

기본값 `SPLIT_VEL_X = 120`, `SPLIT_VEL_Y = 250` 근거:
- 잔류 시간 (위로 튐): `t_apex = SPLIT_VEL_Y / GRAVITY = 250/400 = 0.625s` — 시각적으로 "한 번 튀어오름"이 명확 (P2 정합)
- 좌우 분리: `0.625s × 120 = 75px` (= `SPAWN_IMMUNITY_RADIUS` 기본값) — Medium 반경 28px 대비 약 2.7배 ≈ 시각적으로 명확한 분리, immunity 해제 시점과 정확히 일치

### 4.3 Spawn count over time

```
SPAWN_COUNT_AT(t):
  t <  30s → SPAWN_COUNT_0  = 2
  t <  60s → SPAWN_COUNT_30 = 4
  t >= 60s → SPAWN_COUNT_60 = 6
```

> **SPAWN_COUNT_AT(t)는 spawn trigger threshold**, actual active count는 분열로 그 이상 증가 가능. 하드 cap은 `BALLOON_MAX_ACTIVE` (30) 별도 관리.

매 `SPAWN_INTERVAL` (3s)마다: `if active_balloons < SPAWN_COUNT_AT(t) and active_balloons < BALLOON_MAX_ACTIVE: spawn(1)`.

예시 계산:
- t=0s: 초기 batch `SPAWN_COUNT_0` (2개)
- t=15s: target 2. 분열로 active 더 증가 가능 — **Large 2개가 Small까지 분열 완료 시 이론적 최대 8개** (1→2 Medium→4 Small × 2 Large = 8). spawn은 active < 2 일 때만 발동
- t=45s: target 4. 부족분 3s마다 보충
- t=90s: target 6 또는 cap 30

---

## 5. Edge Cases

| ID | 상황 | 동작 |
|----|------|-----|
| E1 | 분열 직후 자식이 화면 X 가장자리 밖 | 다음 frame Motion 단계에서 `vx = -vx` 자동 반사. 가시 결함 0 |
| E2 | 풍선 화면 하단 도달 (`FLOOR_Y` = `character.y`) | `vy = -|vy| * 0.85`, `y` clamp. 캐릭터 발 아래로 절대 못 감 |
| E3 | 작살 active 중 추가 `input:fire` | 무시 (max 1 active). 시각 피드백 0 |
| E4 | 동일 frame에 (풍선↔캐릭터) + (풍선↔작살) 동시 발생 | `game:over` 우선 처리. balloon split 안 함 — 죽는 순간 화려한 마지막 팝 차단 (UX 명료성) |
| E5 | active_balloons == `BALLOON_MAX_ACTIVE` (30) | spawn 보류. 한 풍선 제거 시 다음 SPAWN_INTERVAL부터 재개. 게임플레이 부드럽게 cap |
| E6 | 가로 모드 진입 | MVP 미지원. CSS `body { orientation: portrait }` 강제 + Pixi viewport portrait fixed. resize 발생 시 모든 풍선 `x` clamp |
| **E7** | **분열 자식이 character와 근접 spawn** | **거리 기반 immunity** — 자식 spawn 시점부터 `dist(child, character) < SPAWN_IMMUNITY_RADIUS` (75px) 인 동안 character collision 면제. 자식의 위로 튐(SPLIT_VEL_Y=250) + 좌우 분리(SPLIT_VEL_X=120)로 약 200ms 안에 75px 거리 확보 → 자연 해제. **frame 기반 면제(이전 안)는 16.67ms = 4.2px 이동에 그쳐 보호 무효 → 거리 기반으로 교체** |
| E8 | `pointercancel` 중 풍선 spawn → drag X 좌표 모름 | `dragMove` 마지막 좌표 유지. character는 이동 멈춤. balloon 시뮬 정상 진행 |

---

## 6. Dependencies

**Upstream** (listen):
- `input-system` — `input:fire`, `input:dragStart`, `input:dragMove`, `input:dragEnd`, `input:dragCancel`
- `systems-index §Engine Bootstrap` — `GameLoop.reset/start/end` contract, `app.ticker` (`ticker.deltaMS / 1000`), Z-layer 5컨테이너
- `systems-index §Conventions` — `rng.spawn` (`next`/`nextInt`만; nextChoice 없음 → 인덱스 접근), setTimeout 금지 (Ticker 누적 패턴 §3.8.1)
- `art-bible §1.2` — Layered Translucency 4층 (balloon glass body)
- `art-bible §1.4` — Visual Contract reference (sample HTML은 visual target, code template 아님 — CSS `backdrop-filter`를 Pixi에 이식 금지)
- `art-bible §3.3` — 풍선 사이즈 80/56/38px + Small +6px hitbox 확장 (작살 충돌만)
- `art-bible §4.7` — GlowFilter 사용 (`pixi-filters` 패키지). 본 시스템은 사이즈별 공유 인스턴스 4종 재사용
- `art-bible §6.3` — Z-layer (character는 balloonContainer 내)

**Downstream** (emit):
- `balloon:popped({ id, size, x, y, color, isCritical })` → Score & Combo, Critical Pop, Visual Juice
  - `id`: balloon entity unique 식별자 (spawn 시 monotonic 증가). Score & Combo frame-guard에서 chained 판별용 (M-SC-1 lock — score-combo §3.2)
  - `isCritical`은 명중 시점 balloon entity 상태 그대로 reflect (parent.isCritical)
- `balloon:split({ parent, children: [left, right] })` → Visual Juice (분열 시각 효과 + squash/stretch + floating)
- `game:over` → GameLoop.end() 직접 호출 (prototype). M1 retrofit: `game-state-manager`가 listen → state machine transition

> **인터페이스 계약 (M-2 — 권한 경계)**: 본 시스템은 `balloon:popped` 단순 팝 사실만 emit (`isCritical`은 entity 상태 그대로). **Critical 판정·부여·연쇄팝 권한**은 Critical Pop System 독점 (`criticalPop:fired({ x, y, chainedBalloons[] })` 별도 emit). **콤보 카운트 권한** ("Critical +1, 연쇄 각 +1 cap +3", decisions §3 #6)은 Score & Combo 독점. 본 시스템은 entity 시뮬레이션만 책임.

> **Critical entity 상태 관리 (prototype)**: balloon entity의 `isCritical` 필드는 Critical Pop System이 직접 set (`balloon.isCritical = true` + color = Gold + glow = HERO tier). 본 시스템은 spawn 시 항상 `isCritical: false`로 시작, 외부 변경 listen 없음. M1 retrofit 시 emit/listen 모델 (`balloon:critical:assigned` 이벤트)로 전환.

> **Bidirectional 갱신 필요**: `input-system.md` Events Emitted 표의 1차 Consumer "Character & Harpoon System"을 본 시스템으로 변경. **Prototype 단계는 주석으로만 표기** (실 변경은 M1 retrofit).

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|-----------|--------|
| `BALLOON_BASE_DIAMETER` | 80 px | 60–100 | Large 사이즈. art-bible §3.3 lock |
| `SIZE_RATIO_MEDIUM` | 0.70 | 0.60–0.80 | art-bible §3.3 lock |
| `SIZE_RATIO_SMALL` | 0.48 | 0.40–0.55 | art-bible §3.3 lock |
| `GRAVITY` | 400 px/s² | 300–600 | ↑ = 빠른 카오스, ↓ = 여유 |
| `BOUNCE_RESTITUTION` | 0.85 | 0.70–1.00 | 1.0 = 무한 바운스. 작을수록 정착감 |
| `SPLIT_VEL_X` | 120 px/s | 80–200 | 분열 좌우 분리 속도 |
| `SPLIT_VEL_Y` | 250 px/s | 150–400 | 분열 위로 튐 속도 |
| `HARPOON_SPEED` | 800 px/s | 500–1200 | ↑ = 즉응감, ↓ = 시각적 잔류 |
| **`HARPOON_SPAWN_OFFSET_Y`** | **4 px** | **0–10** | character 발 → 작살 launcher 끝 수직 거리 |
| **`CHARACTER_HITBOX_RADIUS`** | **32 px** | **24–40** | character 충돌 반경 (실 체형은 캡슐 — 의도적 비대칭 오차 인정). 작을수록 관대 |
| **`SPAWN_IMMUNITY_RADIUS`** | **75 px** | **50–120** | 분열 자식이 character로부터 이 거리 벗어날 때까지 collision 면제 (E7) |
| `SPAWN_COUNT_0` | 2 | 1–3 | 0–30s 동시 풍선 target |
| `SPAWN_COUNT_30` | 4 | 3–6 | 30–60s target |
| `SPAWN_COUNT_60` | 6 | 5–10 | 60s+ target (후반 카오스) |
| `BALLOON_MAX_ACTIVE` | 30 | 20–50 | 성능 cap. **GlowFilter 공유 4종 (§3.1) 가정.** 개별 인스턴스 사용 시 draw call 30+ → GATE-04 미달 위험 |
| `SPAWN_INTERVAL` | 3 s | 2–5 | 부족분 보충 주기 |
| `SPAWN_MARGIN` | 40 px | 20–80 | spawn X 좌·우 여백 (가장자리 즉시 반사 방지) |
| **`SPAWN_Y_TOP`** | **-40 px** | **-80–0** | 풍선 spawn Y 위치 (화면 상단 위 음수 = 위에서 떨어짐) |
| **`FLOOR_Y_DEFAULT`** | **`screen.height - 80`** | — | character 발 초기 Y (계산식 — `screen.height` 의존) |

---

## 8. Acceptance Criteria

| ID | 기준 | 검증 방법 |
|----|------|---------|
| AC.1 | Large 풍선 작살 명중 → Medium 2개 생성, 사이즈 0.70× | unit test |
| AC.2 | Medium 풍선 명중 → Small 2개 생성, 사이즈 0.48× | unit test |
| AC.3 | Small 풍선 명중 → 즉시 제거 (분열 없음) | unit test |
| AC.4 | 풍선 X 가장자리 도달 → `vx` 반사, frame 1 안에 방향 전환 | unit test |
| AC.5 | 풍선 하단 도달 → `vy = -|vy| * 0.85`, `y` clamp at `FLOOR_Y = character.y` | unit test |
| AC.6 | 풍선 ↔ character 원-원 충돌 (반경 합 = `balloon.radius + CHARACTER_HITBOX_RADIUS`) → `game:over` emit + GameLoop.end() | integration test |
| AC.7 | active harpoon 있을 때 `input:fire` 수신 → 무시 (active 1개 유지) | unit test |
| AC.8 | 시간 t별 동시 풍선 평균 (분열 제외 trigger threshold): t<30s ≈ 2, 30≤t<60 ≈ 4, t≥60 ≈ 6 (cap 30) | playtest 60s 세션 측정 |
| AC.9 | iPhone 11 Safari 15 / Galaxy A52 Chrome — `BALLOON_MAX_ACTIVE`(30) 활성 + GlowFilter 공유 4종 시 P50 ≥ 58fps, P99 ≥ 55fps | perf test (GATE-04) |
| AC.10 | 동일 seed로 `rng.spawn` 사용 시 spawn 위치·컬러·velocity 시퀀스 100% 재현 | unit test with seeded rng |
| AC.11 | `GameLoop.reset()` 호출 후 entity 0개, character 중앙 (`x = screen.width/2`, `y = FLOOR_Y_DEFAULT`), time=0 | unit test |
| AC.12 | 분열 자식이 화면 X 밖 spawn 시 즉시 반사 (E1) — 가시 결함 0 frame | unit test + visual review |
| **AC.13** | **분열 자식 spawn 시 `isCritical: false` 강제** (M-1) — Critical Gold 부모에서 분열해도 자식은 일반 풍선 | unit test |
| **AC.14** | **자식 풍선 spawn 직후 character 근접 시 collision 면제** — `dist < SPAWN_IMMUNITY_RADIUS` (75px) 동안 game over 없음, 거리 초과 시 normal collision 재개 (E7) | unit test (boundary) |
| **AC.15** | **`dt` 단위 변환** — `app.ticker.deltaMS / 1000` 사용 검증. `deltaTime` (frame 단위) 사용 시 게임 즉파괴 → 정적 분석 또는 test 검출 | unit test (mock ticker) |
| **AC.16** | **Critical Gold 풍선 작살 명중 → 분열 없이 즉시 제거 + `balloon:popped({ isCritical: true })` emit** (Critical Pop System이 연쇄팝 trigger 위함, §3.4) | unit test |

---

## 9. Implementation Checklist

> 본 1-pager는 M0 prototype 범위. AC → 자동화 테스트 전 매핑은 Phase D (devops-engineer) 빌드 인프라 완성 후 채움. PROCEED 후 M1에서 정식 9섹션 GDD 승격 (m1-pre-production.md §retrofit).

### 진입점

- `src/main.js` Pixi v8 boilerplate (systems-index §Engine Bootstrap) → `GameLoop.start()` → `app.ticker.add((t) => balloonSystem.update(t.deltaMS / 1000))` 매 frame
- `input-system` → `balloonSystem.onFire()` / `.onDragMove(x)` 이벤트 핸들러

> art-bible §1.4: 샘플 HTML은 visual target reference. CSS `backdrop-filter` 등 CSS 구현을 Pixi에 이식 금지 — `BlurFilter`·`GlowFilter` 등 Pixi v8 idiom 사용.

### 호출 경로 (구현 시 grep 검증)

- [ ] `BalloonSystem.update(dt)` — gravity + position + wall bounce + collision + spawn timer (§3.8.1)
- [ ] `BalloonSystem.spawn(t)` — `SPAWN_COUNT_AT(t)` 함수 호출, `rng.spawn.nextInt` 사용 (인덱스 접근). **spawn 직후 `criticalPop.onBalloonSpawned(balloon)` 직접 hook 호출** (critical-pop §3.1 — M0 prototype 단순화, M1 retrofit 시 `balloon:spawned` event emit)
- [ ] `BalloonSystem.removeBalloon(id)` — public removal API (Critical Pop 연쇄팝에서 호출, critical-pop §3.3). balloon 즉시 제거 + `balloon:popped({ isCritical: false })` emit (재귀 방지 — critical-pop §3.3 E9)
- [ ] `HarpoonSystem.fire(x, y)` — `input:fire` 핸들러, max 1 active 가드, spawn y = `character.y - HARPOON_SPAWN_OFFSET_Y`
- [ ] `CharacterEntity.setX(x)` — `input:dragMove` 핸들러, clamp (`y` 변경 안 함)
- [ ] `Collision.balloonHarpoon()` (원-원, Small +6px) — Critical balloon: 분열 skip + 즉시 제거 + `balloon:popped({ isCritical: true })`. 일반: emit `balloon:split` + `balloon:popped({ isCritical: false })`. **emit 전에 `activeBalloons`에서 제거 — Critical Pop의 self-exclusion 보장 (critical-pop §3.3)**
- [ ] `Collision.balloonCharacter()` (원-원, `CHARACTER_HITBOX_RADIUS`, SPAWN_IMMUNITY_RADIUS 면제 검사) → emit `game:over`
- [ ] `BalloonSystem.reset()` / `start()` / `end()` — GameLoop contract (§3.8)
- [ ] GlowFilter 공유 인스턴스 4종 생성 (Large / Medium / Small / Critical Gold — Critical Gold는 size 무관 단일 인스턴스) — §3.1
- [ ] `balloonContainer.sortableChildren = true` 설정

### AC → 테스트 매핑 (Phase D 후 채움)

| AC | Test Method | 파일 |
|----|-----------|------|
| AC.1–3 (split) | unit (BalloonSystem.split) | `tests/unit/balloon-split.test.js` |
| AC.4–5 (bounce) | unit (motion solver) | `tests/unit/balloon-motion.test.js` |
| AC.6 (game over) | integration | `tests/integration/game-over.test.js` |
| AC.7 (harpoon max 1) | unit | `tests/unit/harpoon.test.js` |
| AC.8 (spawn curve) | playtest (60s 세션) | `production/qa/evidence/spawn-curve-YYYY-MM-DD.md` |
| AC.9 (60fps + GlowFilter 공유) | perf (GATE-04) | Playwright + Ticker.deltaMS |
| AC.10 (determinism) | unit (seeded rng) | `tests/unit/balloon-determinism.test.js` |
| AC.11 (reset) | unit | `tests/unit/gameloop-reset.test.js` |
| AC.12 (E1 spawn 밖) | unit + visual | `tests/unit/balloon-edge-spawn.test.js` |
| AC.13 (자식 isCritical false) | unit | `tests/unit/balloon-split.test.js` |
| AC.14 (E7 immunity 거리) | unit (boundary @ 74/75/76px) | `tests/unit/balloon-spawn-immunity.test.js` |
| AC.15 (dt 단위) | unit (mock ticker) | `tests/unit/balloon-tick.test.js` |

### 빌드 검증

- [ ] `npm run build` exit 0 (GATE-01)
- [ ] 실기 60s 세션 60fps 유지 + GlowFilter 공유 인스턴스 4종 동작 검증 (GATE-04, AC.9)
- [ ] BALLOON_MAX_ACTIVE 30 + GlowFilter 공유 시 draw call < 30 (개별 인스턴스 사용 회귀 방지)
