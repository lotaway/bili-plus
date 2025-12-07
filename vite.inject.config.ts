import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/entry/biliVideo/video_page_inject.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'assets/video_page_inject.js',
        name: 'VideoPageInject',
        inlineDynamicImports: true,
      },
    },
  },
});
