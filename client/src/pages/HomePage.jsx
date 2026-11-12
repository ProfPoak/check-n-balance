import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api.js'
import BudgetList from '../components/home/BudgetList.jsx'
import ErrorMessage from '../components/shared/ErrorMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import styles from '../styles/pages/HomePage.module.css'
import { useBusy } from '../hooks/useBusy.js'

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [budgets, setBudgets] = useState(null)
  const [error, setError] = useState(null)
  const [busy, whileBusy] = useBusy()

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
    const res = await whileBusy(() => apiFetch('/budgets', { method: 'POST', body: {} }))
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

      <button className={styles.newButton} onClick={handleNew} disabled={busy}>
        Start new budget
        <span className={styles.plus} aria-hidden="true"></span>
      </button>
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
