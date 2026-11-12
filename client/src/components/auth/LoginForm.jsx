import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import styles from '../../styles/auth/AuthForm.module.css'
import { useBusy } from '../../hooks/useBusy.js'

function LoginForm() {
  const{ login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, whileBusy] = useBusy()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const res = await whileBusy(() => login(email, password))
    if (res.ok) {
      navigate('/')
    }
    else {
      setError(res.data ?? {})
    }
  }

  return(
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label htmlFor="password">Password</label>
      <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <ErrorMessage data={error} />
      <button type="submit" disabled={busy}>Log in</button>
    </form>      
  )
}

export default LoginForm
