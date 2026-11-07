import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api.js'
import BudgetList from '../components/BudgetList.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [budgets, setBudgets] = useState(null)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let ignore = false
    apiFetch('/budgets')
    .then(res => {
      if (ignore) {
        return
      }
      if (res.ok) {
        setBudgets(res.data)
      }
      else {
        setError(res.data ?? {})
      }
    })

    return () => {
      ignore = true
    }
  }, [])

  async function handleNew() {
    setError(null)
    setCreating(true)
    const res = await apiFetch('/budgets', { method: 'POST', body: {} })
    setCreating(false)
    if (res.ok) {
      navigate(`/budgets/${res.data.id}`)
    }
    else {
      setError(res.data ?? {})
    }
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>
        Check'N Balance turns your income, bills and account balances into a timeline,
        so you can see where your money is headed. Open a budget, or start a new one with +.
      </p>

      <button aria-label="New budget" onClick={handleNew} disabled={creating}>+</button>
      <ErrorMessage data={error} />

      {budgets ? (
        <BudgetList budgets={budgets} />
      ) : (
        !error && <p>Loading budgets...</p>
      )}
    </div>
  )
}

export default HomePage
