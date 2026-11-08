import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5175 },
  build: {
    // Naikkan batas peringatan chunk (default 500 kB)
    chunkSizeWarningLimit: 1000,
    target: 'es2022',
    // Vite 8 default = 'oxc' (jangan set 'esbuild' karena sudah tidak disertakan)
    // minify: 'oxc',
    cssMinify: true,
  },
})
