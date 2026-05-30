# Art Bible Extras: POP!

---
- **Status**: ISOLATED for prototype scope (M0). M1 진입 시 본문 재통합 대상.
- **출처**: art-bible.md (압축 전 v2026-05-30) 격리 분류
- **분류 권위**: production/decisions/2026-05-30-prototype-scope.md §2.2
---

이 파일은 art-bible.md 압축 과정에서 M0 prototype 범위에서 격리된 섹션을 보존한다.
원문 그대로 이동; 재해석·편집 없음. M1 Pre-Production 진입 시 art-bible.md 재통합 대상.

---

## [원출처 §2.1 격리 행] Mood & Atmosphere — S1·S4–S7 상태

> **격리 사유**: M0 prototype 스코프에서 S2 (Baseline) + S3 (Critical) 외 상태는 빌드 검증 우선순위 밖.
> M1 재통합 위치: art-bible.md §2.1 매트릭스.

| State | Primary Emotion | Lighting Character | Atmospheric Descriptors | Energy Level | Pixi v8 구현 가이드 |
|-------|----------------|-------------------|----------------------|------|-------------------|
| **S1. Main Menu** | 초대·기대 (Anticipation) | 따뜻한 sunset, 색온도 ~4500K, 대비 낮음 | 부드러운 / 빛나는 / 무중력 / 차분한 | 정적 (Static) — 풍선 1-2개만 부유 | 배경 그라데이션 + 풍선 slow float (10s 주기) + UI Liquid Glass 패널 |
| **S4. Power-Up Absorb** | 만족·보상 (Satisfaction) | 아이템 색조 틴트로 전 화면 부드럽게 색칠 (0.5s) | 따뜻한 / 흡수된 / 보상받은 / 부드러운 | 펄스 (Pulse) — 0.5초 부드러운 swell | `BlendMode.ADD` 색상 overlay (peak 0.2s, fade 0.3s). 캐릭터 주변 색조 glow. **§1.3 Power-Up 흡수 행 참조** |
| **S5. Game Over** | 회복·재도전 (Reflection + Replay Urge) | Frosted Sky 약간 saturated, score 발광, RETRY 버튼 highlight | 평온한 / 정리된 / 초대하는 / "한 판 더" | 정적 → 미세 펄스 (RETRY 버튼만) | 게임플레이 layer fade out (0.5s) + score panel fade in (0.3s lag) + RETRY 버튼 slow pulse (1.5s 주기, breathing animation) |
| **S6. Loading** | 인내·기대 (Patient Anticipation) | Frosted Sky 그라데이션 (정적), 색온도 ~5500K, 대비 낮음 | 잠잠한 / 준비 중인 / 비어있지만 따뜻한 | 정적 (Static) — Frosted Sky 단일 + 풍선 1개만 부유 + 로딩 ring (회전) | 배경 그라데이션 즉시 표시 (Pixi 로드 완료 전 fallback CSS gradient) + 글래스 로딩 ring (캐릭터 위치 자리) + 점진적 풍선 fade in 시작 |
| **S7. Pause** (앱 전환·전화 수신 등) | 일시 멈춤·복귀 대기 (Frozen Anticipation) | S2 배경 그대로 frozen + 상위 dim overlay 30% | 정지된 / 흐릿한 / 기다림 | 완전 정지 (Frozen) — 모든 애니메이션 중단 | Pixi Ticker `stop()` + 화면 위 `rgba(0,0,0,0.3)` dim overlay + 중앙 "TAP TO RESUME" 글래스 패널. 자동 일시정지 트리거: `document.visibilitychange`(hidden) — Input System E.1.3 라이프사이클과 연동 |

---

## [원출처 §2.2] 톤 전환 규칙 (State Transition Atmospherics)

- **S1 → S2** (메뉴 → 플레이 시작): 0.5초 fade. 풍선 1-2개가 빠르게 multiply되어 baseline density 도달
- **S2 → S3** (Critical 트리거): **즉시** (no fade). 다크닝 0.1s ease-in, 0.1s hold, 0.1s ease-out → 총 0.3s 풀 darken 사이클. **§1.3 "0.2초 미만 순간 플래시"는 darken hold 구간(0.1s) 내에 화이트 overlay flash로 내포됨** (수치 충돌 해소)
- **S2 → S4** (Power-Up 흡수): **즉시** tint 시작. 0.2s peak, 0.3s fade
- **S2 → S5** (사망): 0.5초 slow fade. 풍선 정지 + 캐릭터 fade out + score 반전 등장
- **S5 → S2** (RETRY): **체감 즉시 (0.3초 이하)** restart (P4 필러). RETRY 버튼 클릭 → 0.3s 안에 다음 런 시작
- **S6 → S1 또는 S2** (Loading 완료): asset preload 완료 → 메뉴(S1) 또는 직접 게임(S2)으로 0.3s fade
- **S2 → S7** (앱 전환·전화): `document.visibilitychange(hidden)` 감지 → 즉시 freeze + dim. **Input System E.1.3 / E.5.2와 동기화 — `input:dragCancel` emit과 동시 처리**
- **S7 → S2** (앱 복귀): `visibilitychange(visible)` → "TAP TO RESUME" 1탭 → 0.2s dim fade out + Pixi Ticker `start()` → S2 정상 복귀

> **이벤트 우선순위 원칙 (Mood Intensity Tie-Breaker)**: 동시 이벤트 발생 시 더 높은 mood intensity가 우선된다 — **Critical (S3) > Power-Up (S4) > Baseline (S2)**. 본 원칙은 art bible 차원의 declaration이며, 구체 enforcement(이벤트 큐·preemption 로직)는 **Visual Juice System GDD (#10)에서 명세** 예정 — TODO: Visual Juice GDD 작성 시 본 §2.2 원칙 명시 참조.

---

## [원출처 §2.3] 의도적으로 배제하는 분위기

| 배제 분위기 | 이유 | 시각 회피책 |
|-----------|------|----------|
| **고독·우울 (Loneliness)** | POP!은 짬짬이 가벼운 카오스 게임. 진지한 톤은 컨셉 정체성 파괴 | 명도·채도 모두 hi-key 유지. Game Over 시조차 톤 안 어둡게 |
| **공포·긴장 (Tension/Fear)** | Sensation & Juice는 즐거운 폭발이지 공포 폭발이 아님 | 사망 시 충격적 사운드·붉은 화면 금지. 부드러운 fade out |
| **압박·재촉 (Pressure/Urgency)** | "더 빨리 해라" 강요 톤은 P4(1탭 마찰 제로) 위반 | 카운트다운 타이머·재촉 UI 절대 금지 |
| **시리어스 (Solemnity)** | 메인 BGM이 ambient electronic이지 orchestral epic 아님 | 미니멀 UI, 무거운 폰트 금지, 영웅 서사 톤 차단 |

---

## [원출처 §2.4] §1과의 일관성 검증

| §1 원칙 | §2 적용 |
|---------|---------|
| 라이트 baseline + 이벤트 다크닝 (§1.2 Principle 2) | S2 라이트 / S3·S4 이벤트 분기로 enforce |
| 반투명 유리 머티리얼 (§1.2 Principle 1) | S1-S7 모든 상태에서 동적 액터 글래스 머티리얼 유지 |
| 둥근 형태 (§1.2 Principle 3) | 모든 state에서 직각 모서리 금지 (UI Liquid Glass·로딩 ring·Pause 패널 모두 둥근 corner) |
| 휘파람 같은 카오스 (§1.5 Mood Anchor — 안정감) | S1 안정감 + S6 안정감(로딩) |
| 휘파람 같은 카오스 (§1.5 Mood Anchor — 호기심) | S2 호기심 (풍선 부유) |
| 휘파람 같은 카오스 (§1.5 Mood Anchor — **약속**) | **S3 약속 충족** ("Critical 한 번이면 화면이 통째로 화답한다" — 다크닝+플래시+골드림으로 시각화) |
| Visual Contract (§1.4 — sample HTML 정합성) | **S3·S4 이벤트 구현 시 §1.4 검증 경계 기준 준수** (파라미터 정확 일치 + 픽셀 ±10% 허용) |

---

## [원출처 §2.5] §3 (Shape Language) 핸드오프

본 §2가 게임 상태별 emotional·atmospheric context를 정립함. **§3 Shape Language는 본 §2의 energy level 변화(정적 → 측정된 → 폭발적 → 펄스 → 회복)와 동기화되는 형태 어휘를 정의해야 함.** 예: S2 baseline에서 풍선 크기 비율, S3 Critical 순간 골든 풍선의 silhouette 강조 방식 등은 §3 소관.

---

## [원출처 §3.1] Shape Hierarchy (Hero vs Supporting)

| Tier | 요소 | 특성 | 시각 가중치 | 플레이어 응시 빈도 |
|------|------|------|-----------|----------------|
| **HERO** | Critical Gold 풍선 / 발사된 작살 (전체 궤적) / 작살 화살촉 히트 프레임 1-2f / 점수 숫자 변화 / Power-Up 아이템 (드롭~흡수 완료까지) | 최고 채도 + 강한 outer glow + 가장 큰 silhouette 대비 | **100%** (눈이 가장 먼저) | 0.5–3초 동안 집중 |
| **SUPPORTING** | 일반 6색 풍선 / 캐릭터 / UI 패널 / 작살 비드 체인 (히트 외 시점) | 중간 채도 + 표준 glow + 일관된 형태 어휘 | **70%** | 상시 부유 인지 |
| **AMBIENT** | Frosted Sky 배경 / 미세 파티클 / UI shadow | 낮은 채도 + 부드러운 fade + 작은 형태 | **30%** | 무의식적 인지만 |

> **Tier 전환 동적 규칙**:
> - 작살 비드 체인: 발사 중 SUPPORTING → 화살촉 히트 프레임 1-2f 동안 **HERO intensity bump** → 다음 발사까지 SUPPORTING
> - Power-Up 아이템: 드롭 순간(스폰) HERO → 캐릭터 흡수 진행 중(0.5s) HERO 유지 → 흡수 완료 후 사라짐
> - Critical Gold 풍선: 항상 HERO (스폰 → 팝까지 일관)

- **Design Test**: 화면에서 임의 200ms 캡처 → HERO 요소가 3개 이하인가? → YES면 통과, NO면 hero 수 축소 또는 contrast 조정
- **Pillar Served**: P2 (화면이 점수보다 먼저 말한다) — 시각 위계가 정보 priority를 즉시 전달

---

## [원출처 §3.4] UI Shape Grammar

**UI는 world의 글래스 어휘를 echo (별개 HUD 언어 아님)**. 즉 풍선·캐릭터와 같은 머티리얼 family.

| 요소 | 형태 | corner radius | 머티리얼 | blur 반경 |
|------|------|-------------|---------|---------|
| 점수 패널 (HUD) | 가로 긴 rounded rect | 16px | Liquid Glass (Alpha 0.18) | **12px** |
| RETRY 버튼 | 정사각 rounded | 24px (더 부드러움) | Liquid Glass + slight highlight glow (S5 펄스) | **12px** |
| Pause 패널 | 정사각 rounded | 20px | Liquid Glass + dim overlay 30% | **16px** (더 강함) |
| Loading ring | 원형 stroke (open arc) | N/A (원) | 글래스 stroke + 회전 애니메이션 | 없음 |
| 메뉴 START 버튼 (S1) | 큰 rounded rect | 32px | Liquid Glass + slow breathing pulse | **12px** |

**Pixi v8 구현**:
- 모든 패널은 `Graphics.roundRect()` 또는 `@pixi/ui` `RoundedBox`. corner radius ≥ 16px 강제 (§1.2 Principle 3 enforce)
- blur는 `BlurFilter({ strength: 12 })` 적용 (Pixi v8 import: `import { BlurFilter } from 'pixi.js'`)
- **`cacheAsTexture = true` (성능 최적화)**: 패널 내용이 변경되지 않는 동안 cache 유지. 점수 텍스트 변경 시에만 `cacheAsDirty = true` 호출하여 재캐싱 트리거

**Design Test**: UI 요소 중 corner radius < 16px이 있는가? → YES면 즉시 보정

---

## [원출처 §3.5] 형태 통합 표 (전체 요소 한 눈에)

| 요소 | 기하 카테고리 | sharp 요소? | Glow 강도 | Tier |
|------|------------|-----------|---------|------|
| 배경 그라데이션 | flat (no shape) | ❌ | none | AMBIENT |
| 일반 풍선 (6색) | circle | ❌ | standard | SUPPORTING |
| Critical Gold 풍선 (default) | circle + golden outline (S3 시) | ❌ | ×2 (golden glow), S3 darken 중 scale 1.0→1.1 0.1s | **HERO** (항상) |
| 캐릭터 | rounded humanoid (타원 조합) | ❌ | standard | SUPPORTING |
| 작살 비드 체인 | circle ×30 (zigzag) | ❌ | standard / **히트 1-2f HERO bump** | SUPPORTING → HERO (히트) |
| **작살 화살촉** | polygon (sharp tip + 미늘) — *§1.2 canonical 참조* | ✅ **유일한 예외** | standard | **HERO** (발사 순간만) |
| Power-Up 아이템 | sphere/circle | ❌ | bright | **HERO** (드롭~흡수 완료) |
| UI 패널 | rounded rect (radius ≥ 16) | ❌ | subtle | AMBIENT/SUPPORTING |
| **콤보 글로우** (캐릭터 주변) | radial ring (캐릭터 중심 반경 80px) | ❌ | combo count에 비례 (3콤보+: 약 / 5콤보+: 강 / 10콤보+: 폭발) | HERO (5콤보+) / SUPPORTING (그 미만) |
| **점수 팝업** (+250 등) | 텍스트 floating (위로 떠오름) | ❌ | text glow + drop shadow | **HERO** (0.5s 동안) |
| 파티클 (분열 시) | 작은 circle 또는 sparkle (4점 별) | sparkle만 약간 | bright peak | HERO (0.3s만) |

---

## [원출처 §3.6] §1 + §2 일관성 검증

| 상위 원칙 | §3 적용 |
|---------|---------|
| §1.2 Principle 3 (둥근 형태) | 작살 화살촉 외 모든 요소 원형/타원/rounded rect |
| §1.2 작살 예외 명시 | §3.3·§3.5에서 sharp 유일 예외로 enforce |
| §1.5 Mood Anchor (안정감·호기심·약속) | 안정감=부드러운 원형 / 호기심=풍선 부유 / 약속=Critical Gold HERO tier |
| §2 energy level 동기화 | S2 baseline = SUPPORTING tier 중심 / S3 Critical = HERO tier 폭발 / S4 Power-Up = HERO tier pulse |

---

## [원출처 §3.7] §4 (Color System) 핸드오프

본 §3가 모든 요소의 **형태와 위계**를 정립. §4 Color System은 본 §3의 Tier 분류(HERO/SUPPORTING/AMBIENT)와 동기화된 컬러·glow intensity rules를 정의해야 함.

> **중요 — 채도가 아닌 Glow Magnitude로 차별화**: 풍선 6색(§1.3)이 이미 HSL 채도 100%이므로 "HERO 채도 ≥ 85%" 식 가이드는 풍선 간 차별화 효과가 없음. 실제 사용 가능한 차별화 파라미터는 **outer glow alpha + glow radius + (선택) outline stroke**:
>
> | Tier | outer glow alpha | glow radius (px) | outline stroke |
> |------|----------------|----------------|---------------|
> | HERO | ≥ 0.70 | ≥ 24 | 선택적 (Critical S3 시 골드 outline) |
> | SUPPORTING | 0.30–0.60 | 8–16 | 없음 |
> | AMBIENT | ≤ 0.20 | ≤ 8 | 없음 |
>
> §4 작성 시 본 표를 컬러 채도 가이드와 함께 명시.

---

## [원출처 §3.8] Shape Language 준수 체크리스트 (구현자용)

신규 시각 오브젝트 추가 시 본 체크리스트로 §3 준수 검증:

- [ ] 형태가 원형/타원/rounded rect인가? (예외: 작살 화살촉만 허용)
- [ ] 머티리얼이 §1 글래스 사양 (Alpha 0.20, glow radius ≥ 8px) 충족?
- [ ] Tier 분류 결정됨? (HERO / SUPPORTING / AMBIENT)
- [ ] HERO 동시 발현 ≤ 3개 유지?
- [ ] UI 패널 corner radius ≥ 16px?
- [ ] 모바일 viewport 360px 너비에서 인식 가능한 크기?
- [ ] thumbnail 32×32px에서 식별 가능 (캐릭터·HERO 요소만)?
- [ ] DPR 자동 처리 (Pixi `autoDensity: true`)?

→ 한 항목이라도 NO면 art-director 협의 후 디자인 조정 또는 명시적 예외 사유 §3 추가.

---

## [원출처 §5.4] Animation Specs

| Animation | Duration | Easing | Pixi v8 구현 |
|-----------|----------|--------|------------|
| Spawn pop-in | 0.2s | ease-out | scale 0.7 → 1.0 + alpha 0 → 1 (`Ticker` callback에서 elapsed/duration 보간) |
| Breathing (idle) | 2s 주기 (loop) | ease-in-out sine | `Ticker` callback: `t = ticker.elapsedMS / 1000 * Math.PI` (radians), `scale.y = 1 + Math.sin(t) × 0.02`. t 단위 명세로 2초 주기 보장 |
| Drag follow | 즉시 (frame-rate independent lerp) | linear | `factor = 1 - Math.pow(1 - 0.3, delta / (1000/60))` 사용. 60fps 기준 factor 0.3, 저사양에서도 동일 체감. **단순 `× 0.3` 직접 사용 금지** (frame-rate dependent) |
| Fire recoil | 0.1s | ease-out | 양팔 각도 -10° → 0° linear interpolation |
| Death dissolve | 0.3s | ease-in | scale 1.0 → 0.95 + alpha 1.0 → 0.0 + 좌우 ±5° rotation |
| Critical white-hot | 0.2s (S3 동기) | step (no easing) | 모든 머티리얼 fill → `rgba(255,255,255,0.95)` 즉시 교체 후 즉시 복귀 |

---

## [원출처 §5.5] LOD Philosophy (Level of Detail)

POP!은 단일 캐릭터·고정 카메라 거리(화면 하단 ~80px 높이) → **LOD 시스템 불필요**. 모든 디테일 항상 표시.

**예외 (thumbnail 32×32px 축소 시)**:
- 머리·몸 silhouette 유지
- 팔다리 단순화 (line 1px → invisible 허용)
- 표정 디테일(눈·미소) 생략 가능

**Pixi v8 구현**: 단일 캐릭터 sprite. 별도 LOD swap 로직 없음.

> **Filter 격리**: 캐릭터의 `charGlow` filter는 **캐릭터 Container에 고립** 적용 (전역 stage filter 금지). 발사 중 작살 비드 30개와 동시 렌더링 시 filter 중복 합산 방지.

---

## [원출처 §5.6] Expression / Personality

**감정 표현 채널**:
1. **신체 자세** (5.3 참조) — 가장 강한 감정 표현
2. **글로우 색상·강도** — Critical·Power-Up 등 메커니즘 이벤트 동기
3. **표정 디테일** — sample HTML의 작은 점 두 개(눈) + 미세 미소 곡선 (살짝만, 너무 인간적이지 않게)

**금지**:
- 큰 표정 변화 (놀람·분노·기쁨 등 명시적 emotion 아이콘 금지)
- 입 벌림·이빨 노출 (cute 톤 깨짐)
- 눈물·땀 등 만화적 emotion symbol

**근거**: 캐릭터는 player의 분신이지 NPC가 아니다. emotion projection 여지 보존.

---

## [원출처 §5.7] Post-MVP Expansion (Skins)

MVP에는 1 캐릭터 (Anti-pillar AP3). Post-MVP에서 스킨 시스템 고려 가능:
- 머리·몸 색조 변경 (Magenta-Lime 등 풍선 6색 응용)
- 액세서리 (모자·안경 등 — 머티리얼 글래스 family 유지)
- 시즌 테마 (할로윈·크리스마스 등)

> **Skin 호환성 spec**: 스킨은 `headGrad`/`bodyGrad` gradient의 **색상 stop만 교체**하되, **alpha profile (0.90/0.75/0.60 머리, 0.85/0.65/0.55 몸)은 모든 스킨에서 고정**. 글래스 머티리얼 일관성 보장 (§1.2 Principle 1 준수). Pixi v8에서는 `tint` 방식이 아닌 gradient 교체 방식 권장.

→ 본 §5 명세는 base character 한정. 스킨 시스템 추가 시 §5 확장 또는 별도 skin-bible.md.

---

## [원출처 §5.8] §6 (Environment Design Language) 핸드오프

본 §5가 캐릭터를 정립. §6 Environment는:
- POP! 환경 극도로 단순 (배경 그라데이션 + 풍선 부유 공간만)
- 캐릭터 위치(화면 하단 ~80px 높이) 제약과 풍선 활동 공간 분리 명세
- **Z-layer 명세 필수**: 배경 그라데이션(가장 뒤) → 풍선 layer → **캐릭터 layer** → 작살 layer → UI Layer(가장 앞) Pixi Container z-order
- 배경 그라데이션 sprite 크기·해상도·Pixi v8 import 방법
- (Optional) 동적 배경 요소: 미세 cloud particles, sparkle 등 ambient 효과

§6는 짧을 것으로 예상 (POP!이 환경 다양성 없는 단일 arena 게임).

---

## [원출처 §6.1] Environment Overview

**POP!의 환경 = 배경 그라데이션 + 풍선 활동 공간 + 캐릭터 영역**. 별도 아키텍처·소품·NPCs·env storytelling 없음.

| 카테고리 | POP! 적용 |
|---------|---------|
| Architecture | N/A (open space) |
| Props | N/A (MVP) — Post-MVP에서 ambient cloud particles 등 |
| NPCs | N/A (single character only) |
| Environmental Storytelling | N/A (game-concept.md "스토리 없음") |
| Lighting | §1.2 Principle 2 + §2.1 state-based |

**환경 단순화 근거**: P1 필러("한 손가락 한 결정") + P2 필러("화면이 점수보다 먼저 말한다") — 환경 노이즈는 입력·정보 우선순위에 방해. 의도된 미니멀.

---

## [원출처 §6.4] Ambient Effects (Optional, Post-MVP 우선)

**MVP에서 권장하지 않음** (성능 우선). Post-MVP에서 도입 가능:

| Effect | 설명 | 비용 | Pixi 구현 |
|--------|------|------|---------|
| **미세 cloud particles** | 배경 위 흐릿한 흰색 구름 5-10개, 매우 느린 가로 이동 (60s+ 주기) | 낮음 | `ParticleContainer` + tinted sprites |
| **Sparkle ambient** | 화면 어딘가 0.5-2초마다 미세 sparkle 효과 (별 모양 1-2px) | 낮음 | timer-based spawn → `Graphics` star + alpha tween |
| **Subtle gradient shift** | 배경 그라데이션 색조 매우 천천히 변화 (낮 → 황혼 → 밤) | 중간 | gradient stop hex tween (5분 주기) |

> **MVP 결정**: 모두 OFF. 60fps 안정 + bundle size 우선. Post-MVP 베타테스트에서 "환경이 너무 정적이다" 피드백 시 도입 검토.

> **M1 재통합 노트**: §6.4는 art-bible.md §6.3 아래 §6.4로 직접 재삽입. M1 진입 시 ambient effects 결정 상태 재검토.

---

## [원출처 §6.5] Mobile Responsive Design

| 디바이스 | viewport | 처리 |
|---------|---------|------|
| **iPhone 11 (414×896 CSS)** | 9:19.5 aspect | 배경 sprite stretch fit. 위·아래 약간 cropping 허용 |
| **Galaxy A52 (412×915 CSS)** | 9:20 aspect | 동일 |
| **iPad Mini (768×1024 CSS, portrait)** | 9:12 aspect | 배경 stretch + 좌우 풍선 활동 공간 자연 확장 |
| **데스크탑 (1920×1080 가로)** | 16:9 | 배경을 좌우로 stretch하지 않고 **세로 영역만 사용** (좌우 letterboxing 또는 blur 확장) — MVP는 letterboxing |

**Pixi 초기화**:
```typescript
new Application({
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: window.devicePixelRatio,
  autoDensity: true,
  resizeTo: window,  // 자동 viewport 추적
});
```

`window.resize` 이벤트 시 모든 Container 재배치 (Visual Juice / UI System GDD에서 enforce).

---

## [원출처 §6.6] §7 (UI/HUD Visual Direction) 핸드오프

본 §6가 환경 layer + Z-order 정립. §7 UI는:
- 본 §6.3 Z-layer L6 (uiContainer) 안에서만 작동
- §4.5 Liquid Glass palette 적용
- §3.4 corner radius rules 적용
- P4 필러("1탭이 다음 런으로") 시각화 (RETRY 버튼 breathing pulse 등)
- 모바일 터치 타겟 ≥ 44px (Apple HIG) 보장
- 화면 가장자리 ~20px safe zone 유지 (Input System E.4 iOS edge swipe 보호)

---

## [원출처 §7] UI / HUD Visual Direction

3개 화면 (Main Menu / Gameplay HUD / Score Screen) 풀 명세. §3.4 + §4.5 통합 + 타이포·아이콘·인터랙션.

### §7.1 Screen Inventory

| Screen | 트리거 | 주요 요소 | 분위기 (§2 참조) |
|--------|------|---------|----------------|
| **Main Menu** | 게임 진입 (S1) | 타이틀 로고 + START 버튼 + 베스트 스코어 표시 + (옵션) 설정 아이콘 | S1 초대·기대 |
| **Gameplay HUD** | 플레이 중 (S2 ~ S4) | 현재 점수 (상단) + 콤보 인디케이터 (캐릭터 주변) + (옵션) 시간 경과 표시 | S2 흐름·집중 (HUD 최소화) |
| **Score Screen** | 게임 오버 (S5) | 최종 점수 + 베스트 갱신 표시 + RETRY 버튼 + (옵션) 공유 버튼 | S5 회복·재도전 |
| **Pause Overlay** (S7) | `visibilitychange` | "TAP TO RESUME" 패널 + dim overlay | S7 일시 멈춤 |
| **Loading Screen** (S6) | 첫 진입 시 (Pixi 번들 로드) | Frosted Sky 배경 + 중앙 회전 ring + 옵션 진행률 % | S6 인내·기대 (2초 이내 fade out) |
| **Game Over Transition** | S2 사망 → S5 진입 사이 (0.5초) | 게임플레이 layer fade out + 마지막 frame freeze + score panel fade in | S5 회복 진입 |

> **MVP 범위 외 (defer)**: 첫 플레이 onboarding tooltip, 데일리 도전 표시, 통계 화면, 설정 모달은 Post-MVP. game-concept.md "Post-MVP Feature Backlog" 참조.

### §7.2 Gameplay HUD Architecture

```
┌─────────────────────────────┐
│  [SCORE 1,247]              │ ← Top center (Liquid Glass panel)
│                             │
│       ○                     │ ← 풍선
│   ○        ○                │ ← 풍선
│         ○                   │ ← 풍선
│                             │
│            ○                │
│                             │
│           │                 │ ← 작살 (발사 중)
│           │                 │
│           ◇                 │ ← Power-Up (드롭 중, HERO tier)
│                             │
│         (콤보 글로우 ring)   │ ← 캐릭터 주변 글로우 (콤보 5+ 시 강)
│           👤                │ ← 캐릭터
└─────────────────────────────┘
   ← 화면 가장자리 20px safe zone (모든 인터랙티브 요소 제외)
```

| 요소 | 위치 | 크기 | 표시 조건 |
|------|------|------|---------|
| Score Panel | 상단 중앙 (top: 24px, centered) | 너비 ~120px × 높이 40px | 상시 |
| Combo Indicator (글로우 ring) | 캐릭터 중심 (radius 60-80px) | 콤보 카운트 비례 | 콤보 ≥ 3 |
| Power-Up Pickup | 드롭 위치 (랜덤 풍선 팝 위치) | 32px × 32px | 드롭 중 (~1초) |
| Critical Banner | 화면 중앙 (Critical 발생 시) | 풀스크린 오버레이 (alpha 0.3) | S3 0.2초만 |

> **수직 충돌 zone**: Score Panel은 상단 0–64px 구역 점유. **Power-Up Pickup이 이 zone에 드롭될 경우 Power-Up이 Score Panel 뒤에 배치 (z-order: Score Panel > Power-Up)** — Score 가독성 우선. Drop animation은 zone 밖으로 빠져나오면 정상 표시.

### §7.3 Typography

| 용도 | 폰트 | Weight | Size (논리 px @ 1080p) | Color |
|------|------|--------|--------------------|-------|
| **Score 숫자** | `Inter` (또는 `SF Pro Rounded`) | 600 (Semibold) | 24px | `rgba(40,30,60,0.85)` (Liquid Glass 위) |
| **Score 라벨 ("SCORE")** | Inter | 500 (Medium), uppercase, letter-spacing 1px | 14px | `rgba(40,30,60,0.6)` |
| **점수 팝업 (+250)** | Inter | 700 (Bold) | 28px | `#FFFFFF` + drop shadow `rgba(0,0,0,0.4)` + **outer glow 8px rgba(0,0,0,0.6)** (어두운 풍선 위에서 가독성 보장) |

> **점수 팝업 spawn 규칙**: 풍선 팝 위치에서 위로 떠오름 (Δy: -40px over 0.5s, alpha 1.0 → 0.0). z-order: vfxContainer (L5) — 풍선 위, UI 아래. 다중 팝업 동시 발생 시 자동 stack 회피 (각 팝업 spawn 시 ±8px x-offset 랜덤).

| **메인 타이틀 ("POP!")** | Inter / SF Pro Rounded | 800 (Extrabold) | 64px | `#FFD700` (골드) + outer glow |
| **버튼 텍스트 ("START", "RETRY")** | Inter | 600 | 20px | `rgba(40,30,60,0.85)` |
| **콤보 텍스트 ("×8 CHAIN")** | Inter | 700 | 18px, uppercase | `#FFC100` (콤보 골드) + glow |

**폰트 로딩**:
- `Inter`는 Google Fonts에서 무료. 또는 Self-host (`woff2` 형식, ~30KB)
- Pre-load 권장: `<link rel="preload">` 또는 Pixi 초기화 전 `document.fonts.load()`
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### §7.4 Iconography

| 아이콘 | 용도 | 형태 | Stroke / Fill |
|--------|------|------|--------------|
| **멀티샷 Power-Up** | Inventory drop | 화살 ×3 fanned out (위로) | 흰색 stroke 2px, no fill |
| **동결 Power-Up** | Inventory drop | 눈송이 (6각 별) | 흰색 stroke 2px, no fill |
| **메가폭탄 Power-Up** | Inventory drop | 별 (∗ 4-point) | 흰색 fill |
| Pause 아이콘 | Pause 패널 | ‖ (두 vertical bar) | 흰색 fill, 16×16px |
| RETRY 아이콘 (옵션) | RETRY 버튼 | ↻ (curved arrow) | 흰색 stroke 2px |
| Best Score 표시 | Main Menu | ★ (5-point star) outline | 골드 stroke 1.5px |

**Pixi 구현**: 모든 아이콘은 SVG 또는 Pixi `Graphics` 절차 생성. Sprite sheet 불필요 (수 적음).

> **Colorblind 이중 코딩**: 풍선 6색 (Magenta·Cyan·Lime·Amber·Mint·Violet)은 색 외 시각 구별 cue 없음. Deuteranopia에서 Cyan vs Mint, Magenta vs Violet 혼동 가능하지만 **MVP에서 풍선 색은 메커니즘 영향 없음** → 게임플레이 blocking 아님. 상세 분석 및 Post-MVP 패턴 overlay 도입은 **§4.6 Colorblind Safety 참조**.

### §7.5 Button Style System

| 버튼 종류 | Size | corner radius | Liquid Glass | 펄스 |
|---------|------|------------|------------|-----|
| **Primary (START·RETRY)** | 200×64px | 32px | Default + outer breathing pulse | breathing 1.5s |
| **Secondary (설정·공유)** | 48×48px (정사각) | 16px | Default + slight tint on hover | 없음 |
| **Floating (RESUME)** | 160×56px | 28px | Default + center align | 없음 |

**Disabled 상태** (예: 로딩 중 START, 점수 산출 중 RETRY):
- Alpha 전체 0.4
- Border alpha 0.15 (희미하게)
- Outer pulse 정지
- Touch event 무시 (Pixi `eventMode = 'none'`)
- 텍스트 색 unchanged (alpha만 0.4)

**터치 타겟**: 모든 버튼 최소 **44×44 px** (Apple HIG). Primary 64px 이상으로 여유.

### §7.6 Animation Feel

| 인터랙션 | 반응 | Duration |
|---------|------|---------|
| **버튼 tap** | scale 1.0 → 0.95 → 1.0 (눌림 피드백) | 0.15s |
| **버튼 release** | scale 1.0 + glow flash (0.1s) | 0.1s |
| **Score 갱신** | 숫자 즉시 변경 + 점수 팝업 fade-out 0.5s | 0.5s |
| **콤보 글로우 증가** | radius scale 1.0 → 1.2 → 1.0 (펄스) | 0.3s per increment |
| **Critical Banner 출현** | alpha 0 → 0.3 → 0 (instant peak) | 0.2s |
| **화면 전환 — Main → Gameplay** | 전체 fade out (S1 elements) + Gameplay layer fade in | 0.5s (ease-in-out) |
| **화면 전환 — Gameplay → Score** | 게임플레이 layer fade out + 마지막 frame freeze + score panel fade in | 0.5s (S5 fade) + 0.3s (panel) lag |
| **화면 전환 — Score → Gameplay (RETRY)** | RETRY 버튼 tap → 0.3s 안에 다음 런 시작 (P4 필러) | 0.3s 이하 |
| **화면 전환 — Pause 진입** | 즉시 freeze + dim overlay fade in 0.2s | 0.2s |
| **화면 전환 — Pause 해제** | dim overlay fade out + Ticker.start() | 0.2s |

### §7.7 Diegetic vs Screen-space

**POP!은 screen-space HUD** (diegetic 아님). 근거:
- 게임 환경이 추상적 (Frosted Sky open space) — diegetic UI 부착할 surface 없음
- 캐릭터가 player avatar라 HUD를 "들고 있는" 컨셉 불일치
- 캐주얼 모바일 게임 표준 (Suika·Vampire Survivors 등 모두 screen-space)

**예외**: 콤보 인디케이터는 캐릭터 주변에 떠 있어 살짝 diegetic-feeling. 단 캐릭터에 attached가 아니라 캐릭터 위치 따라가는 floating UI.

### §7.8 Touch Target Compliance

| 요소 | 최소 터치 영역 | 시각 영역 |
|------|-------------|---------|
| START / RETRY 버튼 | 64×64px (Primary) | 64×64px (시각 = 터치) |
| 설정 / 공유 (Secondary) | 48×48px | 48×48px |
| **Pause 진입 버튼 (Gameplay HUD 우상단)** | **48×48px (HIG 준수)** | 16×16px 아이콘 (중앙 정렬, 32px hit area 패딩 추가) |
| 화면 빈 공간 (드래그 + 발사) | 화면 전체 | N/A (배경 자체) |

**Safe zone**: 모든 인터랙티브 요소는 화면 가장자리 **20px 이상 안쪽** 배치 (iOS edge swipe 충돌 방지 — Input System E.4 enforce).

### §7.9 §8 (Asset Standards) 핸드오프

본 §7가 UI 시각·인터랙션 명세. §8 Asset Standards는:
- 폰트 파일 (Inter woff2) 파일 명·크기·라이선스
- 아이콘 SVG 파일 명·크기·viewBox 표준
- 절차적 vs 정적 asset 결정 표
- 모든 asset 네이밍 컨벤션 (kebab-case + 카테고리 prefix)
- Vite 번들링 설정 (asset import 방식)

---

## [원출처 §8.1] Asset Category Inventory

| Category | 예시 | MVP 개수 | 우선순위 |
|----------|------|---------|---------|
| **폰트 (Font)** | Inter Variable woff2 | 1 file | 필수 |
| **사운드 (Audio)** | 팝 SFX·Critical·Power-Up·BGM | 4-6 files | 필수 |
| **아이콘 (Icon)** | Power-Up 3종·Pause·RETRY·Star | 5-7 SVG | 필수 |
| **이미지 (Image)** | 캐릭터 PNG 1개 (PNG 래스터화 — `@pixi/svg` 의존 회피) + (절차 생성) 풍선·작살·UI | **1 file** | 필수 (캐릭터만) |
| **데이터 (Config)** | 풍선 색 hex·튜닝 노브·텍스트 i18n·**파티클 spawn 파라미터** (count·lifetime·velocity) | 2-3 JSON | 필수 |
| **Shader (Future)** | 커스텀 `.frag`/`.vert` | **0 (MVP 해당 없음)** — pixi-filters 기본 셰이더만 사용 | N/A (Post-MVP 도입 시 추가 카테고리) |
| **Font fallback** | CSS 시스템 폰트 fallback chain (`-apple-system, BlinkMacSystemFont, sans-serif`) | 0 (CSS 정의) | 필수 — Inter 로드 실패 시 깨짐 방지 |
| **HTML reference** | sample HTML | 1 file | 참조용 (런타임 미포함) |

---

## [원출처 §8.2] File Format Standards

| Category | Format | 근거 |
|----------|--------|------|
| Font | `.woff2` (Variable Font 권장) | 모던 브라우저 100% 지원, 압축률 ↑, 다중 weight 지원 |
| Audio (SFX) | `.mp3` 128kbps 또는 `.ogg` | iOS Safari·Android Chrome 호환. mp3 안전 |
| Audio (BGM) | `.mp3` 192kbps | 음질 vs 사이즈 균형 |
| Icon (Vector) | `.svg` (inline에서 Pixi `Graphics` 변환 권장) | 해상도 무관, gzip 후 매우 작음 |
| Image (Raster, 사용 시) | `.webp` (fallback `.png`) | 압축률 ↑, 모든 모던 모바일 지원 |
| Config (Data) | `.json` (typed via TypeScript) | 표준 JS native, no parser overhead |

---

## [원출처 §8.3] Naming Convention

**`[category]-[name]-[variant].[ext]`** (kebab-case, 영문 lowercase)

> **Override 명시**: 템플릿 표준 (`[category]_[name]_[variant]_[size].[ext]` — underscore)을 **kebab-case로 override**. 근거: HTML5 웹 타겟 — URL-safe 문자 (하이픈) + CSS 컨벤션 호환. `technical-preferences.md` "Files: kebab-case" 정합.

| Category Prefix | 예시 |
|---------------|------|
| `font-` | `font-inter-variable.woff2` |
| `sfx-` | `sfx-balloon-pop.mp3`, `sfx-critical-flash.mp3`, `sfx-powerup-absorb.mp3` |
| `bgm-` | `bgm-frosted-sky-main.mp3` |
| `icon-` | `icon-powerup-multishot.svg`, `icon-powerup-freeze.svg`, `icon-pause.svg` |
| `bg-` | `bg-frosted-sky.png` (사용 시) |
| `config-` | `config-balloons.json`, `config-tuning-knobs.json`, `config-i18n-ko.json` |

**금지**: 공백, 대문자, 한글·특수문자, 버전 suffix (`-v2`, `-final` 등 — git history로 관리)

---

## [원출처 §8.4] Procedural vs Static Asset Decision Matrix

POP!은 **절차 생성 우선** 전략 (번들 크기·메모리 최소화):

| Asset | 절차 vs 정적 | Pixi v8 구현 |
|-------|------------|------------|
| 배경 Frosted Sky | **절차** | `Graphics` + `FillGradient` (§6.2) |
| 풍선 (모든 색·사이즈) | **절차** | `Graphics.circle()` + radial gradient |
| 캐릭터 | **정적 PNG (단일 파일)** — `@pixi/svg` 의존 회피 | sample HTML SVG를 1080p 해상도 PNG로 export 후 `Assets.load('character-figurine.png')` → `Sprite`. Default + Critical 화이트-핫 2개 텍스처 |
| 작살 비드 체인 + 화살촉 | **절차** | `Graphics.circle()` ×30 + `Graphics.polygon()` |
| Power-Up 아이콘 | **정적 SVG** (3개 — 모양 복잡) | `Assets.load('icon-powerup-*.svg')` → Sprite |
| Pause·RETRY·Star 아이콘 | **절차** (단순) | `Graphics` 절차 |
| UI Liquid Glass 패널 | **절차** | `Graphics.roundRect()` + `BlurFilter` |
| 파티클 (분열·sparkle) | **절차** | `ParticleContainer` + dynamic spawn |
| 점수 텍스트 | **절차** | `Text` (Pixi v8 native) |

**근거**: MVP 번들 크기 < 600KB 목표 (technical-preferences.md). 절차 생성 = 0 KB asset.

---

## [원출처 §8.6] Vite Build Configuration Hints

```typescript
// vite.config.ts (요약 가이드)
import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  build: {
    target: 'es2020',  // 모던 모바일 브라우저
    minify: 'terser',  // 기본 esbuild보다 압축률 ↑ (번들 크기 우선)
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },  // production 콘솔 제거
    },
    sourcemap: 'hidden',  // production에서는 hidden (디버깅용 .map 생성, public 미노출)
    rollupOptions: {
      output: {
        manualChunks: {
          'pixi-core': ['pixi.js'],
          'pixi-filters': ['pixi-filters'],
        },
      },
    },
    assetsInlineLimit: 4096,  // 4KB 미만 asset은 base64 inline
  },
  plugins: [
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],
  optimizeDeps: {
    include: ['pixi.js', 'pixi-filters'],
  },
});
```

> **CSS Font fallback**: `body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }` — Inter 로드 실패 시 시스템 폰트로 자연 fallback. `font-display: swap` 적용으로 FOUT 방지.

---

## [원출처 §8.7] Asset Loading Strategy

| Phase | Asset | 시점 |
|-------|-------|------|
| **Phase 1 — 즉시 (HTML load)** | CSS fallback gradient (§4.3 S6) | 0ms — Pixi 로드 전 |
| **Phase 2 — Pixi init** | Pixi v8 core + pixi-filters | < 1s |
| **Phase 3 — Critical preload** | Inter 폰트, 배경 (절차라 0KB), config JSON | < 1.5s |
| **Phase 4 — Lazy load** | BGM (게임 시작 시 fetch), Power-Up 아이콘 (첫 드롭 시) | on-demand |

```typescript
import { Assets } from 'pixi.js';

// Phase 3: Critical preload
await Assets.load([
  'font-inter-variable.woff2',
  'config-balloons.json',
  'config-tuning-knobs.json',
]);

// Phase 4: Lazy load
const bgmPromise = Assets.load('bgm-frosted-sky-main.mp3');
const powerupIconPromise = Assets.load('icon-powerup-multishot.svg');
```

---

## [원출처 §8.8] §9 (Reference Direction) 핸드오프

본 §8가 asset 표준 정립. §9 Reference Direction은:
- 본 art bible 전체에 인용된 외부 reference 캐노니컬 정리 (R1 Neon Glassblowing·R2 Frosted Sky·R3 Liquid Glass)
- 각 reference의 어떤 요소를 차용했고 무엇을 의도적으로 거부했는지 명시
- WebSearch 검증된 출처 URL 모두 포함

---

## [원출처 §9] Reference Direction

본 art bible 전체에서 인용한 외부 reference 캐노니컬 정리. **각 reference는 ADDITIVE** (서로 다른 방향 가리킴, 중복 없음).

### §9.1 R1 — Neon Glassblowing (풍선·캐릭터·작살 머티리얼)

**무엇을 차용**: 반투명 유리에서 안으로 빛이 새어 나오는 시각 어휘. 표면 굴절, rim highlight, outer glow의 결합이 만드는 "fragile but glowing" 인상.

**무엇을 의도적으로 거부**: 사실적 조명 시뮬레이션 (PBR), 그림자 cast, 표면 micro-detail. POP!은 stylized·optimized 글래스, 사실적 렌더링 아님.

**검증된 출처**:
- [Laura Hart — Neon-Illuminated Glass Orchids (Colossal)](https://www.thisiscolossal.com/2020/04/laura-hart-neon-glass-orchids/) — 핵심 visual reference, "translucent glass with neon" 정수
- [Pexels — Glass Blowing Photography](https://www.pexels.com/search/glass%20blowing/) — 용해된 유리의 내부 광원·표면 굴절
- [Adobe Stock — Glass Orbs (216k+)](https://stock.adobe.com/search?k=glass+orb) — 구체 형태 reference

### §9.2 R2 — Pastel Sunset Gradient (Frosted Sky 배경)

**무엇을 차용**: 따뜻한 파스텔 그라데이션 (sky blue → soft pink → lavender)으로 만든 평온하고 무중력적인 분위기. 시간대 ambiguity (해질녘이지만 어둡지 않음).

**무엇을 의도적으로 거부**: 비비드·만화 톤 (Suika Game류), 어두운 sunset (붉은 노을·검은 silhouette).

> **Post-MVP 검토 항목** (anti-reference 아님 — 향후 고려): Alto's Odyssey의 실시간 동적 sky weather cycle은 §6.4 Ambient Effects로 도입 검토 가능.

**검증된 출처**:
- [uiGradients (designer-curated)](https://uigradients.com/) — CSS hex 적용 가능 그라데이션 라이브러리
- [WallpaperFlare — Pastel Sunset Neon](https://www.wallpaperflare.com/sky-sunset-clouds-pink-neon-purple-pastel-fading-wild-wallpaper-ekjvq) — POP! Frosted Sky 톤 정확 매치
- [iStock — Pastel Gradient](https://www.istockphoto.com/photos/pastel-gradient) — 추가 reference 라이브러리

### §9.3 R3 — Apple Liquid Glass (UI 머티리얼 + 환경 반응 철학)

**무엇을 차용**:
1. **반사+굴절+동적 변형** 머티리얼 (POP! Adaptive Darkening 철학과 정확 일치)
2. **레이어드 머티리얼** (UI 패널이 여러 유리층으로 구성)
3. **Specular highlights** — **R1 (Glassblowing)이 캐노니컬, R3는 보조**. 풍선·캐릭터·작살의 Specular는 R1 사양을 따르고, UI 패널만 R3 Liquid Glass 스타일의 specular 적용

**무엇을 의도적으로 거부**: iOS 26의 전체 OS 디자인 언어 차용 (POP!은 게임이지 시스템 UI 아님). 동적 매트릭스 변형 (게임 캐릭터는 정적 위치).

**검증된 출처**:
- [Apple 공식 — "delightful and elegant new software design" (2025-06-09)](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) — Liquid Glass 발표 공식
- [WWDC25 — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) — 공식 디자인 가이드라인 영상
- [Wikipedia — Liquid Glass](https://en.wikipedia.org/wiki/Liquid_Glass) — specular highlights, layered translucency 등 명세
- [TechCrunch — Apple Redesigns OS with Liquid Glass](https://techcrunch.com/2025/06/09/apple-redesigns-its-operating-systems-with-liquid-glass/) — 디자인 변경 요약

### §9.4 Anti-references (의도적으로 영향 받지 않음)

| Anti-reference | 거부 이유 |
|---------------|---------|
| **Geometry Wars / TRON류 다크 네온** | 다크 배경 거부 (Critical 순간만 다크닝). 95% 시간 라이트 톤이 POP! 정체성 |
| **Candy Crush 비비드 폭발** | 비비드 컬러+만화 폭발은 P2(화면이 점수보다 먼저 말한다)와 충돌. 톤 시끄러움 |
| **Pixel art 레트로 (Pang 오리지널 포함)** | 비주얼은 모던 부드러운 톤. Pang 메커닉 인용만, 비주얼 인용 X |
| **Suika Game 만화 톤** | 컬러·결이 R1·R2와 다름. Anchor 정체성 흐림 |
| **Royal Match 광고 인터럽트** | P4 (1탭 마찰 제로) 위반. UI 비주얼 톤은 호환되나 광고 정책 reject |
| **Vampire Survivors 어두운 카오스** | 메커닉만 차용 (오토 + 짧은 런). 비주얼은 결이 다름 (다크 + 픽셀) |
| **Cut the Rope / Bubble Witch류 글로시 플라스틱** | 반짝임·둥근 오브젝트로 R1과 표면적 유사하나 **플라스틱 톤**. POP!의 translucent glass와 충돌. "반짝이면 OK" 오해 방지를 위해 명시적 거부 |

### §9.5 Reference Source 단일 테이블 (구현자 참조)

**Visual References** (art bible의 시각 결정 근거):

| Code | Topic | Primary Source URL |
|------|-------|------------------|
| R1 | Neon Glassblowing | [Laura Hart (Colossal)](https://www.thisiscolossal.com/2020/04/laura-hart-neon-glass-orchids/) |
| R2 | Pastel Sunset Gradient | [uiGradients](https://uigradients.com/) |
| R3 | Apple Liquid Glass | [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) |

**Technical Standards** (입력·터치·접근성 사양 근거 — Accessibility 섹션 + Input System GDD에서 사용):

| Standard | Topic | Primary Source URL |
|----------|-------|------------------|
| Hammer.js | Touch UX threshold heuristics | [Hammer.js](https://hammerjs.github.io/) |
| W3C Pointer Events L3 | 브라우저 입력 표준 | [W3C](https://www.w3.org/TR/pointerevents3/) |
| Material Design Touch | 터치 타겟 사이즈 (≥44px) | [Material](https://m2.material.io/develop/web/supporting/touch-target) |
| WCAG 2.1 AA | 접근성 표준 (contrast, focus 등) | [W3C WCAG](https://www.w3.org/TR/WCAG21/) |

---

## [원출처 §Accessibility] 접근성

### A.1 Colorblind Safety
§4.6 참조. 풍선 색은 메커니즘 영향 없으므로 colorblind 사용자에게 critical 영향 없음. Critical Gold·Power-Up은 색+모양+glow 다중 cue. 별도 colorblind mode UI는 Post-MVP.

### A.2 Text Size + Contrast Ratio (WCAG 1.4.3)

| 용도 | 최소 크기 (논리 px @ 1080p) | Contrast Ratio 기준 |
|------|--------------------------|-------------------|
| Score 숫자 | 24px (Apple HIG 최소 18pt = 24px CSS) | ≥ 4.5:1 (배경 대비) — Liquid Glass 패널 위 dark text `rgba(40,30,60,0.85)` 확보됨 |
| 점수 팝업 | 28px | ≥ 4.5:1 — white text + 검은 outer glow로 풍선 위 가독성 보장 |
| 버튼 텍스트 | 20px | ≥ 4.5:1 — Liquid Glass 패널 위 dark text |
| 작은 라벨 ("SCORE", "BEST") | 14px (uppercase + tracking) | **별도 검증 필수** — 14px는 WCAG "small text" 기준. Frosted Sky 파스텔 위 흰 텍스트는 contrast 실패 위험. 구현 시 색 조정 필요 (대안: `rgba(40,30,60,0.6)` dark + Liquid Glass 패널 위) |

> **검증 도구 권장**: WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/) — 구현 단계에서 모든 텍스트-배경 조합 검증.

### A.3 Touch Target
모든 인터랙티브 요소 ≥ 44×44px (Apple HIG). §7.8 참조.

### A.4 Motion Sensitivity
**MVP 옵션 없음** (모든 motion ON). Post-MVP에서 `prefers-reduced-motion` CSS media query 대응:
- breathing pulse 정지
- Critical 다크닝 0.2s → 0초 (즉시 색 전환)
- 캐릭터 spawn pop-in scale 애니메이션 제거 (즉시 alpha fade)

### A.5 Sound
- 모든 게임 진행은 sound 없이도 가능 (시각 cue 우선, §2 다크닝·플래시 등)
- 인앱 사운드 음소거 옵션은 Post-MVP
- **MVP 대안**: 사용자는 디바이스 시스템 음소거로 즉시 음소거 가능. 모바일 표준 동작이므로 MVP에서 별도 UI 미제공 정당화 가능

### A.6 Screen Reader Support
**N/A for MVP** — POP!은 vision-dependent 게임 (시각·반응 중심). Score Screen만 ARIA 라벨 추가 가능 (Post-MVP).

### A.7 Pause / Resume
P4 필러("1탭 RETRY") + S7 Pause 메커니즘으로 인터럽트 처리. visibilitychange로 자동 pause → 인지부담 ↓.

### A.8 Focus Visible (WCAG 2.4.7) — 데스크탑 호환

POP!은 모바일 우선이나 데스크탑 웹 호환 (mouse + keyboard fallback). 데스크탑에서 키보드 탐색 시:

- **MVP 범위**: N/A — 모든 인터랙션이 touch / mouse click 전제. 키보드 전용 사용자는 게임 플레이 불가 (입력 시스템상 한계, vision-dependent 게임)
- **Post-MVP**: START/RETRY 버튼에 `:focus` visible 스타일 추가 (2px 골드 outline). WCAG 2.4.7 AA 충족 위해 권장
- **현재 결정**: MVP에서 키보드 탐색 미지원 명시. Post-MVP 베타테스트에서 키보드 사용자 피드백 시 우선 추가
