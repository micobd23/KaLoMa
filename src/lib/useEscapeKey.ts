import { useEffect } from 'react'

// Closes a dialog when the user presses Escape.
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onEscape])
}
