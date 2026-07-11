import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastProvider'
import { useEscapeKey } from '../lib/useEscapeKey'

interface Props {
  current: number | null
  onSave: (goal: number | null) => void
  onClose: () => void
}

export default function SettingsModal({ current, onSave, onClose }: Props) {
  const { showToast } = useToast()
  const [goal, setGoal] = useState(current?.toString() ?? '')
  useEscapeKey(onClose)

  async function handleSave() {
    const trimmed = goal.trim()
    // Empty means "no goal" – hides the progress bar.
    if (!trimmed) { onSave(null); return }
    const val = parseInt(trimmed, 10)
    if (isNaN(val) || val < 500 || val > 9999) {
      showToast('Bitte ein Kalorienziel zwischen 500 und 9999 eingeben (oder leer lassen).', { type: 'error' })
      return
    }
    onSave(val)
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) showToast('Abmelden fehlgeschlagen. Bitte Internetverbindung prüfen.', { type: 'error' })
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>⚙ Einstellungen</h3>
        <div className="field" style={{ marginBottom: 6 }}>
          <label>Tägliches Kalorienziel (kcal)</label>
          <input
            type="number"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            min={500}
            max={9999}
            placeholder="Kein Ziel"
            autoFocus
          />
        </div>
        <p className="settings-hint">Leer lassen, um den Fortschrittsbalken auszublenden.</p>
        <div className="modal-btns">
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Abmelden</button>
      </div>
    </div>
  )
}
