import { useState, useEffect, useCallback } from 'react'
import { supabase, r } from '../lib/supabase'
import type { FoodItem } from '../lib/supabase'
import ItemModal from '../components/ItemModal'

interface Props {
  userId: string
  meal: string
  currentDate: string
  onLogUpdate: () => void
}

export default function DatabasePage({ userId, meal, currentDate, onLogUpdate }: Props) {
  const [db, setDb] = useState<(FoodItem & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [pendingItem, setPendingItem] = useState<FoodItem | null>(null)

  const fetchDb = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('food_db')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setDb((data as any[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchDb() }, [fetchDb])

  async function addItem() {
    if (!name.trim()) return
    await supabase.from('food_db').insert({
      user_id: userId,
      name: name.trim(),
      kcal: parseFloat(kcal) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    })
    setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat('')
    fetchDb()
  }

  async function deleteItem(id: string) {
    await supabase.from('food_db').delete().eq('id', id)
    setDb(prev => prev.filter(i => i.id !== id))
  }

  async function confirmAdd(item: FoodItem, amount: number) {
    const fac = amount / 100
    await supabase.from('food_log').insert({
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
    setPendingItem(null)
    onLogUpdate()
  }

  return (
    <>
      <div className="section-heading">
        Neues Lebensmittel anlegen
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text3)', fontSize: 10, marginLeft: 6 }}>· Werte pro 100g</span>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
          <div className="field">
            <label>Fett (g)</label>
            <input type="number" value={fat} onChange={e => setFat(e.target.value)} placeholder="0" min={0} style={{ width: 100 }} />
          </div>
          <button className="btn btn-primary" onClick={addItem} style={{ alignSelf: 'flex-end' }}>+ Speichern</button>
        </div>
      </div>

      <div className="section-heading">Gespeicherte Lebensmittel</div>
      <div className="card" style={{ padding: '.5rem 1.25rem' }}>
        <div className="col-headers">
          <span className="col-name">Name</span>
          <span className="col-m">Prot.</span>
          <span className="col-m">Kh.</span>
          <span className="col-m">Fett</span>
          <span className="col-k">kcal/100g</span>
          <span style={{ width: 64 }} />
          <span className="col-del" />
        </div>
        {loading ? (
          <p className="loading-msg">Lädt…</p>
        ) : !db.length ? (
          <p className="empty">Noch keine Lebensmittel angelegt.</p>
        ) : db.map(item => (
          <div key={item.id} className="db-row">
            <span className="db-name">{item.name}</span>
            <span className="db-macro">{r(item.protein)}g</span>
            <span className="db-macro">{r(item.carbs)}g</span>
            <span className="db-macro">{r(item.fat)}g</span>
            <span className="db-kcal">{Math.round(item.kcal)} kcal</span>
            <button className="db-add-btn" onClick={() => setPendingItem(item)}>+ ins Log</button>
            <button className="del-btn" onClick={() => deleteItem(item.id)}>×</button>
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
    </>
  )
}
