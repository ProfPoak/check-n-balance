import { Link } from 'react-router-dom'
import SignupForm from '../components/SignupForm.jsx'

function SignupPage() {
  return( 
    <div>
      <h1>Signup</h1>
      <SignupForm />
      <p>Have an account? <Link to="/login">Log in</Link></p>
    </div>
  )
}

export default SignupPage
