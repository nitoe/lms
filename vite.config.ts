import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5175 },
  build: {
    // Naikkan batas peringatan chunk agar tidak berisik (default 500 kB)
    chunkSizeWarningLimit: 1000,
    // Optimasi performa build
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        // Pisahkan vendor besar agar cache lebih efektif
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          tiptap: [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/pm',
            '@tiptap/extensions',
            '@tiptap/extension-underline',
            '@tiptap/extension-subscript',
            '@tiptap/extension-superscript',
          ],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
})
