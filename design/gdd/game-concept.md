# Game Concept: POP!

*Created: 2026-05-29*
*Status: Draft*

---

## Elevator Pitch

> 한 손가락으로 캐릭터를 끌고 다니며 더블탭으로 작살을 위로 쏴 풍선을 분열시키는 캐주얼 카오스 모바일 웹 게임. 분열할수록 더 작아지고 점수는 기하급수, 황금 풍선과 자동 흡수 Power-Up이 도파민을 빌드업시키며, 단 한 번의 접촉으로 끝나는 1–3분 짧은 런을 "한 판 더" 반복하게 만든다.

10초 테스트: 클래식 Pang을 모바일에 맞게 한 손가락으로 재해석한 카오스 캐주얼.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | 캐주얼 액션 / 아케이드 리메이크 (Pang 계열 + 모멘텀 슈머) |
| **Platform** | HTML5 모바일 웹 (세로 모드 기본, 데스크탑 웹 호환) |
| **Target Audience** | 25–45세 캐주얼-미드코어 모바일 플레이어 — 짧은 짬짬이 세션 + 도파민 스파이크 추구 (자세히는 Player Profile 참조) |
| **Player Count** | 솔로 (Post-MVP에서 비동기 리더보드 가능) |
| **Session Length** | 1런 30초–3분, 5분 안에 2–3런 전형 |
| **Monetization** | MVP는 미정 — 게임성 검증 후 결정 (Tier 2 단계에서 광고/IAP 후보) |
| **Estimated Scope** | MVP 3–5일 (AI-agent 협업 기준 인간 시간). 풀비전 ~3–4주 |
| **Comparable Titles** | Vampire Survivors / Suika Game / Geometry Dash / Holedown / Pang (원작 영감) |

---

## Core Fantasy

**"혼돈을 통제하고, 더 큰 혼돈으로 보답받는다 — 분열의 황홀경"**

원작 Pang의 본질적 쾌감은 단 하나 — "터뜨림이 더 작은 터뜨림을 낳는 연쇄 분열의 시각적 만족"이다. POP!은 이 본질을 보존하되, 현대 모바일 캐주얼의 도파민 빌드업 어휘(랜덤 크리티컬·자동 흡수 Power-Up·적응형 비주얼 강도)를 접목한다.

플레이어가 얻는 약속:
- **통제와 카오스의 동시 만족** — 손가락은 단순(드래그+더블탭)하지만, 화면은 점점 통제할 수 없는 카오스로 차오른다. 그리고 한 번의 좋은 샷이 그 카오스를 정리한다.
- **순간의 빌드업** — 5콤보가 쌓이면 Power-Up이 떨어지고, 그것이 더 큰 콤보를 만들고, 그게 또 Power-Up을 부른다. 60초 안에 작은 폭죽 쇼.
- **운에 베팅하지만 박탈당하지 않는다** — 황금 풍선은 매 런 2–3회 보장. 운은 자주, 실력 천장은 깊게.

다른 캐주얼 게임에서 얻기 어려운 것: **즉시·강한·반복 가능한 시청각 카타르시스**를 1–3분 안에. 출퇴근 한 정거장 안에 "와 다 터졌다"를 5번 겪고 싶을 때 이 게임이 존재한다.

---

## Unique Hook

**Pang AND ALSO Vampire Survivors AND ALSO Suika Game**

- Pang에서: 작살을 위로 쏴 풍선을 둘로 분열시키는 핵심 메커니즘
- Vampire Survivors에서: 자동화·1런=짧음·"운+성장" 빌드업 곡선
- Suika Game에서: 분열·합체 카오스가 모바일 캐주얼에서 통한다는 검증

세 게임 어느 하나도 다음을 가지고 있지 않다:
1. **한 손가락 + 분열 메커니즘** — Pang은 다중 입력, Suika는 단순 드롭, VS는 자동 사격
2. **적응형 비주얼 강도** — Critical 순간만 화면이 다크닝되어 명도 대비 폭발 (대부분 게임은 일관된 톤)
3. **자동 흡수 Power-Up** — 콤보가 만든 보상이 즉시 손에 들어와 다음 콤보를 부르는 양성 피드백 (Suika·Pang에는 없음)

핵심: 이 셋의 교차점은 비어 있다. POP!이 그 자리를 차지한다.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (감각적 쾌락) | **1 (Primary)** | 스크린쉐이크·파티클·시간감속·적응 다크닝·음정 상승의 동시 발현. 베이스라인 주스가 모든 팝에 적용 |
| **Challenge** (도전·숙달) | **2** | 데스 = 즉시 종료 + 시간비례 풍선 수 증가. 잘하는 사람은 더 오래 살아남고 더 큰 스코어 |
| **Discovery** (탐험·발견) | 3 | Power-Up 종류 발견, Critical 행운 변형성, 메커닉 깊이 (정밀 조준 시 다중 관통 가능성) |
| **Submission** (휴식·편안함) | 4 | 1탭 RETRY로 마찰 제로, 짧은 세션, 자동 흡수로 인지 부담 낮음 |
| **Fantasy** | N/A | 서사·캐릭터 없음 |
| **Narrative** | N/A | 스토리 없음 |
| **Fellowship** | N/A | MVP에 사회 기능 없음 (Post-MVP 비동기 리더보드 가능) |
| **Expression** | N/A | 빌드·커스텀 없음 (AP3 안티필러로 명시) |

### Key Dynamics (Emergent player behaviors)

플레이어가 자연스럽게 시작할 행동:
1. **"한 발이 가장 많이 터지는 위치 찾기"** — 풍선 수직 정렬을 무의식적으로 노림
2. **"Power-Up 흡수 후 5초 안에 다음 큰 콤보 시도"** — 모멘텀 라이딩 본능
3. **"황금 풍선 우선 사냥"** — 큰 보상 인지 후 우선순위 자동 형성
4. **"안전 구역으로 후퇴 → 정리 샷"** — 카오스가 임계점 도달 시 회피·정리 사이클
5. **데스 직후 1탭 RETRY** — 사망 1초 이내 자동 재시작 (Geometry Dash 패턴)

### Core Mechanics (Systems we build)

1. **Drag-to-Move + Double-Tap-to-Fire** — 한 손가락 입력 스킴 (Phase 3 결정)
2. **Balloon Split Physics** — 1 풍선 → 2 작은 풍선 (3사이즈 단계, 최소 사이즈는 종단)
3. **Critical Pop System** — 10% 확률 골든 풍선, 팝 시 화면 다크닝 + 근접 풍선 자동 연쇄
4. **Power-Up Drop System** — 5콤보+ 시 자동 흡수 아이템 드롭 (멀티샷·동결·메가폭탄)
5. **Baseline Juice Layer** — 모든 팝에 스크린쉐이크·파티클·음정·시간감속 차등 적용

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (자유·의미 있는 선택) | 위치·발사 타이밍은 자유. Power-Up은 자동 흡수 (선택 없음 — 의도된 단순화) | Supporting |
| **Competence** (숙달·실력 성장) | 생존시간·점수가 명확한 측정자. 정밀 조준·콤보 추적·카오스 관리의 깊은 천장 | **Core** |
| **Relatedness** (연결·소속) | MVP에 없음. Post-MVP 비동기 리더보드·데일리 시드로 보강 가능 | Minimal (MVP) |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (Primary) — 점수·생존시간 = 명확한 목표, 1런이 짧아 시도 빈도 높음, "내 베스트 갱신" 동기
- [x] **Explorers** (Secondary-Low) — Power-Up 종류 발견·Critical 행운 변형성·메커닉 깊이는 약한 탐험 자극
- [ ] **Socializers** — MVP에서 사회 기능 0
- [ ] **Killers/Competitors** — PvP 없음, MVP 리더보드도 없음

**Quantic Foundry 12-동기 프로파일**:
- HIGH: Destruction · Excitement
- MID-HIGH: Power · Challenge
- MID: Completion (Power-Up 수집감)
- LOW: Fantasy · Story · Design · Discovery · Strategy · Community · Competition (post-MVP MID 가능)

→ 아키타입: **"Daredevil" + "Acrobat"** — 짧은 시간 강한 자극·파괴·속도 추구 캐주얼.

### Flow State Design

- **Onboarding 곡선**: 명시적 튜토리얼 없음 (AP4). 첫 풍선이 튜토리얼. 0–10초 동안 1–2개 풍선만 등장하므로 자연스럽게 입력 학습
- **난이도 스케일링**: 시간비례 풍선 수 증가 (0–30s: 1–2개 / 30–60s: 3–4개 / 60–90s: 5+개 / 90s+: 캡 후 스폰 속도 증가)
- **피드백 명료성**: 모든 팝마다 베이스라인 주스 발현 → 실력 향상이 즉시 시청각 피드백으로 환원. 점수 숫자는 부차적 (P2 필러)
- **실패 회복**: 데스 → 점수 화면 → 1탭 RETRY (P4 필러). 사망과 다음 런 사이 마찰 최소화

---

## Core Loop

### Moment-to-Moment (30초)

```
플레이어 화면 하단 중앙에 캐릭터
    ↓
풍선 1–3개 떠다님 (포물선 바운스)
    ↓
드래그로 캐릭터 이동 → 풍선 아래 위치
    ↓
더블탭 → 작살이 위로 발사
    ↓
풍선 히트 → 둘로 분열 (사이즈 한 단계 작아짐) + 베이스라인 주스
    ↓ [확률 분기]
    [10%] 황금 풍선 → Critical Pop: 화면 다크닝 0.2초 + 근접 풍선 자동 연쇄
    [5콤보+] Power-Up 드롭 → 캐릭터 자동 흡수 (멀티샷/동결/메가폭탄)
    ↓
가장 작은 풍선 = 더 안 쪼개짐 + 큰 점수
    ↓
화면 클리어 또는 시간 진행 → 다음 풍선 스폰
```

### Short-Term (5–15분 = 2–8런)

각 런이 1–3분이므로 5분 안에 2–3런, 15분에 7–8런 가능.

- "한 판 더" 심리 트리거:
  - 직전 런에서 봤지만 못 잡은 황금 풍선의 잔상
  - 콤보가 끊긴 아쉬움
  - 베스트 스코어 갱신이 코앞일 때
- 플레이어 선택: 다음 런 즉시 시작 vs 잠시 멈춤 (1탭이라 마찰 거의 없음)

### Session-Level (15–30분 = 5–15런)

- 자연 정지점: 베스트 스코어 갱신 시 / Power-Up 흐름 못 탔을 때
- 세션 마감 후 "이 게임 생각남" 트리거: 다음 출퇴근·다음 휴식

### Long-Term Progression (MVP)

MVP에는 명시적 진행도 시스템 없음. 진행은 **"내 베스트 스코어"** 1자 데이터.
- 베스트 스코어가 어제·지난주보다 높아지는 것이 유일한 성장 지표
- Post-MVP에서 메타 진행도 추가 가능 (스킨 잠금해제 등 — Feature Backlog 참조)

### Retention Hooks (MVP 기준)

- **Curiosity**: Power-Up 3종 중 어떤 게 떨어질지 / Critical이 언제 나올지 (즉시 충족)
- **Investment**: 베스트 스코어 (로컬 저장) — 잃기 싫음
- **Social**: MVP 없음
- **Mastery**: 정밀 조준·콤보 추적·카오스 관리 깊은 천장

---

## Game Pillars

### Pillar 1: 한 손가락, 한 번에 한 결정

**정의**: 모든 입력은 한 손가락으로 가능하며, 같은 시점에 두 가지 결정(이동 + 발사 타이밍)을 강요하지 않는다. 드래그(이동)와 더블탭(발사)은 별개 시간 슬롯에 존재한다.

*Design test*: 새 메커니즘이 "이동 중 정밀 조준" 같은 동시성 결정을 요구한다면 → 폐기

### Pillar 2: 화면이 점수보다 먼저 말한다

**정의**: 큰 일이 났다는 신호는 숫자 popup이 아니라 스크린쉐이크·플래시·사운드·시간감속이다. UI 숫자는 부차적 확인.

*Design test*: 콤보를 "+250" 텍스트로만 표현해야 작동한다면 → 폐기. 시청각 동시 발현이 기본.

### Pillar 3: 운은 자주 보장, 실력은 천장이 깊다

**정의**: Critical Pop과 Power-Up Drop은 모든 플레이어가 매 런 2~3회는 경험한다(자주). 정밀 조준·콤보 추적·생존 시간은 잘하는 사람만 보는 천장(깊게).

*Design test*: "Critical 출현율을 낮춰 희귀하게 강력하게" 제안 → 폐기. 박탈감 방지가 우선.

### Pillar 4: 1탭이 다음 런으로

**정의**: 사망 → 점수 화면 → RETRY까지 1탭. 광고·메뉴·공유를 RETRY 앞에 끼우지 않는다.

*Design test*: 사망 후 시퀀스에 2탭 이상 마찰이 끼면 → 폐기

### Pillar Tensions (의도된 마찰)

| 텐션 축 | 해소법 |
| ---- | ---- |
| P2 vs P1 (화면 폭발이 다음 입력 정보 가림) | 풍선 영구 윤곽선 — 폭발 파티클 위에 두꺼운 stroke로 풍선 실루엣 항상 가시 |
| P3 vs P4 (운+1탭 = "Critical 안 나오면 리세마라") | 시드 기반 풍선 스폰 결정성 + Pity timer (90초 무Critical 시 강제 1회 스폰) |
| P2 vs P3 (시각 폭발이 미세 정보 활용 방해) | 파티클 0.3초 빠른 페이드 강제. 정적 프레임 불필요 (m6/m8 카오스형에서 분열 방향 예측이 핵심 스킬 아님) |

### Anti-Pillars

- **NOT 광고 인터스티셜로 게임 진행을 막는다** — P4 보호. 광고는 도입하더라도 명시적 사용자 선택(리워드 광고) 또는 메인메뉴 외 시점만
- **NOT 콤보 카운트다운 UI를 화면 가운데에 둔다** — P2 보호. 콤보는 캐릭터·풍선 주변 글로우로 표현, UI 텍스트 노이즈 금지
- **NOT MVP에 스킨·캐릭터 코스튬을 넣는다** — 스코프 보호. 게임성 검증 전 비주얼 다양화는 의사결정 분산
- **NOT 명시적 튜토리얼·"이동하세요" 텍스트를 만든다** — P1 보호. 단순 입력은 첫 풍선이 튜토리얼

---

## Visual Identity Anchor

이 섹션은 아트 바이블의 씨앗이다. 모든 비주얼 결정의 기준점.

### 한 줄 비주얼 규칙
> **"모든 것은 부드러운 하늘 위에 빛나는 유리다 — 단, 큰 일이 날 때는 세계가 어두워지며 화답한다."**

### 안커 방향: Neon Glassblowing on Frosted Sky + Adaptive Darkening

**기본 톤 (95% 시간)**:
- 배경: 파스텔 그라데이션 (스카이블루 → 소프트핑크 → 라벤더, 선셋 톤)
- 풍선: 6색 반투명 네온 유리 (마젠타·시안·라임·앰버·핫핑크·바이올렛). 내부 발광, 떨어질 때 잔광 트레일
- UI: 글래스모피즘 — 반투명 패널, 얇은 네온 보더

**이벤트 톤 (5% 시간 — Critical 발생 시)**:
- 0.2초 동안 배경이 딥 쿨블루로 다크닝
- 풍선이 화이트-핫으로 글로우
- 골드 스트리크 + 풀스크린 화이트 플래시
- 다크 배경의 명도 대비 장점을 "특별한 순간"에만 차용

### 지지 비주얼 원칙 3가지

| 원칙 | 디자인 테스트 |
| ---- | ---- |
| **유리는 깨고 싶다** — 풍선은 반투명 유리 질감, 약간의 frosted 효과 + rim light | 풍선이 불투명하게 보인다면 → 머티리얼 재설정 |
| **폭발은 빠르게 사라진다** — 파티클·VFX는 0.3초 안에 페이드 (P2 vs P1 텐션 해소) | 파티클이 1초 이상 머문다면 → 페이드 곡선 단축 |
| **세계가 이벤트에 반응한다** — Critical·Power-Up 같은 메커니즘 이벤트가 배경·조명·시간 스케일을 바꾼다 | 메커니즘 이벤트가 풍선에만 영향을 준다면 → 환경 반응 추가 |

### 컬러 철학 요약

- **풍선 색**: 채도 높은 네온 6색 (시각 카테고리, MVP에서는 메커니즘 차이 없음)
- **배경 색**: 따뜻한 파스텔 → 차가운 다크블루로의 적응형 전환
- **UI 색**: 반투명 화이트 + 얇은 네온 보더
- **Critical 색**: 골드 (#FFC107 계열) + 화이트 플래시
- **Power-Up 색**: 각 아이템 색조에 따라 흡수 시 배경 0.5초 틴트

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| **Pang (1989, Mitchell)** | 작살로 풍선을 분열시키는 핵심 메커니즘 | 멀티 입력 → 한 손가락. 사다리 제거. 카오스형 도파민 추가 | 원조 — 영감의 출처를 명시 |
| **Vampire Survivors (2022)** | 자동화 + 짧은 런 + "운+성장" 빌드업 곡선 | 자동 사격 대신 명시적 더블탭. 메타 진행도는 Post-MVP | "오토파이어 캐주얼 슈머"가 메가히트 가능함을 증명 (5000만+ 판매) |
| **Suika Game (2023)** | 분열·합체 카오스의 모바일 캐주얼 검증 | 분열 방향이 반대 (Suika는 합체). 더 빠른 페이스 | Sensation & Juice 캐주얼이 모바일 글로벌 1위 가능 (2023–2024) |
| **Geometry Dash (2013)** | 데스 = 즉시 종료 → 1탭 RETRY 루프 | 정밀 플랫포밍 대신 카오스 회피·정리 | 1.4억+ 다운로드 — 마찰 제로 재시작의 강력함 입증 |
| **Holedown (2018)** | 물리 체인 + 미니멀 비주얼 캐주얼 | 분열 대신 합체·관통. 더 빠른 페이스 | 모바일 인디 골든 — 클린 비주얼 + 깊은 메커닉 사례 |

**Non-game inspirations**:
- 유리 공예 (Glassblowing) — 풍선 머티리얼 영감
- 선셋 그라데이션 (sunset hour photography) — Frosted Sky 배경 톤
- Apple iOS 15+ 글래스모피즘 UI — UI 톤 영감

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 25–45 (코어 25–35) |
| **Gaming experience** | 캐주얼 ~ 미드코어 (하드코어 아님) |
| **Time availability** | 출퇴근 (편도 15–30분), 점심 시간, 자기 전 5–15분 짬짬이 |
| **Platform preference** | 모바일 (주로 폰), 데스크탑 웹 보조 |
| **Current games they play** | Royal Match, Suika Game, Vampire Survivors (모바일), Geometry Dash |
| **What they're looking for** | 짧은 시간에 강한 시청각 카타르시스, 학습 부담 없음, 진행도 압박 없음 |
| **What would turn them away** | 튜토리얼 강제, 광고 인터럽트, 결제 압박, 30분 이상 세션 강요, 복잡한 메뉴 |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | **Pixi.js v8** (WebGL2 기본, WebGPU 옵션). JavaScript ES2023+ 또는 TypeScript 5.x. Vite 빌드. 결정 근거: Neon Glassblowing 글로우 품질이 WebGL 셰이더 필터(@pixi/filter-glow)에 의존, 캐주얼 모바일 web casual의 표준 스택. 템플릿에 Pixi 전문 specialist 없음 → 범용 agent stretch (`technical-preferences.md` 참조) |
| **Key Technical Challenges** | 모바일 60fps 유지 (다중 풍선 + 파티클 + 셰이더), 더블탭 입력 정확 감지, 적응형 배경 다크닝 셰이더 또는 CSS filter 구현 |
| **Art Style** | 2D 절차적 셰이더 + 글래스모피즘 UI. 핸드페인트 스프라이트 최소화 |
| **Art Pipeline Complexity** | Low–Medium — 풍선 1 마스터 + 컬러 파라미터 절차적 접근으로 에셋 수 최소화 |
| **Audio Needs** | Moderate — 팝(음정 상승 시스템) / Critical / Power-Up / BGM 1트랙 + UI SFX |
| **Networking** | None (MVP). Post-MVP에서 비동기 리더보드 = 클라우드 백엔드 필요 (Firebase / Supabase 등) |
| **Content Volume** | MVP: 1 캐릭터 / 1 아레나 / 3 풍선 사이즈 / 6 색 / 3 Power-Up / 1 Critical / 1 게임모드 |
| **Procedural Systems** | 풍선 스폰 시드 기반 결정성 (페어플레이용), 시간비례 난이도 곡선 |

---

## Risks and Open Questions

### Design Risks

- **R1. 더블탭 발사 입력감** — 첫 탭의 의미가 모호하거나 더블탭이 자연스럽지 않을 위험
  - **완화**: 첫 빌드에서 단발탭 변형도 만들어 5명 베타테스터 A/B 비교 (+1 작업 세션)
- **R3. 시각 노이즈 과부하** — 베이스라인 주스 + Critical 다크닝 + Power-Up 틴트 동시 발생 시 정보 과부하
  - **완화**: 이벤트 우선순위 (Critical > Power-Up > 일반). 한 번에 하나만 풀-임팩트로 재생

### Technical Risks

- **R4. HTML5 모바일 60fps** — 다중 풍선·파티클·셰이더·적응 다크닝이 저사양 모바일에서 30fps 미만 떨어질 위험
  - **완화**: 초기부터 성능 예산 설정 (60fps@iPhone 11 / Galaxy A 시리즈). 파티클 풀링, CSS filter fallback for 셰이더

### Market Risks

- **R5. 시장 진입** — Suika/VS 클론 다수, 차별화가 비주얼+미세 기믹뿐인데 충분한가
  - **완화**: MVP는 게임성 검증만. 차별화 검증 후 PIVOT 여부 결정. Post-MVP에서 LiveOps·메타게임으로 보강 가능

### Scope Risks

- **R2. Critical 페어플레이** — 운 의존도가 너무 높으면 "운 나쁘면 재미없다" 박탈감
  - **완화**: 시드 기반 결정성 + Pity timer (90초 무Critical 시 강제 1회 스폰). Critical 출현율은 모든 플레이어 매 런 2–3회 보장이 P3 필러의 기본 약속

### Open Questions (Phase 검증 필요)

- **Q1. 더블탭 vs 단발탭** — R1 완화책에서 A/B 결정. 베타테스트로 답
- **Q2. Critical 출현율 정확 수치** — 10%가 적정인가? Pity timer 30/60/90초 중 어디? 베타 데이터로 튜닝
- **Q3. Power-Up 3종 비율** — 멀티샷·동결·메가폭탄 중 어느 것이 가장 만족도 높은가? 베타 관측 + 자기보고로 결정
- **Q4. 풍선 사이즈 단계** — 3단계 (대-중-소)가 충분한가, 4단계 (대-중-소-극소)가 더 도파민 강한가? 빌드 비교 필요
- **Q5. 시드 결정성 vs 완전 랜덤** — 페어플레이 vs 매번 새로움. 모바일 캐주얼에서 어느 쪽이 리텐션 강한가? 베타테스트 후 결정

---

## MVP Definition

### 핵심 가설 (단 하나)

> **"한 손가락으로 풍선을 분열시키는 30초 루프 + 랜덤 Critical/Power-Up 모멘텀 빌드업이, 1–3분 짧은 런을 자발적으로 5회 이상 반복하게 만드는가?"**

### MVP 성공 기준 (정량)

- ✅ 베타테스터가 첫 세션에서 **5런 이상** 자발적으로 플레이
- ✅ "한 판 더" 행동 패턴 — **3회 이상 연속 RETRY** 관측
- ✅ 1런 후 코어 루프를 **설명 없이** 묘사 가능 (게임을 이해함)
- ✅ 첫 3런 안에 **90%** 테스터가 Critical 1회 이상 목격 (페어플레이 검증)
- ✅ 평균 런 길이 **30초–3분** 범위 (난이도 곡선 검증)

### MVP에 필수

1. **드래그-이동 + 더블탭-발사** (대안: 단발탭 A/B용)
2. **풍선 분열 시스템** — 3사이즈 × 6색 (시각만, 메커니즘 동일)
3. **Critical Pop** — 골든 풍선 10% + 화면 다크닝 + 근접 자동 연쇄
4. **Power-Up Drop** — 5콤보+ 시 멀티샷/동결/메가폭탄 3종 자동 흡수
5. **베이스라인 주스** — 스크린쉐이크·파티클·시간감속·음정 (모든 팝)
6. **데스 = 런 종료** + **1탭 RETRY**
7. **시간비례 난이도** — 0–30s: 1–2개 / 30–60s: 3–4개 / 60–90s: 5+개
8. **점수 시스템** — 로컬 베스트 스코어 저장
9. **Frosted Sky 배경** + **Critical 시 적응형 다크닝**
10. **3개 화면** — 메인메뉴 / 게임플레이 HUD / 점수 화면
11. **사운드** — 팝 음정 시스템 + Critical SFX + Power-Up SFX + BGM 1트랙

### MVP에 명시적으로 없음

- 데일리 챌린지 / 리더보드 / 통계
- 캐릭터 스킨 / 코스튬
- 아레나 변형 / 배경 다양화
- 풍선 속성 (폭발/얼음/자석 등)
- 추가 Power-Up 종류
- 추가 Critical 변형
- 옵션·설정 UI (기본 디폴트만)
- 광고 / IAP / 결제
- 클라우드 세이브 / 계정
- 명시적 튜토리얼 (AP4)

### 추정 작업량

- **AI-Agent 협업 기준**: 인간 시간 **3–5일** (12–18 작업 세션, 1세션 = 1.5h)
- **베타테스트 wall-clock**: 5명 테스터 모집·관측·피드백 = +1–3일

### Scope Tier 대체: Post-MVP Feature Backlog

상세 일정 추정 없이 카테고리별 피처 리스트.

**A. Engagement (리텐션 강화)**
- 데일리 시드 챌린지 (전 세계 동일 풍선 패턴)
- 비동기 리더보드 (글로벌·친구·로컬)
- 통계 화면 (총 팝·평균 점수·런 길이 분포)
- 데일리 보상 (출석 트래킹)

**B. Content Variety (콘텐츠 다양화)**
- 캐릭터 스킨 (해금형 또는 IAP)
- 아레나 변형 (배경·BGM·풍선 색조 세트)
- 풍선 속성 — 폭발 / 얼음 / 자석 / 분열 가속 등
- 추가 Power-Up 종류 (시간정지·복제·관통)
- 추가 Critical 변형 (체인 폭탄·시간감속·전 화면 정리)
- 새 게임 모드 (시간 어택·정밀 모드·생존 부스트)

**C. Monetization (수익화)**
- 리워드 광고 (Continue / 부스트 / 스킨 무료 잠금해제)
- 인터스티셜 광고 (런 사이 — AP1 위반하지 않는 빈도 한정)
- IAP — 광고 제거 / 스킨 팩 / 캐릭터 잠금해제

**D. Polish & Platform (폴리시 및 플랫폼)**
- 사운드 폴리시 (다중 BGM, 적응형 음악, 보이스)
- 네이티브 wrapping (iOS / Android 앱 스토어)
- 시즌 콘텐츠 (테마별 풍선·배경·이벤트)
- 옵션·접근성 (사운드 볼륨, 진동, 색약 모드)
- 클라우드 세이브 / 계정 시스템
- 다국어 지원

**E. Social (소셜 — 가장 후순위)**
- 친구 시스템
- 공유 가능한 리플레이
- 토너먼트 모드
- 길드 / 클랜

---

## Next Steps

- [x] ~~`/setup-engine`~~ — **수동 락인 완료** (2026-05-29). Pixi.js v8 + JS/TS + Vite. `.claude/docs/technical-preferences.md` 갱신됨. 템플릿 `/setup-engine` 스킬은 Godot/Unity/Unreal만 지원하므로 수동 작성
- [ ] **`/design-review design/gdd/game-concept.md`** — 컨셉 완결성 검증 (선택)
- [ ] **`/art-bible`** — Visual Identity Anchor 기반 아트 바이블 작성. GDD 작성 전 권장
- [ ] **`/prototype POP-core-loop`** — 핵심 가설 검증을 위한 즉시 프로토타입. HTML 경로로 1–3일 폐기형 빌드. R1(더블탭 입력감) + 핵심 분열·Critical·Power-Up 루프 검증
- [ ] 프로토타입 PROCEED 시: **`/map-systems`** — 시스템 분해, 의존 그래프, systems-index.md 생성
- [ ] **`/design-system [시스템명]`** — 시스템별 GDD 작성 (Balloon Physics, Critical/Power-Up, Input Scheme, Visual Juice 등)
- [ ] **`/create-architecture`** — 마스터 아키텍처 + 필수 ADR 리스트
- [ ] **`/architecture-review`** — TR 레지스트리·요구사항 추적성 매트릭스 부트스트랩
- [ ] **`/gate-check pre-production`** — 프리프로덕션 → 프로덕션 게이트 검증

---

*컨셉 락인 완료. 다음 단계는 `/setup-engine`에서 HTML5 framework 결정.*
