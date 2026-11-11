import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'

function BudgetEditForm({ budget, onSaved, onCancel }) {
  const [title, setTitle] = useState(budget.title)
  const [description, setDescription] = useState(budget.description ?? '')
  const [balanceAsOf, setBalanceAsOf] = useState(budget.balance_as_of)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await apiFetch(`/budgets/${budget.id}`, {
      method: 'PATCH',
      body: { title, description, balance_as_of: balanceAsOf },
    })
    setSaving(false)
    if (res.ok) {
      onSaved(res.data)
    }
    else {
      setError(res.data ?? {})
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Balance as of
        <input type="date" value={balanceAsOf} onChange={(e) => setBalanceAsOf(e.target.value)} />
      </label>
      <button type="submit" disabled={saving}>Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
      <ErrorMessage data={error} />
    </form>
  )
}

export default BudgetEditForm
