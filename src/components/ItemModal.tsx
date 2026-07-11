import { useState } from 'react'
import { r, decimalInput, MEALS } from './../lib/supabase'
import type { FoodItem, MealKey } from '../lib/supabase'
import { useEscapeKey } from '../lib/useEscapeKey'

interface Props {
  item: FoodItem
  fromOFF: boolean
  meal?: MealKey
  showMeal?: boolean
  initialAmount?: number
  confirmLabel?: string
  onConfirm: (amount: number, saveToDb: boolean, meal: MealKey) => void
  onClose: () => void
}

export default function ItemModal({ item, fromOFF, meal = 'frühstück', showMeal = false, initialAmount, confirmLabel = 'Hinzufügen', onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState(initialAmount != null ? String(initialAmount) : '100')
  const [saveToDb, setSaveToDb] = useState(fromOFF)
  const [mealSel, setMealSel] = useState<MealKey>(meal)
  useEscapeKey(onClose)

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
        {showMeal && (
          <div className="field" style={{ marginTop: 10 }}>
            <label>Mahlzeit</label>
            <select value={mealSel} onChange={e => setMealSel(e.target.value as MealKey)}>
              {MEALS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        )}
        {fromOFF && (
          <label className="modal-save-row">
            <input type="checkbox" checked={saveToDb} onChange={e => setSaveToDb(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            In meine Datenbank speichern
          </label>
        )}
        <div className="modal-btns">
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => onConfirm(parseFloat(amount) || 0, saveToDb, mealSel)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
