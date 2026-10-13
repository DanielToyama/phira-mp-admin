import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { BRAND, seedDefaultApiConfig } from '@/lib/branding'

// 首次访问自动写入默认服务器地址，开箱即用
seedDefaultApiConfig()

document.title = BRAND.pageTitle

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="mp-admin-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
