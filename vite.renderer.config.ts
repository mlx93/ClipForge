import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'fabric-vendor': ['fabric'],
          'zustand-vendor': ['zustand'],
          
          // Feature chunks
          'timeline': [
            './src/renderer/components/Timeline.tsx',
            './src/renderer/store/timelineStore.ts'
          ],
          'video': [
            './src/renderer/components/VideoPreview.tsx',
            './src/renderer/components/MediaLibrary.tsx'
          ],
          'export': [
            './src/renderer/components/ExportDialog.tsx',
            './src/renderer/store/exportStore.ts'
          ],
          'project': [
            './src/renderer/components/ProjectMenu.tsx',
            './src/renderer/store/projectStore.ts'
          ]
        }
      }
    },
    target: 'esnext',
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  base: './',
  server: {
    port: 5173
  }
});
