import { Link } from 'react-router-dom'
import LoginForm from '../components/auth/LoginForm.jsx'

function LoginPage() {
  return( 
    <div>
      <h1>Login</h1>
      <LoginForm />
      <p>No account? <Link to="/signup">Sign Up</Link></p>
    </div>
  )
}

export default LoginPage
