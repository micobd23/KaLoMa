import { useState } from 'react'
import { r, decimalInput } from './../lib/supabase'
import type { FoodItem } from '../lib/supabase'

interface Props {
  item: FoodItem
  fromOFF: boolean
  onConfirm: (amount: number, saveToDb: boolean) => void
  onClose: () => void
}

export default function ItemModal({ item, fromOFF, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('100')
  const [saveToDb, setSaveToDb] = useState(fromOFF)

  const fac = (parseFloat(amount) || 0) / 100
  const preview = {
    kcal: Math.round(item.kcal * fac),
    protein: r(item.protein * fac),
    carbs: r(item.carbs * fac),
    fat: r(item.fat * fac),
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{item.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Menge</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(decimalInput(e.target.value))}
              autoFocus
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text2)', paddingTop: 18 }}>g</span>
        </div>
        <p className="modal-preview">
          → {preview.kcal} kcal · {preview.protein}g P · {preview.carbs}g Kh · {preview.fat}g Fett
        </p>
        {fromOFF && (
          <label className="modal-save-row">
            <input type="checkbox" checked={saveToDb} onChange={e => setSaveToDb(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            In meine Datenbank speichern
          </label>
        )}
        <div className="modal-btns">
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => onConfirm(parseFloat(amount) || 0, saveToDb)}>Hinzufügen</button>
        </div>
      </div>
    </div>
  )
}
