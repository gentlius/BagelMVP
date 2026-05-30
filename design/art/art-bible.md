# Art Bible: POP!

## Document Status
- **Version**: 2.0 (Prototype-compressed)
- **Created**: 2026-05-30
- **Last Updated**: 2026-05-30
- **Owned By**: art-director (game-designer 협업)
- **Status**: Prototype-compressed (2026-05-30). Extras isolated to design/art/draft/art-bible-extras.md.
- **Source**: design/gdd/game-concept.md §Visual Identity Anchor
- **Visual Sample**: design/art/samples/01-character-balloon-sky.html (시각 contract reference)

---

## 1. Visual Identity Statement

시각적 정체성 및 렌더링 명세.

### 1.1 한 줄 비주얼 대원칙 (The Core Visual Identity)

> **"모든 것은 부드러운 하늘 위에 빛나는 유리다 — 단, 큰 일이 날 때는 세계가 어두워지며 화답한다."**

### 1.2 지지 비주얼 원칙 3가지 (The 3 Supporting Core Principles)

> **Layered Translucency**: frosted sky (배경) → balloon glass body → neon rim → bloom (필터). 모든 시각 요소는 이 4층 중 하나에 속한다.

**Principle 1 — 동적 액터 레이어는 '반투명 유리(Frosted Glass)' 머티리얼이다**

인게임 동적 액터 레이어(풍선·캐릭터·작살 비드·UI 패널·아이템 아이콘)는 파편화된 리소스가 아닌 단일한 글래스 사양 구조로 바인딩됨. **배경 레이어(Frosted Sky 그라데이션)는 본 원칙 적용 제외** — 배경은 flat gradient이며 글래스 머티리얼 아님.

- **시각적 레이어 구성**: 반투명 본체 (기본값 Alpha **0.20**, 튜닝 허용 범위 0.15-0.30) + 내부 발광 (Radial Gradient, 기본 radius ≥ 8px) + 테두리 림 하이라이트 (White Stroke, Alpha 0.40) + 외부 발광 (Outer Glow / Blur Filter)
- **Design Test (수치 기준)**: 본체 Alpha ≥ 0.15 **AND** 내부 발광 radius ≥ 8px 충족 시 통과. 둘 중 하나라도 미충족 시 구현 에이전트는 머티리얼 에셋 플래그를 전면 재설정해야 함
- **Pillar Served**: P2 (화면이 점수보다 먼저 말한다) — 일관된 질감 계층을 통해 화면 전체의 시각적 결속성(Cohesion)을 확보하고, 유저에게 정보의 우선순위를 직관적으로 전달

**Principle 2 — 라이트 베이스라인 + 이벤트 시점의 다크닝 역동성**

화면의 대비는 고정되어 있지 않으며, 핵심 게임플레이 메커니즘 이벤트에 실시간으로 동기화됨.

- **95% 일상 시간**: 'Frosted Sky'로 명명된 파스텔톤 그라데이션 배경 기본 유지
- **5% 메커니즘 이벤트 시**: Critical Pop, Power-Up 흡수 발생 시 $0.2 \sim 0.5\text{초}$ 동안 배경 레이어에 다크닝 색조 변화를 가해 네온 풍선과 스파크의 대비 극대화. 이벤트 종료 즉시 default 라이트 톤으로 복귀
- **Design Test**: "이 시각 효과는 일상인가, 이벤트인가?" → 일상이면 산뜻한 라이트 톤 사수, 이벤트면 한계치 강한 대비·암전 허용
- **Pillar Served**: P3 (운은 자주 보장, 실력은 천장이 깊다) — Critical 같은 무작위 호재 이벤트가 발생했을 때 시각적 축제(Dramatization)를 열어 유저에게 압도적 보상감 각인

**Principle 3 — 모든 기하학적 형태는 원형 기반의 둥근 곡선을 따른다**

날카로운 시각적 자극을 철저히 배제하여 조작의 심리적 마찰력 낮춤.

- **조형 가이드**: 풍선(원형), 캐릭터(라운드 캡슐형), 파워업(구체), UI 패널(Pixi.js v8 `Graphics.roundRect()` 또는 `@pixi/ui` `RoundedBox` 컴포넌트, corner radius ≥ 16px). 픽셀 아트 스타일 및 직각 다각형 사용 절대 금지. Pang 오리지널 메커닉 헤리티지만 차용하되, 비주얼은 완벽히 모던 톤으로 정제
- 🚨 **유일한 예외 사양 (작살 화살촉)**: Pang 본연의 파괴적 타격감 계승을 위해 작살 끝(Sharp Tip)의 예리함 유지. 단, 딱딱한 폴리곤이 아닌 부드러운 유선형 미늘 곡선으로 디자인
- **Design Test**: "이 오브젝트에 직각(90도) 모서리가 존재하는가?" → YES 시 라운딩 보정을 가하거나 즉시 폐기
- **Pillar Served**: P1 (한 손가락 한 결정) + P2 (화면이 점수보다 먼저 말한다) — 부드러운 형태가 주는 캐주얼 친근감으로 조작 진입 장벽 낮춤(P1), 풍선의 둥근 실루엣이 thumbnail size에서도 가독성 보장(P2)

> **P4 매핑**: P4 (1탭이 다음 런으로)는 §1 시각 정체성 범위 밖. UI 마찰 제로 정책은 UX 흐름의 영역 (design/art/draft/art-bible-extras.md §7 UI/HUD 참조).

### 1.3 컬러 매니페스트 및 팔레트 시스템 (Color Philosophy)

| 시각적 톤 상태 | 핵심 컬러 조합 (HEX) | 스크린 점유 시간 | Pixi BlendMode / Filter 가이드 |
|--------------|-------------------|--------------|----------------------------|
| **Default Baseline (배경)** | 파스텔 스카이블루 (`#B5D8E8`) → 소프트핑크 (`#F5C2D4`) → 라벤더 (`#C4B0E0`) 그라데이션 배경 | 95% 전체 플레이 타임 | `BlendMode.NORMAL`. 배경은 별도 레이어로 격리하여 드로우 콜 최적화 |
| **풍선 6색 (Active Object)** | Magenta `#FF3DA5` / Cyan `#3DD9FF` / Lime `#B5FF3D` / Amber `#FFB73D` / **Mint `#3DFFC2`** / Violet `#A56BFF` | Default + Critical 상태 모두 사용. MVP에서 색은 시각 카테고리만 (메커니즘 차이 없음) | radial gradient inner = 60% lighter, outer = 40% darker. `BlendMode.NORMAL`. Critical 상태 진입 시 outer glow intensity ×1.5 |
| **Critical Pop** | 딥 쿨블루 암전 그라데이션 (`#1A3A55` → `#2D2855` → `#1A1A3A`) + 골드 림 액센트 (`#FFD700`) + 순백 플래시 | 0.2초 미만 순간 플래시 | 배경 레이어에 `ColorMatrixFilter` 적용 또는 상위 암전 오버레이 레이어 알파 연산 |
| **Power-Up 흡수** | 획득한 각 파워업 아이템 고유의 속성 컬러 틴트(Tint) 스크린 효과 적용 | 0.5초 지속 후 페이드아웃 | `BlendMode.ADD` (발광 시각 효과 극대화) |
| **UI 계층** | 글래스모피즘 화이트 (`rgba(255,255,255,0.18)`) + 실시간 테두리 보더 (`rgba(255,255,255,0.35)`) | 인터페이스 출력 시 상시 | 패널 드로우 시 `cacheAsTexture = true` 적용하여 런타임 블러 연산 부하 방지 |

> **Canonical 컬러 선언 (충돌 해소)**: Critical Gold = `#FFD700` (본 art-bible 기준). game-concept.md에 기재된 `#FFC107`는 초안 단계 수치이며 본 명세로 **superseded**. 모든 후속 GDD·구현은 `#FFD700` 사용.

세부 hex·blur·opacity 추가 수치는 §4 Color System에서 상세 명세.

### 1.4 비주얼 컨트랙트 레퍼런스 (Visual Contract Validation)

본 명세서에 기술된 모든 시각 원칙 및 셰이더 결과물은 프로토타입 샌드박스 파일 **[design/art/samples/01-character-balloon-sky.html](samples/01-character-balloon-sky.html)** 의 시각 결과와 정합성 유지 필수.

AI 에이전트는 그래픽 렌더러 컴포넌트(`src/renderers/`) 구현 시 해당 HTML 샘플 코드에 선언된 파라미터 값(Opacity, Blur 12px, 색상 hex 등)을 기본값으로 상속받아 정밀 렌더링해야 함.

> **검증 경계 (정합성 정의)**:
> - **파라미터 수준 (필수 정확 일치)**: Opacity·Blur 반경·색상 hex·border-radius 등 명시 수치는 정확히 일치
> - **픽셀 수준 (허용 오차)**: CSS filter vs Pixi v8 WebGL Filter 렌더링 차이로 인한 픽셀 오차 **±10% 허용**
> - **샘플 HTML은 visual target reference이지 code template이 아님**. CSS 구현 코드(예: `backdrop-filter`)를 그대로 Pixi 컴포넌트에 이식하지 말 것. **시각 결과만 매칭**하고 구현은 Pixi v8 idiom 준수 (`@pixi/filter-glow`, `BlurFilter` 등 활용)

---

### 1.5 Mood Anchor (10초 첫인상 테스트)

플레이어가 게임 첫 10초 안에 받아야 할 감정: **"부드럽게 빛나는 휘파람 같은 카오스"**

세 가지 감정의 동시 결합:
- **안정감** (파스텔 sky 배경 — 위협적이지 않음)
- **호기심** (네온 풍선 — "터뜨리고 싶다")
- **약속** (Critical 한 번이면 화면이 통째로 화답한다 — "한 판 더")

**의도적으로 배제하는 감정**: 압박감·긴장감·시리어스함·고독·우울. POP!은 가벼운 출퇴근 짬짬이용. 무겁거나 진지한 톤 금지.

---

## 2. Mood & Atmosphere (Prototype Core States)

M0 prototype 범위 핵심 상태. S1·S4–S7 및 전환 규칙 전체는 design/art/draft/art-bible-extras.md §[원출처 §2.*] 참조.

### 2.1 게임 상태별 분위기 매트릭스 (Prototype 핵심)

| State | Primary Emotion | Lighting Character | Atmospheric Descriptors | Energy Level | Pixi v8 구현 가이드 |
|-------|----------------|-------------------|----------------------|------|-------------------|
| **S2. Playing — Baseline** | 흐름·집중 (Flow) | Frosted Sky default (스카이블루→핑크→라벤더), 색온도 ~5500K, 대비 중간 | 부유 / 떠다님 / 활기찬 / 카오스 직전 | 측정된 (Measured) — 풍선 자연 부유 + 캐릭터 따라옴 | 95% 시간의 standard rendering. `BlendMode.NORMAL` 배경. 풍선 floating animation 6s 주기 |
| **S3. Critical Moment** | 황홀·축제 (Ecstasy / Dramatization) | 갑작스러운 다크닝 (~3000K 쿨블루) + 골드 림 + 화이트 플래시, 대비 최대 | 폭발적 / 황홀한 / 신성한 순간 / 압도적 | 폭발적 (Explosive) — 0.2초 burst | `ColorMatrixFilter`로 배경을 **§1.3 Critical Pop hex (`#1A3A55` → `#2D2855` → `#1A1A3A`)** 로 darken (0.1s transition in) + **§1.3 화이트 플래시 overlay** (0.05s) + Critical 풍선 outer glow ×2 + **§1.3 골드 림 액센트 `#FFD700`** 발현 |

---

## 3. Shape Language (Prototype Core)

M0 prototype 필수 형태 명세. Tier hierarchy, UI shape grammar, 형태 통합 표, 체크리스트는 design/art/draft/art-bible-extras.md §[원출처 §3.*] 참조.

### 3.2 Character Silhouette (핵심 요약)

**기본 형태**: humanoid glass figurine — 머리 + 몸통 + 양팔(작살 launcher 잡음) + 양다리. **샘플 HTML의 SVG가 canonical reference** ([design/art/samples/01-character-balloon-sky.html](samples/01-character-balloon-sky.html)).

- 머리 직경 : 몸 세로 높이 비율 — **약 1 : 1 (캐주얼 chibi)**, 샘플 HTML이 canonical
- Pixi Container 권장 높이: **64–80px @ 1080p 논리 픽셀**
- 머티리얼: 글래스 (Alpha 0.20 + 내부 발광 + rim highlight) — §1.2 Principle 1 enforce
- 컬러: 머리 = 핑크 글래스 / 몸 = 시안-블루 글래스 (§5.2 Material Stop Colors)

### 3.3 World Objects: 풍선 + 작살

**풍선 (Balloon)**:

| 사이즈 | 직경 (px @ 1080p 논리) | 분열 후 | 비율 |
|--------|------------------|--------|------|
| Large | 80px | → Medium 2개 | 1.0 |
| Medium | 56px | → Small 2개 | 0.7 |
| Small | 38px | (종단 — 안 쪼개짐) | 0.48 |

- **형태**: 완전 원형 (circle, no ellipse). 부유 시 미세 squash & stretch (±5%) 허용
- **이동**: 포물선 바운스. 화면 가장자리 반사. 부드러운 floating 6s 주기

**Critical Gold 풍선 S3 darken 중 silhouette 변화**:
- 다크닝 진입 시: outline stroke 추가 (`#FFD700` 골드, 2px) → 어두운 배경에서도 silhouette 식별 가능
- 외곽 glow ×2 intensity, scale **+10% (1.0 → 1.1)** 0.1s 동안만
- 다크닝 종료 시 outline 즉시 제거, scale 1.0 복귀

> **DPR 처리**: 모든 px 수치는 **CSS 논리 픽셀** 기준. Pixi 초기화 시 `resolution: window.devicePixelRatio, autoDensity: true`로 자동 scale.

> **터치 타겟 핸드오프**: 38px Small 풍선 — 작살 충돌 hitbox를 시각 반경 +6px로 확장 (Balloon Physics & Split System GDD에서 enforce).

**작살 (Harpoon)**:
- 와이어: 30개 비드 zigzag (좌 x=9, 우 x=15) → 나선 코일 효과 (sample HTML 참조)
- 끝: arrowhead polygon (sharp tip + 양쪽 미늘 곡선) — §1.2 Principle 3 유일한 예외
- 머티리얼: 글래스 (sample HTML SVG defs `beadGrad`, `arrowGrad` 참조)

---

## 4. Color System

§1.3 + Tier 분류 통합 완전한 hex/HSL/semantic 매핑.

### 4.1 Primary Palette — Background & Environment

| 컬러명 | HEX | HSL | 역할 | 사용 시점 |
|--------|-----|-----|------|---------|
| **Sky Blue** | `#B5D8E8` | (199°, 50%, 81%) | Frosted Sky 상단 | S1·S2·S5·S6 (Default 배경) |
| **Soft Pink** | `#F5C2D4` | (337°, 67%, 86%) | Frosted Sky 중간 (gradient stop 50%) | Default 배경 전환점 |
| **Lavender** | `#C4B0E0` | (262°, 41%, 78%) | Frosted Sky 하단 | Default 배경 |
| **Deep Cool Blue** | `#1A3A55` | (210°, 53%, 22%) | Critical Pop 배경 상단 | S3만 (0.2초) |
| **Midnight Violet** | `#2D2855` | (250°, 35%, 25%) | Critical Pop 배경 중간 | S3만 |
| **Near Black** | `#1A1A3A` | (240°, 38%, 17%) | Critical Pop 배경 하단 | S3만 |

### 4.2 Balloon 6색 Palette + Glow Magnitude

모든 풍선은 채도 100% (HSL S=100). **Tier 차별화는 채도가 아닌 glow + outline으로**.

| 풍선 색 | HEX | HSL | Outer Glow Alpha | Glow Radius | 의미 (semantic) |
|---------|-----|-----|----------------|-----------|---------------|
| Magenta | `#FF3DA5` | (332°, 100%, 62%) | 0.40 (SUPPORTING) | 12px | 정렬 없음 — 시각 분류만 |
| Cyan | `#3DD9FF` | (193°, 100%, 62%) | 0.40 | 12px | 정렬 없음 |
| Lime | `#B5FF3D` | (84°, 100%, 62%) | 0.40 | 12px | 정렬 없음 |
| Amber | `#FFB73D` | (38°, 100%, 62%) | 0.40 | 12px | 정렬 없음 |
| Mint | `#3DFFC2` | (161°, 100%, 62%) | 0.40 | 12px | 정렬 없음 — 시각 분류만 (이전 HotPink `#FF6BA8` 교체, hue 분포 균등) |
| Violet | `#A56BFF` | (260°, 100%, 71%) | 0.40 | 12px | 정렬 없음 |
| **Critical Gold** | `#FFD700` | (51°, 100%, 50%) | **0.85** (HERO) + outline `#FFD700` 2px on S3 | **28px** | **운 호재 — 특별** |

> **MVP에서 6색은 시각 카테고리만**. 메커니즘 차이(어느 색이 더 점수 높음 등) 없음. Post-MVP에서 색별 특수 효과 도입 가능.

### 4.3 State-based Palette Switching

| State | 배경 (3-stop gradient) | 풍선 채도 | Character | UI 가시성 |
|-------|---------------------|--------|----------|---------|
| **S1·S2·S5 Default** | Sky Blue (`#B5D8E8`) → Soft Pink (`#F5C2D4`) → Lavender (`#C4B0E0`) | 100% | 핑크 머리 + 시안 몸 (default) | Liquid Glass 가시 |
| **S6 Loading** | **CSS fallback: `linear-gradient(180deg, #B5D8E8 0%, #F5C2D4 50%, #C4B0E0 100%)`** — Pixi Application 로드 전 즉시 표시. Pixi 마운트 후 동일 hex로 Sprite 교체 | N/A (풍선 없음) | N/A | 로딩 ring (open arc, 흰색 stroke 2px) |
| **S3 Critical Pop** | Deep Cool Blue → Midnight Violet → Near Black (0.2s) | 풍선 outer glow ×2, scale ×1.1 | 화이트-핫 글로우 전환 (sample HTML B 참조) | Liquid Glass 어두운 배경 위에서도 가시 (border alpha 0.5로 증가) |
| **S4 Power-Up Absorb** | Default + 아이템 색조 tint overlay (0.5s) | unchanged | unchanged | UI 패널 살짝 색조 입힘 |
| **S7 Pause** | S2 frozen + `rgba(0,0,0,0.3)` dim overlay | frozen unchanged | frozen unchanged | "TAP TO RESUME" 패널 highlight |

### 4.4 Power-Up 색상 매핑

3종 Power-Up의 시각 식별 컬러:

| Power-Up | 아이콘 컬러 | S4 흡수 시 화면 tint | 의미 |
|----------|----------|------------------|------|
| 멀티샷 (Multi-Shot) | `#3DD9FF` Cyan | Cyan 0.15 alpha 0.5s | 시원함·확장 |
| 동결 (Freeze) | **`#78D0FF` Ice Blue** (배경 Sky Blue `#B5D8E8`와 명확히 구별, HSL 200°/100%/74%) | Ice Blue 0.25 alpha 0.5s (alpha ↑) | 정지·차분 |
| 메가폭탄 (Mega-Bomb) | `#FFB73D` Amber | Amber 0.15 alpha 0.5s | 폭발·강력 |

### 4.5 UI Liquid Glass Palette

| 요소 | 배경색 | 보더색 | Inner shadow | Outer shadow (정지) | 애니메이션 (펄스) |
|------|--------|--------|------------|---------------|----------------|
| Default 패널 (점수·메뉴) | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.35)` 1px | `rgba(255,255,255,0.50)` 0px 1px inset | `rgba(0,0,0,0.08)` 0px 4px 16px | 없음 |
| S3 Critical 중 UI | `rgba(255,255,255,0.22)` (가시성 ↑) | `rgba(255,255,255,0.50)` 1.5px | unchanged | `rgba(255,215,0,0.20)` 0px 0px 24px (골드 글로우) | 없음 (이벤트만) |
| RETRY 버튼 (S5) | `rgba(255,255,255,0.22)` | `rgba(255,255,255,0.50)` 1px | unchanged | **trough: `rgba(0,0,0,0.10)` 0px 4px 16px / peak: `rgba(180,220,255,0.40)` 0px 0px 24px (시안 글로우)** | breathing pulse 1.5s 주기 (trough ↔ peak interpolation) |

### 4.6 Colorblind Safety

| 가능 충돌 | 충돌 색 | 영향 | 백업 cue |
|---------|--------|-----|---------|
| Protanopia/Deuteranopia (적·녹맹) | Lime vs Amber (둘 다 노란 계열, hue 38° vs 84°) | 풍선 2색 차별화 어려움 | **풍선 위 작은 흰색 pattern overlay** (옵션 — Post-MVP). 풍선 색은 카테고리만 (메커니즘 영향 없으므로 critical 아님). Mint 교체로 Magenta-HotPink 충돌 해소됨 |
| Tritanopia (청·황맹) | Sky Blue vs Cyan (배경-풍선) / **Amber `#FFB73D` vs Lime `#B5FF3D`** (둘 다 노란 계열, hue 38° vs 84°) | 배경-풍선 contrast 저하 + **Amber/Lime 두 풍선 구분 어려움** | (1) Frosted Sky 그라데이션이 자연 brightness 차이 제공 (HSL Lightness 81% vs 62%) — 배경 충분. (2) Amber/Lime은 MVP에서 메커니즘 영향 없으므로 구분 실패가 게임플레이 blocking 아님. Post-MVP에서 색별 효과 도입 시 패턴 overlay 추가 검토 |
| **Critical Gold 식별** | 황색맹은 Gold 식별 약할 수 있음 | Critical Pop 시각 효과 손실 | **golden outline 2px (#FFD700) + scale 1.1 + outer glow ×2가 모두 동시 발현** → 색 의존 없이 다른 채널로 식별 가능 |
| **Power-Up 3종 구분** | 색 외 차별화 없으면 colorblind 사용자 불편 | Power-Up 선택 정보 손실 | **각 Power-Up은 고유 아이콘 모양** (멀티샷=화살 ×3, 동결=눈송이, 메가폭탄=∗) 별도 명세 (design/art/draft/art-bible-extras.md §7.4) |

> **MVP 결론**: 풍선 색은 메커니즘 영향 없으므로 colorblind 영향 최소. Critical Gold·Power-Up은 색+모양+glow 다중 cue로 식별 보장. **별도 colorblind mode UI는 Post-MVP**.

### 4.7 Pixi v8 컬러 구현 가이드

```typescript
// 1. 풍선 색 정의 (config 파일)
export const BALLOON_PALETTE = {
  magenta: 0xFF3DA5,
  cyan: 0x3DD9FF,
  lime: 0xB5FF3D,
  amber: 0xFFB73D,
  mint: 0x3DFFC2,       // HotPink (0xFF6BA8) 에서 교체 — hue 분포 균등
  violet: 0xA56BFF,
  goldCritical: 0xFFD700,
} as const;

// 2. Outer glow 적용 (HERO tier vs SUPPORTING)
// ⚠ Pixi v8 호환 패키지명: `pixi-filters` (구버전 `@pixi/filter-glow`는 v5/v6 시대)
import { GlowFilter } from 'pixi-filters';

const supportingGlow = new GlowFilter({ distance: 12, outerStrength: 0.4, color: 0xFFFFFF });
const heroGlow = new GlowFilter({ distance: 28, outerStrength: 0.85, color: 0xFFD700 });

// 3. 배경 그라데이션 (Pixi Mesh + vertex colors 또는 LinearGradient texture)
// 권장: 미리 렌더링된 Sprite 사용 (성능)
const skyTexture = await Assets.load('frosted-sky-gradient.png');  // pre-rendered
const skySprite = new Sprite(skyTexture);

// 4. State 전환 (배경 색조)
import { ColorMatrixFilter } from 'pixi.js';
const darkenFilter = new ColorMatrixFilter();
darkenFilter.brightness(0.3, false);  // S3 진입 시 적용, 0.1s tween
```

### 4.8 §5 (Character Design Direction) 핸드오프

본 §4가 모든 컬러 contract 정립. §5 Character Design은:
- 캐릭터 머티리얼 hex (§3.2에 `headGrad`·`bodyGrad` 참조) → §5에서 정확 stop colors 명세
- 캐릭터 애니메이션 시 컬러 변화 (예: 발사 순간 일시 글로우 색 변화)
- S3 Critical 중 화이트-핫 글로우 정확 hex (현재는 sample HTML에서 시각만 락인)

---

## 5. Character Design Direction (Prototype Core)

M0 prototype 필수 항목. Animation specs, LOD, Expression/Personality, Post-MVP Skins, §6 핸드오프는 design/art/draft/art-bible-extras.md §[원출처 §5.*] 참조.

### 5.1 Player Character Visual Archetype

**Type**: Single character (MVP에서 1종). NPC·enemy·ally 없음 (풍선은 object).

**Archetype**: **Cute Glass Figurine (큐트 글래스 인형)** — small humanoid with rounded chibi proportions, made entirely of frosted glass with neon inner glow. 핵심 톤: 친근함·약간 모자란 듯한 cuteness·neutral facial expression (감정은 자세와 글로우로 표현, 표정 변화 최소).

### 5.2 Material Stop Colors

샘플 HTML의 `headGrad`·`bodyGrad` canonical 승격:

**Head Material** (`headGrad` — pink glass):

| Stop | Color | Alpha |
|------|-------|-------|
| 0% (center highlight) | `#FFD2E6` | 0.90 |
| 50% (mid) | `#FFA0C8` | 0.75 |
| 100% (edge) | `#C86EA0` | 0.60 |

**Body Material** (`bodyGrad` — cyan-blue glass):

| Stop | Color | Alpha |
|------|-------|-------|
| 0% (center highlight) | `#DCF0FF` | 0.85 |
| 60% (mid) | `#A0C8F0` | 0.65 |
| 100% (edge) | `#648CC8` | 0.55 |

**Arms/Legs**: `bodyGrad` 동일 적용.
**Hands**: `rgba(180, 220, 255, 0.85)` solid — slightly more opaque.
**Shoes**: `rgba(120, 160, 220, 0.85)` solid — darker cyan, ground contact 강조.

### 5.3 Pose & Stance (Prototype 핵심)

| 상태 | Pose | 시각 표현 |
|------|------|---------|
| **Idle (S2 baseline)** | 정면 향함, 양팔 위로 들어 작살 launcher 잡음, 다리 살짝 벌림 | 안정적·기대감, 호흡 애니메이션 (몸통 ±2% scale 2s 주기) |
| **S3 Critical 중** | Idle pose 유지, 머티리얼 전체 화이트-핫 글로우 전환 | 캐릭터 silhouette만 보임 (디테일 일시 사라짐) |

> Spawn / Respawn, Drag 이동 중, Fire, Death 포즈 및 animation timing 상세는 design/art/draft/art-bible-extras.md §[원출처 §5.3] + §[원출처 §5.4] 참조.

---

## 6. Environment Design Language (Prototype Core)

전체 환경 overview, ambient effects, mobile responsive, §7 핸드오프는 design/art/draft/art-bible-extras.md §[원출처 §6.*] 참조.

### 6.2 Background Sprite Specification

**Frosted Sky 그라데이션** (§4.1 hex 기준):

| 속성 | 값 |
|------|-----|
| **방향** | 수직 (top → bottom) 180° linear gradient |
| **Stops** | `#B5D8E8` 0% → `#F5C2D4` 50% → `#C4B0E0` 100% |
| **해상도 (논리 픽셀)** | 1080×1920 (모바일 세로 9:16 표준) — Pixi `Sprite`로 stretch to viewport |
| **파일 포맷** | PNG-8 또는 SVG (그라데이션 단순 → SVG가 용량 최소) |
| **파일 크기 목표** | < 20KB (절차적 생성 시 0KB) |
| **Pixi v8 권장 구현** | **절차적 생성** (런타임에 `Graphics` + `FillGradient`). 정적 PNG 대신. 메모리·로드 시간 최소화 |

```typescript
// Pixi v8 절차적 Frosted Sky gradient 생성
import { Graphics, FillGradient } from 'pixi.js';

const gradient = new FillGradient(0, 0, 0, screen.height);
gradient.addColorStop(0, 0xB5D8E8);
gradient.addColorStop(0.5, 0xF5C2D4);
gradient.addColorStop(1, 0xC4B0E0);

const skyBackground = new Graphics()
  .rect(0, 0, screen.width, screen.height)
  .fill({ fill: gradient });
```

### 6.3 Z-layer Hierarchy (Pixi Container 순서)

배경(가장 뒤) → UI(가장 앞) 순서. **5컨테이너 lock** — systems-index.md §Engine Bootstrap과 정확히 동기.

| Layer | Container 이름 | 내용 | z-index |
|-------|--------------|-----|---------|
| L0 | `bgContainer` | Frosted Sky gradient sprite | 0 (가장 뒤) |
| L1 | `balloonContainer` | 모든 풍선 (일반 + Critical Gold) | 1 |
| L2 | `harpoonContainer` | 발사된 작살 (비드 체인 + 화살촉) | 2 |
| L3 | `vfxContainer` | 파편 파티클·Critical 플래시·Power-Up tint | 3 |
| L4 | `uiContainer` | HUD·메뉴·점수 패널·RETRY 버튼 | 4 (가장 앞) |

> character entity는 balloonContainer 내 zIndex로 처리 (decisions §2.2: character + harpoon → balloon-physics-split 흡수). ambient background effects는 PROCEED 후 vfxContainer 흡수 또는 별도 container 신설 — M1 재검토 (격리: art-bible-extras.md §6.4).

**Pixi v8 구현**:
```typescript
// 생성 순서가 곧 draw order
const bgContainer      = new Container(); app.stage.addChild(bgContainer);
const balloonContainer = new Container(); app.stage.addChild(balloonContainer);
const harpoonContainer = new Container(); app.stage.addChild(harpoonContainer);
const vfxContainer     = new Container(); app.stage.addChild(vfxContainer);
const uiContainer      = new Container(); app.stage.addChild(uiContainer);
```

**불변 규칙**: Container 순서는 production 빌드에서 절대 변경 금지. 시스템 GDD 추가 시 본 L0-L4 안에 맞춰야 함.

---

## 8. Asset Standards (Bundle Budget)

UI/HUD visual direction (§7), asset category inventory (§8.1), file formats (§8.2), naming convention (§8.3), procedural vs static matrix (§8.4), Vite config hints (§8.6), loading strategy (§8.7)는 design/art/draft/art-bible-extras.md §[원출처 §7.*] + §[원출처 §8.*] 참조.

### 8.5 Bundle Size Budget — 초기 vs Lazy 분리

**초기 번들 (첫 인터랙티브 도달까지 필요한 asset)**:

| 항목 | 목표 (gzip) | 최대 (gzip) |
|------|-----------|-----------|
| Pixi v8 core (minified) | ~400KB | 450KB |
| pixi-filters (GlowFilter 포함) | ~50KB | 80KB |
| Inter 폰트 (Variable) | ~30KB | 50KB |
| 게임 코드 (모든 시스템) | ~100KB | 200KB |
| Critical SFX (팝·Critical·Power-Up 3개) | ~30KB | 50KB |
| 캐릭터 PNG | ~5KB | 10KB |
| Pause·RETRY 아이콘 (절차) | 0KB | 0KB |
| **초기 번들 총합** | **~615KB** | **~840KB** |

**Lazy 청크 (on-demand 로드)**:

| 항목 | 목표 (gzip) | 트리거 |
|------|-----------|-------|
| BGM (`bgm-frosted-sky-main.mp3`) | ~80KB | 게임 시작 시 |
| Power-Up SVG 아이콘 (3개) | ~10KB | 첫 콤보 5+ 시 |
| Loading SFX (선택) | ~10KB | 첫 사망 시 |

> **600KB 목표 검증**: 초기 번들 615KB는 목표 600KB를 ~2.5% 초과. Pixi v8 tree-shaking으로 사용하지 않는 모듈 (예: `@pixi/mesh-extras`) 제거하면 ~580KB 가능. Vite `manualChunks` + `import()` 동적 로드로 BGM·SVG 분리하여 초기 < 600KB 달성.

> **첫 인터랙티브 < 2s 목표**: 초기 번들 615KB / 3G 빠름 ~750Kbps = 약 6.5초. **현실적으로 4G/LTE 기준** 1.5-2초 가능. 3G 환경은 폴백 Loading screen (S6, CSS gradient 즉시 표시) 필수.
