import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,      // 允許外部 IP 連線 (Docker 必要)
    port: 5173,      // 固定 Port
    proxy: {
      '/api': {
        target: 'http://server:8080',
        changeOrigin: true,
      },
    },
    // ✨ 修改：允許 Cloudflare Tunnel 的網域通過安全檢查
    allowedHosts: [
      "fintrack.czhuang.dev"
    ],
  },
})
