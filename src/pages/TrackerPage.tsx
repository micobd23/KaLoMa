import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { supabase, MEALS, r, kj, dateKey, formatDate, decimalInput } from '../lib/supabase'
import type { FoodItem, LogEntry, MealKey } from '../lib/supabase'
import ItemModal from '../components/ItemModal'
import { useToast } from '../components/ToastProvider'

const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))
const SAVE_ERROR = 'Fehler beim Speichern. Bitte Internetverbindung prüfen.'
const LOAD_ERROR = 'Daten konnten nicht geladen werden. Bitte Internetverbindung prüfen.'

interface Props {
  userId: string
  kcalGoal: number | null
  date: Date
  onDateChange: (d: Date) => void
}

interface PendingItem { item: FoodItem; fromOFF: boolean }

interface SugItem extends FoodItem { source: 'off'; brand?: string }

export default function TrackerPage({ userId, kcalGoal, date, onDateChange }: Props) {
  const { showToast } = useToast()
  const [log, setLog] = useState<LogEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [foodDb, setFoodDb] = useState<(FoodItem & { id: string })[]>([])
  const [meal, setMeal] = useState<MealKey>('frühstück')

  // Form
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('100')
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
  const skipNextSearchRef = useRef(false)

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null)

  const fetchLog = useCallback(async () => {
    setLogLoading(true)
    const { data, error } = await supabase
      .from('food_log')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateKey(date))
      .order('created_at')
    if (error) showToast(LOAD_ERROR, { type: 'error' })
    setLog((data as LogEntry[]) ?? [])
    setLogLoading(false)
  }, [userId, date, showToast])

  const fetchFoodDb = useCallback(async () => {
    const { data, error } = await supabase.from('food_db').select('*').eq('user_id', userId).order('name')
    if (error) showToast(LOAD_ERROR, { type: 'error' })
    setFoodDb((data as (FoodItem & { id: string })[]) ?? [])
  }, [userId, showToast])

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

  // Persistent browsable list of the local food database, filtered live by the search field
  const visibleFoodDb = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? foodDb.filter(i => i.name.toLowerCase().includes(q)) : foodDb
  }, [foodDb, query])

  // Open Food Facts search (external results only — local matches are always visible in the list above)
  useEffect(() => {
    clearTimeout(offTimerRef.current)
    if (skipNextSearchRef.current) { skipNextSearchRef.current = false; return }
    if (query.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setShowSuggestions(true)
    offTimerRef.current = setTimeout(() => searchOFF(query), 500)
  }, [query])

  async function searchOFF(q: string) {
    setOffLoading(true)
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&lc=de&fields=product_name,product_name_de,brands,nutriments`
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
      setSuggestions(offItems)
    } catch { /* network error – show nothing */ }
    setOffLoading(false)
  }

  function selectSuggestion(item: SugItem) {
    skipNextSearchRef.current = true
    setQuery(item.name)
    setSelectedBase(item)
    setShowSuggestions(false)
    setSuggestions([])
    applyBase(item, parseFloat(amount) || 0)
    // Auto-save OFF items to local DB
    const exists = foodDb.some(i => i.name.toLowerCase() === item.name.toLowerCase())
    if (!exists) {
      supabase.from('food_db').insert({ user_id: userId, name: item.name, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat })
        .then(({ error }) => { if (error) showToast(SAVE_ERROR, { type: 'error' }); else fetchFoodDb() })
    }
  }

  function selectFromDb(item: FoodItem & { id: string }) {
    skipNextSearchRef.current = true
    setQuery(item.name)
    setSelectedBase(item)
    setShowSuggestions(false)
    setSuggestions([])
    applyBase(item, parseFloat(amount) || 0)
  }

  function applyBase(base: FoodItem, amt: number) {
    const fac = amt / 100
    setKcalInput(String(r(base.kcal * fac)))
    setProteinInput(String(r(base.protein * fac)))
    setCarbsInput(String(r(base.carbs * fac)))
    setFatInput(String(r(base.fat * fac)))
  }

  function handleAmountChange(val: string) {
    setAmount(val)
    if (selectedBase) applyBase(selectedBase, parseFloat(val) || 0)
  }

  async function addToLog() {
    if (!query.trim()) return
    const amt = parseFloat(amount) || 0
    if (amt <= 0) { showToast('Bitte eine Menge größer als 0 eingeben.', { type: 'error' }); return }
    const { error } = await supabase.from('food_log').insert({
      user_id: userId,
      date: dateKey(date),
      meal,
      name: query.trim(),
      amount: amt,
      kcal: parseFloat(kcalInput) || 0,
      protein: parseFloat(proteinInput) || 0,
      carbs: parseFloat(carbsInput) || 0,
      fat: parseFloat(fatInput) || 0,
    })
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    setQuery(''); setAmount('100'); setKcalInput(''); setProteinInput(''); setCarbsInput(''); setFatInput(''); setSelectedBase(null)
    fetchLog()
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from('food_log').delete().eq('id', id)
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
    setLog(prev => prev.filter(e => e.id !== id))
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerOpen(false)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
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
        showToast(`Barcode ${barcode} nicht in Open Food Facts gefunden. Du kannst das Produkt manuell eintragen.`, { type: 'error' })
      }
    } catch {
      showToast('Fehler beim Laden des Produkts. Bitte Internetverbindung prüfen.', { type: 'error' })
    }
  }

  async function confirmItemModal(amount: number, saveToDb: boolean, selectedMeal: MealKey) {
    if (!pendingItem) return
    if (amount <= 0) { showToast('Bitte eine Menge größer als 0 eingeben.', { type: 'error' }); return }
    const { item } = pendingItem
    const fac = amount / 100
    if (saveToDb) {
      const exists = foodDb.some(i => i.name.toLowerCase() === item.name.toLowerCase())
      if (!exists) {
        const { error } = await supabase.from('food_db').insert({ user_id: userId, name: item.name, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat })
        if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
        fetchFoodDb()
      }
    }
    const { error } = await supabase.from('food_log').insert({
      user_id: userId, date: dateKey(date), meal: selectedMeal,
      name: item.name, amount,
      kcal: item.kcal * fac, protein: item.protein * fac,
      carbs: item.carbs * fac, fat: item.fat * fac,
    })
    if (error) { showToast(SAVE_ERROR, { type: 'error' }); return }
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
        <button aria-label="Vorheriger Tag" onClick={() => onDateChange(new Date(date.getTime() - 86400000))}>‹</button>
        <span className="date-label">{formatDate(date)}</span>
        <button aria-label="Nächster Tag" onClick={() => onDateChange(new Date(date.getTime() + 86400000))}>›</button>
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
            <div className={`goal-bar-fill${remaining < 0 ? ' over' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="tracker-grid">
        {/* Left: Erfassung */}
        <div>
          <div className="section-heading">Erfassung</div>
          <div className="card">
            <div className="search-row">
              <div className="search-wrap" ref={searchWrapRef}>
                <div className="field">
                  <label>Lebensmittel suchen</label>
                  <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); if (selectedBase) setSelectedBase(null) }}
                    onFocus={() => query && setShowSuggestions(true)}
                    onKeyDown={e => e.key === 'Enter' && !showSuggestions && addToLog()}
                    placeholder="Name eingeben oder Barcode scannen…"
                    autoComplete="off"
                  />
                </div>
                {showSuggestions && (suggestions.length > 0 || offLoading) && (
                  <div className="suggestions">
                    {suggestions.map((item, i) => (
                      <div key={i} className="suggestion-item" onMouseDown={() => selectSuggestion(item)}>
                        <span className="sug-name">
                          {item.name}
                          {item.brand && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}> · {item.brand}</span>}
                        </span>
                        <span className="sug-badge">OFF</span>
                        <span className="sug-meta">{Math.round(item.kcal)} kcal</span>
                      </div>
                    ))}
                    {offLoading && <div className="sug-loading">Suche in Open Food Facts…</div>}
                  </div>
                )}
              </div>
              <button className="scan-btn" onClick={() => setScannerOpen(true)} title="Barcode scannen" aria-label="Barcode scannen">📷</button>
            </div>

            <div className="field" style={{ marginBottom: 6 }}>
              <label>Meine Datenbank <span style={{ fontWeight: 400, color: 'var(--text3)' }}>· zum Auswählen anklicken</span></label>
              <div className="db-list">
                {!visibleFoodDb.length ? (
                  <p className="empty" style={{ padding: '10px 0' }}>{query.trim() ? 'Keine Treffer.' : 'Noch keine Lebensmittel gespeichert.'}</p>
                ) : visibleFoodDb.map(item => (
                  <div
                    key={item.id}
                    className={`db-list-row${selectedBase?.name === item.name ? ' selected' : ''}`}
                    onClick={() => selectFromDb(item)}
                  >
                    <span className="db-list-name">{item.name}</span>
                    <span className="db-list-kcal">{Math.round(item.kcal)} kcal</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={e => { e.preventDefault(); addToLog() }}>
              <div className="form-row">
                <div className="field">
                  <label>Menge</label>
                  <input type="text" inputMode="decimal" value={amount} onChange={e => handleAmountChange(decimalInput(e.target.value))} />
                </div>
                <div className="field"><label>kcal</label><input type="text" inputMode="decimal" value={kcalInput} onChange={e => setKcalInput(decimalInput(e.target.value))} placeholder="0" readOnly={!!selectedBase} tabIndex={selectedBase ? -1 : undefined} className={selectedBase ? 'calc-locked' : undefined} title={selectedBase ? 'Wird automatisch aus der Menge berechnet' : undefined} /></div>
                <div className="field"><label>Protein</label><input type="text" inputMode="decimal" value={proteinInput} onChange={e => setProteinInput(decimalInput(e.target.value))} placeholder="0" readOnly={!!selectedBase} tabIndex={selectedBase ? -1 : undefined} className={selectedBase ? 'calc-locked' : undefined} title={selectedBase ? 'Wird automatisch aus der Menge berechnet' : undefined} /></div>
                <div className="field"><label>KH</label><input type="text" inputMode="decimal" value={carbsInput} onChange={e => setCarbsInput(decimalInput(e.target.value))} placeholder="0" readOnly={!!selectedBase} tabIndex={selectedBase ? -1 : undefined} className={selectedBase ? 'calc-locked' : undefined} title={selectedBase ? 'Wird automatisch aus der Menge berechnet' : undefined} /></div>
                <div className="field"><label>Fett</label><input type="text" inputMode="decimal" value={fatInput} onChange={e => setFatInput(decimalInput(e.target.value))} placeholder="0" readOnly={!!selectedBase} tabIndex={selectedBase ? -1 : undefined} className={selectedBase ? 'calc-locked' : undefined} title={selectedBase ? 'Wird automatisch aus der Menge berechnet' : undefined} /></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, minHeight: 16 }}>
                {kcalInput && `→ ${kj(parseFloat(kcalInput) || 0)} kJ`}
              </div>
              <button type="submit" className="btn btn-primary">Übernehmen</button>
            </form>
          </div>
        </div>

        {/* Right: Berechnungstag */}
        <div>
          <div className="section-heading">Berechnungstag</div>
          <div className="card card-tinted">
            <div className="meal-selector">
              {MEALS.map(m => (
                <button key={m.key} className={`meal-btn${meal === m.key ? ' active' : ''}`} onClick={() => setMeal(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>

            {logLoading ? (
              <p className="loading-msg">Lädt…</p>
            ) : !log.length ? (
              <p className="empty">Noch keine Einträge für diesen Tag.</p>
            ) : grouped.map(group => (
              <div key={group.key} className="meal-group-block">
                <div className="meal-group-header">
                  <span>{group.label}</span>
                  <span className="meal-group-kcal">{Math.round(group.entries.reduce((s, e) => s + e.kcal, 0))} kcal</span>
                </div>
                <div className="grid-table">
                  <div className="grid-head">
                    <span className="grid-col-name">Lebensmittel</span>
                    <span className="grid-col-m">Prot.</span>
                    <span className="grid-col-m">Kh.</span>
                    <span className="grid-col-m">Fett</span>
                    <span className="grid-col-m hide-sm">kJ</span>
                    <span className="grid-col-k">kcal</span>
                    <span className="grid-col-del" />
                  </div>
                  {group.entries.map(entry => (
                    <div key={entry.id} className="grid-row">
                      <span className="grid-col-name">
                        <span className="grid-name-text">
                          {entry.name}{entry.amount !== 100 && ` (${Math.round(entry.amount)}g)`}
                        </span>
                      </span>
                      <span className="grid-col-m">{r(entry.protein)}</span>
                      <span className="grid-col-m">{r(entry.carbs)}</span>
                      <span className="grid-col-m">{r(entry.fat)}</span>
                      <span className="grid-col-m hide-sm">{kj(entry.kcal)}</span>
                      <span className="grid-col-k">{Math.round(entry.kcal)}</span>
                      <span className="grid-col-del"><button className="del-btn" aria-label={`${entry.name} löschen`} onClick={() => deleteEntry(entry.id)}>×</button></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!logLoading && log.length > 0 && (
              <div className="summary-table">
                <div className="summary-row head">
                  <span className="grid-col-name">Summen</span>
                  <span className="grid-col-m">Prot.</span>
                  <span className="grid-col-m">Kh.</span>
                  <span className="grid-col-m">Fett</span>
                  <span className="grid-col-m hide-sm">kJ</span>
                  <span className="grid-col-k">kcal</span>
                  <span className="grid-col-del" />
                </div>
                {grouped.map(g => {
                  const s = g.entries.reduce((acc, e) => ({
                    kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat,
                  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
                  return (
                    <div className="summary-row" key={g.key}>
                      <span className="grid-col-name"><span className="grid-name-text">{g.label}</span></span>
                      <span className="grid-col-m">{r(s.protein)}</span>
                      <span className="grid-col-m">{r(s.carbs)}</span>
                      <span className="grid-col-m">{r(s.fat)}</span>
                      <span className="grid-col-m hide-sm">{kj(s.kcal)}</span>
                      <span className="grid-col-k">{Math.round(s.kcal)}</span>
                      <span className="grid-col-del" />
                    </div>
                  )
                })}
                <div className="summary-row total">
                  <span className="grid-col-name"><span className="grid-name-text">Tagessumme</span></span>
                  <span className="grid-col-m">{r(totals.protein)}</span>
                  <span className="grid-col-m">{r(totals.carbs)}</span>
                  <span className="grid-col-m">{r(totals.fat)}</span>
                  <span className="grid-col-m hide-sm">{kj(totals.kcal)}</span>
                  <span className="grid-col-k">{Math.round(totals.kcal)}</span>
                  <span className="grid-col-del" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {scannerOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />
        </Suspense>
      )}
      {pendingItem && (
        <ItemModal
          item={pendingItem.item}
          fromOFF={pendingItem.fromOFF}
          meal={meal}
          showMeal
          onConfirm={confirmItemModal}
          onClose={() => setPendingItem(null)}
        />
      )}
    </>
  )
}
