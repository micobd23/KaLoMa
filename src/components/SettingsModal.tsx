import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Goals } from '../lib/supabase'
import { useToast } from './ToastProvider'
import { useEscapeKey } from '../lib/useEscapeKey'

interface Props {
  current: Goals
  onSave: (goals: Goals) => void
  onClose: () => void
}

export default function SettingsModal({ current, onSave, onClose }: Props) {
  const { showToast } = useToast()
  const [kcal, setKcal] = useState(current.kcal?.toString() ?? '')
  const [protein, setProtein] = useState(current.protein?.toString() ?? '')
  const [carbs, setCarbs] = useState(current.carbs?.toString() ?? '')
  const [fat, setFat] = useState(current.fat?.toString() ?? '')
  useEscapeKey(onClose)

  // Parses an optional goal field. Returns undefined when the value is invalid.
  function parseGoal(raw: string, min: number, max: number): number | null | undefined {
    const t = raw.trim()
    if (!t) return null
    const v = parseInt(t, 10)
    if (isNaN(v) || v < min || v > max) return undefined
    return v
  }

  function handleSave() {
    const kcalVal = parseGoal(kcal, 500, 9999)
    if (kcalVal === undefined) {
      showToast('Bitte ein Kalorienziel zwischen 500 und 9999 eingeben (oder leer lassen).', { type: 'error' })
      return
    }
    const proteinVal = parseGoal(protein, 1, 999)
    const carbsVal = parseGoal(carbs, 1, 999)
    const fatVal = parseGoal(fat, 1, 999)
    if (proteinVal === undefined || carbsVal === undefined || fatVal === undefined) {
      showToast('Makro-Ziele müssen zwischen 1 und 999 g liegen (oder leer bleiben).', { type: 'error' })
      return
    }
    onSave({ kcal: kcalVal, protein: proteinVal, carbs: carbsVal, fat: fatVal })
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
          <input type="number" value={kcal} onChange={e => setKcal(e.target.value)} min={500} max={9999} placeholder="Kein Ziel" autoFocus />
        </div>
        <p className="settings-hint">Leer lassen, um den Fortschrittsbalken auszublenden.</p>

        <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>
          Makro-Ziele (g, optional)
        </label>
        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
          <div className="field"><label>Protein</label><input type="number" value={protein} onChange={e => setProtein(e.target.value)} min={1} max={999} placeholder="—" /></div>
          <div className="field"><label>Kohlenhydrate</label><input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} min={1} max={999} placeholder="—" /></div>
          <div className="field"><label>Fett</label><input type="number" value={fat} onChange={e => setFat(e.target.value)} min={1} max={999} placeholder="—" /></div>
        </div>

        <div className="modal-btns">
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Abmelden</button>
      </div>
    </div>
  )
}
