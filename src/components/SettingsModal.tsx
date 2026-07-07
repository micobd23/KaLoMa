import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastProvider'

interface Props {
  current: number | null
  onSave: (goal: number | null) => void
  onClose: () => void
}

export default function SettingsModal({ current, onSave, onClose }: Props) {
  const { showToast } = useToast()
  const [goal, setGoal] = useState(current?.toString() ?? '')

  async function handleSave() {
    const val = parseInt(goal) || null
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
