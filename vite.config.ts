import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// GitHub Pages subpath: /BagelMVP/ — local dev은 '/' 그대로
// CI에서 VITE_BASE_PATH=/BagelMVP/ env로 override
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    host: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // Pixi.js in separate chunk for caching
          pixi: ['pixi.js'],
        },
      },
    },
    // Allow large chunks for pixi bundle
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    visualizer({
      open: false,
      // 프로젝트 루트로 배출 — dist/ 외부 → (1) bundle-size CI 측정에서 자연스러운 제외 (2) GitHub Pages 라이브에 분석 산출물 노출 방지
      filename: 'bundle-stats.html',
      title: 'POP! Bundle Analysis',
    }),
  ],
});
