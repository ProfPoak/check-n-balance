import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import styles from '../../styles/auth/ProtectedRoute.module.css'

function ProtectedRoute() {
  const { user, checkingSession, sessionError, retrySession } = useAuth()

  if (checkingSession) {
    return <p className={`${styles.message} ${styles.loading}`}>Loading...</p>
  }
  if (sessionError) {
    return(
      <div className={styles.message}>
        <ErrorMessage data={sessionError} />
        <button onClick={retrySession}>Try again</button>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <Outlet />
}

export default ProtectedRoute
