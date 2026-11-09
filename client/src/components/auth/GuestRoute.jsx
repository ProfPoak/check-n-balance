import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function GuestRoute() {
  const { user, checkingSession } = useAuth()

  if (checkingSession) {
    return <p>Loading...</p>
  }
  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default GuestRoute
