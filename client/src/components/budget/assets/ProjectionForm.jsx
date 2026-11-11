import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/assets/ProjectionForm.module.css'

// Under the asset list: "Project to" date + Calculate All → GET /budgets/:id/projection?to=...
// AssetsPanel renders it with key={version}, so any item, asset or budget change throws the old result away.
// Props: budgetId
function ProjectionForm({ budgetId }) {
  const [to, setTo] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    // A blank date still goes to the server (as "?to="), so its message shows
    const res = await apiFetch(`/budgets/${budgetId}/projection?to=${to}`)
    if (res.ok) {
      setResult(res.data)
    }
    else {
      setResult(null)
      setError(res.data ?? {})
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="project-to">Project to</label>
      <input id="project-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button type="submit">Calculate All</button>
      <ErrorMessage data={error} />

      {result && (
        <div className={styles.result}>
          <p className={styles.asOf}>Balances as of {formatDate(result.as_of)}</p>
          <p className={styles.line}>
            Starting balance: <span className={styles.value}>{formatMoney(result.starting_balance)}</span>
          </p>
          <p className={styles.line}>
            Net change: <span className={`${styles.value} ${Number(result.net) < 0 ? styles.negative : ''}`}>{formatMoney(result.net)}</span>
          </p>
          <p className={`${styles.line} ${styles.total}`}>
            Projected balance: <span className={`${styles.value} ${Number(result.projected_balance) < 0 ? styles.negative : ''}`}>{formatMoney(result.projected_balance)}</span>
          </p>
        </div>
      )}
    </form>
  )
}

export default ProjectionForm
