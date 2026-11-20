import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import UpdatePrompt from './components/UpdatePrompt.tsx'
import ThemedToaster from './components/ThemedToaster.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { LanguageProvider } from './context/LanguageContext.tsx'
import { installKeyboardAvoidance } from './utils/mobileKeyboard.ts'

// Phones only: keeps the field being typed into above the on-screen keyboard
// in every modal and page, rather than patching each form separately.
installKeyboardAvoidance()

// After a deploy, a tab still running the old bundle asks for lazy chunks that
// no longer exist and gets index.html back, so the page it was opening
// crashes. Reloading picks up the new build. Once per minute at most, so a
// chunk that is genuinely broken cannot loop the page.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'chunk-reload-at'
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY) ?? 0) } catch { /* storage blocked */ }
  if (Date.now() - last < 60_000) return
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* storage blocked */ }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Inside ThemeProvider, so the error screen is painted in the theme the
      user chose rather than snapping to light at the worst moment. Outside
      App, because a failure in the router or a provider is exactly the kind
      this has to survive — a boundary nested any deeper would go down with it.
    */}
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </LanguageProvider>
      <ThemedToaster />
      {/*
        Outside the boundary and beside the toaster it renders into: it is the
        service worker's registration point as well as the update prompt, and
        a crash in App is the one moment a stale bundle most needs replacing.
      */}
      <UpdatePrompt />
    </ThemeProvider>
  </StrictMode>,
)
