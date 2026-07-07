import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { supabase, r, kj } from '../lib/supabase'
import type { FoodItem } from '../lib/supabase'
import ItemModal from '../components/ItemModal'
import { useToast } from '../components/ToastProvider'

const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))
const SAVE_ERROR = 'Fehler beim Speichern. Bitte Internetverbindung prüfen.'

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
    const { data } = await supabase
      .from('food_db')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setDb((data as DbItem[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchDb() }, [fetchDb])

  const sorted = useMemo(() => {
    const list = [...db]
    if (sortKey === 'kcal') list.sort((a, b) => b.kcal - a.kcal)
    else if (sortKey === 'category') list.sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name))
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [db, sortKey])

  async function addItem() {
    if (!name.trim()) return
    const { error } = await supabase.from('food_db').insert({
      user_id: userId,
      name: name.trim(),
      category: category.trim() || null,
      kcal: parseFloat(kcal) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    })
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    setName(''); setCategory(''); setKcal(''); setProtein(''); setCarbs(''); setFat('')
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
    setDb(prev => prev.filter(i => i.id !== id))
  }

  async function confirmAdd(item: FoodItem, amount: number) {
    if (amount <= 0) { showToast('Bitte eine Menge größer als 0 eingeben.', { type: 'error' }); return }
    const fac = amount / 100
    const { error } = await supabase.from('food_log').insert({
      user_id: userId,
      date: currentDate,
      meal,
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
          Neues Lebensmittel anlegen
          <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10, marginLeft: 6 }}>· Werte pro 100g</span>
        </span>
        <button className="scan-btn" onClick={() => setScannerOpen(true)} title="Barcode scannen und direkt in die Datenbank speichern">📷</button>
      </div>
      <div className="card">
        <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Haferflocken" onKeyDown={e => e.key === 'Enter' && addItem()} />
          </div>
          <div className="field"><label>kcal</label><input type="number" value={kcal} onChange={e => setKcal(e.target.value)} placeholder="0" min={0} /></div>
          <div className="field"><label>Protein (g)</label><input type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="0" min={0} /></div>
          <div className="field"><label>Kohlen. (g)</label><input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="0" min={0} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 100 }}>
            <label>Fett (g)</label>
            <input type="number" value={fat} onChange={e => setFat(e.target.value)} placeholder="0" min={0} />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Rubrik (optional)</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. Getreide" />
          </div>
          <button className="btn btn-primary" onClick={addItem} style={{ alignSelf: 'flex-end' }}>+ Speichern</button>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="section-heading" style={{ marginBottom: 0 }}>Kalorientabelle</div>
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
          <span className="grid-col-m hide-sm">kJ</span>
          <span className="grid-col-k">kcal/100g</span>
          <span className="grid-col-m hide-sm">Rubrik</span>
          <span className="grid-col-add" />
          <span className="grid-col-del" />
        </div>
        {loading ? (
          <p className="loading-msg">Lädt…</p>
        ) : !sorted.length ? (
          <p className="empty">Noch keine Lebensmittel angelegt.</p>
        ) : sorted.map(item => (
          <div key={item.id} className="grid-row">
            <span className="grid-col-name"><span className="grid-name-text">{item.name}</span></span>
            <span className="grid-col-m hide-sm">{kj(item.kcal)}</span>
            <span className="grid-col-k">{Math.round(item.kcal)}</span>
            <span className="grid-col-m hide-sm"><span className="grid-name-text">{item.category || '—'}</span></span>
            <span className="grid-col-add"><button className="db-add-btn" onClick={() => setPendingItem(item)}>+ ins Log</button></span>
            <span className="grid-col-del"><button className="del-btn" onClick={() => deleteItem(item.id)}>×</button></span>
          </div>
        ))}
      </div>

      {pendingItem && (
        <ItemModal
          item={pendingItem}
          fromOFF={false}
          onConfirm={(amount) => confirmAdd(pendingItem, amount)}
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
