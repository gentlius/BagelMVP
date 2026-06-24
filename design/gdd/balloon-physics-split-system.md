# Balloon Physics & Split System

> **Status**: Draft (M0 prototype 1-pager, post-review v1.1)
> **Author**: gentlius + Claude
> **Last Updated**: 2026-06-24 (D-P6-BBCOL-01: balloon-balloon 짐볼 탄성 충돌 추가 — §3.10, §4.4, E9/E10, AC.26–30)
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
| `harpoon` | `harpoonContainer` | **(0.5, 1.0) bottom-center** → sprite.height = 라인 길이 | **1** (정책) | `x` (고정 — 발사 위치), `bottomY` (고정 — 발 위치), `topY` (위로 자람 → 0), `growthSpeed` |
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

> **Pang Heritage**: 작살은 총알이 아닌 **설치형 수직 라인**이다. 발사 위치 x에 고정되며 캐릭터가 이동해도 라인은 그 자리에 유지된다. 플레이어는 작살을 두고 도망가거나, 작살을 앞세우고 달아나는 Pang 원작의 핵심 포지셔닝 게임플레이를 할 수 있다. (art-bible §3 "Pang 본연의 파괴적 타격감 계승")

**생성 (`input:fire` 수신 시)**:
- active harpoon이 이미 있으면 무시 (E3 max 1 active 정책)
- 없으면 즉시 생성:
  - `x = character.x` (발사 시점 위치 — 이후 고정)
  - `bottomY = character.y - HARPOON_SPAWN_OFFSET_Y` (라인 하단 — 이후 고정)
  - `topY = bottomY` (라인 길이 0으로 시작)
  - `growthSpeed = HARPOON_GROWTH_SPEED`
  - sprite anchor = (0.5, 1.0) bottom-center, sprite.y = bottomY, sprite.height = 0

**매 frame 갱신 (`_updateHarpoon(dt)`)**:
```
topY -= growthSpeed × dt     // 라인이 위로 자람
topY = max(topY, 0)          // 천장 clamp
sprite.height = bottomY - topY  // anchor (0.5, 1.0) → 위쪽으로 높이 증가
```

**천장 도달 (`topY ≤ 0`)**:
- 즉시 제거 (M0 단순화)
- Pang 원작은 천장에서 잠시 머무른 후 사라짐 → M1 polish 대상

**x 좌표 고정**:
- 작살 `x`는 발사 시점에 확정. 이후 `character.x`가 변해도 작살 위치 불변
- 시각 결과: 작살을 발사하고 캐릭터를 옆으로 이동하면 작살 라인이 이전 위치에 남음

**풍선 충돌 (`_checkHarpoonBalloon`)**:
- 충돌 모델: **원-라인 segment** (§3.9의 원-원 통일 대비 작살만 예외)
- X 겹침 검사: `|balloon.x − harpoon.x| ≤ balloon.radius + HARPOON_LINE_WIDTH / 2`
- Y 겹침 검사: balloon이 수직 segment `[topY, bottomY]` 와 교차 (`balloon.y - radius ≤ bottomY` AND `balloon.y + radius ≥ topY`)
- 양 조건 충족 → balloon hit: §3.4 Split 규칙 적용 후 작살 즉시 제거 (one-hit)
- Small 풍선 hitbox 확장 (`+6px`) 적용 — §3.9 동일 (art-bible §3.3)

**시각 사양**:
- 작살 라인 = 나선 비드 패턴 + 화살촉 (art-bible §6 canonical sample HTML 정합)
- 구현 담당: technical-artist Phase 6.B
- M0 prototype은 단색 직선 라인 (HARPOON_LINE_WIDTH = 6 px) 허용

### 3.6 Character Entity

**Virtual stick (조이스틱) 모델** — 마우스 절대 좌표 추종 (워프) 거부, 드래그 시작점 = stick center → offset 기반 velocity. 마우스 위치로 캐릭터가 즉시 워프하면 게임감 손실 (Pang 정합성 미달). 손가락 거리가 속도로 변환되는 조이스틱 모델이 모바일 슈터 표준 (Bubble Trouble, Pang remakes).

상태 필드 (system 내부, CharacterEntity 인터페이스 외):
- `_dragStartX: number | null` — null이면 not dragging. 드래그 시작 시 stick center로 lock
- `_characterVx: number` — px/s, 매 frame update에서 position에 적용

입력 핸들러:
- `input:dragStart({x, y})`: `_dragStartX = x; _characterVx = 0`
- `input:dragMove({x, y})`: `_dragStartX === null`이면 무시. 아니면 `offset = x - _dragStartX; _characterVx = clamp(offset * STICK_SENSITIVITY, -STICK_MAX_VX, STICK_MAX_VX)`. `y`는 무시 (발 위치 고정)
- `input:dragEnd` / `input:dragCancel`: `_dragStartX = null; _characterVx = 0` (즉시 멈춤, 관성 없음 — Pang feel)

매 frame `update(dt)`:
- `_characterVx ≠ 0`이면 `character.x = clamp(character.x + _characterVx * dt, character.width/2, screen.width - character.width/2)` + sprite sync
- character.y는 항상 발 위치 (FLOOR_Y) — 변경 없음

### 3.7 Game Over

- 풍선 ↔ character 충돌: **원-원 거리 비교** (§3.9 충돌 모델 통일)
  ```
  dx = balloon.x - character.x
  dy = balloon.y - character.y       // character.y = 발 위치
  if (dx*dx + dy*dy) < (balloon.radius + CHARACTER_HITBOX_RADIUS)²: game over
  ```
- `CHARACTER_HITBOX_RADIUS`는 의도적 hitbox 크기 (실 체형 캡슐형 ↔ 원 근사의 상하/좌우 비대칭 오차 인정). §7 Tuning Knob
- 조건 충족 → `_triggerDeath(impactX)` 호출 + emit `game:over` (사망 연출 시퀀스)
- 1-hit kill (HP 없음)

**사망 연출**:
캐릭터가 풍선처럼 바운싱하며 화면 밖으로 떨어짐. game over emit 직전 `_triggerDeath(impactX)` 호출:
- `character.isDying = true` (이후 모든 input + spawn timer + collision check 중단)
- `character.vx = DEATH_KICK_VX × sign(character.x - impactX)` — 충돌 위치 반대 방향 튕김
- `character.vy = DEATH_KICK_VY` (위로 -650 px/s 튕김)
- `character.angularVel = DEATH_ANGULAR_VEL × sign(vx)` — sprite 회전 (구르는 느낌)
- 작살 즉시 제거 (사망 후 잔존 부자연)
- virtual stick state clear (`_dragStartX = null`)

매 frame `_updateCharacterDying(dt)`:
- `vy += GRAVITY × dt` (풍선과 동일 중력)
- `x += vx × dt`, `y += vy × dt`
- 좌우 벽 바운스: `vx *= DEATH_BOUNCE_DAMP` (0.7 감쇠)
- floor 무시 (바닥 통과해서 화면 밖으로 떨어짐)
- `sprite.rotation += angularVel × dt`
- `y > screen.height + DEATH_OFFSCREEN_MARGIN`(200px) 시 `sprite.visible = false` (메모리 보존, RETRY reset)

**RETRY 처리**: `reset()`에서 character.isDying=false, vx/vy/angularVel=0, sprite.visible=true, sprite.rotation=0, x/y FLOOR_Y_DEFAULT로 복원.

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

- **모든 충돌 원-원 거리 비교** (`dx² + dy² < (r1+r2)²`, broad-phase는 sqrt 미사용)
- balloon-harpoon: harpoon 1개 fixed → O(n) (n=cap 30)
- balloon-character: character 1개 fixed → O(n)
- **balloon-balloon: 짐볼 탄성 충돌 (§3.10) → O(n²/2)** (n=30 → 435쌍/frame). 각 쌍 ≈ 20 flops → ~9k flops/frame, 모바일 60fps budget 대비 무시 가능 (R4 risk 재평가: detection은 거리 비교만, sqrt는 실제 겹침 발생 쌍에만 — 평시 대부분 broad-phase에서 reject)
- **Small 풍선 hitbox 확장 (art-bible §3.3)**: balloon-harpoon 충돌 시 Small 풍선 충돌 반경 = `visual radius + 6px` (touch target 보장). **character·balloon-balloon 충돌은 미적용** (게임플레이 난이도 + 물리 정합성 보존 — 시각 반경으로만 충돌)
- character 반경 = `CHARACTER_HITBOX_RADIUS` (§7)

### 3.10 Balloon-Balloon 짐볼 탄성 충돌 (D-P6-BBCOL-01)

> **설계 변경 (2026-06-24, 치프)**: 이전 1-pager는 성능 근거로 balloon-balloon 충돌을 의도적 제외했다 (버블끼리 관통). 짐볼끼리 부딪히는 물리감이 부재해 체감이 빈약 → **impulse 기반 원-원 탄성 충돌**을 추가한다. 물리 성격: **질량비례(mass ∝ 면적) + 탄탄한 바운스(restitution 0.9)** — 큰 버블이 작은 버블을 밀어내고, 작은 버블은 강하게 튕겨나간다.

**매 frame `_resolveBalloonCollisions()`** (motion + character/harpoon collision 갱신 후, spawn timer 전):

모든 풍선 쌍 (i, j), i < j 에 대해:

1. **상호충돌 면제 (E9)**: `i 또는 j 의 spawnImmunityRadius > 0` 이면 skip. 분열 직후 형제 풍선은 부모 위치에서 겹친 채 생성되므로(거리 0), immunity 동안 상호충돌을 막아 폭발적 분리를 방지한다. immunity는 character로부터 75px 벗어나면 해제(E7)되며, 그 시점엔 SPLIT_VEL로 이미 분리 완료.

2. **detection** (broad-phase): `dx = xj-xi, dy = yj-yi`, `distSq = dx²+dy²`, `sumR = ri+rj`. `distSq ≥ sumR²` → skip. `distSq == 0` (완전 동일 위치) → skip (법선 계산 불가 — immunity가 통상 차단하나 안전 가드).

3. **positional separation** (겹침 제거, inverse-mass 가중): `dist = √distSq`, `overlap = sumR - dist`, 법선 `n = (dx, dy)/dist`. 가벼운 쪽이 더 많이 밀림:
   ```
   w_i = invMass_i / (invMass_i + invMass_j)   // 작은 풍선일수록 큼
   w_j = invMass_j / (invMass_i + invMass_j)
   p_i -= n × overlap × w_i ;  p_j += n × overlap × w_j
   ```

4. **velocity exchange** (1D impulse along normal): 상대속도 `v_rel = v_i - v_j`, `vrn = v_rel · n`. `vrn ≤ 0` (이미 분리 중) → 속도 변경 skip (겹침 분리만 적용). 접근 중(`vrn > 0`)이면:
   ```
   jImp = -(1 + e) × vrn / (invMass_i + invMass_j)      // e = BALLOON_COLLISION_RESTITUTION
   v_i += jImp × invMass_i × n
   v_j -= jImp × invMass_j × n
   ```

5. **sprite 동기화**: 위치가 바뀐 i, j 의 `sprite.x/y` 즉시 갱신 (motion 단계의 sync 이후 nudge 발생).

**질량 정의**: `mass = radius²` (면적 비례, π 상수 생략 — 비율만 사용). `invMass = 1 / radius²`. XL(r=80) 질량 6400 vs XS(r≈9.6) 질량 ~92 → XL이 XS보다 ~70배 무거움 → XS가 강하게 튕겨나감.

**단일 패스**: frame당 1회 해소 (relaxation iteration 없음). 조밀한 더미에서 잔여 겹침이 남을 수 있으나 다음 frame 누적 보정 + restitution 0.9의 활발한 바운스로 정착 jitter 최소. iteration 추가는 perf 측정 후 polish 대상 (§7 tuning note).

**character·harpoon 무관**: 본 해소는 balloon 쌍에만 적용. character 충돌(game over, §3.7)·harpoon 충돌(split, §3.5)은 기존대로 별도 처리. 결정론 보존: RNG 미사용, 고정 iteration 순서(active 배열 인덱스) → AC.10 영향 없음.

---

## 4. Formulas

### 4.1 Size scaling

**5단계 분열 chain** — XL (시작, ×2) ↔ XS (종단, ×0.5). Pang 원작 4-5단계 정합 + 한 발 명중 후 분열 chain 길이 = 게임 길이.

```
diameter_px = BALLOON_BASE_DIAMETER × SIZE_RATIO[size]
SIZE_RATIO_XL     = 2.00 → 160 px   (시작 크기)
SIZE_RATIO_LARGE  = 1.00 → 80 px
SIZE_RATIO_MEDIUM = 0.70 → 56 px
SIZE_RATIO_SMALL  = 0.48 → 38 px    (art-bible §3.3 lock)
SIZE_RATIO_XS     = 0.24 → 19 px    (종단 — 안 쪼개짐)
```

**분열 chain** (`_hitBalloon`):
XL → Large × 2 → Medium × 2 → Small × 2 → XS × 2 → (terminal)

**Hitbox 마진**: Small + XS 풍선에만 +SMALL_HARPOON_HITBOX_EXTRA(6px) 적용 (작살 명중성).

**Score 비례**: `SIZE_MULTIPLIER` (score-combo §4.1) — XL 0.5 / Large 1.0 / Medium 1.5 / Small 2.0 / XS 3.0 (작은 풍선 = 높은 보상).

### 4.2 Split velocity

```
child_left:  vx = -SPLIT_VEL_X,  vy = -SPLIT_VEL_Y
child_right: vx = +SPLIT_VEL_X,  vy = -SPLIT_VEL_Y
```

기본값 `SPLIT_VEL_X = 120`, `SPLIT_VEL_Y = 250` 근거:
- 잔류 시간 (위로 튐): `t_apex = SPLIT_VEL_Y / GRAVITY = 250/400 = 0.625s` — 시각적으로 "한 번 튀어오름"이 명확 (P2 정합)
- 좌우 분리: `0.625s × 120 = 75px` (= `SPAWN_IMMUNITY_RADIUS` 기본값) — Medium 반경 28px 대비 약 2.7배 ≈ 시각적으로 명확한 분리, immunity 해제 시점과 정확히 일치

### 4.4 Balloon-Balloon 탄성 충돌 (§3.10)

질량 (면적 비례, 상수 생략):
```
mass(b)    = radius(b)²            // radius = BALLOON_BASE_DIAMETER × SIZE_RATIO[size] / 2
invMass(b) = 1 / radius(b)²
```

겹침 분리 (inverse-mass 가중, n = 단위 법선 i→j):
```
overlap = (ri + rj) - dist
w_i = invMass_i / (invMass_i + invMass_j)
p_i -= n × overlap × w_i ;  p_j += n × overlap × w_j
```

속도 교환 (vrn = (v_i - v_j)·n, 접근 중 vrn>0 에만):
```
jImp = -(1 + e) × vrn / (invMass_i + invMass_j)      e = BALLOON_COLLISION_RESTITUTION = 0.9
v_i += jImp × invMass_i × n ;  v_j -= jImp × invMass_j × n
```

예시 — XL(r=80, m=6400) 정지 ↔ XS(r=9.6, m≈92) 가 +200px/s로 정면 충돌 (n=(1,0)):
- `invMass_XL = 1/6400 ≈ 1.563e-4`, `invMass_XS = 1/92 ≈ 1.087e-2`
- `vrn = (0 - 200)·1 = -200` … 부호는 i/j 지정에 의존. i=XS(접근), j=XL 로 두면 `v_i-v_j = 200`, `vrn=200 (>0)`
- `jImp = -(1.9)(200) / (1.087e-2 + 1.563e-4) ≈ -34480`
- `v_XS += jImp × invMass_XS = -34480 × 1.087e-2 ≈ -375 px/s` → +200 에서 -375 로 강하게 튕겨나감
- `v_XL -= jImp × invMass_XL = -(-34480 × 1.563e-4) ≈ +5.4 px/s` → 거의 안 밀림 (질량비 ~70배 확인)

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
| **E9** | **분열 형제가 부모 위치에서 거리 0으로 겹쳐 생성** | **`spawnImmunityRadius > 0` 인 풍선은 balloon-balloon 충돌 면제 (§3.10 step 1).** 거리 0에서 즉시 충돌 해소하면 overlap = sumR 전량이 한 frame에 분리되어 폭발적 속도 부여 → SPLIT_VEL 설계 무력화. immunity가 character 75px 이탈 시 해제(E7)되고 그때는 이미 SPLIT_VEL로 분리 완료 → 자연스러운 상호충돌 재개 |
| E10 | balloon-balloon 충돌 시 두 풍선 완전 동일 좌표 (distSq=0, immunity 모두 해제된 비정상 케이스) | 법선 계산 불가 → 해당 쌍 skip (§3.10 step 2). 다음 frame 중력·미세 위치차로 자연 해소. 0-division 가드 |

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
  - `children` 배열 구조: `children[0] = left (vx = -SPLIT_VEL_X)`, `children[1] = right (vx = +SPLIT_VEL_X)` (Phase C 일관성 보강)
- `game:over` → GameLoop.end() 직접 호출 (prototype). M1 retrofit: `game-state-manager`가 listen → state machine transition

> **인터페이스 계약 (M-2 — 권한 경계)**: 본 시스템은 `balloon:popped` 단순 팝 사실만 emit (`isCritical`은 entity 상태 그대로). **Critical 판정·부여·연쇄팝 권한**은 Critical Pop System 독점 (`criticalPop:fired({ x, y, chainedBalloons[] })` 별도 emit). **콤보 카운트 권한** ("Critical +1, 연쇄 각 +1 cap +3", decisions §3 #6)은 Score & Combo 독점. 본 시스템은 entity 시뮬레이션만 책임.

> **Critical 시각 권한 위임**: Critical 시각 differentiation (texture swap + scale + glow) 권한은 **본 시스템의 `applyCriticalVisual(b)` 메서드**에 위임. critical-pop은 isCritical lottery + Pity timer + chain detection logic만 담당, 시각 변경 호출은 `this._balloonSystem.applyCriticalVisual(b)`로 위임. logic과 시각 권한 분리 — critical-pop이 sprite 변경 시 sprite ownership 침범, balloon-physics-split이 lottery logic 침범 둘 다 회피. M0 prototype 결합 허용 패턴 (cross-system direct method call).
>
> **`applyCriticalVisual(b: BalloonEntity): void`** — critical-pop._setCritical()이 isCritical=true set 후 즉시 호출:
> 1. **texture swap**: `b.sprite.texture = getBalloonTexture(app, 'gold')` — BALLOON_PALETTE.gold radial gradient (Canvas 2D `createRadialGradient` 패턴, art-bible §6)
> 2. **tint reset**: `b.sprite.tint = 0xFFFFFF` — texture 자체가 gold이므로 multiply tint 제거
> 3. **scale ×1.1**: `b.sprite.width = BALLOON_BASE_DIAMETER × SIZE_RATIO[b.size] × 1.1` (height 동일)
> 4. **hero GlowFilter**: `b.sprite.filters = [new GlowFilter({ distance: 28, outerStrength: 2.0, innerStrength: 0, color: 0xFFD700, quality: 0.5 })]` — supporting glow(outerStrength 0.8)의 2.5×, gold (#FFD700)

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
| `BOUNCE_RESTITUTION` | 0.85 | 0.70–1.00 | 벽·바닥 반사 탄성. 1.0 = 무한 바운스. 작을수록 정착감 |
| **`BALLOON_COLLISION_RESTITUTION`** | **0.9** | **0.5–1.0** | balloon-balloon 충돌 탄성 (§3.10). 1.0 = 에너지 보존(무한 핑퐁), 0.5 = 둔탁/정착. 0.9 = 탄탄한 짐볼 바운스 (치프 2026-06-24). ↓ 시 바닥 적체 ↑. 단일 해소 패스/frame (relaxation iteration은 perf 측정 후 polish 대상) |
| `SPLIT_VEL_X` | 120 px/s | 80–200 | 분열 좌우 분리 속도 |
| `SPLIT_VEL_Y` | 250 px/s | 150–400 | 분열 위로 튐 속도 |
| `HARPOON_GROWTH_SPEED` | **800 px/s** | 500–1500 | ↑ = 즉응감 (Pang 원작 ~1000), ↓ = 라인 자람 시각적 추적 가능. 800px 화면 기준 약 1.0s에 천장 도달. Pang 게임감 보존 — 너무 빠르면 작살 시각 추적 불가 + 풍선 위치 예측/회피 시간 사라짐 |
| `HARPOON_LINE_WIDTH` | **10 px** | 4–16 | 작살 라인 시각 가로폭 + 풍선 충돌 hitbox X범위 공통 (`HARPOON_LINE_WIDTH / 2` 반경). Frosted Sky 파스텔 배경 위 식별성 보장 |
| **`HARPOON_TINT`** | **`0x00E5FF`** (네온 시안) | — | 작살 sprite.tint + GlowFilter color. 채도 100% / 명도 90% — Frosted Sky 파스텔 배경 위에서 가장 식별 잘 됨 |
| **`STICK_SENSITIVITY`** | **2** | **1–6** | virtual stick offset(px) → vx(px/s) 비율. ↑ = 작은 손가락 움직임으로 빠른 이동. ↓ = 정밀 조준 |
| **`STICK_MAX_VX`** | **270 px/s** | **150–500** | 캐릭터 최대 수평 속도. ↑ = 회피 쉬움, ↓ = 긴박감 ↑ |
| **`DEATH_KICK_VY`** | **-650 px/s** | **-400 ~ -900** | 사망 연출 초기 위로 튕김 속도. ↑(절대값) = 높이 튕김 |
| **`DEATH_KICK_VX`** | **250 px/s** | **150–400** | 사망 연출 좌우 튕김 절대값 (방향은 충돌 위치 반대). ↑ = 빠른 옆 비행 |
| **`DEATH_BOUNCE_DAMP`** | **0.7** | **0.4–0.9** | 벽 바운스 감쇠율. 1.0 = 무한 바운스, 0 = 즉시 정지 (벽에서 멈춤) |
| **`DEATH_ANGULAR_VEL`** | **5 rad/s** | **2–10** | sprite 회전 속도 (구르는 느낌). ↑ = 빠른 회전 |
| **`DEATH_OFFSCREEN_MARGIN`** | **200 px** | **100–400** | character.y > screen.height + 이 값 시 sprite hide (메모리 보존) |
| **`HARPOON_SPAWN_OFFSET_Y`** | **4 px** | **0–10** | character 발 → 작살 launcher 끝 수직 거리 |
| **`CHARACTER_HITBOX_RADIUS`** | **24 px** | **18–36** | character 충돌 반경. sprite.width(48) / 2 = 24 정합 — 시각 반경과 일치. 시각=hitbox 명료성 우선 (보이는 것보다 멀리서 사망 시 사용자 인지 불일치) |
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
| AC.3 | XS 풍선 명중 → 즉시 제거 (분열 없음, 종단) | unit test |
| **AC.3-XL** | **XL 풍선 명중 → Large 2개 생성, 사이즈 1.0×** | unit test |
| **AC.3-XS** | **Small 풍선 명중 → XS 2개 생성, 사이즈 0.24×** | unit test |
| AC.4 | 풍선 X 가장자리 도달 → `vx` 반사, frame 1 안에 방향 전환 | unit test |
| AC.5 | 풍선 하단 도달 → `vy = -|vy| * 0.85`, `y` clamp at `FLOOR_Y = character.y` | unit test |
| AC.6 | 풍선 ↔ character 원-원 충돌 (반경 합 = `balloon.radius + CHARACTER_HITBOX_RADIUS`) → `game:over` emit + GameLoop.end() | integration test |
| **AC.26** | **balloon-balloon: 두 풍선이 `dist < ri+rj` 로 겹치면 한 frame 해소 후 `dist ≥ ri+rj` (겹침 제거). 분리 거리만큼 inverse-mass 가중 — 작은 풍선이 더 많이 밀림** | unit test (XL+XS 겹침 시나리오) |
| **AC.27** | **balloon-balloon 속도 교환: 접근(vrn>0) 시 impulse 적용 — 충돌 후 두 풍선 상대속도 부호 반전(분리 방향), 질량비 ∝ r² (큰 풍선 Δv ≪ 작은 풍선 Δv). 분리 중(vrn≤0)이면 속도 변경 없음** | unit test (정면충돌 + 이미 분리중 2케이스) |
| **AC.28** | **balloon-balloon 운동량 보존: 충돌 전후 `m_i·v_i + m_j·v_j` 보존 (±부동소수 오차). e=0.9 → 운동에너지는 감소(완전탄성 아님)** | unit test |
| **AC.29** | **`spawnImmunityRadius > 0` 인 풍선은 balloon-balloon 충돌 면제 (E9) — 분열 직후 동일 위치 형제가 폭발 분리되지 않음. immunity 해제 후 정상 상호충돌** | unit test (immunity on/off boundary) |
| **AC.30** | **distSq=0 (완전 동일 위치, immunity 모두 해제) 비정상 케이스에서 0-division 없이 skip (E10), crash·NaN 없음** | unit test |
| AC.7 | active harpoon 있을 때 `input:fire` 수신 → 무시 (active 1개 유지) | unit test |
| **AC.17** | **작살 발사 후 캐릭터 좌우 이동 → 작살 `x` 변화 0px (발사 위치 고정)** | unit test |
| **AC.18** | **작살 라인이 bottomY → 0까지 자라는 시간 ≈ bottomY / HARPOON_GROWTH_SPEED (예: 800px / 800 = 1.0s). 허용 오차 ±1 frame (16ms)** | unit test (mock ticker) |
| **AC.19** | **풍선이 라인 segment `[topY, bottomY]` × `[x ± HARPOON_LINE_WIDTH/2]` 내에 있을 때 hit (포인트 충돌 아님). segment 밖 풍선 동일 x에 있어도 hit 없음** | unit test (경계 4케이스) |
| **AC.20** | **virtual stick: dragStart 시 stick center lock, dragMove offset = x - startX → vx = clamp(offset × STICK_SENSITIVITY, ±STICK_MAX_VX). 마우스 절대 좌표 ≠ 캐릭터 위치 (워프 없음)** | unit test (3 시나리오: offset 0/+100/+1000) |
| **AC.21** | **dragEnd / dragCancel 시 vx = 0 즉시 멈춤 (관성 없음). 그 후 update(dt) 호출해도 character.x 변화 0** | unit test |
| **AC.22** | **사망 연출: 풍선 충돌 시 character.isDying=true, vx 방향 = sign(character.x - impactX), vy = DEATH_KICK_VY, angularVel ≠ 0. 작살 즉시 제거** | unit test (impact 좌/우 2 시나리오) |
| **AC.23** | **dying mode: update(dt)마다 gravity 적용 (vy += GRAVITY × dt), 좌우 벽 도달 시 vx × DEATH_BOUNCE_DAMP 반전, floor 통과 (bounce 없음), y > screen.height + DEATH_OFFSCREEN_MARGIN 시 sprite.visible=false** | unit test (mock ticker 2-3s) |
| **AC.24** | **dying 중 input (fire/drag) + spawn timer 모두 무시. balloon physics는 계속 (떨어지는 풍선 시각 유지)** | unit test |
| **AC.25** | **reset() 호출 후 character.isDying=false, vx=vy=angularVel=0, sprite.visible=true, sprite.rotation=0, x=sw/2, y=FLOOR_Y_DEFAULT** | unit test |
| AC.8 | 시간 t별 동시 풍선 평균 (분열 제외 trigger threshold): t<30s ≈ 2, 30≤t<60 ≈ 4, t≥60 ≈ 6 (cap 30) | playtest 60s 세션 측정 |
| AC.9 | iPhone 11 Safari 15 / Galaxy A52 Chrome — `BALLOON_MAX_ACTIVE`(30) 활성 + GlowFilter 공유 4종 시 P50 ≥ 58fps, P99 ≥ 55fps | perf test (GATE-04) |
| AC.10 | 동일 seed로 `rng.spawn` 사용 시 spawn 위치·컬러·velocity 시퀀스 100% 재현 | unit test with seeded rng |
| AC.11 | `GameLoop.reset()` 호출 후 entity 0개, character 중앙 (`x = screen.width/2`, `y = FLOOR_Y_DEFAULT`), time=0 | unit test |
| AC.12 | 분열 자식이 화면 X 밖 spawn 시 즉시 반사 (E1) — 가시 결함 0 frame | unit test + visual review |
| **AC.13** | **분열 자식 spawn 시 `isCritical: false` 강제** (M-1) — Critical Gold 부모에서 분열해도 자식은 일반 풍선 | unit test |
| **AC.14** | **자식 풍선 spawn 직후 character 근접 시 collision 면제** — `dist < SPAWN_IMMUNITY_RADIUS` (75px) 동안 game over 없음, 거리 초과 시 normal collision 재개 (E7) | unit test (boundary) |
| **AC.15** | **`dt` 단위 변환** — `app.ticker.deltaMS / 1000` 사용 검증. `deltaTime` (frame 단위) 사용 시 게임 즉파괴 → 정적 분석 또는 test 검출 | unit test (mock ticker) |
| **AC.16** | **Critical Gold 풍선 작살 명중 → 분열 없이 즉시 제거 + `balloon:popped({ isCritical: true })` emit** (Critical Pop System이 연쇄팝 trigger 위함, §3.4) | unit test |
| **AC.16-VIS** | **`applyCriticalVisual(b)` 호출 시 (1) `b.sprite.texture` = gold radial gradient (BALLOON_PALETTE.gold), (2) `b.sprite.tint` = 0xFFFFFF, (3) `b.sprite.width/height` = `BALLOON_BASE_DIAMETER × SIZE_RATIO[b.size] × 1.1`, (4) `b.sprite.filters`에 GlowFilter(color 0xFFD700, outerStrength 2.0, distance 28) 존재** | unit test (mock BalloonEntity + mock getBalloonTexture) |

---

## 9. Implementation Checklist

> 본 1-pager는 M0 prototype 범위. AC → 자동화 테스트 전 매핑은 Phase D (devops-engineer) 빌드 인프라 완성 후 채움. PROCEED 후 M1에서 정식 9섹션 GDD 승격 (m1-pre-production.md §retrofit).

### 진입점

- main entry (systems-index §Engine Bootstrap) Pixi v8 boilerplate → `GameLoop.start()` → `app.ticker.add((t) => balloonSystem.update(t.deltaMS / 1000))` 매 frame
- `input-system` → `balloonSystem.onFire()` / `.onDragStart(x)` / `.onDragMove(x)` / `.onDragEnd()` 이벤트 핸들러 (virtual stick 4-method API)

> art-bible §1.4: 샘플 HTML은 visual target reference. CSS `backdrop-filter` 등 CSS 구현을 Pixi에 이식 금지 — `BlurFilter`·`GlowFilter` 등 Pixi v8 idiom 사용.

### 호출 경로 (구현 시 grep 검증)

- [ ] `BalloonSystem.update(dt)` — gravity + position + wall bounce + collision + spawn timer (§3.8.1)
- [ ] `BalloonSystem.spawn(t)` — `SPAWN_COUNT_AT(t)` 함수 호출, `rng.spawn.nextInt` 사용 (인덱스 접근). **spawn 직후 `criticalPop.onBalloonSpawned(balloon)` 직접 hook 호출** (critical-pop §3.1 — M0 prototype 단순화, M1 retrofit 시 `balloon:spawned` event emit)
- [ ] `BalloonSystem.removeBalloon(id)` — public removal API (Critical Pop 연쇄팝에서 호출, critical-pop §3.3). balloon 즉시 제거 + `balloon:popped({ isCritical: false })` emit (재귀 방지 — critical-pop §3.3 E9)
- [ ] `HarpoonSystem.fire(x, bottomY)` — `input:fire` 핸들러, max 1 active 가드. `x = character.x` (이후 고정), `bottomY = character.y - HARPOON_SPAWN_OFFSET_Y` (이후 고정), `topY = bottomY` (length 0 시작)
- [ ] `CharacterEntity.setX(x)` — `input:dragMove` 핸들러, clamp (`y` 변경 안 함)
- [ ] `Collision.balloonHarpoonLine()` (원-라인 segment, Small +6px) — X: `|balloon.x - harpoon.x| ≤ balloon.radius + HARPOON_LINE_WIDTH/2`. Y: balloon이 `[topY, bottomY]` 교차. Critical balloon: 분열 skip + 즉시 제거 + `balloon:popped({ isCritical: true })`. 일반: emit `balloon:split` + `balloon:popped({ isCritical: false })`. **emit 전에 `activeBalloons`에서 제거 — Critical Pop의 self-exclusion 보장 (critical-pop §3.3)**
- [ ] `Collision.balloonCharacter()` (원-원, `CHARACTER_HITBOX_RADIUS`, SPAWN_IMMUNITY_RADIUS 면제 검사) → emit `game:over`
- [ ] `BalloonSystem.reset()` / `start()` / `end()` — GameLoop contract (§3.8)
- [ ] GlowFilter 공유 인스턴스 4종 생성 (Large / Medium / Small / Critical Gold — Critical Gold는 size 무관 단일 인스턴스) — §3.1
- [ ] `balloonContainer.sortableChildren = true` 설정

### AC → 테스트 매핑 (Phase D 후 채움)

| AC | Test Method |
|----|-------------|
| AC.1–3 (split) | unit (BalloonSystem.split) |
| AC.4–5 (bounce) | unit (motion solver) |
| AC.6 (game over) | integration |
| AC.7 (harpoon max 1) | unit |
| AC.8 (spawn curve) | playtest (60s 세션) — evidence 별도 폴더 기록 |
| AC.9 (60fps + GlowFilter 공유) | perf (GATE-04) — Playwright + Ticker.deltaMS |
| AC.10 (determinism) | unit (seeded rng) |
| AC.11 (reset) | unit |
| AC.12 (E1 spawn 밖) | unit + visual |
| AC.13 (자식 isCritical false) | unit |
| AC.14 (E7 immunity 거리) | unit (boundary @ 74/75/76px) |
| AC.15 (dt 단위) | unit (mock ticker) |

### 빌드 검증

- [ ] `npm run build` exit 0 (GATE-01)
- [ ] 실기 60s 세션 60fps 유지 + GlowFilter 공유 인스턴스 4종 동작 검증 (GATE-04, AC.9)
- [ ] BALLOON_MAX_ACTIVE 30 + GlowFilter 공유 시 draw call < 30 (개별 인스턴스 사용 회귀 방지)
