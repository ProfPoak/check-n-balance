import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api.js'
import BudgetList from '../components/home/BudgetList.jsx'
import ErrorMessage from '../components/shared/ErrorMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import styles from '../styles/pages/HomePage.module.css'

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
    <div className={styles.page}>
      <h1>Welcome, {user.email}</h1>
      <p className={styles.intro}>
        Check'N Balance turns your income, bills and account balances into a timeline,
        so you can see where your money is headed.
      </p>

      <div className={styles.newRow}>
        <button id="new-budget" className={styles.newButton} aria-label="New budget" onClick={handleNew} disabled={creating}>+</button>
        <label htmlFor="new-budget" className={styles.newLabel}>Start new budget</label>
      </div>
      <ErrorMessage data={error} />

      {budgets ? (
        <BudgetList budgets={budgets} />
      ) : (
        !error && <p className={styles.loading}>Loading budgets...</p>
      )}
    </div>
  )
}

export default HomePage
