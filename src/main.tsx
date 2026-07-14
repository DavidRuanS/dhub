import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthGate /></StrictMode>,
)
