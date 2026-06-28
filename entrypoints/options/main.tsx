import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '../../src/styles/tokens.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Options root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
