# POP!

> Pang-inspired HTML5 mobile web prototype — modern Neon Glassblowing aesthetic. One-touch drag + double-tap harpoon firing for balloon splitting chaos.

## 개요

POP!은 한 손가락 입력(드래그 + 더블탭)으로 풍선을 분열시키는 짧은 런 캐주얼 모바일 웹 게임입니다. Pang의 헤리티지(설치형 작살 + 분열 체인)를 현대적 Neon Glassblowing 미학으로 재해석합니다.

**Target Platform**: HTML5 모바일 웹 (iPhone 11 Safari 15+ / Galaxy A52 Chrome 100+)
**Performance Goal**: 안정적 60 FPS (모바일 기준)

## 빠른 시작 (Quick Start)

### 환경 요구
- **Node.js** v24 권장 (LTS v20+ OK)
- **npm** v10+
- OS: Windows 11 / macOS / Linux

### 설치
```bash
git clone <repo>
cd pop-prototype
npm install
```

### 개발 서버
```bash
npm run dev
```
→ http://localhost:5173

### 프로덕션 빌드 & 미리보기
```bash
npm run build
npm run preview
```
→ http://localhost:4173

### 테스트
```bash
npm run test       # Vitest unit + integration
npm run test:e2e   # Playwright e2e (Pixel 5 모바일 viewport)
npm run typecheck  # TypeScript strict
```

## 환경 이슈 해결

### SSL 인터셉트 환경 (Corporate Proxy / Zscaler)

`UNABLE_TO_VERIFY_LEAF_SIGNATURE` 오류 시:

**Windows PowerShell (임시)**:
```powershell
$env:NODE_OPTIONS = "--use-system-ca"
npm install
```

**Windows PowerShell (영구)**:
```powershell
setx NODE_OPTIONS "--use-system-ca"
```

**macOS / Linux**:
```bash
export NODE_OPTIONS="--use-system-ca"
npm install
```

Node.js v24+는 OS Trust Store(Windows Cert Store, macOS Keychain, Linux ca-certificates)를 자동으로 사용합니다.

### Windows PowerShell ExecutionPolicy

`npm.ps1 cannot be loaded` 오류 시:

**Option 1**: `.cmd` 변형 사용
```powershell
npm.cmd install
npx.cmd vite
```

**Option 2**: ExecutionPolicy 변경
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 프로젝트 구조

```
design/                     — 게임 디자인 문서 (외부 제출 영역)
  gdd/                      — 5 시스템 GDD + game-concept + systems-index
  art/                      — art-bible + canonical sample HTML
  ux/                       — HUD/About modal UX spec

src/                        — 게임 소스 코드
  systems/                  — 5 시스템 (Input + Balloon Physics & Split + 
                              Critical Pop + Score & Combo + Visual Juice)
  vfx/                      — VFX + procedural sprites + background
  ui/                       — HUD + About modal
  audio/                    — AudioManager + SFX synth (Web Audio)
  events/                   — EventBus singleton
  conventions/              — RNG wrapper + UI strings
  entities/                 — Balloon, Character, Harpoon interfaces

tests/                      — Vitest unit/integration + Playwright e2e

public/audio/bgm/           — BGM OGG 자산 (CC0)

playwright.config.ts        — E2E 설정 (Pixel 5 portrait 모바일 뷰포트)
vite.config.ts              — 빌드 설정 + 번들 분석
tsconfig.json               — TypeScript strict
```

## 기술 스택

| 컴포넌트 | 버전 | 용도 |
|---------|------|------|
| **Pixi.js** | ^8.0.0 | WebGL2 렌더러 |
| **pixi-filters** | ^6.0.0 | GlowFilter (Neon 글로우) |
| **Vite** | ^5.0.0 | 빌드 + dev server |
| **TypeScript** | ^5.0.0 | Strict 타입 체크 |
| **Vitest** | ^1.0.0 | Unit + integration 테스트 |
| **Playwright** | ^1.40.0 | E2E 자동화 (Chromium 모바일) |
| **Node.js** | v24 / v20 LTS | 런타임 |

**주의**: `@pixi/filter-glow` (v5/v6용 구버전)는 Pixi v8 호환 안 됨. `pixi-filters` 패키지 사용.

## BGM 다운로드 & 변환 (CC0)

기본 BGM은 별도 자산입니다. [freesound.org/s/684184/](https://freesound.org/s/684184/) ("Some Game Background Music Or Something" by Seth_Makes_Sounds, CC0)에서 다운로드 가능합니다.

### FFmpeg 설치

**Windows (winget)**:
```powershell
winget install --id Gyan.FFmpeg --source winget --accept-package-agreements --accept-source-agreements --silent
```

### WAV → OGG q6 변환

```bash
ffmpeg -y -i "path/to/684184__seth_makes_sounds__some-game-background-music-or-something.wav" \
  -c:a libvorbis -q:a 6 public/audio/bgm/primary.ogg
```

**결과**: 34.5 MB WAV → 3.28 MB OGG (89% 감소)

### Audacity 대안
- File → Import → WAV
- File → Export → OGG Vorbis (Quality: 6)
- 저장: `public/audio/bgm/primary.ogg`

### BGM 없이 실행
`primary.ogg` 누락 시에도 게임 정상 작동합니다 (silent fallback, console.warn 1회). 게임 로직 영향 0.

## 라이선스

- **코드**: (사용자 결정)
- **BGM**: CC0 Public Domain (Seth_Makes_Sounds) — `assets/audio/LICENSE_REGISTRY.md` 참조
- **기타 자산**: 모두 procedural (Web Audio synthesis + Pixi Graphics)

## 빌드 검증 (Build Gates 5/5)

| Gate | 기준 | 검증 방법 |
|------|------|---------|
| GATE-01 | `npm run build` exit 0 | CI build job |
| GATE-02 | Preview HTTP 200 응답 | Playwright 테스트 |
| GATE-03 | Console error 0 (60초, Pixel 5) | E2E 자동 수집 |
| GATE-04 | FPS P50 ≥58 / P99 ≥55 | Playwright RAF timing |
| GATE-05 | Bundle < 600 KB | CI bundle-size job |

**자동화**: `.github/workflows/ci.yml` 4-job 파이프라인 (build / unit / e2e / bundle-size)

## 디자인 문서 읽기 순서

외부 개발자 또는 AI agent 권장 순서:

1. **`design/gdd/game-concept.md`** — 게임 비전 + 4개 Pillars
2. **`design/gdd/systems-index.md`** — 시스템 분류 + §Engine Bootstrap + §Conventions + Wiring 의무사항
3. **`design/art/art-bible.md`** + **`design/art/samples/01-character-balloon-sky.html`** — 시각 정체성 (canonical sample이 단일 진실)
4. **Input System** → **Balloon Physics & Split** → **Critical Pop** → **Score & Combo** → **Visual Juice** (각 `design/gdd/[system].md`)
5. **`design/ux/hud.md`** + **`design/ux/about-modal.md`** — UI/UX 레이아웃

## 알려진 한계

- **iOS Safari**: Playwright Pixel 5 desktop emulation은 Chromium 기반. 정확한 iOS 호환 검증은 실기 테스트 필수
- **BGM**: 라이선스 보존 이유로 git에 미포함. `primary.ogg` 별도 설정 필요
- **Backup BGM**: 선택 사항. Primary 단독으로 작동
- **Gamepad**: MVP 미지원 (터치/마우스 전용)

---

**Last Updated**: 2026-05-31
