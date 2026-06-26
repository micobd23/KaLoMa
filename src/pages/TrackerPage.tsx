import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, MEALS, r, dateKey, formatDate } from '../lib/supabase'
import type { FoodItem, LogEntry, MealKey } from '../lib/supabase'
import BarcodeScanner from '../components/BarcodeScanner'
import ItemModal from '../components/ItemModal'

interface Props {
  userId: string
  kcalGoal: number | null
  date: Date
  onDateChange: (d: Date) => void
}

interface PendingItem { item: FoodItem; fromOFF: boolean }

interface SugItem extends FoodItem { source: 'local' | 'off'; brand?: string }

export default function TrackerPage({ userId, kcalGoal, date, onDateChange }: Props) {
  const [log, setLog] = useState<LogEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [foodDb, setFoodDb] = useState<(FoodItem & { id: string })[]>([])
  const [meal, setMeal] = useState<MealKey>('frühstück')

  // Form
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState(100)
  const [kcalInput, setKcalInput] = useState('')
  const [proteinInput, setProteinInput] = useState('')
  const [carbsInput, setCarbsInput] = useState('')
  const [fatInput, setFatInput] = useState('')
  const [selectedBase, setSelectedBase] = useState<FoodItem | null>(null)

  // Search
  const [suggestions, setSuggestions] = useState<SugItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [offLoading, setOffLoading] = useState(false)
  const offTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null)

  const fetchLog = useCallback(async () => {
    setLogLoading(true)
    const { data } = await supabase
      .from('food_log')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateKey(date))
      .order('created_at')
    setLog((data as LogEntry[]) ?? [])
    setLogLoading(false)
  }, [userId, date])

  const fetchFoodDb = useCallback(async () => {
    const { data } = await supabase.from('food_db').select('*').eq('user_id', userId).order('name')
    setFoodDb((data as any[]) ?? [])
  }, [userId])

  useEffect(() => { fetchLog() }, [fetchLog])
  useEffect(() => { fetchFoodDb() }, [fetchFoodDb])

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search logic
  useEffect(() => {
    clearTimeout(offTimerRef.current)
    if (!query.trim()) { setSuggestions([]); setShowSuggestions(false); return }

    const local: SugItem[] = foodDb
      .filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4)
      .map(i => ({ ...i, source: 'local' as const }))
    setSuggestions(local)
    setShowSuggestions(true)

    if (query.trim().length >= 2) {
      offTimerRef.current = setTimeout(() => searchOFF(query, local), 500)
    }
  }, [query, foodDb])

  async function searchOFF(q: string, existing: SugItem[]) {
    setOffLoading(true)
    try {
      const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,product_name_de,brands,nutriments`
      const res = await fetch(url)
      const data = await res.json()
      const products = (data.products ?? []).filter((p: any) => {
        const nm = p.nutriments
        return (p.product_name || p.product_name_de) && nm?.['energy-kcal_100g'] != null
      })
      const offItems: SugItem[] = products.slice(0, 5).map((p: any) => ({
        name: (p.product_name_de || p.product_name || '').trim(),
        brand: p.brands?.split(',')[0]?.trim(),
        kcal: Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
        protein: r(p.nutriments['proteins_100g'] ?? 0),
        carbs: r(p.nutriments['carbohydrates_100g'] ?? 0),
        fat: r(p.nutriments['fat_100g'] ?? 0),
        source: 'off' as const,
      })).filter((i: SugItem) => i.name)
      setSuggestions([...existing, ...offItems])
    } catch { /* network error – show only local */ }
    setOffLoading(false)
  }

  function selectSuggestion(item: SugItem) {
    setQuery(item.name)
    setSelectedBase(item)
    setShowSuggestions(false)
    applyBase(item, amount)
    // Auto-save OFF items to local DB
    if (item.source === 'off') {
      const exists = foodDb.some(i => i.name.toLowerCase() === item.name.toLowerCase())
      if (!exists) {
        supabase.from('food_db').insert({ user_id: userId, name: item.name, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat })
          .then(() => fetchFoodDb())
      }
    }
  }

  function applyBase(base: FoodItem, amt: number) {
    const fac = amt / 100
    setKcalInput(String(r(base.kcal * fac)))
    setProteinInput(String(r(base.protein * fac)))
    setCarbsInput(String(r(base.carbs * fac)))
    setFatInput(String(r(base.fat * fac)))
  }

  function handleAmountChange(val: number) {
    setAmount(val)
    if (selectedBase) applyBase(selectedBase, val)
  }

  async function addToLog() {
    if (!query.trim()) return
    await supabase.from('food_log').insert({
      user_id: userId,
      date: dateKey(date),
      meal,
      name: query.trim(),
      amount,
      kcal: parseFloat(kcalInput) || 0,
      protein: parseFloat(proteinInput) || 0,
      carbs: parseFloat(carbsInput) || 0,
      fat: parseFloat(fatInput) || 0,
    })
    setQuery(''); setAmount(100); setKcalInput(''); setProteinInput(''); setCarbsInput(''); setFatInput(''); setSelectedBase(null)
    fetchLog()
  }

  async function deleteEntry(id: string) {
    await supabase.from('food_log').delete().eq('id', id)
    setLog(prev => prev.filter(e => e.id !== id))
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false)
    try {
      const res = await fetch(`https://de.openfoodfacts.org/api/v0/product/${barcode}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const nm = p.nutriments ?? {}
        setPendingItem({
          fromOFF: true,
          item: {
            name: (p.product_name_de || p.product_name || barcode).trim(),
            kcal: Math.round(nm['energy-kcal_100g'] ?? 0),
            protein: r(nm['proteins_100g'] ?? 0),
            carbs: r(nm['carbohydrates_100g'] ?? 0),
            fat: r(nm['fat_100g'] ?? 0),
          }
        })
      } else {
        alert(`Barcode ${barcode} nicht in Open Food Facts gefunden. Du kannst das Produkt manuell eintragen.`)
      }
    } catch {
      alert('Fehler beim Laden des Produkts. Bitte Internetverbindung prüfen.')
    }
  }

  async function confirmItemModal(amount: number, saveToDb: boolean) {
    if (!pendingItem) return
    const { item } = pendingItem
    const fac = amount / 100
    if (saveToDb) {
      const exists = foodDb.some(i => i.name.toLowerCase() === item.name.toLowerCase())
      if (!exists) {
        await supabase.from('food_db').insert({ user_id: userId, name: item.name, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat })
        fetchFoodDb()
      }
    }
    await supabase.from('food_log').insert({
      user_id: userId, date: dateKey(date), meal,
      name: item.name, amount,
      kcal: item.kcal * fac, protein: item.protein * fac,
      carbs: item.carbs * fac, fat: item.fat * fac,
    })
    setPendingItem(null)
    fetchLog()
  }

  // Totals
  const totals = log.reduce((acc, e) => ({
    kcal: acc.kcal + e.kcal,
    protein: acc.protein + e.protein,
    carbs: acc.carbs + e.carbs,
    fat: acc.fat + e.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  // Grouped log
  const grouped = MEALS.map(m => ({
    ...m,
    entries: log.filter(e => e.meal === m.key),
  })).filter(g => g.entries.length > 0)

  const pct = kcalGoal ? Math.min((totals.kcal / kcalGoal) * 100, 100) : 0
  const remaining = kcalGoal ? kcalGoal - Math.round(totals.kcal) : 0

  return (
    <>
      {/* Date navigation */}
      <div className="date-nav">
        <button onClick={() => onDateChange(new Date(date.getTime() - 86400000))}>‹</button>
        <span className="date-label">{formatDate(date)}</span>
        <button onClick={() => onDateChange(new Date(date.getTime() + 86400000))}>›</button>
      </div>

      {/* Macro summary */}
      <div className="macro-grid">
        <div className="macro-card"><div className="mc-label">Kalorien</div><div><span className="mc-val">{Math.round(totals.kcal)}</span> <span className="mc-unit">kcal</span></div></div>
        <div className="macro-card"><div className="mc-label">Protein</div><div><span className="mc-val">{r(totals.protein)}</span> <span className="mc-unit">g</span></div></div>
        <div className="macro-card"><div className="mc-label">Kohlenhydrate</div><div><span className="mc-val">{r(totals.carbs)}</span> <span className="mc-unit">g</span></div></div>
        <div className="macro-card"><div className="mc-label">Fett</div><div><span className="mc-val">{r(totals.fat)}</span> <span className="mc-unit">g</span></div></div>
      </div>

      {/* Goal progress */}
      {kcalGoal && (
        <div className="goal-bar-wrap">
          <div className="goal-bar-meta">
            <span>{Math.round(totals.kcal)} / {kcalGoal} kcal</span>
            <span className={remaining < 0 ? 'over' : ''}>
              {remaining >= 0 ? `noch ${remaining} kcal` : `${Math.abs(remaining)} kcal über Ziel`}
            </span>
          </div>
          <div className="goal-bar-track">
            <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Add entry */}
      <div className="section-heading">Eintrag hinzufügen</div>
      <div className="card">
        {/* Meal selector */}
        <div className="meal-selector">
          {MEALS.map(m => (
            <button key={m.key} className={`meal-btn${meal === m.key ? ' active' : ''}`} onClick={() => setMeal(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Search + scanner */}
        <div className="search-row">
          <div className="search-wrap" ref={searchWrapRef}>
            <div className="field">
              <label>Lebensmittel suchen</label>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query && setShowSuggestions(true)}
                onKeyDown={e => e.key === 'Enter' && !showSuggestions && addToLog()}
                placeholder="Name eingeben oder Barcode scannen…"
                autoComplete="off"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((item, i) => (
                  <div key={i} className="suggestion-item" onMouseDown={() => selectSuggestion(item)}>
                    <span className="sug-name">
                      {item.name}
                      {item.brand && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}> · {item.brand}</span>}
                    </span>
                    <span className={`sug-badge${item.source === 'local' ? ' local' : ''}`}>{item.source === 'local' ? 'Meine DB' : 'OFF'}</span>
                    <span className="sug-meta">{Math.round(item.kcal)} kcal</span>
                  </div>
                ))}
                {offLoading && <div className="sug-loading">Suche in Open Food Facts…</div>}
              </div>
            )}
          </div>
          <button className="scan-btn" onClick={() => setScannerOpen(true)} title="Barcode scannen">📷</button>
        </div>

        {/* Macro inputs */}
        <div className="form-row">
          <div className="field">
            <label>Menge (g)</label>
            <input type="number" value={amount} min={1} onChange={e => handleAmountChange(Number(e.target.value) || 100)} />
          </div>
          <div className="field"><label>kcal</label><input type="number" value={kcalInput} onChange={e => setKcalInput(e.target.value)} placeholder="0" min={0} /></div>
          <div className="field"><label>Protein (g)</label><input type="number" value={proteinInput} onChange={e => setProteinInput(e.target.value)} placeholder="0" min={0} /></div>
          <div className="field"><label>Kohlen. (g)</label><input type="number" value={carbsInput} onChange={e => setCarbsInput(e.target.value)} placeholder="0" min={0} /></div>
          <div className="field"><label>Fett (g)</label><input type="number" value={fatInput} onChange={e => setFatInput(e.target.value)} placeholder="0" min={0} /></div>
        </div>
        <button className="btn btn-primary" onClick={addToLog}>+ Hinzufügen</button>
      </div>

      {/* Log */}
      <div className="section-heading">Gegessen</div>
      <div className="card" style={{ padding: '.5rem 1.25rem' }}>
        <div className="col-headers">
          <span className="col-name">Lebensmittel</span>
          <span className="col-m">Prot.</span>
          <span className="col-m">Kh.</span>
          <span className="col-m">Fett</span>
          <span className="col-k">kcal</span>
          <span className="col-del" />
        </div>
        {logLoading ? (
          <p className="loading-msg">Lädt…</p>
        ) : !log.length ? (
          <p className="empty">Noch keine Einträge für diesen Tag.</p>
        ) : grouped.map(group => (
          <div key={group.key}>
            <div className="meal-group-header">
              <span>{group.label}</span>
              <span className="meal-group-kcal">{Math.round(group.entries.reduce((s, e) => s + e.kcal, 0))} kcal</span>
            </div>
            {group.entries.map(entry => (
              <div key={entry.id} className="entry-row">
                <span className="entry-name">
                  {entry.name}
                  {entry.amount !== 100 && <span className="entry-amt"> ({Math.round(entry.amount)}g)</span>}
                </span>
                <span className="entry-macro">{r(entry.protein)}g</span>
                <span className="entry-macro">{r(entry.carbs)}g</span>
                <span className="entry-macro">{r(entry.fat)}g</span>
                <span className="entry-kcal">{Math.round(entry.kcal)} kcal</span>
                <button className="del-btn" onClick={() => deleteEntry(entry.id)}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {scannerOpen && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />}
      {pendingItem && (
        <ItemModal
          item={pendingItem.item}
          fromOFF={pendingItem.fromOFF}
          onConfirm={confirmItemModal}
          onClose={() => setPendingItem(null)}
        />
      )}
    </>
  )
}
