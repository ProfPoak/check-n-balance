import { Link } from 'react-router-dom'
import SignupForm from '../components/auth/SignupForm.jsx'
import styles from './AuthPage.module.css'

function SignupPage() {
  return( 
    <div className={styles.card}>
      <h1>Signup</h1>
      <SignupForm />
      <p className={styles.switch}>Have an account? <Link to="/login">Log in</Link></p>
    </div>
  )
}

export default SignupPage
