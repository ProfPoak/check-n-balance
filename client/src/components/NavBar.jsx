import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

function NavBar() {
  const { user, checkingSession, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  async function handleLogout() {
    setError(null)
    const res = await logout()
    if (res.ok) {
      navigate('/login')
    }
    else {
      setError(res.data ?? {})
    }
  }

  if (checkingSession) {
    return <nav></nav>
  }

  return (
    <nav>
      {user ? (
        <>
          <Link to="/">Home</Link>
          <span>{user.email}</span>
          <button onClick={handleLogout}>Log out</button>
          <ErrorMessage data={error} />
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/signup">Signup</Link>
        </>
      )}
    </nav>
  )
}

export default NavBar
