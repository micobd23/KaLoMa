import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { supabase, r, kj, decimalInput } from '../lib/supabase'
import type { FoodItem, MealKey } from '../lib/supabase'
import ItemModal from '../components/ItemModal'
import { useToast } from '../components/ToastProvider'

const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))
const SAVE_ERROR = 'Fehler beim Speichern. Bitte Internetverbindung prüfen.'
const LOAD_ERROR = 'Daten konnten nicht geladen werden. Bitte Internetverbindung prüfen.'

interface Props {
  userId: string
  meal: string
  currentDate: string
  onLogUpdate: () => void
}

type DbItem = FoodItem & { id: string; category?: string | null }
type SortKey = 'name' | 'kcal' | 'category'

export default function DatabasePage({ userId, meal, currentDate, onLogUpdate }: Props) {
  const { showToast } = useToast()
  const [db, setDb] = useState<DbItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [pendingItem, setPendingItem] = useState<DbItem | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const fetchDb = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('food_db')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    if (error) showToast(LOAD_ERROR, { type: 'error' })
    setDb((data as DbItem[]) ?? [])
    setLoading(false)
  }, [userId, showToast])

  useEffect(() => { fetchDb() }, [fetchDb])

  const sorted = useMemo(() => {
    const list = [...db]
    if (sortKey === 'kcal') list.sort((a, b) => b.kcal - a.kcal)
    else if (sortKey === 'category') list.sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name))
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [db, sortKey])

  function resetForm() {
    setEditingId(null)
    setName(''); setCategory(''); setKcal(''); setProtein(''); setCarbs(''); setFat('')
  }

  function startEdit(item: DbItem) {
    setEditingId(item.id)
    setName(item.name)
    setCategory(item.category ?? '')
    setKcal(String(item.kcal))
    setProtein(String(item.protein))
    setCarbs(String(item.carbs))
    setFat(String(item.fat))
  }

  async function saveItem() {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      kcal: parseFloat(kcal) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    }
    const { error } = editingId
      ? await supabase.from('food_db').update(payload).eq('id', editingId)
      : await supabase.from('food_db').insert({ user_id: userId, ...payload })
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    resetForm()
    fetchDb()
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
      const data = await res.json()
      if (data.status !== 1 || !data.product) {
        showToast(`Barcode ${barcode} nicht in Open Food Facts gefunden. Du kannst das Produkt manuell eintragen.`, { type: 'error' })
        return
      }
      const p = data.product
      const nm = p.nutriments ?? {}
      const item = {
        name: (p.product_name_de || p.product_name || barcode).trim(),
        kcal: Math.round(nm['energy-kcal_100g'] ?? 0),
        protein: r(nm['proteins_100g'] ?? 0),
        carbs: r(nm['carbohydrates_100g'] ?? 0),
        fat: r(nm['fat_100g'] ?? 0),
      }
      if (!item.name) {
        showToast('Produkt hat keinen Namen bei Open Food Facts. Bitte manuell eintragen.', { type: 'error' })
        return
      }
      if (db.some(i => i.name.toLowerCase() === item.name.toLowerCase())) {
        showToast(`"${item.name}" ist schon in deiner Datenbank.`, { type: 'error' })
        return
      }
      const { error } = await supabase.from('food_db').insert({ user_id: userId, ...item })
      if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
      fetchDb()
    } catch {
      showToast('Fehler beim Laden des Produkts. Bitte Internetverbindung prüfen.', { type: 'error' })
    }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('food_db').delete().eq('id', id)
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    if (editingId === id) resetForm()
    setDb(prev => prev.filter(i => i.id !== id))
  }

  async function confirmAdd(item: FoodItem, amount: number, selectedMeal: MealKey) {
    if (amount <= 0) { showToast('Bitte eine Menge größer als 0 eingeben.', { type: 'error' }); return }
    const fac = amount / 100
    const { error } = await supabase.from('food_log').insert({
      user_id: userId,
      date: currentDate,
      meal: selectedMeal,
      name: item.name,
      amount,
      kcal: item.kcal * fac,
      protein: item.protein * fac,
      carbs: item.carbs * fac,
      fat: item.fat * fac,
    })
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    setPendingItem(null)
    onLogUpdate()
  }

  return (
    <>
      <div className="section-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          {editingId ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel anlegen'}
          <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10, marginLeft: 6 }}>· Werte pro 100g</span>
        </span>
        <button className="scan-btn" onClick={() => setScannerOpen(true)} title="Barcode scannen und direkt in die Datenbank speichern" aria-label="Barcode scannen und direkt in die Datenbank speichern">📷</button>
      </div>
      <div className="card">
        <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Haferflocken" onKeyDown={e => e.key === 'Enter' && saveItem()} />
          </div>
          <div className="field"><label>kcal</label><input type="text" inputMode="decimal" value={kcal} onChange={e => setKcal(decimalInput(e.target.value))} placeholder="0" /></div>
          <div className="field"><label>Protein (g)</label><input type="text" inputMode="decimal" value={protein} onChange={e => setProtein(decimalInput(e.target.value))} placeholder="0" /></div>
          <div className="field"><label>Kohlen. (g)</label><input type="text" inputMode="decimal" value={carbs} onChange={e => setCarbs(decimalInput(e.target.value))} placeholder="0" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 100 }}>
            <label>Fett (g)</label>
            <input type="text" inputMode="decimal" value={fat} onChange={e => setFat(decimalInput(e.target.value))} placeholder="0" />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Rubrik (optional)</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. Getreide" />
          </div>
          {editingId && (
            <button className="btn" onClick={resetForm} style={{ alignSelf: 'flex-end' }}>Abbrechen</button>
          )}
          <button className="btn btn-primary" onClick={saveItem} style={{ alignSelf: 'flex-end' }}>
            {editingId ? 'Aktualisieren' : '+ Speichern'}
          </button>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          Kalorientabelle <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>· zum Bearbeiten anklicken</span>
        </div>
        <div className="field">
          <label>Sortieren nach</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="kcal">kcal</option>
            <option value="category">Rubrik</option>
          </select>
        </div>
      </div>
      <div className="grid-table">
        <div className="grid-head">
          <span className="grid-col-name">Name</span>
          <span className="grid-col-m">Prot.</span>
          <span className="grid-col-m">Kh.</span>
          <span className="grid-col-m">Fett</span>
          <span className="grid-col-m hide-sm">kJ</span>
          <span className="grid-col-k">kcal</span>
          <span className="grid-col-m hide-sm">Rubrik</span>
          <span className="grid-col-del" />
          <span className="grid-col-del" />
        </div>
        {loading ? (
          <p className="loading-msg">Lädt…</p>
        ) : !sorted.length ? (
          <p className="empty">Noch keine Lebensmittel angelegt.</p>
        ) : sorted.map(item => (
          <div
            key={item.id}
            className={`grid-row editable${editingId === item.id ? ' editing' : ''}`}
            onClick={() => startEdit(item)}
          >
            <span className="grid-col-name"><span className="grid-name-text">{item.name}</span></span>
            <span className="grid-col-m">{r(item.protein)}</span>
            <span className="grid-col-m">{r(item.carbs)}</span>
            <span className="grid-col-m">{r(item.fat)}</span>
            <span className="grid-col-m hide-sm">{kj(item.kcal)}</span>
            <span className="grid-col-k">{Math.round(item.kcal)}</span>
            <span className="grid-col-m hide-sm"><span className="grid-name-text">{item.category || '—'}</span></span>
            <span className="grid-col-del">
              <button className="db-add-btn" title="Ins Log übernehmen" aria-label={`${item.name} ins Log übernehmen`} onClick={e => { e.stopPropagation(); setPendingItem(item) }}>+</button>
            </span>
            <span className="grid-col-del">
              <button className="del-btn" title="Löschen" aria-label={`${item.name} löschen`} onClick={e => { e.stopPropagation(); deleteItem(item.id) }}>×</button>
            </span>
          </div>
        ))}
      </div>

      {pendingItem && (
        <ItemModal
          item={pendingItem}
          fromOFF={false}
          meal={meal as MealKey}
          showMeal
          onConfirm={(amount, _saveToDb, selectedMeal) => confirmAdd(pendingItem, amount, selectedMeal)}
          onClose={() => setPendingItem(null)}
        />
      )}
      {scannerOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
