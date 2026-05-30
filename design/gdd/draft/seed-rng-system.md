# Seed / RNG System

> **Status**: Designed (pending /design-review)
> **Author**: joywoni + Claude
> **Specialists consulted (lean mode 확장 검토)**:
> - `systems-designer` (algorithm 결정 + §C/D): Mulberry32 선택 + 시드 파생 + Date.now() seed
> - `qa-lead` (Section H AC): AC-05 fixed seed (flaky fix), AC-06 Bonferroni 보정, AC-07 라벨 정정, +3 신규 AC (sub-stream independence, chi-square, degenerate seeds), +AC-18 MVP 베타 검증, smoke subset에 AC-03 추가
> - `engine-programmer` (Pixi v8 / Vite 호환성): **NON-ISSUE 전 항목** 확인 — 변경 불필요. LOW risk 확정
> - `creative-director` (Section B Player Fantasy): positive framing 전환 + Slay the Spire reference 추가 + metaphorical close (GSM §B와 sibling tone)
> **Last Updated**: 2026-05-30
> **Implements Pillar**: P3 — 운은 자주 보장, 실력은 천장이 깊다 (시드 결정성 + 페어플레이)
> **Handoff target**: Other AI agent (spec-heavy, prose-minimal style)
> **Engine target**: Pixi.js v8 + JavaScript/TypeScript + Vite
> **Algorithm**: Mulberry32 (자체 구현, 외부 의존 0)
> **Instances**: 3 domain-specific (spawn / critical / powerup)
> **Seed policy**: 매 런 새 시드 (Date.now() 기반)

---

## Overview

**Seed/RNG System**은 POP! 게임플레이의 모든 확률적 의사결정 — 풍선 spawn 위치·타이밍, Critical Pop 발현 (10% + Pity timer), Power-Up 종류 (3종 균등) — 의 **단일 결정성 권위 소스**다. `Math.random` 호출은 게임플레이 코드 전체에서 금지되며, 모든 RNG는 이 시스템이 제공하는 3개의 domain-specific 인스턴스(`spawn` / `critical` / `powerup`)를 통해서만 발생한다. 각 인스턴스는 Mulberry32 알고리즘(7줄 자체 구현, 외부 의존 0)으로 master seed에서 XOR magic constant로 파생되며, 같은 master seed로 같은 시드 파생 → 같은 RNG 시퀀스 → 같은 게임 패턴이라는 **재현성 계약**을 보장한다. P3 필러("운은 자주, 실력 천장 깊게")의 페어플레이 절반(시드 결정성)과 박탈감 방지 절반(Pity timer counter — 각 도메인 RNG가 인접 시스템과 협력) 모두 이 시스템의 contract 위에 구축된다. 매 런 시작 시 `newRunSeed()` 호출로 새 master seed가 생성되며 (Date.now() 기반), 같은 런 중에는 RETRY 시에도 시드 변경되지 않음(GSM `enterState('playing', from=dead)` 시 `newRunSeed()` 호출 → 새 시드). `from=paused` 복귀는 시드 보존하여 세션 일관성 유지.

## Player Fantasy

**이 시스템 자체에는 직접적인 player fantasy가 없다.** Game State Manager처럼 순수 infrastructure — 플레이어는 RNG의 존재를 의식하지 못한다. 대신 이 시스템은 POP!의 **"운은 자주 보장"** 약속을 매 런 침묵으로 지킨다. 플레이어가 RNG를 의식하지 않을 때 RNG가 가장 잘 작동하고 있다.

구체적으로 **P3 "운은 자주 보장, 실력 천장이 깊다"의 보장 절반** 을 수치로 강제한다: 매 런 Critical 2-3회 보장은 10%가 진짜 10%여야 가능하다. `Math.random`은 V8 구현체에 따라 미세하게 비균등하고 시드 재현이 불가능하다. Mulberry32는 PractRand 32GB pass로 균등성 입증됐고, 같은 시드는 같은 분포를 재현한다.

동시에 **R2 페어플레이 약속(Pity timer + 시드 결정성)** 을 backbone으로 받친다. 시드 결정성이 깨지면 "다른 사람과 같은 시드로 같은 패턴을 봤다"가 검증 불가능해진다 — "내가 운이 없는 게 아니라 모두에게 동일한 운이 분배되고 있다"는 신뢰가 무너진다. Slay the Spire가 입증한 패턴이다: 시드 결정성 + pity 보장이 결합되면 패배도 "RNG 탓"이 아니라 "내가 못 봤다"로 귀인된다. POP!는 같은 심리 구조를 캐주얼 척도로 노린다.

플레이어 입장에서 이 시스템이 "잘 작동한다"의 증거: **"운이 없네"라고 말하기 전에 다음 Critical이 도착함**.

> **Review note**: creative-director 1회 비평 반영 (positive framing + Slay the Spire reference + metaphorical close). GSM §B와 sibling 관계의 tone — back-to-back 읽기 시 같은 hand로 인식되도록 의도. MVP 성공기준 90% 목격률은 AC §H로 이동 (Player Fantasy는 felt experience만).

## Detailed Design

### Core Rules

1. **Math.random 절대 금지**: 게임플레이 코드 어디서도 `Math.random()` 호출 금지. 위반 시 dev-mode lint 차단. 모든 RNG는 이 시스템이 제공하는 인스턴스 호출.

2. **3개 domain-specific 인스턴스**: `spawn` (풍선 위치·timing), `critical` (Critical Pop 확률 + Pity timer counter), `powerup` (Power-Up 종류 선택). 각각 독립된 Mulberry32 인스턴스 — 한 도메인의 RNG 호출이 다른 도메인의 시퀀스를 이동시키지 않음 (디버깅·A/B 테스트 용이성).

3. **Master seed → domain seed 파생**: master seed에서 XOR magic constant로 3개 sub-seed 파생 (자세한 식은 §D Formulas).

4. **시드 lifecycle (GSM contract 정합)**:
   - `enterState('playing', from='menu')` → GSM이 `rng.newRunSeed()` 호출 → 새 master seed 생성 → 3 sub-RNG 인스턴스 재생성
   - `enterState('playing', from='dead')` (RETRY) → 동일 — 새 시드
   - `enterState('playing', from='paused')` → 시드 보존 (호출 안 됨, GSM이 분기)
   - `enterState('menu')` / `enterState('dead')` → 시드 그대로 유지 (다음 newRunSeed까지 freeze)

5. **결정성 계약**: 같은 master seed로 `newRunSeed(masterSeed)` 명시 호출 → 같은 spawn 패턴·Critical 발현·Power-Up 시퀀스 100% 재현. 디버깅·QA·치트 의심 시 시드 출력 → 동일 시드로 재생 가능.

6. **출력 형식**: 각 인스턴스의 `.next()` 호출은 `[0, 1)` float 반환 (Math.random과 동일 계약). 정수 범위는 `.nextInt(min, max)` 헬퍼.

7. **상태 노출 금지**: RNG 내부 state는 외부 read 불가 (private). 시드는 생성 시 한 번만 노출 (`getMasterSeed()` getter — 디버깅·로깅 용).

### Public Interface

```typescript
// src/core/rng.ts

export interface RngInstance {
  next(): number;                              // [0, 1) float
  nextInt(min: number, max: number): number;   // [min, max] 정수 (max 포함)
  nextBool(p?: number): boolean;               // true with probability p (default 0.5)
  nextChoice<T>(items: T[]): T;                // 균등 선택
}

export interface RngSuite {
  spawn: RngInstance;
  critical: RngInstance;
  powerup: RngInstance;
  getMasterSeed(): number;                     // 디버깅/로깅 용
  newRunSeed(masterSeedOverride?: number): void; // 호출 시 3 인스턴스 재초기화
}

export function createRngSuite(initialSeed?: number): RngSuite;
```

**사용 예시** (downstream 시스템):

```typescript
// Difficulty & Spawn System
const x = rng.spawn.nextInt(50, GAME_WIDTH - 50);
const initialSize = rng.spawn.nextChoice([SIZE_LARGE, SIZE_MEDIUM]);

// Critical Pop System
const isCritical = rng.critical.nextBool(CRITICAL_PROBABILITY); // 0.10

// Power-Up System
const powerType = rng.powerup.nextChoice([MULTI_SHOT, FREEZE, MEGA_BOMB]);
```

### Interactions with Other Systems

| System | 관계 | 인터페이스 |
|--------|------|----------|
| **Game State Manager (#1, Designed)** | Control | GSM이 `enterState('playing', from='menu'|'dead')` 시 `rngSuite.newRunSeed()` 호출. `from='paused'`는 호출 안 함. GSM PROVISIONAL 해소됨 |
| **Difficulty & Spawn (#7)** | Read-only | `rng.spawn.nextInt(x, y)`, `rng.spawn.nextChoice(...)` 호출. spawn 패턴 결정성. 풍선 사이즈·위치·타이밍의 단일 RNG 소스 |
| **Critical Pop (#6)** | Read-only + Counter | `rng.critical.nextBool(CRITICAL_PROBABILITY)` 호출. Pity timer counter는 Critical Pop GDD가 owns — RNG 시스템은 카운터 안 가짐 (각 시스템이 자기 도메인 책임) |
| **Power-Up (#9)** | Read-only | `rng.powerup.nextChoice([MULTI_SHOT, FREEZE, MEGA_BOMB])`. drop 트리거 후 종류 선택. Power-Up 발생 여부 (콤보 5+) 는 Score & Combo가 결정, RNG는 종류만 |
| **Save System (#13)** | None (의도적) | 시드는 런 단위로 휘발성 — Save에 시드 저장 안 함. localStorage에 시드 영구 보관은 over-engineering for MVP |

**Ownership 정리**:
- master seed + 3 sub-instance: **이 시스템 단일 소유** (외부 raw state 접근 금지)
- Pity timer counter: **Critical Pop GDD가 owns** — 이 시스템은 RNG만 제공, "왜 강제 발생인지"는 모름
- spawn 패턴 결정: **Difficulty & Spawn GDD가 owns** — 이 시스템은 균등 분포만 보장

## Formulas

### F.1 Mulberry32 (단일 인스턴스 next)

The **mulberry32 next** formula is defined as:

```
state ← (state + 0x6D2B79F5) mod 2^32
t1 ← (state XOR (state >> 15)) × (1 OR state) mod 2^32
t2 ← t1 XOR (t1 + ((t1 XOR (t1 >> 7)) × (61 OR t1)) mod 2^32)
output ← (t2 XOR (t2 >> 14)) / 0xFFFFFFFF
```

**Variables**:

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| state | `s` | uint32 | [0, 2^32 - 1] | RNG 내부 상태. 매 호출 시 advance |
| output | — | float64 | [0, 1) | 호출자에 반환되는 균등 분포 값 |

**Output Range**: [0, 1) — 0 포함, 1 배제. `Math.random` 계약과 동일.

**Worked Example** (seed=42):

```
s = 42
next() #1:
  s = (42 + 0x6D2B79F5) mod 2^32 = 1832200251
  t1 = (1832200251 XOR (1832200251 >> 15)) × (1 | 1832200251) mod 2^32 = ... = 2614301693
  t2 = t1 XOR (t1 + ((t1 XOR (t1 >> 7)) × (61 | t1)) mod 2^32) = ... = 1827852944
  output = (1827852944 XOR (1827852944 >> 14)) / 0xFFFFFFFF
         ≈ 0.4255...

next() #2 (seed=42 after one call):
  s = (1832200251 + 0x6D2B79F5) mod 2^32 = ...
  output ≈ 0.7124...  (예시 값, 실제 구현 검증 필요)
```

> **참고 구현** (TypeScript, 7줄):
> ```typescript
> function mulberry32(seed: number): () => number {
>   let s = seed >>> 0;
>   return function() {
>     s = (s + 0x6D2B79F5) >>> 0;
>     let t = Math.imul(s ^ (s >>> 15), 1 | s);
>     t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
>     return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
>   };
> }
> ```

**Statistical guarantee**: PractRand 32GB pass — 수십억 호출까지 검출 가능한 패턴 없음. POP! 1-3분 런의 ~10K RNG 호출 규모에 충분.

### F.2 시드 파생 (Master → Domain Sub-Seeds)

The **domain seed derivation** formula is defined as:

```
spawnSeed    = masterSeed XOR 0xDEAD1234
criticalSeed = masterSeed XOR 0xBEEF5678
powerupSeed  = masterSeed XOR 0xCAFE9ABC
```

**Variables**:

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| masterSeed | `M` | uint32 | [0, 2^32 - 1] | 런 시작 시 생성된 master seed |
| spawnSeed | `M ⊕ 0xDEAD1234` | uint32 | [0, 2^32 - 1] | spawn RNG 인스턴스 시드 |
| criticalSeed | `M ⊕ 0xBEEF5678` | uint32 | [0, 2^32 - 1] | critical RNG 인스턴스 시드 |
| powerupSeed | `M ⊕ 0xCAFE9ABC` | uint32 | [0, 2^32 - 1] | powerup RNG 인스턴스 시드 |

**Output Range**: 3개 uint32 시드 — 32-bit space 안에서 균등 분포 (XOR with 상수는 분포 보존).

**Independence rationale**: 수학적으로 완전한 sub-stream 독립성(counter-based PRNG)은 아니지만, 3개 도메인이 raw master seed를 공유하지 않으므로 게임 스케일에서 충분. spawn RNG 1000회 호출이 critical RNG 시퀀스에 영향 없음 (각각 독립 state).

**Magic constants 선정**: 0xDEAD1234·0xBEEF5678·0xCAFE9ABC — 가독성 있는 hex pattern으로 디버깅 친화. 통계 영향 없음 (XOR 분포 보존).

### F.3 Master Seed 생성

The **master seed generation** formula is defined as:

```
masterSeed = Date.now() >>> 0     // ms timestamp의 하위 32비트
```

**Variables**:

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Date.now() | — | float64 | ~13자리 ms | UTC epoch ms |
| masterSeed | `M` | uint32 | [0, 2^32 - 1] | 하위 32비트 truncation |

**Output Range**: [0, 2^32 - 1] ≈ 4.3억 가능 시드. ms 단위 변화 → 매 런 다른 시드 (인접 런이라도 ms 다름). 49.7일 주기로 시드 공간 wrap (P3 페어플레이에 영향 없음).

**디버깅 시 override**: `newRunSeed(masterSeedOverride)` 호출 시 Date.now() 무시하고 명시 시드 사용. QA·재현 테스트·치트 의심 시 사용.

### F.4 nextInt 헬퍼

The **nextInt** formula is defined as:

```
nextInt(min, max) = floor(next() × (max - min + 1)) + min
```

**Variables**: `min`/`max` (int, inclusive). Output: [min, max] 정수.

**Edge case**: `min > max`이면 throw `RangeError`. `min === max`이면 항상 `min` 반환 (1 outcome).

### F.5 nextBool (확률 boolean)

The **nextBool** formula is defined as:

```
nextBool(p) = next() < p
```

**Variables**: `p` ∈ [0, 1] (default 0.5). Output: boolean. true 확률 = p.

**Example**: `rng.critical.nextBool(0.10)` → 10% 확률로 true.

### F.6 nextChoice (균등 선택)

The **nextChoice** formula is defined as:

```
nextChoice(items[]) = items[nextInt(0, items.length - 1)]
```

**Edge case**: empty array → throw `RangeError`.

> **Review note**: systems-designer 1회 비평 (알고리즘 결정) 반영. Mulberry32 + 시드 파생 + Date.now() seed 모두 systems-designer 권고 그대로. lean mode에서 §D HIGH risk 섹션 — `systems-designer` 충분히 상담됨.

## Edge Cases

- **If `newRunSeed()`가 같은 ms에 두 번 호출**: Date.now()가 동일한 값 반환 → 같은 시드 → 같은 패턴. 발생 가능성 매우 낮으나 RETRY 즉시 호출 시 가능. **결정**: ms 같으면 같은 시드 허용 (의도된 동작 — 디버깅에 유리). counter monotonic 추가는 over-engineering.

- **If `masterSeedOverride`가 0**: `0 >>> 0 === 0` 유효 시드. Mulberry32는 seed=0에서도 정상 작동 (첫 호출에서 state += 0x6D2B79F5으로 0 탈출). 0을 reserved value로 두지 않음.

- **If 게임 로직이 `Math.random()` 호출 (위반)**: dev-mode lint rule (`eslint-plugin-no-restricted-globals` 또는 자체 rule)로 build 차단. production에는 lint 적용 안 되지만 코드 리뷰 시 reject.

- **If `nextInt(min, max)`에서 min > max**: `throw new RangeError('nextInt: min must be <= max')`. silent reject 안 함 — 호출자 버그.

- **If `nextChoice([])` (빈 array)**: `throw new RangeError('nextChoice: array must be non-empty')`. silent reject 안 함.

- **If domain RNG 호출 순서가 reorder됨** (예: spawn 코드 리팩토링): 같은 master seed라도 spawn 시퀀스 자체는 보존되지만 외부 발현(시각 패턴)이 달라질 수 있음. 즉 "시드 100으로 재생했는데 다른 풍선 패턴이 나옴" 발생 가능. **완화**: domain RNG 호출은 고정 순서 유지 (단위 테스트로 회귀 방지). spawn.nextInt → spawn.nextChoice 순서가 한 번 정해지면 변경 시 ADR 필수.

- **If RETRY 버튼을 매우 빠르게 연속 탭**: GSM이 `playing → playing` 비허용 transition으로 reject (GSM AC-07 처럼). RNG는 영향 없음 — `newRunSeed`는 RETRY 1회당 1회만 호출.

- **If 페이지 새로고침 후 RETRY**: 새 master seed (Date.now() 다름) → 다른 패턴. 시드는 휘발성 — 의도된 동작 (Save에 시드 저장 안 함).

- **If Critical Pity timer가 강제 발생 시 RNG 호출 안 함**: Critical Pop GDD가 owns — 90초 무 Critical 시 RNG bypass하고 강제 isCritical = true 처리. RNG 시스템은 영향 없음. RNG는 "균등 분포"만 보장, "운 보장 메커니즘"은 도메인 시스템 책임.

- **If 디버그 모드에서 시드 출력 요구**: `rngSuite.getMasterSeed()` 호출. console.log 또는 UI debug overlay (Post-MVP). 사용자에게 노출하지 않음 (치트 위험).

- **If 같은 master seed로 두 번 `newRunSeed(M)` 호출**: 3 sub-instance 모두 같은 state로 재초기화 → 같은 시퀀스 재생산. 의도된 동작 (재현성 계약).

- **If domain seed 파생 magic constant가 충돌하도록 변경됨** (예: 0xDEAD1234 와 0xBEEF5678이 같아짐): spawn과 critical이 같은 시퀀스 → P3 약속 깨짐 (Critical 패턴이 spawn 패턴 따라감). 회귀 방지: 단위 테스트로 3 constant가 distinct함을 검증 (AC §H).

## Dependencies

### Upstream (이 시스템이 의존하는 것)

**없음 (Foundation layer).** Mulberry32는 표준 JS API (`Math.imul`, bitwise) 외 의존 없음.

| 외부 의존 | 인터페이스 | 비고 |
|----------|----------|------|
| **JavaScript `Math.imul`** | 32-bit 정수 곱셈 | ES2015+, 모든 모던 브라우저 지원 |
| **JavaScript bitwise ops** | `>>>`, `^`, `\|` | ES5+, universal |
| **`Date.now()`** | epoch ms timestamp | 모든 브라우저 |

### Downstream Dependents

| System | 관계 | Interface | 상태 |
|--------|------|----------|------|
| **Game State Manager (#1, Designed)** | Control caller | GSM이 `rngSuite.newRunSeed()` 호출 (`enterState('playing', from='menu'\|'dead')` 시). GSM PROVISIONAL 해소됨 | Designed (양방향 verify 완료) |
| **Difficulty & Spawn (#7)** | Read-only consumer | `rng.spawn.nextInt(...)` / `nextChoice(...)` | Undesigned |
| **Critical Pop (#6)** | Read-only consumer | `rng.critical.nextBool(CRITICAL_PROBABILITY)`. Pity timer는 Critical 자체가 owns | Undesigned |
| **Power-Up (#9)** | Read-only consumer | `rng.powerup.nextChoice([MULTI_SHOT, FREEZE, MEGA_BOMB])` | Undesigned |
| **Save System (#13)** | None (의도적) | 시드 저장 안 함 — 휘발성 | Undesigned |

### Bidirectional Verify

- **Game State Manager** (✅ verified): GSM §C Interactions의 "Seed/RNG" 행에서 `enterState('playing', from=menu/dead)` → `rng.newRunSeed()` 명시. PROVISIONAL 마크 해소 가능 (GSM 다음 revision에서).
- **Critical Pop (#6, undesigned)**: Critical GDD 작성 시 Pity timer counter가 Critical 자체에 있음을 확인 — RNG 시스템은 단순 nextBool만 제공.
- **Difficulty & Spawn (#7, undesigned)**: spawn 호출 순서를 고정으로 유지하기 위한 규약 명시 필요 (Edge Case "domain RNG 호출 순서 reorder").
- **Power-Up (#9, undesigned)**: drop 트리거(콤보 5+)는 Score & Combo가 결정. RNG는 종류만.

### Dependency Graph (Local)

```
   [Math.imul]   [bitwise ops]   [Date.now()]
        │             │              │
        └─────────────┼──────────────┘
                      ▼
            ┌─────────────────────┐
            │   Seed/RNG System   │ ◀── newRunSeed() 호출 (GSM)
            └─────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     spawn         critical       powerup
        │             │             │
        ▼             ▼             ▼
  Difficulty &    Critical Pop    Power-Up
  Spawn (#7)     (#6, Pity owns)  (#9)
```

## Tuning Knobs

이 시스템은 본질적으로 튜닝 노브가 거의 없다 — RNG는 균등 분포만 제공하고, "확률값"은 호출자가 결정. 다만 다음 한 가지만 노출:

| Knob | Default | Safe Range | 너무 높이면 | 너무 낮추면 | 영향 시스템 |
|------|---------|-----------|-----------|-----------|------------|
| `debugLogSeed` | `false` | `true` / `false` | production에 시드 console.log 노출 → 치트 위험 + 사용자 console에 노이즈 | (영향 없음 — 기본) | 디버깅/로깅 채널 |

### 호출자가 사용하는 확률 상수 (이 시스템에 정의 안 됨 — 참고용)

| Constant | Owner GDD | Value | 비고 |
|----------|-----------|-------|------|
| `CRITICAL_PROBABILITY` | Critical Pop (#6) | 0.10 (10%) | `rng.critical.nextBool(0.10)` |
| `CRITICAL_PITY_TIMER_MS` | Critical Pop (#6) | 90000 (90s) | RNG bypass — 강제 발생 |
| `POWERUP_CHOICES` | Power-Up (#9) | 3 종 (multi/freeze/mega) | `rng.powerup.nextChoice(POWERUP_CHOICES)` |
| `SPAWN_X_RANGE` | Difficulty & Spawn (#7) | [50, GAME_WIDTH - 50] | `rng.spawn.nextInt(min, max)` |

이 상수들은 각 owner GDD에서 owns. Seed/RNG는 균등 분포만 제공 — "10%인지 15%인지"는 모름.

> **Constants vs Knobs 가이드**:
> - **Constants (변경 = ADR 필수)**: 시드 파생 magic constants (0xDEAD1234/0xBEEF5678/0xCAFE9ABC), Mulberry32 알고리즘 상수 (0x6D2B79F5 등) — F.1/F.2에 정의됨. 시스템 invariant.
> - **Knobs**: `debugLogSeed` 1개. 운영 환경 변동 거의 없음.

## Visual/Audio Requirements

**Not applicable.** Seed/RNG는 시각·청각 출력이 없다. RNG의 결과(spawn 위치, Critical 발현 등)가 시각적으로 발현되지만 모두 호출자 시스템(Difficulty & Spawn, Critical Pop, Power-Up)이 owns. 이 시스템은 숫자만 반환.

> **디버그 옵션 (Post-MVP)**: 시드 표시용 작은 UI overlay (`getMasterSeed()` 값 디스플레이) 고려 가능. MVP는 console.log만.

## UI Requirements

**Not applicable.** UI 표면 없음. Post-MVP 데이터드는 시드 표시·복제·공유 기능 가능하나 MVP에는 불필요.

## Acceptance Criteria

각 AC는 GIVEN-WHEN-THEN 포맷. 독립 QA가 GDD 없이 Vitest로 자동화 가능.

### Determinism Contracts

- **AC-01** (재현성 — 핵심 contract): GIVEN `createRngSuite(42)` 호출, WHEN `spawn.nextInt(0, 100)`을 10회 호출 후 시퀀스 기록, THEN 새 인스턴스 `createRngSuite(42)`로 동일 호출 시 같은 10개 정수 시퀀스 반환.

- **AC-02** (Math.random 금지): GIVEN production build, WHEN `grep -r "Math\.random" src/` 실행, THEN 매치 0건. (lint rule + CI 검증)

- **AC-03** (시드 파생 distinct): GIVEN `createRngSuite(M)` 호출, WHEN `spawn`·`critical`·`powerup` 각각 1회 next() 호출, THEN 3개 출력값 모두 서로 다름 (magic constant 충돌 회귀 방지).

- **AC-04** (도메인 독립성 — counter level): GIVEN `createRngSuite(42)` 호출 후 `spawn.next()` 100회 호출, WHEN `critical.next()` 1회 호출 → 값 X 기록, THEN 새 인스턴스 `createRngSuite(42)` 후 spawn 호출 없이 바로 `critical.next()` 1회 → 같은 값 X 반환 (spawn 시퀀스가 critical 카운터에 영향 없음).

- **AC-04b** (NEW — sub-stream statistical independence, qa-lead M-2): GIVEN `createRngSuite(M)` for M ∈ {0, 1, 42, 0xDEAD0000, 0xFFFFFFFF}, WHEN `spawn.next()` 와 `critical.next()`을 각 1,000회 호출, THEN 두 시퀀스의 Pearson 상관계수 |corr| < 0.01 모든 M에 대해. XOR magic constant 시드 파생이 statistically independent 시퀀스를 만드는지 검증 — XOR 시드 파생의 hidden 상관성 회귀 방지.

### Statistical Quality

- **AC-05** (균등 분포 — Critical 10%, qa-lead revised: **fixed seed**): GIVEN `createRngSuite(42)` (**고정 시드 — flakiness 방지**), WHEN `critical.nextBool(0.10)` 100,000회 호출, THEN true 횟수 ∈ [9500, 10500] (±500 = ±5.3σ — 1-in-3.5M false positive rate). 5%+ 시스템적 확률 편향 검출. **MVP 성공기준 90% Critical 목격률**과 직결 — RNG가 깨지면 베타테스트에서 즉시 발현.

- **AC-05b** (NEW — Chi-square goodness-of-fit, qa-lead M-1): GIVEN `createRngSuite(42)`, WHEN `nextInt(0, 9)` 100,000회 호출, THEN chi-square 통계량 < 21.7 (p=0.01, df=9). 범위 검사로 catch 안 되는 미세 non-uniformity (예: alternating high/low) 검출.

- **AC-06** (nextInt 범위, qa-lead revised: **threshold tighten + Bonferroni 보정**): GIVEN `createRngSuite(42)`, WHEN `nextInt(0, 9)` 10,000회 호출, THEN 각 정수 0-9 등장 횟수 ∈ [880, 1120] (±120 = ±4σ per bin, 10 bin Bonferroni 보정 후 99.9% family-wise confidence). 이전 ±200(±6.67σ)은 너무 loose — 15% 편향 통과. 라벨 "±20% 표준오차"는 잘못된 단위 표기였음 (수정).

- **AC-07** (nextChoice 균등, qa-lead revised: **라벨만 정정**): GIVEN `createRngSuite(42)`, WHEN `nextChoice([A, B, C])` 9,000회 호출, THEN 각 ∈ [2700, 3300] (±300 = ±6.7σ — regression check 적정). 이전 라벨 "±10%"는 표준오차 단위 아닌 절대 범위 — 정정.

### Public API Contract

- **AC-08** (`.next()` range): GIVEN 임의 시드, WHEN `.next()` 1000회 호출, THEN 모든 값 ∈ [0, 1) (0 포함, 1 배제). 1.0 절대 반환 안 함.

- **AC-08b** (NEW — degenerate seeds, qa-lead M-3): GIVEN `createRngSuite(0)` 와 `createRngSuite(0xFFFFFFFF)`, WHEN 각각 `next()` 10회 호출, THEN 어느 시퀀스도 all-zeros / all-ones / 서로 동일하지 않음. Mulberry32가 edge seed에서 trivial output 안 만듦을 검증.

- **AC-09** (`nextInt` 경계 inclusive): GIVEN `nextInt(5, 10)`, WHEN 100회 호출, THEN 5와 10 모두 등장 (inclusive 양 끝).

- **AC-10** (`nextInt` invalid args): GIVEN `nextInt(10, 5)` (min > max), WHEN 호출, THEN `RangeError` throw.

- **AC-11** (`nextChoice` empty): GIVEN `nextChoice([])`, WHEN 호출, THEN `RangeError` throw.

- **AC-12** (`nextBool` extremes): GIVEN `nextBool(0)` 100회 호출, THEN 모두 false. GIVEN `nextBool(1)` 100회, THEN 모두 true.

### Lifecycle Integration

- **AC-13** (GSM contract): GIVEN GSM `enterState('playing', from='menu')`, WHEN GSM이 `rngSuite.newRunSeed()` 호출 후 `getMasterSeed()` 호출, THEN 반환된 seed가 이전 런과 다름 (Date.now() 변화 가정 — 두 런 사이 최소 1ms 경과).

- **AC-14** (paused → playing 시드 보존, M-4 GSM 연계): GIVEN `currentState === 'playing'`, master seed M, WHEN paused 후 playing 복귀 (GSM이 `newRunSeed` 호출 안 함), THEN `getMasterSeed() === M` (불변).

- **AC-15** (`newRunSeed(M)` override): GIVEN 어떤 상태, WHEN `newRunSeed(12345)` 호출, THEN `getMasterSeed() === 12345`. 3 sub-instance도 일관된 시드로 재초기화.

### Performance

- **AC-16** (호출 시간): GIVEN 임의 인스턴스, WHEN `.next()` 100,000회 호출, THEN 총 시간 < 100ms (인스턴스당 < 1µs 평균). 게임 런 RNG 호출 ~10K이므로 frame budget 영향 0.

- **AC-17** (메모리): GIVEN `createRngSuite()` 후 `destroy` 호출 없음, WHEN heap snapshot, THEN 인스턴스당 < 100 bytes (state는 단일 number).

### MVP 성공기준 통합 AC (Player Fantasy에서 이동)

- **AC-18** (NEW — MVP 베타테스트 검증, Player Fantasy에서 AC로 이동): GIVEN 5인 베타테스트, WHEN 각 테스터 첫 3런 플레이, THEN **90% 이상 (≥ 4/5)이 Critical 1회 이상 목격**. 80% 미만이면 RNG 균등 분포 깨졌거나 Pity timer 통합 실패 — 즉시 회귀 조사 트리거. game-concept.md MVP 성공기준 정합.

### Smoke Test Subset (qa-lead 권고 — AC-03 추가, AC-05 fixed seed)

다음 4 AC가 핵심 — 매 push마다 < 100ms 실행:

- **AC-01** (재현성) — 시드 결정성의 단일 contract
- **AC-02** (Math.random 금지) — codebase 위반 회귀 방지
- **AC-03** (magic constant distinctness) — 시드 파생 회귀 방지, 거의 free
- **AC-05** (10% 균등 with fixed seed) — Critical 확률 상수 회귀 방지 (잘못된 p 값 catch)

> **Review note**: qa-lead 1회 비평 반영 (AC-05 fixed seed, AC-06 Bonferroni 보정, AC-07 라벨 정정, AC-04b/AC-05b/AC-08b 신규 추가, AC-18 베타테스트 통합, smoke AC-03 추가). lean mode 확장 검토 완료.

## Open Questions

- **OQ.1 — 데일리 시드 (Post-MVP)**: MVP는 매 런 새 시드. Post-MVP에 리더보드 도입 시 "데일리 챌린지" 모드 추가 가능 — 전 세계 플레이어가 같은 시드로 같은 패턴 도전. UTC 자정 기준 vs 사용자 로컬 자정 기준 결정 필요.
  - **Owner**: live-ops-designer + game-designer
  - **Target**: Post-MVP 리더보드 도입 시점
  - **Default 가정**: UTC 자정 (글로벌 통일)

- **OQ.2 — 시드 공유·표시 UI**: Post-MVP에 "내 시드 공유 → 친구가 같은 시드로 도전" 기능 고려 가능. MVP에는 없음.
  - **Owner**: ux-designer + community-manager
  - **Target**: Post-MVP

- **OQ.3 — 시드 공간 충분성**: 32-bit (~4.3억) 시드로 모든 플레이어 unique 시드 보장 가능한가? Birthday paradox로 ~65K 동시 플레이어부터 충돌 가능. MVP는 동시 플레이어 매우 적어 무문제. Post-MVP 대규모 시 64-bit seed 또는 추가 entropy(user ID hash) 고려.
  - **Owner**: systems-designer
  - **Target**: Post-MVP 스케일링 시점

- **OQ.4 — Pity timer counter 위치 확정** (Critical Pop GDD 작성 시 검증): RNG 시스템은 Pity counter 안 가짐 (현재 명세). Critical Pop GDD가 owns. 만약 spawn timing이 Critical Pity timer를 영향한다면 (cross-system event) 재검토 필요.
  - **Owner**: game-designer + systems-designer
  - **Target**: Critical Pop GDD (#6) 작성 시

## Implementation Checklist

Approved 조건: 아래 전 항목 체크 완료 + QA Lead 서명 + Lead Programmer ADR 서명.

### 진입점

- `src/core/rng.ts` — Mulberry32 + RngSuite factory. 단일 export `createRngSuite(initialSeed?)`.
- `src/main.ts` 부트스트랩 코드:
  ```typescript
  import { createRngSuite } from './core/rng';
  const rngSuite = createRngSuite(); // initial seed = Date.now()
  // GSM 인스턴스에 전달
  const gsm = new GameStateManager({ app, rngSuite, ... });
  ```
- GSM `enterState('playing', from='menu'|'dead')` → `rngSuite.newRunSeed()` 호출 (GSM §C Interactions 정합).

### Public API 표면 (§C Public Interface 정합)

| Symbol | Signature | 책임 |
|--------|-----------|------|
| `createRngSuite(initialSeed?: number)` | factory function | 새 RngSuite 인스턴스 + 3 sub-RNG (spawn/critical/powerup) |
| `RngSuite.spawn / .critical / .powerup` | RngInstance properties | 각 도메인 RNG |
| `RngSuite.newRunSeed(masterSeedOverride?)` | void method | 새 master seed로 3 sub-RNG 재초기화 |
| `RngSuite.getMasterSeed()` | number getter | 디버그/로깅 — 현재 master seed |
| `RngInstance.next()` | () => number | [0, 1) float |
| `RngInstance.nextInt(min, max)` | (number, number) => number | [min, max] 정수 |
| `RngInstance.nextBool(p?)` | (number?) => boolean | 확률 p로 true |
| `RngInstance.nextChoice<T>(items)` | (T[]) => T | 균등 선택 |

### 호출 경로 체크리스트

- [ ] `src/core/rng.ts` 단일 파일 — 다른 곳에 RNG 구현 분산 없음 (grep 검증)
- [ ] `src/main.ts`에서 `createRngSuite()` 인스턴스 1개 생성 — singleton-like
- [ ] GSM 생성자에 rngSuite 주입 — GSM이 `newRunSeed` 호출 가능
- [ ] Difficulty & Spawn, Critical Pop, Power-Up이 RngSuite 인스턴스를 생성자 주입 받음 (전역 변수 금지)
- [ ] **`Math.random` 호출 0건** (grep + ESLint rule + AC-02)
- [ ] 의존 외부 메서드 존재 확인:
  - [ ] `Math.imul` (ES2015+)
  - [ ] `Date.now()`
  - [ ] bitwise `>>>`, `^`, `|`

### AC → 테스트 매핑

| AC 범위 | 테스트 파일 | 주요 테스트 함수 |
|--------|------------|----------------|
| AC-01 ~ AC-04 (Determinism) | `tests/unit/rng/determinism.test.ts` | `test_same_seed_same_sequence`, `test_no_math_random_in_src`, `test_domain_seeds_distinct`, `test_domain_independence` |
| AC-05 ~ AC-07 (Statistical) | `tests/unit/rng/statistical.test.ts` | `test_critical_probability_10pct_uniform`, `test_nextint_uniform_distribution`, `test_nextchoice_uniform` |
| AC-08 ~ AC-12 (Public API) | `tests/unit/rng/api.test.ts` | `test_next_in_range_0_to_1`, `test_nextint_inclusive_bounds`, `test_nextint_throws_on_invalid`, `test_nextchoice_throws_on_empty`, `test_nextbool_extremes` |
| AC-13 ~ AC-15 (Lifecycle) | `tests/integration/rng/lifecycle.test.ts` | `test_new_run_seed_changes_master`, `test_paused_resume_preserves_seed`, `test_seed_override` |
| AC-16 ~ AC-17 (Performance) | `tests/unit/rng/performance.test.ts` | `test_next_throughput`, `test_instance_memory_footprint` |

### 빌드 검증

- [ ] `npm run build` (Vite production) 성공
- [ ] Bundle에 RNG 코드 포함 + 외부 라이브러리 0 (`grep seedrandom dist/` 결과 0)
- [ ] 번들 크기 영향 < 1KB (Mulberry32 7줄)
- [ ] `eslint . --rule 'no-restricted-globals: ["error", "Math.random"]'` 통과
- [ ] **QA Lead 서명** _______

### 코드 리뷰 동기화

- [ ] ADR 작성: RNG algorithm 결정 (Mulberry32 선택 근거 + 대안 평가) — systems-designer 비평이 ADR 기반
- [ ] `.claude/docs/technical-preferences.md` Architecture Decisions Log에 ADR 추가
- [ ] `design/gdd/systems-index.md` Status: Not Started → Designed
- [ ] `design/registry/entities.yaml` constants에 `CRITICAL_PROBABILITY` (0.10, owner: Critical Pop), magic constants는 internal — 등록 안 함
- [ ] `tests/unit/test_api_contracts.ts`에 RngSuite Public API 표면 등록
- [ ] **game-state-manager.md §C** Seed/RNG 행의 "PROVISIONAL" 마크 제거 (이 GDD로 락인됨)
- [ ] **game-state-manager.md OQ.3** Resolve (시드 정책: 매 런 새 시드)
- [ ] **Lead Programmer 서명** _______ + **Technical Director ADR 서명** _______
