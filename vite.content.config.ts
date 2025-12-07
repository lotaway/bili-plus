import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/entry/content/index.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'assets/content.js',
        name: 'ContentScript',
        inlineDynamicImports: true, // Ensure everything is in one file
      },
    },
  },
});
