import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'
import WalletEnhancer from './WalletEnhancer'
import AgendaEditEnhancer from './AgendaEditEnhancer'
import './styles.css'
import './overrides.css'
import './agenda-edit.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthGate /><WalletEnhancer /><AgendaEditEnhancer /></StrictMode>,
)
