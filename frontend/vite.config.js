import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/callback': 'http://localhost:3000',
      '/client-config': 'http://localhost:3000',
      '/get-repos': 'http://localhost:3000',
      '/ai-search': 'http://localhost:3000',
      '/get-repo-contents': 'http://localhost:3000',
      '/get-file-content': 'http://localhost:3000',
      '/commit-file': 'http://localhost:3000',
      '/check-auth': 'http://localhost:3000',
    }
  }
})
