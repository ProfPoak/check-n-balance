import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBusy } from '../../hooks/useBusy.js'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import styles from '../../styles/layout/NavBar.module.css'

function NavBar() {
  const { user, checkingSession, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [busy, whileBusy] = useBusy()

  async function handleLogout() {
    setError(null)
    const res = await whileBusy(logout)
    if (res.ok) {
      navigate('/login')
    }
    else {
      setError(res.data ?? {})
    }
  }

  if (checkingSession) {
    return <nav className={styles.nav}></nav>
  }

  return (
    <nav className={styles.nav}>
      {user ? (
        <>
          <Link to="/" className={styles.brand}>Check'N Balance</Link>
          <span className={`${styles.email} ${styles.pushRight}`}>{user.email}</span>
          <button onClick={handleLogout} disabled={busy}>Log out</button>
          <ErrorMessage data={error} />
        </>
      ) : (
        <>
          <Link to="/login" className={`${styles.link} ${styles.pushRight}`}>Login</Link>
          <Link to="/signup" className={styles.link}>Signup</Link>
        </>
      )}
    </nav>
  )
}

export default NavBar
