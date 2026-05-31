# Visual Juice System

> **Status**: Draft (M0 prototype 1-pager, post-review v1.1)
> **Author**: gentlius + Claude (audio-director 협업)
> **Last Updated**: 2026-05-31
> **Implements Pillar**: P2 (화면이 점수보다 먼저 말한다) — Visual·Audio 응답이 게임 상태 인지 주채널 / P3 (운은 자주, 실력은 깊게) — Critical 다크닝 + 5콤보 ring으로 극대 시각 보상
> **Engine target**: Pixi.js v8 + Web Audio API
> **Scope note**: M0 prototype 범위 1-pager. 9섹션 헤더 유지 + §Audio Note 흡수 (audio-director M0 Direction v2). M1 PROCEED 후 정식 GDD 승격.

---

## 1. Overview

Visual Juice System은 POP!의 **시청각 cross-cutting 피드백 단일 권한자**다. 8개 이벤트 listen + 시각 효과 발현 + SFX trigger + BGM 관리. 이벤트 우선순위 매트릭스로 동시 발생 시 충돌 해소.

**책임 5건**:
- (a) **Pop particle** — balloon:popped 시 size별 차등 파티클 (Pixi ParticleContainer)
- (b) **Critical 다크닝 시퀀스** — criticalPop:fired 시 art-bible §2.1 S3 0.2s 완결 시퀀스
- (c) **5콤보 글로우 ring** — combo:milestone 시 캐릭터 주변 HERO tier glow 변형 (0.5s)
- (d) **Score popup float** — score:updated 시 (x, y)에서 부유 (pool 20개)
- (e) **Audio trigger + BGM** — Web Audio API 직접 호출. §Audio Note 참조

> **P2 listener lock**: `GameLoop.start()` 시 **Visual Juice listener를 Score & Combo보다 먼저 등록** → 시각·청각이 점수 emit 전에 발화 (score-combo §1 + §6).

> **art-bible §1.2 Layered Translucency 귀속**: 파티클·5콤보 ring·Score popup·다크닝 overlay·화이트 플래시 = 모두 **bloom 레이어** (vfxContainer L3). 4층 ("frosted sky → balloon glass body → neon rim → bloom") 중 최상위.

> **권한 경계**: vfxContainer (L3) + uiContainer (L4) + **게임플레이 layer alpha 변경 (game:over fade — 권한 예외 1건)**. Critical 다크닝은 vfxContainer 내 `_darkenOverlay` sprite로 처리 (bgContainer ColorMatrixFilter 방식 폐기). 그 외 다른 시스템 entity·container 절대 modify 금지. 데이터는 listen으로만 수신.

---

## 2. Player Fantasy

**감정 목표**: 손가락이 결과를 만들기 전에 화면과 소리가 먼저 "지금 무엇이 일어났는지" 알린다 — P2 약속의 실체.

플레이어가 풍선을 터뜨릴 때마다 파티클이 폭발하고, Critical 순간에는 화면 전체가 0.2초 다크닝되며 골드 림과 화이트 플래시가 폭발 보상감을 안긴다. 5콤보 마일스톤 도달 시 캐릭터 주변에 글로우 ring이 0.5초 발현 — "지금 흐름 좋다" 인지가 점수 숫자보다 먼저 도착한다. SFX는 size별·이벤트별 차등으로 청각 채널을 통해 같은 정보를 강화. 시각·청각이 합성되어 매 pop이 "한 번 더" 욕구를 자극.

---

## 3. Detailed Rules

### 3.1 이벤트 우선순위 매트릭스

동시 frame 이벤트 발생 시 시각·청각 채널 충돌 해소:

| 우선순위 | 이벤트 | 시각 영향 | 청각 영향 |
|---------|--------|---------|---------|
| 1 (최고) | `criticalPop:fired` | **cool blue overlay (vfxContainer alpha 0→0.6→0)** + **캐릭터 화이트-핫 GlowFilter 0.20s** + 골드 림 + 화이트 플래시 + 50 chained particles | critical SFX + BGM ducking -4dBFS 0.1s |
| 2 | `game:over` | 게임플레이 layer (bgContainer + balloonContainer + harpoonContainer) alpha fade out 0.5s (권한 예외) | gameover SFX + BGM fade-out 0.3s |
| 3 | `combo:milestone (tier=5)` | 캐릭터 주변 글로우 ring 0.5s (HERO tier `#FFD700`) | combo_tier2 SFX (10ms delay — 마스킹 방지) |
| 4 | `balloon:popped (isCritical: false)` | Pop particle (size별 차등) + Score popup at (x, y) | balloon_pop_large 또는 small SFX |
| 5 | `balloon:split` | **parent 위치 particle burst (parent.color, POP_PARTICLE_COUNT[parent.size])** + 자식 squash/stretch ±5% 시각 (art-bible §3.3) | (balloon_pop_large가 split + pop 겸임) |
| 6 | `input:fire` | **M0 시각 효과 0** — harpoon entity spawn (balloon-physics-split §3.5)이 충분한 시각 응답으로 가정. **M1 retrofit: 캐릭터 launcher 끝 0.05s flash 검토** | harpoon SFX |
| 7 | `score:updated` | Score popup at (x, y) — pool 20개 | (SFX 없음 — balloon:popped로 충분) |
| 8 | `combo:reset` | **M0 시각·청각 0 단순화** (콤보 끊김을 실패 신호로 강조하지 않고 조용히 처리). PG-06 playtest 시 "콤보 끊김 인지 부족" 피드백 수집 (AC.19) | — |

> **Critical + 5콤보 동시 발생 (E1)**: 두 이벤트 모두 `#FFD700` 사용. **의도적 시각 합산** — "Critical이 5콤보를 건드렸다"는 강화 보상감 (P3 정합). 다크닝 = 전 화면 / ring = 캐릭터 주변 — 공간·형태·시간 프로파일이 모두 달라 합산 인지 자연.

### 3.2 Pop particle 시스템

**Glass Shard Particle 시각 사양** (art-bible §1.2 Layered Translucency 정합 — frosted glass 깨짐):

| 항목 | 사양 |
|------|------|
| Texture canvas | 32×32 px (작게 그릴 때 인지 보장 — 14px 이하는 둥글게 보임) |
| Vertex 수 | **3-4 vertex만** (sharp 삼각형/사각형). 5+ vertex 거부 — 작게 그릴 때 원형 인지 |
| Texture 종류 | **4 종류 랜덤** (2 triangle: 등변·sliver + 2 quad: chunky·kite). spawn 시 랜덤 선택 |
| Layer 1 — frosted base | polygon fill `0xffffff` **alpha 0.45** (반투명 — tint multiply로 풍선 색 반사) |
| Layer 2 — inner brighter | smaller polygon (scale 0.6) fill `0xffffff` **alpha 0.65** (내부 광택) |
| Layer 3 — rim stroke | polygon stroke `1.2px` `0xffffff` **alpha 0.95** (sharp white edge) |
| Layer 4 — specular hot-spot | 작은 원 `radius 1.8px` `0xffffff` **alpha 1.0** (광택점) |
| Tint | `parent.color` (multiply) — 풍선 색이 반투명 통해 살짝 비침 |
| Lifetime | 1.2s (linear alpha + scale fade) |
| Tumbling | 초기 rotation random + angularVel `±8 rad/s` random (구르는 깨진 유리) |
| Speed | `POP_PARTICLE_SPEED_MIN/MAX 80-200 px/s`, angle random (360° burst) |
| Cap | 200 동시 활성 (FIFO eviction, §E3) |

> **튜닝 히스토리** (사용자 실기 확인): base alpha 0.30 → 너무 흐림 / 0.60 → 너무 진함 / **0.45 채택** (중간값, 풍선 색 보존 + frosted 느낌 유지)



```js
// Pixi v8 ParticleContainer (성능 — 200개 동시 안전)
const popParticleContainer = new ParticleContainer({ maxSize: 200, properties: { position: true, scale: true, alpha: true, rotation: true } })
vfxContainer.addChild(popParticleContainer)

// VFX-only 난수: Math.random() 직접 허용 (gameplay determinism과 무관, §Conventions rng wrapper는 spawn·critical 도메인 한정)
const vfxRandom = () => Math.random()

// balloon:popped 처리
onBalloonPopped(event) {
  if (activeParticles.length + POP_PARTICLE_COUNT[event.size] > POP_PARTICLE_CAP) {
    // FIFO cap 관리 (게임 코드에서 직접) — ParticleContainer maxSize는 자동 처리 안 함
    const overflow = activeParticles.length + POP_PARTICLE_COUNT[event.size] - POP_PARTICLE_CAP
    for (let i = 0; i < overflow; i++) particlePool.release(activeParticles.shift())
  }
  const count = POP_PARTICLE_COUNT[event.size]
  for (let i = 0; i < count; i++) {
    const p = particlePool.acquire()
    p.position.set(event.x, event.y)
    const angle = vfxRandom() * Math.PI * 2
    const speed = POP_PARTICLE_SPEED_MIN + vfxRandom() * (POP_PARTICLE_SPEED_MAX - POP_PARTICLE_SPEED_MIN)
    p.vx = Math.cos(angle) * speed
    p.vy = Math.sin(angle) * speed
    p.lifetime = POP_PARTICLE_LIFETIME
    p.color = event.color
    activeParticles.push(p)
  }
}

// update(dt)
for (const p of activeParticles) {
  p.lifetime -= dt
  if (p.lifetime <= 0) { particlePool.release(p); continue }
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.alpha = p.lifetime / POP_PARTICLE_LIFETIME
  p.scale.set(p.alpha)
}
```

### 3.3 Critical 다크닝 시퀀스 (criticalPop:fired)

> **(2026-05-31)**: 기존 `bgContainer ColorMatrixFilter.brightness(0.3)` (회색 어둡게) 명세 → **SUPERSEDED**. art-bible §2.1 S3 "Deep Cool Blue" 색조 명세와 불일치하고 bgContainer 외 레이어(balloon, harpoon, ui)가 어두워지지 않아 임팩트 부족했던 것이 교체 이유. Cool Blue Overlay Sprite로 교체. 하기 명세가 현재 구현의 단일 진실.

**Cool Blue Overlay Sprite** — vfxContainer (L3) zIndex 9:

- color: `DARKEN_OVERLAY_COLOR = 0x0a1f3a` (deep cool blue — sample HTML §critical-state .sky-bg L222 정합)
- alpha tween 0 → 0.6 → 0, 5-phase state machine:

```
t=0.00–0.05s  ramp-in   : overlay alpha 0 → 0.6 (linear)
              BGM ducking: gain 0.35 → 0.18 ramp
              critical SFX 재생 시작 (GainNode 1.0)
t=0.05–0.10s  flash     : overlay alpha 0.6 유지 + white flash Sprite(zIndex 10) alpha 0.6→0
t=0.10–0.15s  hold      : overlay alpha 0.6 유지 + 골드 림(#FFD700) Critical 본체만 outline
              Pop particle (Critical Gold) 본체 위치 50개 발현
t=0.15–0.20s  ramp-out  : overlay alpha 0.6 → 0 (linear)
              BGM ducking restore: gain 0.18 → 0.35 ramp
t=0.20s       idle      : overlay.visible = false. 시퀀스 완결. BGM 정상 볼륨
```

**구현 사항**:
- `_darkenOverlay` Sprite: initTextures()에서 1×1 Graphics `fill(0x0a1f3a)` → generateTexture → Sprite width/height = 화면 전체. zIndex 9 (white flash zIndex 10 아래). vfxContainer.addChild.
- Tween 패턴: 자체 ticker 누적 + `_darkenOverlay.alpha` 매 frame 갱신 (Pixi v8 tween 내장 없음)
- bgContainer ColorMatrixFilter 방식 **폐기** — cool blue overlay가 vfxContainer 최상위에서 bg + balloon + harpoon + ui 전 layer를 어둡게 표현
- 시퀀스 진행 중 추가 criticalPop:fired 발생 시: 현재 시퀀스 즉시 중단 + 새 시퀀스 시작 (E2, §E2)

### 3.3-B 캐릭터 화이트-핫 글로우 (criticalPop:fired)

> **(2026-05-31)**: Critical 진입 시 character sprite GlowFilter swap 0.20s. 어두운 배경 위에서 캐릭터 발광이 플레이어 시선을 캐릭터로 집중시키는 Critical 임팩트 cue — art-bible §S3 "캐릭터 silhouette 화이트-핫" + sample HTML B 정합.

**Critical 진입 시 (`_startDarkening()` 호출 시점)**:
1. `_charOrigFilters = charSprite.filters` 백업
2. `charSprite.filters = [_charGlowFilter]` swap
3. `_charGlowTimer = 0.20s` 시작

**GlowFilter 파라미터** (`_charGlowFilter`, 인스턴스 1개 constructor에서 생성):
```
GlowFilter({
  distance:      30,
  outerStrength: 2.5,
  innerStrength: 0,
  color:         0xFFFFFF,   // 화이트-핫
  quality:       0.5,
})
```

**0.20s 후 원상복구** (`_updateDarkening()` timer tail):
- `charSprite.filters = _charOrigFilters ?? []`
- `_charOrigFilters = null`

**API contract**: visual-juice `VisualJuiceOptions`에 `getCharacterSprite?: () => Sprite | null` 옵션. GameLoop이 `attachVisualJuice({ ..., getCharacterSprite: () => balloonSystem.getCharacter().sprite })` wiring. 옵션 미전달 시 캐릭터 glow 효과 skip (silent — 다크닝은 정상 진행).

### 3.4 5콤보 글로우 ring (combo:milestone)

```js
onComboMilestone(event) {
  if (event.tier !== MILESTONE_COMBO) return    // tier 검사 (M0는 5만 처리)
  // 기존 ring 활성 시 즉시 제거 (E5)
  if (activeRing) vfxContainer.removeChild(activeRing)
  // 새 ring spawn
  activeRing = new Sprite(ringTexture)           // pre-rendered circle texture, tint = #FFD700
  activeRing.anchor.set(0.5, 0.5)
  activeRing.position.set(character.x, character.y)
  activeRing.tint = 0xFFD700                     // HERO tier (art-bible §4.2)
  activeRing.alpha = RING_ALPHA_START
  activeRing.scale.set(RING_RADIUS_START / ringTexture.width)
  activeRing.lifetime = RING_LIFETIME
  vfxContainer.addChild(activeRing)
  audioManager.play('combo_tier2', 0.7, 10)      // 10ms delay
}

// update(dt) — ring 매 frame 갱신
if (activeRing) {
  activeRing.lifetime -= dt
  if (activeRing.lifetime <= 0) {
    vfxContainer.removeChild(activeRing); activeRing = null
  } else {
    const progress = 1 - (activeRing.lifetime / RING_LIFETIME)
    activeRing.scale.set(lerp(RING_RADIUS_START, RING_RADIUS_END, progress) / ringTexture.width)
    activeRing.alpha = (1 - progress) * RING_ALPHA_START
  }
}
```

- **ring texture**: 절차적 생성 (런타임 `Graphics().circle(0, 0, 64).fill(0xFFFFFF)` → `app.renderer.generateTexture(graphics)`) — PNG 파일 없음, asset bundle 영향 0
- Sprite + tint + scale animation 패턴 — Graphics 재드로우 회피 (60fps 안전)
- 단일 active ring만 유지 (E5 — 신규 발현 시 기존 즉시 제거)
- art-bible §4.2 HERO tier glow 변형 (Critical Gold와 동일 hex `#FFD700` 사용)

### 3.5 Score popup float (score:updated)

```js
// pool: 20개 Pixi Text pre-allocate (vfxContainer)
// M1 retrofit: BitmapText로 마이그레이션 — text 변경 시 atlas rebuild 회피, 성능 ↑
onScoreUpdated(event) {
  const popup = scorePopupPool.acquire()        // pool 고갈 시 FIFO (가장 오래된 release)
  popup.text = `+${Math.floor(event.delta)}`    // 정수 표시 (소수점 노출 안 함)
  popup.position.set(event.x, event.y - 20)
  popup.alpha = 1.0
  popup.lifetime = SCORE_POPUP_LIFETIME          // 0.8s
}

update(dt) {
  for (const p of activePopups) {
    p.lifetime -= dt
    if (p.lifetime <= 0) { scorePopupPool.release(p); continue }
    p.y -= SCORE_POPUP_FLOAT_SPEED * dt          // 부유 (50 px/s)
    p.alpha = p.lifetime / SCORE_POPUP_LIFETIME
  }
}
```

- pool 20개 (UI 성능 안전망 — score-combo §6 Downstream 정합)
- 동일 frame 복수 score:updated (Critical chain 4개 popup) → 각 풍선 위치 (x, y) 공간 분리로 발현 (chained balloon x/y 서로 다름)
- **M1 BitmapText 마이그레이션 비고**: Pixi v8 `Text` 객체 text 변경 시 internal dirty flag → 다음 render에서 canvas/atlas 재생성. pool 20개 × 0.8s lifetime ≈ 동시 활성 8-10개로 M0 허용 범위. M1에서 `BitmapText` (glyphs pre-baked atlas) 전환 권장

### 3.6 Audio trigger 매트릭스

§Audio Note 페이지 하단 참조. 8 이벤트 각각 SFX 매핑 + Mix + Ducking + 라이선스 관리 + Web Audio AudioContext unlock 패턴.

### 3.7 GameLoop Contract + Listener 등록 순서 (P2 lock)

`app.init({...})` 완료 → `GameLoop.start()` **직전 1회만, 순서 lock**:
1. **Visual Juice listener 먼저 (P2 lock)**: `visualJuice.attachListeners(balloonSystem, criticalPopSystem, scoreComboSystem, inputSystem)`
2. **Score & Combo listener 그 다음** (score-combo §9 IC)
3. **AudioContext unlock 등록**: `inputSystem.once('input:fire', () => audioManager.unlock())` + `inputSystem.once('input:dragStart', () => audioManager.unlock())` — 브라우저 autoplay 정책 우회

`GameLoop.start()` → `app.ticker.add((t) => visualJuice.update(t.deltaMS / 1000))` 매 frame + `audioManager.bgmStart('primary')` (BGM Primary 트랙 default 재생)
`GameLoop.reset()` → `visualJuice.reset()` (전 vfx 제거 + `audioManager.bgmStop()` + 재시작)
`GameLoop.end()` → ticker 제거, 상태 freeze, BGM fade-out 0.3s

---

## 4. Formulas

### 4.1 Pop particle

```
POP_PARTICLE_COUNT = { Large: 30, Medium: 20, Small: 10, CriticalBody: 50 }
POP_PARTICLE_SPEED_MIN = 80 px/s
POP_PARTICLE_SPEED_MAX = 200 px/s
POP_PARTICLE_LIFETIME  = 1.2 s
POP_PARTICLE_CAP       = 200 (FIFO 게임 코드 cap)

매 frame:
  alpha = lifetime / POP_PARTICLE_LIFETIME    (1.0 → 0.0)
  scale = alpha                                (1.0 → 0.0 동기)
  x += vx * dt
  y += vy * dt
```

### 4.2 다크닝 시퀀스 timing (총합 0.20s — art-bible §1.3 "0.2초 미만" 충족)

> 아래 수식의 제어 대상은 `_darkenOverlay.alpha` (cool blue overlay). 기존 `ColorMatrixFilter.brightness()` 수식 → **SUPERSEDED** (§3.3 교체 사유 참조).

```
DARKEN_RAMP_SEC       = 0.05s   (phase 1회 duration)
DARKEN_OVERLAY_COLOR  = 0x0a1f3a (deep cool blue — art-bible §2.1 S3 정합)
DARKEN_PEAK_ALPHA     = 0.6

t=0.00 ~ 0.05s  ramp-in : overlay.alpha = 0.6 × (t / 0.05)
t=0.05 ~ 0.10s  flash   : overlay.alpha = 0.6 (유지) + white flash alpha 0.6→0.0
t=0.10 ~ 0.15s  hold    : overlay.alpha = 0.6 (유지) + 골드 림 + 50 particle 발현
t=0.15 ~ 0.20s  ramp-out: overlay.alpha = 0.6 × (1 - (t / 0.05))

BGM ducking timeline:
t=0.00 ~ 0.05s: gain 0.35 → 0.18 ramp
t=0.15 ~ 0.20s: gain 0.18 → 0.35 ramp
```

### 4.3 5콤보 ring

```
RING_RADIUS_START = character.width × 1.5
RING_RADIUS_END   = character.width × 2.5  (1.5배 확장)
RING_ALPHA_START  = 0.85
RING_LIFETIME     = 0.5 s

매 frame:
  progress = 1 - (lifetime / RING_LIFETIME)
  ring.scale = lerp(RING_RADIUS_START, RING_RADIUS_END, progress) / ringTexture.width
  ring.alpha = (1 - progress) × RING_ALPHA_START
```

### 4.4 Score popup

```
SCORE_POPUP_FLOAT_SPEED = 50 px/s (위로)
SCORE_POPUP_LIFETIME    = 0.8 s
SCORE_POPUP_POOL_SIZE   = 20

매 frame:
  y -= SCORE_POPUP_FLOAT_SPEED * dt
  alpha = lifetime / SCORE_POPUP_LIFETIME
```

---

## 5. Edge Cases

| ID | 상황 | 동작 |
|----|------|-----|
| E1 | 동일 frame `criticalPop:fired` + `combo:milestone` (Critical chain으로 5콤보 cross) | **의도적 시각 합산** — Critical 다크닝(전 화면) + ring(캐릭터 주변) 동시 발현. 골드 색 겹침 = "Critical이 5콤보를 건드렸다" 강화 보상 (P3 정합) |
| E2 | criticalPop:fired 진행 중 (0.2s) 또 다른 criticalPop:fired | 현재 시퀀스 즉시 중단 + 새 시퀀스 시작. BGM ducking ramp 자동 덮어씀 |
| E3 | Pop particle 200개 cap 도달 | **FIFO 게임 코드 cap 관리** (ParticleContainer maxSize 자동 처리 안 함). `activeParticles.shift()` + `pool.release()` 후 신규 발현 |
| E4 | Score popup pool 20개 cap 도달 | 가장 오래된 popup release. 신규 발현 |
| E5 | combo:milestone 시 5콤보 ring 활성 중 새 streak 5콤보 도달 | 기존 ring 즉시 제거 + 새 ring spawn. 단일 active ring만 유지 |
| E6 | game:over 발생 시 진행 중 다크닝/ring/popup | 모든 vfx 즉시 제거 + 게임플레이 layer (bgContainer + balloonContainer + harpoonContainer) alpha fade 0.5s (권한 예외) + gameover SFX + BGM fade-out 0.3s. **RETRY 탭 활성화는 fade 시작과 동시** (fade 완료 기다리지 않음 — input-system AC.9 "데스→탭 ≤1초" 동기) |
| E7 | `combo:reset` 발생 | 시각·청각 0 (M0 단순화, PG-06 playtest 시 "콤보 끊김 인지 부족" 피드백 수집) |
| E8 | balloon:split 이벤트 | 자식 squash/stretch ±5% 시각. **자식 floating 6s 주기 = balloon-physics-split 소유** (Visual Juice는 splat/stretch 만, position 기반 sine wave는 balloon-physics-split §3.3 책임) |
| E9 | BGM 초기 로드 실패 (asset 없음) | 게임플레이 정상 진행 (silent BGM). console.warn 1회. M0 prototype 허용 |
| E10 | AudioContext suspended 상태 (브라우저 autoplay 정책) | 첫 `input:fire` 또는 `input:dragStart` 핸들러에서 `audioManager.unlock()` (`ctx.resume()`) 호출. 그 전까지 모든 audio call은 silent (E9와 동일 폴백) |
| E11 | `GameLoop.reset()` 중 BGM 재시작 | `audioManager.bgmStop()` (기존 `AudioBufferSourceNode.stop()`) + 새 `AudioBufferSourceNode` 생성 후 `bgmStart('primary')`. AudioBufferSourceNode는 stop 후 재사용 불가 — 매번 새 인스턴스 |

---

## 6. Dependencies

**Upstream** (listen):
- `balloon-physics-split` — `balloon:popped({id, size, x, y, color, isCritical})` + `balloon:split({parent, children})` listen. **floating 6s 주기 = balloon-physics-split 소유** (시각 효과이지만 position 기반)
- `critical-pop` — `criticalPop:fired({x, y, criticalSize, chainedBalloons})` listen
- `score-combo` — `score:updated({totalScore, delta, combo, size, x, y, sizeMultiplier, comboMultiplier})` + `combo:milestone({tier, combo})` + `combo:reset({finalCombo})` listen
- `input-system` — `input:fire` + `input:dragStart` listen (harpoon SFX + AudioContext unlock)
- GameLoop — `game:over` listen
- `systems-index §Engine Bootstrap` — `app.ticker`, `GameLoop.reset/start/end`, Z-layer (vfxContainer L3 + uiContainer L4 + **bgContainer 권한 예외**)
- `art-bible §1.2` + `§1.3` + `§2.1` + `§3.3` + `§4.2` + `§4.7` — Layered Translucency / Critical hex / S3 시퀀스 / squash & stretch / HERO tier glow / Pixi v8 컬러 구현

**Downstream** (emit):
- (없음 — Visual Juice는 cross-cutting 단말)

**Asset Dependencies**:
- `assets/audio/bgm/` 3개 트랙 (freesound.org #684184, #251461, #427513) — **lazy `import()` 분리** (게임 시작 시 로드, 초기 번들에서 제거 — art-bible §8.5 전략)
- `assets/audio/sfx/` 7개 (PowerShell 합성 6개 + freesound UI 클릭 1개) — **초기 번들에 포함**
- `assets/audio/LICENSE_REGISTRY.md` — 라이선스 리스트 관리 (SM `DOWNLOAD_GUIDE.md` 패턴, 누락 0건 정책)
- ring texture: **절차적 생성** (Graphics + `generateTexture()`) — PNG 파일 없음, bundle 영향 0

> **권한 경계**: 본 시스템은 vfxContainer + uiContainer + **게임플레이 layer (bgContainer + balloonContainer + harpoonContainer) alpha 변경 (game:over fade — 권한 예외 1건)**. 그 외 entity·container 상태 절대 modify 금지. 다른 시스템 emit으로만 데이터 수신.
> **bgContainer ColorMatrixFilter 방식 폐기**: 기존 Critical 다크닝 시 bgContainer.filters 변경 권한 → 폐기. cool blue overlay sprite (vfxContainer zIndex 9)가 대신 모든 layer를 어둡게 표현. bgContainer는 이제 game:over alpha fade (권한 예외 1건)만 수정.

---

## 7. Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|-----------|--------|
| `POP_PARTICLE_COUNT.Large` | 30 | 20–50 | Large balloon pop 파티클 수 |
| `POP_PARTICLE_COUNT.Medium` | 20 | 15–35 | Medium balloon pop 파티클 수 |
| `POP_PARTICLE_COUNT.Small` | 10 | 5–20 | Small balloon pop 파티클 수 |
| `POP_PARTICLE_COUNT.CriticalBody` | 50 | 30–80 | Critical balloon 본체 파티클 수 |
| `POP_PARTICLE_SPEED_MIN/MAX` | 80–200 px/s | 60–300 | 파티클 분산 속도 |
| `POP_PARTICLE_LIFETIME` | 1.2 s | 0.5–2.0 | 파티클 지속 (Glass Shard 가시성 — §Glass Shard Particle 시각 사양 정합) |
| `POP_PARTICLE_CAP` | 200 | 150–300 | FIFO 게임 코드 cap (ParticleContainer maxSize와 동일) |
| `RING_RADIUS_START` | character.width × 1.5 | 1.2–2.0 | 5콤보 ring 시작 반경 |
| `RING_RADIUS_END` | character.width × 2.5 | 2.0–3.5 | 5콤보 ring 종료 반경 |
| `RING_LIFETIME` | 0.5 s | 0.3–1.0 | 5콤보 ring 지속 |
| `SCORE_POPUP_FLOAT_SPEED` | 50 px/s | 30–100 | Score popup 위로 부유 속도 |
| `SCORE_POPUP_LIFETIME` | 0.8 s | 0.5–1.5 | Score popup 지속 |
| `SCORE_POPUP_POOL_SIZE` | 20 | 15–40 | Pool cap (M1 BitmapText 마이그레이션 비고) |
| `DARKEN_DURATION` | 0.05 s | 0.03–0.10 | Critical 다크닝 in/out ramp 시간 (각 phase) |
| `DARKEN_OVERLAY_COLOR` | `0x0a1f3a` (deep cool blue) | — | overlay sprite fill color. sample HTML §critical-state 정합 |
| `DARKEN_OVERLAY_PEAK_ALPHA` | `0.6` | `0.4–0.85` | overlay 피크 alpha. ↑ = 임팩트 ↑, 시각 가독성 ↓ |
| `CHAR_GLOW_DURATION_SEC` | `0.20` s | `0.10–0.30` | 캐릭터 화이트-핫 GlowFilter swap duration. 다크닝 총 시퀀스(0.20s)와 정합 권장 |
| `WHITE_FLASH_ALPHA` | 0.6 | 0.4–0.8 | 화이트 플래시 강도 |
| `BGM_DUCK_GAIN` | 0.18 | 0.10–0.25 | Critical 중 BGM ducking 볼륨 (기본 0.35 → 0.18) |
| `GAMEOVER_FADE_DURATION` | 0.5 s | 0.3–1.0 | game:over 게임플레이 layer alpha fade |

---

## 8. Acceptance Criteria

| ID | 기준 | 검증 방법 |
|----|------|---------|
| AC.1 | balloon:popped 수신 → size별 정확한 파티클 count + (x, y) spawn + 풍선 color 상속 | unit test |
| **AC.1-Split** | **balloon:split 수신 → parent 위치 (parent.x, parent.y)에 POP_PARTICLE_COUNT[parent.size]개 파티클 burst + parent.color 상속** | unit test |
| AC.2 | Pop particle lifetime 1.2s 정확 + alpha/scale linear fade | unit test |
| AC.3 | Pop particle 200개 cap 도달 시 FIFO 제거 (`activeParticles.shift() + pool.release()`) + 신규 발현 정상 (E3) | unit test |
| AC.4 | criticalPop:fired 수신 → 0.2s 완결 시퀀스 (0.05s ramp in + 0.05s flash + 0.05s 유지 + 0.05s ramp out, 총합 0.20s) | integration test (manual smoke M0, automated M1) |
| **AC.4-VIS-02** | **criticalPop:fired 수신 → `_darkenOverlay.alpha` 0→0.6→0 정확. 피크 0.6 ±0.05, 총 duration 0.20s ±16ms (1 frame). overlay color = 0x0a1f3a (cool blue). bgContainer.filters 변경 0건 (cmFilter 폐기)** | integration test (manual smoke M0) |
| **AC.4-VIS-03** | **criticalPop:fired 수신 → `charSprite.filters`에 white GlowFilter (color 0xFFFFFF, outerStrength 2.5, distance 30) swap. 0.20s 후 원본 filters 복구. dragMove/onFire 등 game action 발생해도 timer에 영향 없음** | integration test |
| AC.5 | criticalPop:fired 진행 중 추가 criticalPop:fired → 현재 시퀀스 중단 + 새 시퀀스 시작 (E2) | unit test |
| AC.6 | combo:milestone(tier=5) 수신 → ring 0.5s 발현 + combo_tier2 SFX 10ms delay 재생. **`event.tier !== 5` 시 무시** (mn2) | integration test |
| AC.7 | score:updated 수신 → Score popup at (x, y - 20) spawn + 0.8s float + fade. `+${Math.floor(delta)}` 정수 표시 | unit test |
| AC.8 | Score popup pool 20개 cap → 가장 오래된 release + 신규 acquire | unit test |
| AC.9 | input:fire 수신 → harpoon SFX 재생 (max 1 active). 시각 효과 0 (M0 단순화) | unit test |
| AC.10 | game:over 수신 → 게임플레이 layer (bgContainer + balloonContainer + harpoonContainer) alpha fade 0.5s + gameover SFX + BGM fade-out 0.3s. **RETRY 탭 활성화는 fade 시작과 동시** (E6) | integration test |
| AC.11 | combo:reset 수신 → 시각·청각 0 (M0 단순화) | unit test |
| AC.12 | 동일 frame Critical + 5콤보 → 다크닝(bgContainer) + ring(vfxContainer) 동시 발현 (의도적 합산) | integration test |
| AC.13 | `GameLoop.reset()` 호출 시 전 vfx 제거 + `audioManager.bgmStop()` + 재시작 (E11) | unit test |
| AC.14 | 60fps 유지 — Critical 발생 + Pop particle 200개 cap + Score popup 20개 + 5콤보 ring 동시 시 iPhone 11 Safari 15 P50 ≥ 58fps (GATE-04) | perf test |
| AC.15 | Web Audio API 직접 호출 — @pixi/sound 의존 0건 (technical-preferences.md lock) | code review (grep) |
| AC.16 | BGM 3개 트랙 + SFX 7개 라이선스 명시 — `assets/audio/LICENSE_REGISTRY.md`에 각 freesound.org URL + 라이선스 표기 (누락 0건) | manual audit |
| AC.17 | vfxContainer + uiContainer + bgContainer (Critical 다크닝) + 게임플레이 layer fade (game:over) 외 stage·container 변경 0건 — 권한 경계 검증 | code review (grep) |
| AC.18 | Visual Juice listener가 Score & Combo보다 먼저 등록 (P2 lock) — `attachListeners` 호출 순서 grep | code review |
| AC.19 | **PG-06 기여 (ADVISORY)** — 5명 플레이테스터 중 4명이 "pop SFX + 파티클 피드백이 조작감을 높인다"고 응답. 추가 항목: "콤보 끊김 (combo:reset) 인지 가능 여부" 피드백 수집 | playtest post-session 인터뷰 |
| AC.20 | AudioContext unlock — 첫 `input:fire` 또는 `input:dragStart` 시 `ctx.resume()` 호출. 그 전까지 모든 audio call은 silent fallback (E10) | unit test (mock AudioContext) |
| AC.21 | Bundle <600KB — SFX 7개 초기 번들 포함, BGM 3트랙 lazy `import()` 분리 (art-bible §8.5 전략) | build report (GATE-05) |

---

## 9. Implementation Checklist

> M0 prototype 범위. AC → 자동화 테스트 매핑은 Phase D 후. M1 retrofit: BitmapText 마이그레이션 + launcher flash + 10/20 마일스톤 + Power-up vfx + Master Volume Slider.

### 진입점 + Listener 등록 (P2 lock + AudioContext unlock)

- `app.init({...})` 완료 → `GameLoop.start()` **직전 1회만**:
  1. **Visual Juice 먼저 (P2 lock)**: `visualJuice.attachListeners(balloonSystem, criticalPopSystem, scoreComboSystem, inputSystem)`
  2. Score & Combo 그 다음 (score-combo §9 IC)
  3. **AudioContext unlock**: `inputSystem.once('input:fire', () => audioManager.unlock())` + `inputSystem.once('input:dragStart', () => audioManager.unlock())`
- `GameLoop.start()` → `app.ticker.add((t) => visualJuice.update(t.deltaMS / 1000))` + `audioManager.bgmStart('primary')`
- `GameLoop.reset()` → `visualJuice.reset()` → `audioManager.bgmStop()` + 재시작
- `GameLoop.end()` → BGM fade-out 0.3s

### 호출 경로

- [ ] `VisualJuiceSystem.update(dt)` — 파티클·popup·ring·다크닝 ramp 매 frame 갱신
- [ ] `VisualJuiceSystem.onBalloonPopped(event)` — Pop particle (FIFO cap 관리) + size별 SFX + isCritical=false 시 combo_tier1 SFX
- [ ] `VisualJuiceSystem.onCriticalPopFired(event)` — **cool blue overlay 다크닝 시퀀스 (_darkenOverlay, vfxContainer zIndex 9)** + **캐릭터 화이트-핫 GlowFilter 0.20s swap (_charGlowTimer)** + 화이트 플래시 (vfxContainer zIndex 10) + 골드 림 (Critical 본체만) + 50 particle + critical SFX + BGM ducking
- [ ] `VisualJuiceSystem.onBalloonSplit(event)` — 자식 squash/stretch ±5% (별도 SFX 없음)
- [ ] `VisualJuiceSystem.onScoreUpdated(event)` — Score popup pool.acquire + float
- [ ] `VisualJuiceSystem.onComboMilestone(event)` — `event.tier !== 5` 시 return + ring spawn + combo_tier2 SFX 10ms delay
- [ ] `VisualJuiceSystem.onComboReset(event)` — M0 시각·청각 0
- [ ] `VisualJuiceSystem.onInputFire()` — harpoon SFX (시각 0)
- [ ] `VisualJuiceSystem.onGameOver()` — 게임플레이 layer fade 0.5s + gameover SFX + BGM fade-out 0.3s
- [ ] `VisualJuiceSystem.reset()` — 전 vfx 즉시 제거 + audioManager.bgmStop() + 재시작
- [ ] `AudioManager` 모듈 (별도 파일) — `play(sfxId, volume, delayMs)` / `duck(duration)` / `bgmStart(trackId)` / `bgmStop()` / `stopAllSfx()` / `unlock()` (ctx.resume)

### AC → 테스트 매핑 (Phase D 후 채움)

| AC | Test Method |
|----|-------------|
| AC.1–3 (Pop particle + FIFO) | unit |
| AC.4–5 (Critical 다크닝 시퀀스) | integration (manual smoke M0) — evidence 별도 폴더 기록 |
| AC.6 (5콤보 ring + tier 검사) | integration |
| AC.7–8 (Score popup) | unit |
| AC.9 (harpoon SFX) | unit |
| AC.10 (game over fade + RETRY 동기) | integration |
| AC.11 (combo reset 시각 0) | unit |
| AC.12 (Critical + ring 동시) | integration |
| AC.13 (Reset + BGM 재시작) | unit |
| AC.14 (60fps peak load) | perf (GATE-04) — Playwright + Ticker.deltaMS |
| AC.15 (Web Audio direct) | code review — grep `@pixi/sound` (0건) |
| AC.16 (라이선스 누락 0) | manual audit — LICENSE_REGISTRY.md (assets/audio/ 또는 별도 폴더) |
| AC.17 (권한 경계) | code review — grep |
| AC.18 (P2 listener 순서) | code review — grep `attachListeners` 순서 |
| AC.19 (PG-06 playtest) | playtest 인터뷰 — evidence 별도 폴더 기록 |
| AC.20 (AudioContext unlock) | unit |
| AC.21 (Bundle <600KB) | build report — Vite build analyzer |

### 빌드 검증

- [ ] `npm run build` exit 0 (GATE-01)
- [ ] Bundle <600KB 확인 — SFX 초기 포함, BGM lazy 분리 (GATE-05, AC.21)
- [ ] 실기 60fps 유지 + 모든 vfx 동시 발현 + Critical 시퀀스 시 frame drop 0 (GATE-04, AC.14)
- [ ] LICENSE_REGISTRY.md에 BGM 3 + SFX 1 (UI 클릭, freesound) 명시 (AC.16)

---

## §Audio Note (audio-director M0 Direction v2 — 2026-05-31)

### Sonic Identity
**Neon Glassblowing on Frosted Sky** — 전자음 기반 경쾌함. 칩튠 아케이드 에너지 + 유리 재질감 팝 SFX. SM "Cold Precision"의 건조함 대신 색채와 물성이 있는 소리.

### BGM (freesound.org CC0, 3 트랙 다운로드, **lazy `import()` 분리**)

| Slot | 파일명 | Freesound ID | 크리에이터 | 라이선스 | 비고 |
|------|--------|-------------|-----------|--------|------|
| Primary | `mus_gameplay_loop_01.ogg` | [684184](https://freesound.org/people/Seth_Makes_Sounds/sounds/684184/) | Seth_Makes_Sounds | CC0 | 8-bit 칩튠 루프. **M0 default 트랙** |
| Backup A | `mus_gameplay_loop_02.ogg` | [251461](https://freesound.org/people/joshuaempyre/sounds/251461/) | joshuaempyre | (페이지 확인) | 아케이드 8-bit |
| Backup B | `mus_gameplay_loop_03.ogg` | [427513](https://freesound.org/people/CarlosCarty/sounds/427513/) | CarlosCarty | (페이지 확인) | 80 BPM 레트로 (피치업 필요) |

**처리**: Audacity 루프포인트 확인 + OGG q6 변환 + LUFS -16 정규화. **각 다운로드 시 라이선스 페이지 재확인 + `assets/audio/LICENSE_REGISTRY.md`에 등록 필수** (CC0/CC BY 혼재 risk).

### SFX (PowerShell 자체 합성 6개 + freesound 1개, **초기 번들 포함**)

| ID | 파일명 | 소스 | 의도 톤 | 길이 | 트리거 이벤트 |
|----|--------|-----|---------|------|------------|
| P-01 | `sfx_balloon_pop_small_01.ogg` | PowerShell (SM `gen_sfx.ps1` 재사용) | 작은 유리알 팝, 고음 (~600-900Hz) | 80-100ms | `balloon:popped({size:'Small'})` |
| P-02 | `sfx_balloon_pop_large_01.ogg` | PowerShell | 큰 유리 팝, 저음 부스트 (~200-400Hz) | 150-200ms | `balloon:popped({size:'Large' or 'Medium'})` |
| P-03 | `sfx_critical_pop_01.ogg` | PowerShell | Pitch 상승 아르페지오 + 반짝임 | 250-350ms | `criticalPop:fired` |
| P-04 | `sfx_combo_tier1_01.ogg` | PowerShell | 단음 중음 (~440Hz) | 60-80ms | `balloon:popped({isCritical:false})` (combo 1-4) |
| P-05 | `sfx_combo_tier2_01.ogg` | PowerShell | 반음 높음 (~523Hz), 밝게 | 80-100ms | `combo:milestone({tier:5})` |
| P-06 | `sfx_harpoon_fire_01.ogg` | PowerShell | Laser shoot 짧게, pitch 상승 | 80-120ms | `input:fire` |
| P-07 | `sfx_gameover_01.ogg` | PowerShell | 하강 sweeping tone | 400-600ms | `game:over` |

> **PowerShell 합성**: SM `gen_sfx.ps1` / `gen_sfx2.ps1` 스크립트 POP! repo로 복사 후 파라미터 조정.

### Mix / Ducking

| 채널 | GainNode | 피크 | 비고 |
|------|---------|------|------|
| BGM | 0.35 | -9 dBFS | Critical 중 ducking → 0.18 (0.1s) |
| SFX 일반 | 0.7 | -3 dBFS | 게임플레이 피드백 주채널 |
| Critical SFX | 1.0 | 0 dBFS | BGM ducking 동반 |
| Game Over SFX | 0.8 | -2 dBFS | BGM fade-out 0.3s 동반 |

크기별 차등: Large/Medium balloon_pop_large = 0.7 / Small balloon_pop_small = 0.55.

### Web Audio 구현 패턴 (AudioContext unlock 포함)

```js
// audio-manager.js (단일 모듈)
const ctx = new AudioContext()           // 초기 state: 'suspended' (브라우저 autoplay 정책)
const buffers = new Map()
const bgmGain = ctx.createGain(); bgmGain.gain.value = 0.35; bgmGain.connect(ctx.destination)
const sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0;  sfxGain.connect(ctx.destination)
let bgmNode = null

// AudioContext unlock — input-system 첫 fire/drag 핸들러에서 호출 (B2)
function unlock() {
  if (ctx.state === 'suspended') ctx.resume()
}

function play(sfxId, volume = 1.0, delayMs = 0) {
  const src = ctx.createBufferSource()
  src.buffer = buffers.get(sfxId)
  const g = ctx.createGain(); g.gain.value = volume
  src.connect(g).connect(sfxGain)
  src.start(ctx.currentTime + delayMs / 1000)
}

function duck(duration = 0.1) {
  bgmGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.05)
  bgmGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.05 + duration)
}

function bgmStart(trackId) {
  bgmStop()                              // 기존 중복 방지
  bgmNode = ctx.createBufferSource()
  bgmNode.buffer = buffers.get(trackId)
  bgmNode.loop = true
  bgmNode.connect(bgmGain)
  bgmNode.start()
}

function bgmStop() {
  if (bgmNode) { bgmNode.stop(); bgmNode = null }
}

function stopAllSfx() { /* 진행 중 SFX 강제 종료 — game:over 시 */ }

export const audioManager = { unlock, play, duck, bgmStart, bgmStop, stopAllSfx }
```

### AP1 + Bundle 정합 (art-bible §8.5 전략)

- Web Audio API 브라우저 내장 — 외부 라이브러리 0
- @pixi/sound 미사용 (technical-preferences.md lock)
- **SFX 7개 초기 번들** (~30KB gzip, art-bible §8.5에 이미 계상)
- **BGM 3 트랙 lazy `import()`** (게임 시작 시 로드, 초기 번들에서 제거)
- GATE-05 600KB 달성 path: art-bible §8.5 전략 그대로 + Pixi v8 tree-shaking → ~580KB
- 광고·결제 hook 0 (AP1)

### M1 Retrofit 목록

- BitmapText 마이그레이션 (Score popup)
- input:fire launcher flash (캐릭터 끝 0.05s)
- combo:reset 시각·청각 피드백 (PG-06 playtest 결과 따라)
- Master Volume Slider (options UI)
- Adaptive music (게임 상태별 BGM 레이어)
- combo 10/20 마일스톤 SFX (M0 2슬롯 남김)
- Power-up 흡수 SFX (3종)
- Spatial panning (SFX x 좌표)

### LICENSE_REGISTRY.md 관리 (SM DOWNLOAD_GUIDE.md 패턴)

`assets/audio/LICENSE_REGISTRY.md` 신설 — 각 freesound.org 파일별:
- 파일명 + 트랙 원제
- 크리에이터 + Freesound ID + URL
- 라이선스 (CC0 / CC BY 4.0 / etc.)
- CC BY 시 크레딧 표기 위치
- 다운로드 일자
- 처리 방법 (Audacity 트리밍·루프·변환)

**누락 0건 정책**: PR 머지 전 LICENSE_REGISTRY.md 등록 확인 (AC.16). M0 강제.
