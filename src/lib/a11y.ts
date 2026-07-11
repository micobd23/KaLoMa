import type { KeyboardEvent } from 'react'

// Lets a clickable non-button element (e.g. a table row) be activated
// with Enter or Space, like a real button.
export function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }
}
