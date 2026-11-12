import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import styles from '../../styles/auth/AuthForm.module.css'
import { useBusy } from '../../hooks/useBusy.js'

function SignupForm() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, whileBusy] = useBusy()
  const [confirm, setConfirm] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError({error: 'Passwords do not match'})
      return
    }
    const res = await whileBusy(() => signup(email, password))
    if (res.ok) {
      navigate('/')
    }
    else {
      setError(res.data ?? {})
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label htmlFor="password">Password</label>
      <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <label htmlFor="confirm-password">Confirm password</label>
      <input type="password" id="confirm-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

      <ErrorMessage data={error} />
      <button type="submit" disabled={busy}>Sign up</button>
    </form>
  )
}

export default SignupForm
