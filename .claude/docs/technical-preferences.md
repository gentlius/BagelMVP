# Technical Preferences

<!-- Initial pin 2026-05-29 (manual, before template HTML5 support landed). -->
<!-- Updated 2026-06-11: CCGS template now supports HTML5/PixiJS via /setup-engine html5. -->
<!-- Engine Specialists section rewritten to use new HTML5 specialist set. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Pixi.js v8 (WebGL2 default, WebGPU optional)
- **Language**: JavaScript (ES2023+) or TypeScript 5.x (선택 — 미결정. GDD 단계에서는 무관)
- **Rendering**: WebGL2 via Pixi v8 Renderer
- **Physics**: 수동 구현 (POP! 물리는 단순 — 중력 + 바운스 + 원-원 충돌). Matter.js 등 미사용
- **Target Platform**: HTML5 모바일 웹 (세로 모드 기본, 데스크탑 웹 호환)

> **Note**: 이 프로젝트의 엔진 트랙은 템플릿 기본(Godot/Unity/Unreal) 외에 위치. `/setup-engine`은 직접 적용 불가 — 본 파일을 수동 유지.

## Input & Platform

- **Target Platforms**: HTML5 Web (모바일 우선, 데스크탑 호환)
- **Input Methods**: Touch (1차) / Mouse + Keyboard (데스크탑 폴백)
- **Primary Input**: Touch — 한 손가락 (드래그 + 더블탭)
- **Gamepad Support**: None
- **Touch Support**: Full — 핵심 입력 채널
- **Platform Notes**:
  - 세로 모드 기본. 가로 모드 미지원 (MVP)
  - iOS Safari 15+ / Android Chrome 100+ 지원
  - PWA 가능하나 MVP에서는 미적용 (단순 웹페이지)
  - 디바이스 픽셀 비율 (DPR) 대응 필수 — Retina 디스플레이 선명도

## Naming Conventions

- **Classes**: PascalCase (예: `BalloonEntity`, `InputHandler`)
- **Variables**: camelCase (예: `balloonSize`, `currentCombo`)
- **Functions/Methods**: camelCase (예: `spawnBalloon()`, `handleDoubleTap()`)
- **Events**: kebab-case 또는 camelCase, 일관되게 (예: `balloon-popped` 또는 `balloonPopped`) — 본 프로젝트는 **camelCase** 채택
- **Files**: kebab-case (예: `input-system.js`, `balloon-physics.js`)
- **Constants**: SCREAMING_SNAKE_CASE (예: `DOUBLE_TAP_WINDOW_MS`, `CRITICAL_CHANCE`)
- **Pixi Container 네이밍**: 역할 + Container 접미사 (예: `balloonContainer`, `vfxContainer`)

## Performance Budgets

- **Target Framerate**: **60 FPS** (모바일 기준)
- **Frame Budget**: 16.67ms (60fps), critical path 12ms 이내
- **Reference Devices**: iPhone 11 / Galaxy A52 — 이 기준에서 안정적 60fps
- **Draw Calls**: < 30 per frame (Pixi 자동 배칭으로 일반적으로 5–10)
- **Active Sprites/Containers**: < 100 동시
- **Particles**: ParticleContainer로 200개 동시까지 안전
- **Memory Ceiling**: 모바일 web heap < 100MB (브라우저 자체 + Pixi + 게임)
- **Initial Bundle**: < 600KB (Pixi v8 minified ~400KB + 게임 코드 ~50–200KB)
- **Load Time**: 첫 인터랙티브 < 2s (3G 빠름 또는 LTE)

## Testing

- **Framework**: Vitest (또는 Jest — 미결정. Vitest 권장 — ESM-first, Pixi v8과 호환 잘됨)
- **E2E**: Playwright (모바일 web 자동화 가능)
- **Minimum Coverage**: 핵심 로직 80% (Score 수식·Critical 확률·Pity timer·콤보 트래킹 등 수치 계약)
- **Required Tests**:
  - Balance formulas (Score & Combo 수식의 출력 범위)
  - Determinism (시드 기반 spawn이 같은 시드 = 같은 패턴)
  - State machine 전환 (Game State Manager 모든 valid transition)
  - Pity timer (90초 무 Critical 시 강제 발생)

## Forbidden Patterns

- `setTimeout`/`setInterval` 게임 루프 — Pixi Ticker만 사용 (DPI 변동·tab 비활성 대응)
- 인라인 광고·결제 호출 — MVP는 없음 (Anti-pillar AP1)
- 글로벌 변수 (window.* 직접 할당) — 모듈 export·import만
- `eval()` / `Function()` 동적 코드 평가
- jQuery·legacy DOM 라이브러리 — Pixi가 화면 전체 소유
- 외부 CDN 의존 (런타임 데이터 페치) — MVP는 완전 self-contained

## Allowed Libraries / Addons

- **Pixi.js v8** (core) — 렌더러
- **@pixi/sound** (선택) — 또는 native Web Audio API. 사운드 시스템 GDD에서 결정
- **pixi-filters** (v6.x) — Pixi v8 호환 필터 통합 패키지. `GlowFilter` (Neon Glassblowing 글로우), `AdvancedBloomFilter` (Critical 발광 — 선택, 모바일 성능 검증 필수) 등 포함. **주의: 구버전 `@pixi/filter-glow`는 Pixi v5/v6 시대 패키지로 v8 호환 안 됨**
- **seedrandom** 또는 자체 LCG 구현 — Seed/RNG System에서 결정 (외부 의존 최소화 선호 → 자체 구현 가능성 높음)
- 빌드: **Vite** (개발 + 번들). Webpack/Rollup 대안

> 광고·analytics SDK는 Post-MVP. MVP는 완전 self-contained.

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one when implementation begins]

## Engine Specialists

> **업데이트 2026-06-11**: CCGS 템플릿에 HTML5/PixiJS 전용 specialist agent 5종이 추가되어
> stretch-범용 라우팅(gameplay-programmer + technical-artist + ui-programmer)을 폐기하고
> 전용 라우팅으로 전환. ADR-0001 (Engine Specialist Separation Policy) 적용 — TypeScript
> 코드 품질은 `pixijs-specialist`에 흡수 (단일 언어 정책).

- **Primary**: html5-specialist (브라우저 API, 플랫폼 아키텍처, 모바일 웹 perf)
- **Framework Specialist**: pixijs-specialist (PixiJS 8.x — scene graph, Assets, Filters, Ticker, ParticleContainer, Federated events; TypeScript 코드 품질도 함께 소유)
- **Shader Specialist**: webgl-shader-specialist (커스텀 GLSL Filter, WebGL2/WebGPU dual-target)
- **Build Specialist**: web-build-specialist (Vite config, 번들 최적화, asset pipeline, PWA, CI/CD)
- **E2E Test Specialist**: playwright-e2e-specialist (브라우저 e2e, 모바일 device emulation, viewport/touch 시뮬, screenshot regression)
- **Additional Specialists** (engine-agnostic):
  - performance-analyst (모바일 web 60fps 검증, 메모리 프로파일링)
  - audio-director / sound-designer (Web Audio API, Howler.js, @pixi/sound 결정)
- **Routing Notes**:
  - PixiJS API를 사용하는 `.ts` / `.js` 파일 → `pixijs-specialist`
  - 브라우저 API (Storage, fetch, Workers), 플랫폼 결정 (PWA, Capacitor) → `html5-specialist`
  - 커스텀 GLSL Filter 작성 → `webgl-shader-specialist` (Filter wrapper는 `pixijs-specialist`)
  - `vite.config.ts` / `tsconfig.json` / `package.json` 스크립트 → `web-build-specialist`
  - `tests/e2e/*.spec.ts` Playwright e2e → `playwright-e2e-specialist`
  - 일반 architecture review → `html5-specialist`

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (`.ts`, `.js` using PixiJS) | pixijs-specialist |
| Platform / browser API code (`.ts` / `.js`, no Pixi) | html5-specialist |
| Custom shader files (`.glsl`, `.wgsl`, `.vert`, `.frag`, `.vs`, `.fs`) | webgl-shader-specialist |
| Build config (`vite.config.*`, `tsconfig.json`, `package.json` scripts) | web-build-specialist |
| E2E test files (`tests/e2e/**/*.spec.ts`) | playwright-e2e-specialist |
| Unit test files (`tests/unit/**/*.test.ts`) | pixijs-specialist or gameplay-programmer |
| HTML entry (`index.html`) | html5-specialist |
| PWA manifest (`public/manifest.json`) | web-build-specialist |
| CI workflows (`.github/workflows/*.yml`) | web-build-specialist |
| Stylesheets (`.css` — minimal in canvas-based games) | html5-specialist |
| General architecture review | html5-specialist |
