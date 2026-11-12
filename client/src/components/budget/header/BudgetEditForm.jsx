import { useState } from 'react'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/header/BudgetEditForm.module.css'
import { useRequest } from '../../../hooks/useRequest.js'

function BudgetEditForm({ budget, onSaved, onCancel, className }) {
  const [title, setTitle] = useState(budget.title)
  const [description, setDescription] = useState(budget.description ?? '')
  const [balanceAsOf, setBalanceAsOf] = useState(budget.balance_as_of)
  const { busy, error, send } = useRequest()

  async function handleSubmit(e) {
    e.preventDefault()
    const res = await send(`/budgets/${budget.id}`, {
      method: 'PATCH',
      body: { title, description, balance_as_of: balanceAsOf },
    })
    if (res.ok) {
      onSaved(res.data)
    }
  }

  return (
    <form className={`${styles.form} ${className ?? ''}`} onSubmit={handleSubmit} noValidate>
      <label className={styles.wide}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={styles.wide}>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Balance as of
        <input type="date" value={balanceAsOf} onChange={(e) => setBalanceAsOf(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
      <ErrorMessage data={error} />
    </form>
  )
}

export default BudgetEditForm
