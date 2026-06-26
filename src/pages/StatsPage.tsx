import { useState, useEffect, useCallback } from 'react'
import { supabase, r, dateKey } from '../lib/supabase'

interface Props {
  userId: string
  onJumpToDay: (date: Date) => void
}

interface DayStats {
  date: Date
  kcal: number
  protein: number
  carbs: number
  fat: number
  hasData: boolean
}

export default function StatsPage({ userId, onJumpToDay }: Props) {
  const [range, setRange] = useState(7)
  const [days, setDays] = useState<DayStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const from = new Date(); from.setHours(0,0,0,0); from.setDate(from.getDate() - (range - 1))
    const { data } = await supabase
      .from('food_log')
      .select('date, kcal, protein, carbs, fat')
      .eq('user_id', userId)
      .gte('date', dateKey(from))
      .lte('date', dateKey(new Date()))
    const entries = (data ?? []) as { date: string; kcal: number; protein: number; carbs: number; fat: number }[]

    const result: DayStats[] = []
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i)
      const key = dateKey(d)
      const dayEntries = entries.filter(e => e.date === key)
      const kcal = dayEntries.reduce((s, e) => s + e.kcal, 0)
      const protein = dayEntries.reduce((s, e) => s + e.protein, 0)
      const carbs = dayEntries.reduce((s, e) => s + e.carbs, 0)
      const fat = dayEntries.reduce((s, e) => s + e.fat, 0)
      result.push({ date: d, kcal, protein, carbs, fat, hasData: dayEntries.length > 0 })
    }
    setDays(result)
    setLoading(false)
  }, [userId, range])

  useEffect(() => { fetchStats() }, [fetchStats])

  const withData = days.filter(d => d.hasData)
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
  const avgR = (arr: number[]) => arr.length ? r(arr.reduce((s, v) => s + v, 0) / arr.length) : null

  const avgKcal = avg(withData.map(d => d.kcal))
  const avgP = avgR(withData.map(d => d.protein))
  const avgC = avgR(withData.map(d => d.carbs))
  const avgF = avgR(withData.map(d => d.fat))

  const maxKcal = Math.max(...days.map(d => d.kcal), 1)
  const chartDays = days.slice(-Math.min(range, 14))
  const histDays = [...days].reverse().filter(d => d.hasData)

  return (
    <>
      <div className="stats-range">
        {([7, 14, 30] as const).map(n => (
          <button key={n} className={`range-btn${range === n ? ' active' : ''}`} onClick={() => setRange(n)}>{n} Tage</button>
        ))}
      </div>

      <div className="section-heading">Durchschnitt (Tage mit Einträgen)</div>
      <div className="stats-avg-grid">
        <div className="avg-card"><div className="avg-label">Ø Kalorien</div><div className="avg-val">{avgKcal ?? '—'}</div><div className="avg-unit">kcal</div></div>
        <div className="avg-card"><div className="avg-label">Ø Protein</div><div className="avg-val">{avgP ?? '—'}</div><div className="avg-unit">g</div></div>
        <div className="avg-card"><div className="avg-label">Ø Kohlenhydr.</div><div className="avg-val">{avgC ?? '—'}</div><div className="avg-unit">g</div></div>
        <div className="avg-card"><div className="avg-label">Ø Fett</div><div className="avg-val">{avgF ?? '—'}</div><div className="avg-unit">g</div></div>
      </div>

      <div className="bar-chart">
        <div className="bar-chart-title">Kalorien pro Tag</div>
        {loading ? <p className="loading-msg">Lädt…</p> : (
          <div className="bars">
            {chartDays.map((day, i) => {
              const h = day.kcal > 0 ? Math.max((day.kcal / maxKcal) * 100, 4) : 2
              const label = day.date.toLocaleDateString('de-DE', { weekday: 'short' })
              return (
                <div key={i} className="bar-col">
                  {day.kcal > 0 && <div className="bar-val">{Math.round(day.kcal)}</div>}
                  <div className="bar-fill" style={{ height: `${h}%`, opacity: day.hasData ? .85 : .2 }} />
                  <div className="bar-label">{label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="section-heading">Verlauf</div>
      <div className="card" style={{ padding: '.5rem 1.25rem' }}>
        {loading ? <p className="loading-msg">Lädt…</p>
          : !histDays.length ? <p className="empty">Keine Daten im gewählten Zeitraum.</p>
          : histDays.map((day, i) => (
            <div key={i} className="history-row" onClick={() => onJumpToDay(day.date)}>
              <span className="history-date">{day.date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>
              <span className="history-kcal">{Math.round(day.kcal)} kcal</span>
              <span className="history-macros">{r(day.protein)}P · {r(day.carbs)}Kh · {r(day.fat)}F</span>
              <span className="history-arrow">›</span>
            </div>
          ))}
      </div>
    </>
  )
}
