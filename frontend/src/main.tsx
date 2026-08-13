import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx'

/**
 * The toasts render into a portal outside the styled tree, so they take their
 * colours from props rather than from a `dark:` class. Split into its own
 * component because it has to sit inside the provider to read the theme.
 */
function ThemedToaster() {
  const { resolved } = useTheme()
  const dark = resolved === 'dark'
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: dark ? '#1e293b' : '#ffffff',
          color: dark ? '#e2e8f0' : '#1e293b',
          border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
        },
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <ThemedToaster />
    </ThemeProvider>
  </StrictMode>,
)
