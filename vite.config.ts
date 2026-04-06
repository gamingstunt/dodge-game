import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: 'src/client/index.html',
        splash: 'src/client/splash.html',
      },
    },
  },
});
