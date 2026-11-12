import { useNavigate } from 'react-router-dom'
import BudgetList from '../components/home/BudgetList.jsx'
import ErrorMessage from '../components/shared/ErrorMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import styles from '../styles/pages/HomePage.module.css'
import { useFetch } from '../hooks/useFetch.js'
import { useRequest } from '../hooks/useRequest.js'

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: budgets, error: loadError } = useFetch('/budgets')
  const { busy, error, send } = useRequest()

  async function handleNew() {
    const res = await send('/budgets', { method: 'POST', body: {} })
    if (res.ok) {
      navigate(`/budgets/${res.data.id}`)
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
      <ErrorMessage data={error ?? loadError} />

      {budgets ? (
        <BudgetList budgets={budgets} />
      ) : (
        !loadError && <p className={styles.loading}>Loading budgets...</p>
      )}
    </div>
  )
}

export default HomePage
