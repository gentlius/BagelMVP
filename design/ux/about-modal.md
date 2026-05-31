# UX Spec: About Modal — POP!

**Version**: 1.0
**Created**: 2026-05-31
**Owned By**: ux-designer
**Status**: Draft
**Authority**: `design/art/art-bible.md` (색상 권위). `design/gdd/visual-juice-system.md` §Audio Implementation Note (BGM CC0 라이선스).

---

## 1. Overview

About Modal은 두 요소로 구성된다:

1. **ⓘ 버튼** — 우하단 항시 노출 진입점. 탭 시 모달 열기 + 게임 일시정지.
2. **Credits 모달** — 전체화면 dim + 중앙 패널 + 크레딧 텍스트 + "TAP TO CLOSE" 안내.

모달이 열리면 `GameLoop.pause()` + `AudioContext.suspend()`로 모든 게임 진행이 정지된다. 닫히면 정확히 역순으로 재개된다. 플레이어는 크레딧을 확인한 뒤 게임 상태 손실 없이 복귀할 수 있다.

---

## 2. Player Fantasy

게임 중 언제든 (심지어 긴장감이 최고조일 때도) 크레딧을 확인하고 완전히 돌아올 수 있다는 신뢰감. "일시정지했다가 재개했더니 풍선 위치가 달라졌다"는 사고가 없다. TAP TO CLOSE로 닫는 행위 자체가 게임 재개를 향한 명확한 신호다 (Pillar P1: 한 손가락 한 결정).

---

## 3. Layout

모든 좌표는 런타임 기준. `sw` = `app.screen.width`, `sh` = `app.screen.height`.

### 3.1 ⓘ 버튼

| 속성 | 값 |
|------|-----|
| 크기 | `INFO_BUTTON_SIZE` (기본값 36px) × 36px 원형 |
| x | `sw - INFO_BUTTON_SIZE - INFO_BUTTON_MARGIN` |
| y | `sh - INFO_BUTTON_SIZE - INFO_BUTTON_MARGIN` |
| `INFO_BUTTON_MARGIN` | 기본값 16px |
| 배경 | 검은 원 (fill: `#000000`, alpha 0.55) |
| 테두리 | 흰 원 stroke, width 1.5px, color `#FFFFFF`, alpha 0.85 |
| 라벨 | "i" 문자, font-size 22px, bold, fill `#FFFFFF`, anchor (0.5, 0.5) |
| eventMode | `static` |
| cursor | `pointer` |
| zIndex | 50 (uiContainer 내 기준) |

resize 시 `x`, `y`를 위 공식으로 재계산한다.

### 3.2 모달 — Dim Background

| 속성 | 값 |
|------|-----|
| 영역 | fullscreen rect (0, 0, sw, sh) |
| Fill | `#000000`, alpha `MODAL_DIM_ALPHA` (기본값 0.78) |
| eventMode | `static` (탭 시 close) |
| cursor | `pointer` |

### 3.3 모달 — Content Panel

| 속성 | 값 |
|------|-----|
| 너비 | `min(sw - 40, PANEL_MAX_W)` — 기본값 PANEL_MAX_W = 360px |
| 높이 | `min(sh - 80, PANEL_MAX_H)` — 기본값 PANEL_MAX_H = 520px |
| 좌상단 x | `(sw - panelW) / 2` |
| 좌상단 y | `(sh - panelH) / 2` |
| 배경 fill | `#10182A` (0x10182A), alpha 0.95 |
| 테두리 | stroke width 1.5px, color `#FFFFFF`, alpha 0.25 |
| corner radius | 16px (art-bible §1.2 Principle 3 — 원형 기반) |
| eventMode | `static` + `pointertap` → `e.stopPropagation()` (실수 close 방지) |

### 3.4 크레딧 텍스트 라인 (13줄, 중앙 정렬)

텍스트 커서는 `panelY + 32`에서 시작하며, 각 라인 렌더 후 `line.height + line.gap`만큼 아래로 이동한다. 모든 텍스트는 anchor (0.5, 0), x = `panelX + panelW / 2` (패널 수평 중앙).

| # | 텍스트 | size | color | bold | gap (after) |
|---|--------|------|-------|------|------------|
| 1 | "POP! Prototype" | 28px | `#FFFFFF` | yes | 8px |
| 2 | `v{VERSION}` (런타임 치환) | 14px | `#CCCCCC` | no | 24px |
| 3 | "— Credits —" | 16px | HERO Gold `#FFD700` | yes | 16px |
| 4 | `BGM: "Some Game Background Music Or Something"` | 13px | `#FFFFFF` | no | 4px |
| 5 | `  by Seth_Makes_Sounds (CC0)` | 12px | `#AAAAAA` | no | 4px |
| 6 | `  freesound.org/s/684184/` | 12px | 네온 시안-dim `#88CCFF` | no | 16px |
| 7 | `SFX: Procedural Web Audio synthesis` | 13px | `#FFFFFF` | no | 4px |
| 8 | `  (Project-internal)` | 12px | `#AAAAAA` | no | 16px |
| 9 | `Art: Procedural Pixi Graphics` | 13px | `#FFFFFF` | no | 4px |
| 10 | `  (Project-internal)` | 12px | `#AAAAAA` | no | 16px |
| 11 | `Engine: Pixi.js v8 (MIT)` | 12px | `#AAAAAA` | no | 4px |
| 12 | `Build: Vite (MIT)` | 12px | `#AAAAAA` | no | 28px |
| 13 | "— TAP TO CLOSE —" | 14px | 네온 시안 `#00E5FF` | yes | 0px |

**wordWrap**: `true`, wordWrapWidth = `panelW - 32px`. font-family: system-ui, sans-serif.

---

## 4. 상호작용

| 트리거 | 동작 |
|--------|------|
| ⓘ 버튼 `pointertap` | 모달 open: `modal.visible = true` + `GameLoop.pause()` + `AudioContext.suspend()` |
| Dim 영역 `pointertap` | 모달 close: `modal.visible = false` + `GameLoop.resume()` + `AudioContext.resume()` |
| Content panel 내부 `pointertap` | `e.stopPropagation()` — close 이벤트 버블링 차단 |
| 모달이 이미 열려있을 때 ⓘ 탭 | no-op (idempotent open guard: `if (isOpen) return`) |
| 모달이 이미 닫혀있을 때 dim 탭 | no-op (idempotent close guard: `if (!isOpen) return`) |

---

## 5. Container 권한

About Modal의 모든 요소는 `uiContainer` (L4) 안에만 존재한다.

```
uiContainer (L4)
  ├── infoButton    (zIndex 50)
  └── modal         (zIndex 100, visible = false 초기)
        ├── dim       (fullscreen Graphics)
        ├── panelBg   (rounded rect Graphics)
        └── text[0..12]  (13 Text 노드)
```

HUD (`design/ux/hud.md`)의 요소들과 동일 컨테이너를 공유하지만 zIndex로 격리된다. About Modal은 `bgContainer`, `balloonContainer`, `harpoonContainer`, `vfxContainer`를 수정하지 않는다.

---

## 6. Pause / Resume

**GameLoop API**:
- `pause()` — Pixi Ticker 정지 + physics/spawn/critical/score/visual-juice 모두 freeze
- `resume()` — Ticker 재가동 + 모든 시스템 재개
- `isPaused()` — boolean (중복 호출 방어용)

**AudioContext API**:
- `AudioContext.suspend()` — BGM + SFX 재생 일시정지
- `AudioContext.resume()` — BGM + SFX 재개 (이전 재생 위치 유지)

모달 open/close는 반드시 GameLoop pause/resume과 AudioContext suspend/resume을 **동시에** 호출한다. 한쪽만 호출하면 사운드가 게임 없이 계속 재생되거나, 게임이 묵음 상태로 진행되는 부분 정지 상태가 된다.

---

## 7. Tuning Knobs

| 상수 | 기본값 | 안전 범위 | 영향 |
|------|--------|---------|------|
| `INFO_BUTTON_SIZE` | 36px | 32–48px | 버튼 크기. 최소 32px (탭 타깃 보장) |
| `INFO_BUTTON_MARGIN` | 16px | 8–24px | 화면 모서리에서의 여백 |
| `MODAL_DIM_ALPHA` | 0.78 | 0.5–0.9 | dim 배경 불투명도. ↑ = 패널 가독성 ↑, 화면 가림 ↑ |
| `PANEL_MAX_W` | 360px | 300–420px | 패널 최대 너비 |
| `PANEL_MAX_H` | 520px | 400–600px | 패널 최대 높이. 텍스트 13줄 기준 최소 480px 권장 |
| `PANEL_CORNER_RADIUS` | 16px | 12–24px | 패널 모서리 radius (art-bible §1.2 Principle 3) |
| `VERSION` | `'0.1.0-proto.1'` | — | 모달 2번째 줄에 표시되는 버전 문자열 |
| `CREDIT_LINES` | 위 §3.4 13줄 | — | 크레딧 텍스트 배열. 줄 추가/수정 시 이 상수만 변경 |

---

## 8. CC0 라이선스 정합

BGM "Some Game Background Music Or Something" by Seth_Makes_Sounds
- 출처: freesound.org/s/684184/
- 라이선스: CC0 1.0 Universal (Public Domain Dedication)
- Attribution 의무: 없음 (CC0). 단, 위 크레딧 표시는 제작자에 대한 매너 표시로 유지.
- 라이선스 등록: `assets/audio/LICENSE_REGISTRY.md` 에 URL + 라이선스 기록 (visual-juice-system AC.16 준수).

SFX 7개는 Procedural Web Audio synthesis (Project-internal) — 외부 라이선스 의무 없음.

---

## 9. Acceptance Criteria

| ID | 조건 | 검증 방법 |
|----|------|---------|
| AC.1 | ⓘ 버튼이 resize 전·후 항상 `(sw - 36 - 16, sh - 36 - 16)` 위치에 렌더링됨 | manual visual + unit test |
| AC.2 | 모달 open 시 GameLoop.pause() + AudioContext.suspend() 호출 확인. 열린 frame 이후 balloon 위치 변화 0 | integration test |
| AC.3 | 모달 close 시 GameLoop.resume() + AudioContext.resume() 호출 확인. 닫힌 직후 Ticker 재가동 | integration test |
| AC.4 | dim 영역 탭 → close. content panel 영역 탭 → close 안 됨 (stopPropagation 확인) | integration test |
| AC.5 | 크레딧 텍스트 13줄 전부 표시 + 수평 중앙 정렬 (anchor 0.5 기준) | manual visual |
| AC.6 | 모달 이미 open 상태에서 ⓘ 재탭 → no-op (pause() 중복 호출 없음) | unit test |
| AC.7 | 모달 zIndex 100, ⓘ 버튼 zIndex 50 — 모달이 HUD 요소 위에 렌더링됨 | manual visual |

---

## Implementation Checklist

Approved 조건: 아래 전 항목 체크 완료.

### 진입점
- About Modal은 `attachAboutModal(deps)` 팩토리로 생성. deps = `{ uiContainer, app, pause, resume }`. `GameLoop.init()` 완료 후 1회 호출.

### 호출 경로
- [ ] `attachAboutModal(deps)` → `new AboutModal(deps)` → `_buildInfoButton()` + `_buildModal()` 순서 실행
- [ ] ⓘ 버튼 `pointertap` → `_open()` → `modal.visible = true` + `pause()` + `AudioContext.suspend()`
- [ ] dim `pointertap` → `_close()` → `modal.visible = false` + `resume()` + `AudioContext.resume()`
- [ ] panelBg `pointertap` → `e.stopPropagation()` wiring
- [ ] `app.renderer.on('resize', ...)` → 버튼 `x`, `y` 재계산
- [ ] `destroy()` 시 infoButton + modal `destroy({ children: true })`

### AC → 테스트 매핑
| AC | Test Method | 테스트 함수 |
|----|-------------|------------|
| AC.2 | integration | `test_open_pauses_game_and_audio` |
| AC.3 | integration | `test_close_resumes_game_and_audio` |
| AC.4 | integration | `test_panel_tap_does_not_close` |
| AC.6 | unit | `test_open_is_idempotent` |
