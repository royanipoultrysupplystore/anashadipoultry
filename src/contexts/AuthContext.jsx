import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

const STORAGE_KEY = 'anashadi_app_user'
const VERIFY_MS = 60 * 1000 // how often to re-check the DB session_version

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  refreshOwnSessionVersion: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load any stored session on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setLoading(false)
  }, [])

  function persist(u) {
    setUser(u)
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    else localStorage.removeItem(STORAGE_KEY)
  }

  function logout() {
    persist(null)
  }

  async function login(username, password) {
    // auth_login signature is unchanged — we fetch session_version separately.
    const { data, error } = await supabase.rpc('auth_login', {
      p_username: username,
      p_password: password,
    })
    if (error) {
      console.error('Login error:', error)
      return { ok: false, message: error.message }
    }
    if (!data || data.length === 0) {
      return { ok: false, message: 'Invalid username or password' }
    }
    // Strip the password hash — never persist it to localStorage
    const { password: _pw, ...safeUser } = data[0]
    // Follow-up read of the current session_version so we can detect a later bump.
    const { data: sv } = await supabase.from('app_users').select('session_version').eq('id', safeUser.id).single()
    safeUser.session_version = sv?.session_version ?? 1
    persist(safeUser)
    return { ok: true, user: safeUser }
  }

  // Compare the stored session_version against the DB; sign out on mismatch or if
  // the user row is gone (deleted). This is what makes a server-side bump kick a
  // browser off.
  async function verifySession(current) {
    if (!current?.id) return
    const { data, error } = await supabase.from('app_users').select('session_version').eq('id', current.id).single()
    if (error || !data) { logout(); return }
    if ((data.session_version ?? 1) !== (current.session_version ?? 1)) logout()
  }

  // Re-sync THIS browser's stored version to the DB — used after the admin bumps
  // their own version (e.g. changing their own password / "sign out everyone")
  // so the current browser doesn't kick itself off.
  async function refreshOwnSessionVersion() {
    if (!user?.id) return
    const { data } = await supabase.from('app_users').select('session_version').eq('id', user.id).single()
    if (data) persist({ ...user, session_version: data.session_version })
  }

  // Verify on mount, when the tab regains focus, and every VERIFY_MS.
  useEffect(() => {
    if (!user?.id) return
    verifySession(user)
    const onVisible = () => { if (document.visibilityState === 'visible') verifySession(user) }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => verifySession(user), VERIFY_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
    // Re-arm when identity or the known version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.session_version])

  const isAdmin = user?.role === 'admin'
  const isAssociate = user?.role === 'associate'
  const isEntity = user?.role === 'entity'
  const entityType = user?.entity_type || null
  const entityId = user?.entity_id || null

  // Where an entity user is confined to — their own detail page.
  const ENTITY_BASE = { client: '/clients', farm: '/farms', supplier: '/suppliers', saraf: '/sarafs' }
  const entityHome = isEntity && entityType && entityId ? `${ENTITY_BASE[entityType] || '/clients'}/${entityId}` : null

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshOwnSessionVersion, isAdmin, isAssociate, isEntity, entityType, entityId, entityHome }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
