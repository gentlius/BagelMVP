# UX Spec: HUD — POP!

**Version**: 1.0
**Created**: 2026-05-31
**Owned By**: ux-designer
**Status**: Draft
**Authority**: `design/art/art-bible.md` (색상 권위). `design/gdd/visual-juice-system.md` AC.10, E6, §3.7 (RETRY 타이밍 권위).

---

## 1. Overview

HUD는 플레이어에게 실시간 게임 상태(점수·콤보)를 전달하고, 게임 종료 시 GAME OVER overlay와 RETRY 버튼을 표시하는 단일 책임 UI 계층이다. HUD는 상태를 소유하지 않고 EventBus 이벤트를 listen하여 표시만 갱신한다.

HUD가 담당하는 4가지 요소:
1. **Score Text** — 현재 총점 (중앙 상단)
2. **Combo Text** — 현재 콤보 수 (Score 아래, 콤보 0일 때 숨김)
3. **GAME OVER overlay** — 게임 종료 라벨 + RETRY 버튼 (fade-in 500ms)
4. **About ⓘ 버튼** — 우하단 info 진입점 (상세 레이아웃은 `design/ux/about-modal.md` 참조)

HUD는 데이터를 수신만 한다. 상태 변경은 `input:retry` 이벤트 emit을 통해 GameLoop에 위임한다.

---

## 2. Player Fantasy

플레이어는 점수와 콤보를 보기 위해 시선을 옮길 필요가 없다. 정보는 항상 제자리에 있고, 화면 중앙 액션을 방해하지 않는다. GAME OVER가 뜨는 순간 이미 RETRY 버튼이 활성 상태이므로 "죽었다 → 탭 → 재시작" 흐름이 1초 이내에 완결된다 (Pillar P4: 1탭이 다음 런으로).

---

## 3. Layout

모든 좌표는 런타임 기준. `sw` = `app.screen.width`, `sh` = `app.screen.height`.

### 3.1 Score Text

| 속성 | 값 |
|------|-----|
| Anchor | (0.5, 0) — center-top |
| x | `sw / 2` |
| y | `HUD_MARGIN_TOP` (기본값 20px) |
| Font | system-ui, sans-serif |
| Font size | `HUD_SCORE_SIZE` (기본값 24px) |
| Font weight | bold |
| Fill color | `#FFFFFF` (0xFFFFFF) |
| Drop shadow | color: black, blur: 4, distance: 2, angle: 45deg, alpha: 0.6 |
| Initial text | `UI.score(0)` (ui-strings 모듈, §Conventions 단일 소유) |

### 3.2 Combo Text

| 속성 | 값 |
|------|-----|
| Anchor | (0.5, 0) — center-top |
| x | `sw / 2` |
| y | `HUD_MARGIN_TOP + HUD_COMBO_GAP` (기본값 20 + 32 = 52px) |
| Font | system-ui, sans-serif |
| Font size | `HUD_COMBO_SIZE` (기본값 20px) |
| Font weight | bold |
| Fill color | HERO Gold `#FFD700` (0xFFD700) — art-bible §4.2 Critical Gold canonical |
| Drop shadow | color: black, blur: 3, distance: 1, angle: 45deg, alpha: 0.5 |
| Initial alpha | 0 (combo < 1 시 완전 숨김) |

### 3.3 GAME OVER Overlay

GAME OVER overlay는 `game:over` 이벤트 수신 전까지 `visible = false`로 존재한다. 이벤트 수신 시 `visible = true`로 전환 후 alpha를 0에서 1로 `GAME_OVER_FADE_DURATION_MS` 동안 선형 증가시킨다 (Pixi Ticker lerp — `setTimeout` 금지).

**GAME OVER 라벨**

| 속성 | 값 |
|------|-----|
| Anchor | (0.5, 0.5) — center |
| x | `sw / 2` |
| y | `sh * 0.35` |
| Font size | 48px bold |
| Fill color | `#FFFFFF` |
| Drop shadow | color: black, blur: 8, distance: 3, alpha: 0.8 |
| Text | `UI.gameOver` |

**RETRY 버튼** (overlay 자식 — overlay alpha와 동시 fade)

| 속성 | 값 |
|------|-----|
| Position (center) | x = `sw / 2`, y = `sh * 0.55` |
| 시각 크기 | width 160px, height 56px, corner radius 12px |
| 최소 탭 타깃 | 48×48px (hitArea로 강제) |
| 배경 fill | `#001A33` (0x001A33), alpha 0.85 — Frosted Sky dark |
| 테두리 | color `#00F5FF` (0x00F5FF) neon cyan, stroke width 2px |
| 라벨 | `UI.retry`, 22px bold, fill `#00F5FF`, letterSpacing 2 |
| eventMode | `static` |
| cursor | `pointer` |
| 활성 시점 | fade 시작과 동시 (fade 완료를 기다리지 않음 — visual-juice-system AC.10 E6) |

### 3.4 About ⓘ 버튼 위치

| 속성 | 값 |
|------|-----|
| 크기 | 36×36px |
| x | `sw - 36 - 16` |
| y | `sh - 36 - 16` |
| zIndex | 50 |

상세 레이아웃·상호작용은 `design/ux/about-modal.md` 참조.

---

## 4. Resize 처리

`app.renderer` 의 `resize` 이벤트 수신 시:

```
scoreText.x   = newWidth / 2
comboText.x   = newWidth / 2
gameOverLabel.x = newWidth / 2
gameOverLabel.y = newHeight * 0.35
retryButton.x   = newWidth / 2
retryButton.y   = newHeight * 0.55
```

resize 후에도 Score/Combo는 항상 수평 중앙 정렬을 유지해야 한다.

---

## 5. Events Subscribed

| 이벤트 | 핸들러 동작 |
|--------|-----------|
| `score:updated` (payload: `{totalScore, combo}`) | Score text를 `UI.score(totalScore)`로 갱신. combo >= 1 이면 Combo text를 `UI.combo(combo)`로 갱신 + alpha 1. combo < 1 이면 Combo text alpha 0 |
| `combo:milestone` (payload: `{combo}`) | Combo text를 `UI.combo(combo)`로 갱신 + alpha 1 |
| `combo:reset` | Combo text alpha 0 |
| `game:over` | GAME OVER overlay `visible = true` + alpha 0에서 1로 `GAME_OVER_FADE_DURATION_MS` 내 선형 fade. RETRY 버튼 탭 이벤트 즉시 활성 (fade 완료 전) |
| `game:start` | Score text를 `UI.score(0)`으로 리셋. Combo text alpha 0. GAME OVER overlay `visible = false`, alpha 0 |

---

## 6. Events Emitted

| 이벤트 | 발화 조건 | payload |
|--------|----------|---------|
| `input:retry` | RETRY 버튼 `pointertap` | `{}` |

`input:retry` 수신 시 GameLoop가 `reset()` 후 `start()`를 호출한다 (GameLoop 소유 — HUD는 알지 못함).

---

## 7. Container 권한

HUD의 모든 요소는 `uiContainer` (L4 — 최상위 draw layer) 안에만 존재한다.

```
app.stage
  ├── bgContainer       (L0)
  ├── balloonContainer  (L1)
  ├── harpoonContainer  (L2)
  ├── vfxContainer      (L3)
  └── uiContainer       (L4)  ← HUD 전용
        ├── scoreText   (zIndex auto)
        ├── comboText   (zIndex auto)
        ├── gameOverOverlay (zIndex auto)
        └── infoButton  (zIndex 50 — about-modal.md 소유)
```

`uiContainer.sortableChildren = true`. HUD는 `bgContainer`, `balloonContainer`, `harpoonContainer`, `vfxContainer`를 수정하지 않는다.

---

## 8. Tuning Knobs

| 상수 | 기본값 | 안전 범위 | 영향 |
|------|--------|---------|------|
| `HUD_MARGIN_TOP` | 20px | 12–40px | Score text 상단 여백. 노치 기기에서 올려야 할 수 있음 |
| `HUD_COMBO_GAP` | 32px | 24–48px | Score 아래 Combo text 수직 간격 |
| `HUD_SCORE_SIZE` | 24px | 18–32px | Score text 크기. 너무 크면 중앙 액션 방해 |
| `HUD_COMBO_SIZE` | 20px | 16–28px | Combo text 크기 |
| `GAME_OVER_FADE_DURATION_MS` | 500ms | 300–1000ms | GAME OVER overlay alpha 0→1 소요 시간 |
| `RETRY_WIDTH` | 160px | 120–200px | RETRY 버튼 시각 너비 |
| `RETRY_HEIGHT` | 56px | 48–72px | RETRY 버튼 시각 높이 (최소 48px — 탭 타깃) |
| `COMBO_DISPLAY_THRESHOLD` | 1 | 1–3 | 이 값 이상일 때만 Combo text 표시 |

---

## 9. Acceptance Criteria

| ID | 조건 | 검증 방법 |
|----|------|---------|
| AC.1 | Score text가 `sw / 2` x, `HUD_MARGIN_TOP` y에 center-top anchor로 렌더링됨 | manual visual (resize 전·후) |
| AC.2 | combo = 0 일 때 Combo text alpha = 0. combo >= 1 일 때 alpha = 1 | unit test |
| AC.3 | `game:over` 이벤트 수신 후 GAME OVER overlay가 500ms ± 1 frame (16.7ms) 내에 alpha 0→1 완료 | integration test (Ticker mock) |
| AC.4 | RETRY 버튼 탭 시 `input:retry` 이벤트가 EventBus로 emit됨 + GameLoop reset 발동 | integration test |
| AC.5 | resize 후 Score text와 Combo text x = newWidth / 2 (중앙 정렬 유지) | unit test |
| AC.6 | RETRY 버튼 최소 탭 타깃 48×48px — hitArea 기준 | manual (touch device) |
| AC.7 | `game:start` 이벤트 수신 시 Score text = 0, Combo alpha = 0, overlay hidden | unit test |

---

## Implementation Checklist

Approved 조건: 아래 전 항목 체크 완료.

### 진입점
- HUD는 `attachHUD(uiContainer, app)` 팩토리 함수로 생성. `GameLoop.init()` 완료 후 1회 호출.

### 호출 경로
- [ ] `attachHUD(uiContainer, app)` → `new HUD(uiContainer, app)` 생성
- [ ] 생성자 안에서 EventBus listener 5개 등록 (`score:updated`, `combo:milestone`, `combo:reset`, `game:over`, `game:start`)
- [ ] `app.renderer.on('resize', ...)` 등록
- [ ] `app.ticker.add(...)` 등록 (RETRY fade-in Ticker lerp)
- [ ] RETRY 버튼 `pointertap` → `eventBus.emit('input:retry', {})` wiring

### AC → 테스트 매핑
| AC | Test Method | 테스트 함수 |
|----|-------------|------------|
| AC.2 | unit | `test_combo_alpha_threshold` |
| AC.3 | integration | `test_gameover_fade_duration` |
| AC.4 | integration | `test_retry_emits_input_retry` |
| AC.5 | unit | `test_resize_centers_score_combo` |
| AC.7 | unit | `test_game_start_resets_hud` |
