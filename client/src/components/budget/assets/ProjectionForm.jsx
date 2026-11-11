import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'

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
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="project-to">Project to</label>
      <input id="project-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button type="submit">Calculate All</button>
      <ErrorMessage data={error} />

      {result && (
        <div>
          <p>Balances as of {formatDate(result.as_of)}</p>
          <p>Starting balance: {formatMoney(result.starting_balance)}</p>
          <p>Net change: {formatMoney(result.net)}</p>
          <p>Projected balance: {formatMoney(result.projected_balance)}</p>
        </div>
      )}
    </form>
  )
}

export default ProjectionForm
