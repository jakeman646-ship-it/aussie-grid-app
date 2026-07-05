/**
 * Aussie Grid — Entry point
 * File: src/main.tsx
 * Version: v0.1.2.13
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reloadOnceForStaleChunk } from './lib/lazyRetry'

// Vite fires this when a preloaded dependency chunk 404s (stale deploy).
// Reload once to fetch the new manifest instead of surfacing a broken import.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunk()) {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
