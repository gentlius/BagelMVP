import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  base: '/',
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
