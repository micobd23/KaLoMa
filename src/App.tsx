import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, dateKey } from './lib/supabase'
import AuthPage from './components/AuthPage'
import SettingsModal from './components/SettingsModal'
import TrackerPage from './pages/TrackerPage'
import StatsPage from './pages/StatsPage'
import DatabasePage from './pages/DatabasePage'

type Tab = 'tracker' | 'stats' | 'db'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('tracker')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [kcalGoal, setKcalGoal] = useState<number | null>(null)
  const [logRefreshKey, setLogRefreshKey] = useState(0)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [trackerDate, setTrackerDate] = useState(today)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
      if (data.session) loadSettings(data.session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (s) loadSettings(s.user.id)
      else setKcalGoal(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadSettings(userId: string) {
    const { data } = await supabase
      .from('user_settings')
      .select('kcal_goal')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) setKcalGoal(data.kcal_goal ?? null)
  }

  async function saveSettings(goal: number | null) {
    if (!session) return
    await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      kcal_goal: goal,
      updated_at: new Date().toISOString(),
    })
    setKcalGoal(goal)
    setSettingsOpen(false)
  }

  function handleJumpToDay(date: Date) {
    setTrackerDate(date)
    setTab('tracker')
  }

  if (authLoading) return <div className="app-loading">🥗</div>
  if (!session) return <AuthPage />

  return (
    <>
      <header>
        <h1>🥗 KaLoMa</h1>
        <button className="header-btn" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">⚙</button>
      </header>

      <div className="tab-bar">
        <button className={`tab${tab === 'tracker' ? ' active' : ''}`} onClick={() => setTab('tracker')}>Tageslog</button>
        <button className={`tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>Statistik</button>
        <button className={`tab${tab === 'db' ? ' active' : ''}`} onClick={() => setTab('db')}>Datenbank</button>
      </div>

      <main>
        {tab === 'tracker' && (
          <TrackerPage
            key={logRefreshKey}
            userId={session.user.id}
            kcalGoal={kcalGoal}
            date={trackerDate}
            onDateChange={setTrackerDate}
          />
        )}
        {tab === 'stats' && (
          <StatsPage userId={session.user.id} onJumpToDay={handleJumpToDay} />
        )}
        {tab === 'db' && (
          <DatabasePage
            userId={session.user.id}
            meal="frühstück"
            currentDate={dateKey(trackerDate)}
            onLogUpdate={() => { setLogRefreshKey(k => k + 1); setTab('tracker') }}
          />
        )}
      </main>

      {settingsOpen && (
        <SettingsModal current={kcalGoal} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  )
}
