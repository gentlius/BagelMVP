/**
 * POP! e2e smoke test — Build Gates GATE-02 / GATE-03 / GATE-04 / GATE-05
 *
 * Runs against: vite preview http://localhost:4173
 * Viewport: iPhone 12 (390×844, deviceScaleFactor=3) — from playwright.config.ts
 *
 * Gate coverage:
 *   GATE-02 — HTTP 200 on page.goto('/')
 *   GATE-03 — 60s session, console.error count = 0 (console.warn allowed per D-P3-SD-01 BGM fallback)
 *   GATE-04 — RAF delta P50 ≥ 58fps (≤17.24ms), P99 ≥ 55fps (≤18.18ms)
 *             Note: CI environment = desktop Chromium, no CPU throttle.
 *             Real device throttle is user's responsibility (m0 §실기 검증).
 *   GATE-05 — dist/assets/*.js total size < 614_400 bytes (600 KB)
 *
 * Decision D-P4-02: RAF-based frame timing instead of globalThis._gameTicker.
 *   Pixi Ticker runs on top of requestAnimationFrame, so RAF timestamp deltas
 *   are equivalent for FPS measurement purposes (same underlying clock).
 *   This avoids requiring src/ modifications (out of qa-lead scope per sprint §11).
 *
 * Decision D-P4-03: GATE-04 measured in CI desktop environment (no CPU throttle).
 *   Real-device throttle measurement is a user-side task (m0 §실기 검증).
 *   CI gate validates "does the game loop run at all at expected speed on desktop".
 */

import { test, expect } from '@playwright/test';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// GATE-05: Bundle size assertion (runs independently of browser session)
// ---------------------------------------------------------------------------

test('GATE-05: dist/assets/*.js total < 600 KB', async () => {
  const assetsDir = join(process.cwd(), 'dist', 'assets');
  const files = await readdir(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));

  let totalBytes = 0;
  for (const file of jsFiles) {
    const s = await stat(join(assetsDir, file));
    totalBytes += s.size;
  }

  const totalKB = totalBytes / 1024;
  console.log(`Bundle total: ${totalKB.toFixed(1)} KB (${jsFiles.length} JS chunks)`);
  // Log individual chunks
  for (const file of jsFiles) {
    const s = await stat(join(assetsDir, file));
    console.log(`  ${file}: ${(s.size / 1024).toFixed(1)} KB`);
  }

  expect(totalBytes).toBeLessThan(614_400); // 600 KB in bytes
});

// ---------------------------------------------------------------------------
// GATE-02 / GATE-03 / GATE-04: 60-second browser session
// ---------------------------------------------------------------------------

test('GATE-02/03/04: 60s mobile session — HTTP 200 + 0 console.error + FPS', async ({ page }) => {
  // Collect console errors (warn is allowed — D-P3-SD-01 BGM silent fallback)
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
    // DIAGNOSTIC: print all browser messages
    console.log(`[browser ${msg.type()}] ${msg.text()}`);
  });

  // Page errors (uncaught exceptions)
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.log(`[pageerror] ${err.message}`);
  });

  // GATE-02: HTTP 200
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  // DIAGNOSTIC: snapshot page state before canvas wait
  await page.waitForTimeout(2000);
  const diag = await page.evaluate(() => ({
    gameHTML: document.getElementById('game')?.innerHTML?.substring(0, 300) ?? 'NO_GAME_ELEMENT',
    bodyChildren: document.body.children.length,
  }));
  console.log('[diag] #game innerHTML:', diag.gameHTML);
  console.log('[diag] body children:', diag.bodyChildren);

  // Wait for Pixi canvas to mount (app canvas injected into #game)
  await page.waitForSelector('#game canvas', { timeout: 10_000 });

  // ---------------------------------------------------------------------------
  // GATE-04: RAF frame timing — inject measurement script
  // Collects frame deltas over 60s via requestAnimationFrame callbacks.
  // Returns { p50: number, p99: number } in fps.
  // ---------------------------------------------------------------------------

  const SESSION_MS = 60_000;
  const TAP_INTERVAL_MS = 5_000; // tap every 5s to trigger input:fire

  // Inject RAF timing measurement into the page
  await page.evaluate(() => {
    const deltas: number[] = [];
    let lastTs: number | null = null;

    function frame(ts: number) {
      if (lastTs !== null) {
        const delta = ts - lastTs;
        if (delta > 0 && delta < 500) { // ignore spikes > 500ms (tab switch etc.)
          deltas.push(delta);
        }
      }
      lastTs = ts;
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    (globalThis as unknown as Record<string, unknown>)['_rafDeltas'] = deltas;
  });

  // Simulate taps to exercise game systems (input:fire → balloon spawn → VFX)
  const viewport = page.viewportSize();
  const tapX = (viewport?.width ?? 390) / 2;
  const tapY = (viewport?.height ?? 844) / 2;

  // Run session — tap every 5 seconds for 60 seconds
  const startTime = Date.now();
  while (Date.now() - startTime < SESSION_MS) {
    const elapsed = Date.now() - startTime;
    const remaining = SESSION_MS - elapsed;
    const waitMs = Math.min(TAP_INTERVAL_MS, remaining);

    await page.waitForTimeout(waitMs);

    if (Date.now() - startTime < SESSION_MS) {
      // Double-tap to simulate double-tap input:fire
      await page.touchscreen.tap(tapX, tapY);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(tapX, tapY);
    }
  }

  // Collect RAF measurements
  const fpsResult = await page.evaluate(() => {
    const deltas = (globalThis as unknown as { _rafDeltas?: number[] })['_rafDeltas'] ?? [];

    if (deltas.length < 10) {
      return { p50: 0, p99: 0, sampleCount: deltas.length, error: 'Insufficient samples' };
    }

    const sorted = [...deltas].sort((a, b) => a - b);
    const p50DeltaMs = sorted[Math.floor(sorted.length * 0.50)];
    const p99DeltaMs = sorted[Math.floor(sorted.length * 0.99)];

    const p50Fps = 1000 / p50DeltaMs;
    const p99Fps = 1000 / p99DeltaMs;

    return { p50: p50Fps, p99: p99Fps, sampleCount: deltas.length };
  });

  console.log(`GATE-04 FPS measurement:`);
  console.log(`  Samples: ${fpsResult.sampleCount}`);
  console.log(`  P50: ${fpsResult.p50.toFixed(1)} fps`);
  console.log(`  P99: ${fpsResult.p99.toFixed(1)} fps`);
  console.log(`  console.error count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log(`  Errors:`);
    for (const e of consoleErrors) console.log(`    - ${e}`);
  }

  // GATE-03: 0 console.error
  expect(
    consoleErrors,
    `GATE-03 FAIL: ${consoleErrors.length} console.error(s) detected`
  ).toHaveLength(0);

  // Page-level uncaught exceptions (also GATE-03)
  expect(
    pageErrors,
    `GATE-03 FAIL: ${pageErrors.length} uncaught page error(s)`
  ).toHaveLength(0);

  // GATE-04: FPS thresholds (desktop CI — no CPU throttle)
  expect(
    fpsResult.sampleCount,
    'GATE-04: Need at least 100 RAF samples for reliable measurement'
  ).toBeGreaterThanOrEqual(100);

  expect(
    fpsResult.p50,
    `GATE-04 FAIL: P50 fps ${fpsResult.p50.toFixed(1)} < 58`
  ).toBeGreaterThanOrEqual(58);

  expect(
    fpsResult.p99,
    `GATE-04 FAIL: P99 fps ${fpsResult.p99.toFixed(1)} < 55`
  ).toBeGreaterThanOrEqual(55);
});
