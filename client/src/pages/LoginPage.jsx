import { Link } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm.jsx'
import styles from './AuthPage.module.css'

function LoginPage() {
  return( 
    <div className={styles.card}>
      <h1>Login</h1>
      <LoginForm />
      <p className={styles.switch}>No account? <Link to="/signup">Sign Up</Link></p>
    </div>
  )
}

export default LoginPage
