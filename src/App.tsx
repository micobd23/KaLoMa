import { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, dateKey, formatDate } from './lib/supabase'
import { useToast } from './components/ToastProvider'
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
  const [kcalGoal, setKcalGoal] = useState<number | null>(null)
  const [logRefreshKey, setLogRefreshKey] = useState(0)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [compact, setCompact] = useState(false)
  const menuBarRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!menuBarRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      kcal_goal: goal,
      updated_at: new Date().toISOString(),
    })
    if (error) { showToast('Fehler beim Speichern. Bitte Internetverbindung prüfen.', { type: 'error' }); return }
    setKcalGoal(goal)
    setSettingsOpen(false)
  }

  function handleJumpToDay(date: Date) {
    setTrackerDate(date)
    setTab('tracker')
  }

  function handleClose() {
    setOpenMenu(null)
    setLogoutConfirmOpen(true)
  }

  async function confirmLogout() {
    setLogoutConfirmOpen(false)
    const { error } = await supabase.auth.signOut()
    if (error) showToast('Abmelden fehlgeschlagen. Bitte Internetverbindung prüfen.', { type: 'error' })
  }

  function goTo(t: Tab) {
    setTab(t)
    setOpenMenu(null)
  }

  if (authLoading) return <div className="app-loading">🥗</div>
  if (!session) return <AuthPage />

  return (
    <div className={`app-shell${compact ? ' compact' : ''}`}>
      <div className="title-bar">
        <div className="traffic-lights">
          <button className="traffic-light red" title="Abmelden" onClick={handleClose} />
          <button className="traffic-light yellow" title="Einklappen" onClick={() => setCollapsed(c => !c)} />
          <button className="traffic-light green" title="Breite umschalten" onClick={() => setCompact(c => !c)} />
        </div>
        <div className="title-bar-title">KaLoMa 4.60 – {TAB_LABEL[tab]}</div>
      </div>

      {!collapsed && (
        <>
          <div className="menu-bar" ref={menuBarRef}>
            <div className={`menu-item${openMenu === 'datei' ? ' open' : ''}`}>
              <button className="menu-item-btn" onClick={() => setOpenMenu(m => m === 'datei' ? null : 'datei')}>Datei</button>
              {openMenu === 'datei' && (
                <div className="menu-dropdown">
                  <button onClick={handleClose}>Abmelden</button>
                </div>
              )}
            </div>
            <div className={`menu-item${openMenu === 'ansicht' ? ' open' : ''}`}>
              <button className="menu-item-btn" onClick={() => setOpenMenu(m => m === 'ansicht' ? null : 'ansicht')}>Ansicht</button>
              {openMenu === 'ansicht' && (
                <div className="menu-dropdown">
                  <button onClick={() => goTo('tracker')}>Tageslog</button>
                  <button onClick={() => goTo('stats')}>Statistik</button>
                  <button onClick={() => goTo('db')}>Kalorientabelle</button>
                </div>
              )}
            </div>
            <div className={`menu-item${openMenu === 'extras' ? ' open' : ''}`}>
              <button className="menu-item-btn" onClick={() => setOpenMenu(m => m === 'extras' ? null : 'extras')}>Extras</button>
              {openMenu === 'extras' && (
                <div className="menu-dropdown">
                  <button onClick={() => { setSettingsOpen(true); setOpenMenu(null) }}>Einstellungen…</button>
                </div>
              )}
            </div>
            <div className={`menu-item${openMenu === 'hilfe' ? ' open' : ''}`}>
              <button className="menu-item-btn" onClick={() => setOpenMenu(m => m === 'hilfe' ? null : 'hilfe')}>Hilfe</button>
              {openMenu === 'hilfe' && (
                <div className="menu-dropdown">
                  <button onClick={() => { setAboutOpen(true); setOpenMenu(null) }}>Über KaLoMa…</button>
                </div>
              )}
            </div>
          </div>

          <div className="tool-bar">
            <button className={`tool-btn${tab === 'tracker' ? ' active' : ''}`} title="Tageslog" onClick={() => setTab('tracker')}>📝</button>
            <button className={`tool-btn${tab === 'stats' ? ' active' : ''}`} title="Statistik" onClick={() => setTab('stats')}>📊</button>
            <button className={`tool-btn${tab === 'db' ? ' active' : ''}`} title="Kalorientabelle" onClick={() => setTab('db')}>🗂</button>
            <div className="tool-sep" />
            <button className="tool-btn" title="Einstellungen" onClick={() => setSettingsOpen(true)}>⚙</button>
            <button className="tool-btn" title="Über KaLoMa" onClick={() => setAboutOpen(true)}>❓</button>
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

          <div className="status-bar">
            <span>{TAB_LABEL[tab]}</span>
            {tab === 'tracker' && <span>{formatDate(trackerDate)}</span>}
            <span className="status-flex" />
            <span>Ziel: {kcalGoal ? 'AN' : 'AUS'}</span>
          </div>
        </>
      )}

      {settingsOpen && (
        <SettingsModal current={kcalGoal} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
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
