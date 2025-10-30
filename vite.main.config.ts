import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      name: 'main',
      fileName: 'index',
      formats: ['cjs']
    },
    outDir: 'dist/main',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'electron',
        'fs',
        'fs/promises',
        'path',
        'os',
        'util',
        'events',
        'child_process',
        'stream',
        'crypto',
        'url',
        'querystring',
        'buffer',
        'assert',
        'constants',
        'timers',
        'tty',
        'readline',
        'repl',
        'vm',
        'zlib',
        'http',
        'https',
        'net',
        'tls',
        'dgram',
        'dns',
        'cluster',
        'worker_threads',
        '@ffmpeg-installer/ffmpeg',
        'fluent-ffmpeg',
        'googleapis',
        'google-auth-library',
        'googleapis-common',
        'google-auth-library/build/src/transport/http2'
      ]
    },
    target: 'node18',
    minify: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  define: {
    global: 'globalThis'
  }
});
