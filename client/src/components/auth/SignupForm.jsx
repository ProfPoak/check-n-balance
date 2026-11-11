import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'

function SignupForm() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError({error: 'Passwords do not match'})
      return
    }
    setSubmitting(true)
    const res = await signup(email, password)
    setSubmitting(false)
    if (res.ok) {
      navigate('/')
    }
    else {
      setError(res.data ?? {})
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label htmlFor="password">Password</label>
      <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <label htmlFor="confirm-password">Confirm password</label>
      <input type="password" id="confirm-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

      <ErrorMessage data={error} />
      <button type="submit" disabled={submitting}>Sign up</button>
    </form>
  )
}

export default SignupForm
