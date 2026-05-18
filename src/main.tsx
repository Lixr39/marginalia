import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/themes.css'
import './styles/reset.css'

// Restore theme from localStorage before first paint
const storedTheme = localStorage.getItem('marginalia-theme') === 'night' ? 'night' : 'day'
document.documentElement.classList.remove('theme-day', 'theme-night')
document.documentElement.classList.add(`theme-${storedTheme}`)
const themeColor = storedTheme === 'night' ? '#0c0a10' : '#ffffff'
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
