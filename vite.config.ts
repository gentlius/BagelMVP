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
      filename: 'dist/stats.html',
      title: 'POP! Bundle Analysis',
    }),
  ],
});
