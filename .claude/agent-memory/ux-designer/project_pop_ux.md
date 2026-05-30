---
name: POP! Project UX Context
description: Core UX constraints, pillars, and key decisions for the POP! game project
type: project
---

POP! is a casual HTML5 mobile web game (Pixi.js v8, portrait-only MVP). UX decisions are anchored to 4 pillars and 4 anti-pillars.

**Why:** All UX design must serve these pillars or be rejected at design-test.

**Pillar relevance to UX:**
- P4 (1탭이 다음 런으로): dead → playing RETRY must be sub-33ms, 1 tap only. No confirmation dialogs, no ads in the retry path.
- P1 (한 손가락 한 결정): all input is single-finger. No simultaneous decisions.
- P2 (화면이 점수보다 먼저 말한다): visual/audio feedback is primary; score numbers are secondary.
- AP4 (명시적 튜토리얼 만들지 않는다): no tutorial text. First balloon is the tutorial. Does NOT exempt accessibility (ARIA) requirements.

**Key resolved UX decisions (as of 2026-05-30):**
- Paused overlay: tap-to-resume (explicit tap required), NOT auto-resume. Art bible already specified "TAP TO RESUME" panel.
- boot_error: HTML-layer reload button (window.location.reload()), not JS-dependent. Art bible has no S8 mood entry — inherits S6 Loading visuals.
- Menu decorative balloons: YES, 1-2 floating balloons (art bible S1 already decided this). Deco pool separate from gameplay pool. Balloon Physics GDD #5 must address deco pool.
- Paused dim overlay: rgba(0,0,0,0.3) — 30%, not 50% (art bible §4.3 is authority).

**Systems index location:** design/gdd/systems-index.md
**Game State Manager GDD:** design/gdd/game-state-manager.md
**Art Bible:** design/art/art-bible.md
