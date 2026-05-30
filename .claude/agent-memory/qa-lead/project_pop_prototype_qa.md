---
name: POP! Prototype QA Gate Decisions
description: QA Lead review of prototype scope reduction — rng wrapper mandate, Pixi v8 build gates, inline QA section requirement, mini consistency check
type: project
---

Reviewed prototype scope reduction proposal (2026-05-30). Key decisions:

**Why:** User evaluating Pre-Production track vs. rapid prototype scope for "does it feel fun?" validation. seed-rng-system.md already signed with Mulberry32 + determinism contract.

**QA Gate outcomes:**
- Math.random() direct calls PROHIBITED even in prototype — thin `rng()` wrapper mandatory (5-min impl cost, preserves GDD contract + enables future regression tests)
- /qa-plan full skill CUT: CONDITIONAL YES — prototype-spec.md must include inline QA section (build gates + player metrics + PROCEED/PIVOT/KILL criteria)
- /design-review full CUT: CONDITIONAL YES — mini consistency check (1 session, 3 items) required after 4x 1-pagers complete
- Verdict: CONCERN (not OBJECT) — direction endorsed, two specific decisions need adjustment

**Pixi v8 / Vite build gate equivalents (Godot --export-release analog):**
- GATE-01: npm run build → exit code 0, dist/ generated
- GATE-02: npm run preview → HTTP 200
- GATE-03: Playwright mobile viewport (390×844) → 60s session, console.error 0, no SCRIPT ERROR pattern
- GATE-04: FPS via Pixi Ticker.deltaMS → P50 ≥ 58fps, P99 ≥ 55fps
- GATE-05: Bundle size < 600KB

**Player QA gates (measurable):**
- PG-01: avg session ≥ 90s
- PG-02: 2/3 testers ≥ 3 consecutive runs
- PG-03: double-tap recognition ≥ 90%
- PG-04: Critical witnessed in first 3 runs by 90% testers
- PG-05: FPS ≥ 55fps floor
- PG-06: "Control feeling" Likert ≥ 4/5 by 4 of 5 testers

**Test Evidence by system (prototype):**
- Balloon Physics & Split: Logic → BLOCKING (unit test: split size formula, collision)
- Critical Pop: Logic → BLOCKING (unit test: pity timer, chi-square probability)
- Score & Combo: Logic → BLOCKING (unit test: formula output range, combo transitions)
- Visual Juice: Visual/Feel → ADVISORY (screenshot + art-director sign-off)

**How to apply:** When prototype-spec.md is drafted, require QA section inline before signing off. Flag any Math.random() direct calls in game code as blocker. Run GATE-01~05 at every mini-milestone DoD check.
