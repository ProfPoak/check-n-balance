import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(null)

  function applySession(res) {
    if (res.ok) {
      setUser(res.data)
    }
    else if(res.status === 401) {
      setUser(null)
    }
    else {
      setSessionError(res.data ?? {})
    }
    setCheckingSession(false)
  }

  useEffect(() => {
    let ignore = false
    apiFetch('/check_session')
    .then(res => {
      if (!ignore) {
        applySession(res)
      }
    })

    return () => {
      ignore = true
    }
  }, [])

  function retrySession() {
    setSessionError(null)
    setCheckingSession(true)
    apiFetch('/check_session')
    .then(res => {
      applySession(res)
    })
  }

  async function login(email, password) {
    const res = await apiFetch('/login', {
      method: 'POST',
      body: { email, password }
    })
    if (res.ok) {
      setUser(res.data)
    }
    return res
  }

  async function signup(email, password) {
    const res = await apiFetch('/signup', {
      method: 'POST',
      body: { email, password }
    })
    if (res.ok) {
      setUser(res.data)
    }
    return res
  }

  async function logout() {
    const res = await apiFetch('/logout', {
      method: 'DELETE'
    })
    if (res.ok) {
      setUser(null)
    }
    return res
  }

  const value = { user, checkingSession, sessionError, retrySession, login, signup, logout }
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
