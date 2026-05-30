---
name: Art Bible is Visual Authority
description: When GDD and art bible conflict on visual specs, art bible wins. GDD must be updated to match.
type: feedback
---

When reviewing GDD visual/audio requirements against the art bible, the art bible is the single authority for visual decisions. If the GDD specifies a visual value (overlay alpha, text label, animation duration) that conflicts with the art bible, the GDD is wrong — not the art bible.

**Why:** The art bible is a dedicated visual specification document owned by the art director. GDD sections like "Visual/Audio Requirements" are derivative summaries, not primary specs. Two observed conflicts in the game-state-manager GDD review (2026-05-30):
1. GDD said paused overlay dim = rgba(0,0,0,0.5); art bible §4.3 said 0.3. Art bible wins.
2. GDD said "Tap to resume" or "Tap anywhere to continue" (provisional); art bible S7 said "TAP TO RESUME" (decided). Art bible wins.

**How to apply:** In every GDD review, cross-check all visual values in UI Requirements and Visual/Audio Requirements sections against the art bible's mood matrix (§2.1) and UI system specs (§3–§7). Flag mismatches as BLOCKING before handoff.
