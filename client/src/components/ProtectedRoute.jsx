import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

function ProtectedRoute() {
  const { user, checkingSession, sessionError, retrySession } = useAuth()

  if (checkingSession) {
    return <p>Loading...</p>
  }
  if (sessionError) {
    return(
      <>
        <ErrorMessage data={sessionError} />
        <button onClick={retrySession}>Try again</button>
      </>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <Outlet />
}

export default ProtectedRoute
