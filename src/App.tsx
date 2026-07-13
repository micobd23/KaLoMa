import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, dateKey, formatDate } from './lib/supabase'
import type { Goals } from './lib/supabase'

const EMPTY_GOALS: Goals = { kcal: null, protein: null, carbs: null, fat: null }
import { useToast } from './components/ToastProvider'
import { useEscapeKey } from './lib/useEscapeKey'
import AuthPage from './components/AuthPage'
import SettingsModal from './components/SettingsModal'
import AboutDialog from './components/AboutDialog'
import TrackerPage from './pages/TrackerPage'
import StatsPage from './pages/StatsPage'
import DatabasePage from './pages/DatabasePage'

type Tab = 'tracker' | 'stats' | 'db'

const TAB_LABEL: Record<Tab, string> = {
  tracker: 'Tageslog',
  stats: 'Statistik',
  db: 'Kalorientabelle',
}

export default function App() {
  const { showToast } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('tracker')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [goals, setGoals] = useState<Goals>(EMPTY_GOALS)
  const [logRefreshKey, setLogRefreshKey] = useState(0)

  const [collapsed, setCollapsed] = useState(false)
  const [compact, setCompact] = useState(false)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [trackerDate, setTrackerDate] = useState(today)

  useEscapeKey(useCallback(() => setLogoutConfirmOpen(false), []))

  const loadSettings = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('kcal_goal, protein_goal, carbs_goal, fat_goal')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) { showToast('Einstellungen konnten nicht geladen werden. Bitte Internetverbindung prüfen.', { type: 'error' }); return }
    if (data) setGoals({
      kcal: data.kcal_goal ?? null,
      protein: data.protein_goal ?? null,
      carbs: data.carbs_goal ?? null,
      fat: data.fat_goal ?? null,
    })
  }, [showToast])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
      if (data.session) loadSettings(data.session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (s) loadSettings(s.user.id)
      else setGoals(EMPTY_GOALS)
    })
    return () => subscription.unsubscribe()
  }, [loadSettings])

  // Notify when a newly deployed service worker takes over an already-open tab
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const hadController = !!navigator.serviceWorker.controller
    function onControllerChange() {
      if (hadController) {
        showToast('Neue Version verfügbar.', {
          persist: true,
          action: { label: 'Neu laden', onClick: () => window.location.reload() },
        })
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [showToast])

  async function saveSettings(next: Goals) {
    if (!session) return
    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      kcal_goal: next.kcal,
      protein_goal: next.protein,
      carbs_goal: next.carbs,
      fat_goal: next.fat,
      updated_at: new Date().toISOString(),
    })
    if (error) { showToast('Fehler beim Speichern. Bitte Internetverbindung prüfen.', { type: 'error' }); return }
    setGoals(next)
    setSettingsOpen(false)
  }

  function handleJumpToDay(date: Date) {
    setTrackerDate(date)
    setTab('tracker')
  }

  function handleClose() {
    setLogoutConfirmOpen(true)
  }

  async function confirmLogout() {
    setLogoutConfirmOpen(false)
    const { error } = await supabase.auth.signOut()
    if (error) showToast('Abmelden fehlgeschlagen. Bitte Internetverbindung prüfen.', { type: 'error' })
  }

  if (authLoading) return <div className="app-loading">🥗</div>
  if (!session) return <AuthPage />

  return (
    <div className={`app-shell${compact ? ' compact' : ''}`}>
      <div className="title-bar">
        <div className="traffic-lights">
          <button className="traffic-light red" title="Abmelden" aria-label="Abmelden" onClick={handleClose} />
          <button className="traffic-light yellow" title="Einklappen" aria-label="Einklappen" onClick={() => setCollapsed(c => !c)} />
          <button className="traffic-light green" title="Breite umschalten" aria-label="Breite umschalten" onClick={() => setCompact(c => !c)} />
        </div>
        <div className="title-bar-title">KaLoMa 4.60 – {TAB_LABEL[tab]}</div>
      </div>

      {!collapsed && (
        <>
          <div className="tool-bar">
            <button className={`tool-btn tool-tab${tab === 'tracker' ? ' active' : ''}`} title="Tageslog" aria-label="Tageslog" onClick={() => setTab('tracker')}>📝</button>
            <button className={`tool-btn tool-tab${tab === 'stats' ? ' active' : ''}`} title="Statistik" aria-label="Statistik" onClick={() => setTab('stats')}>📊</button>
            <button className={`tool-btn tool-tab${tab === 'db' ? ' active' : ''}`} title="Kalorientabelle" aria-label="Kalorientabelle" onClick={() => setTab('db')}>🗂</button>
            <div className="tool-sep tool-tab" />
            <button className="tool-btn" title="Einstellungen" aria-label="Einstellungen" onClick={() => setSettingsOpen(true)}>⚙</button>
            <button className="tool-btn" title="Über KaLoMa" aria-label="Über KaLoMa" onClick={() => setAboutOpen(true)}>❓</button>
          </div>

          <main>
            {tab === 'tracker' && (
              <TrackerPage
                key={logRefreshKey}
                userId={session.user.id}
                goals={goals}
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

          <div className="status-bar">
            <span>{TAB_LABEL[tab]}</span>
            {tab === 'tracker' && <span>{formatDate(trackerDate)}</span>}
            <span className="status-flex" />
            <span>Ziel: {goals.kcal ? 'AN' : 'AUS'}</span>
          </div>

          <nav className="bottom-nav">
            <button className={tab === 'tracker' ? 'active' : ''} onClick={() => setTab('tracker')}>
              <span className="bn-icon">📝</span><span className="bn-label">Tageslog</span>
            </button>
            <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
              <span className="bn-icon">📊</span><span className="bn-label">Statistik</span>
            </button>
            <button className={tab === 'db' ? 'active' : ''} onClick={() => setTab('db')}>
              <span className="bn-icon">🗂</span><span className="bn-label">Tabelle</span>
            </button>
          </nav>
        </>
      )}

      {settingsOpen && (
        <SettingsModal current={goals} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {logoutConfirmOpen && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setLogoutConfirmOpen(false)}>
          <div className="modal">
            <h3>KaLoMa schließen und abmelden?</h3>
            <div className="modal-btns">
              <button className="btn" onClick={() => setLogoutConfirmOpen(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={confirmLogout}>Abmelden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
