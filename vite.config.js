import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署时，改成你的仓库名，如 '/nano-banana-watermark-remover/'
  // 本地开发或其他平台部署时用 '/'
  base: '/',
})
