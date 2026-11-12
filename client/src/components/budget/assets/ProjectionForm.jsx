import { useState } from 'react'
import { useRequest } from '../../../hooks/useRequest.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/assets/ProjectionForm.module.css'

// AssetsPanel renders this with key={version}, so any budget change throws away a stale result.
function ProjectionForm({ budgetId }) {
  const [to, setTo] = useState('')
  const [result, setResult] = useState(null)
  const { busy, error, send } = useRequest()

  async function handleSubmit(e) {
    e.preventDefault()
    // A blank date is still sent (as "?to=") so the server returns its message
    const res = await send(`/budgets/${budgetId}/projection?to=${to}`)
    setResult(res.ok ? res.data : null)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="project-to">Project to</label>
      <input id="project-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button type="submit" disabled={busy}>Calculate All</button>
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
