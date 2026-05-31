/**
 * Playwright configuration — POP! e2e smoke tests
 *
 * Target: mobile viewport (iPhone 12 = 390×844, devicePixelRatio 3)
 * Browser: Chromium only (GATE-03 / GATE-04 requirement)
 * baseURL: http://localhost:4173 (vite preview default)
 *
 * webServer: builds dist/ then starts preview server automatically.
 * reuseExistingServer: true locally (skip rebuild if server already running),
 *                      false in CI (always fresh build).
 *
 * Decisions:
 *   D-P4-01: webServer auto-builds + starts preview. No manual preview needed.
 *   D-P4-02: RAF-based frame timing for GATE-04 (Ticker.deltaMS not exposed globally).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,           // 90s per test (60s session + startup margin)
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        // Pixel 5 (Android Chrome): 393×851 CSS px, chromium browser.
        // D-P4-04: Pixel 5 채택 — iPhone 12 device는 webkit engine 요구
        // (Windows에서 webkit fidelity 낮음 + 추가 ~80MB 다운로드 회피).
        // 모바일 Safari 실기 정합성은 사용자 실기 검증 단계로 분리 (m0 §실기 검증).
      },
    },
  ],
  webServer: {
    command: 'npm.cmd run build && npm.cmd run preview -- --port 4173',
    port: 4173,
    timeout: 120_000,      // build (2s) + startup margin
    reuseExistingServer: !process.env['CI'],
  },
});
