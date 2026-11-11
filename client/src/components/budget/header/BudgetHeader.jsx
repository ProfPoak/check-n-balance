import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../../api.js'
import BudgetEditForm from './BudgetEditForm.jsx'
import BudgetSelector from './BudgetSelector.jsx'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/header/BudgetHeader.module.css'

function BudgetHeader({ budget, onBudgetChange }) {
  const [budgets, setBudgets] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // The selector's list. On failure budgets stays null and the selector is hidden.
  useEffect(() => {
    let ignore = false
    apiFetch('/budgets').then(res => {
      if (!ignore && res.ok) {
        setBudgets(res.data)
      }
    })
    return () => {
      ignore = true
    }
  }, [])

  function handleSaved(data) {
    onBudgetChange({
      id: data.id,
      title: data.title,
      description: data.description,
      balance_as_of: data.balance_as_of,
    })
    setBudgets((list) => list && list.map((b) => (b.id === data.id ? { ...b, title: data.title } : b)))
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this budget?')) {
      return
    }
    setError(null)
    const res = await apiFetch(`/budgets/${budget.id}`, { method: 'DELETE' })
    if (res.ok) {
      navigate('/')
    }
    else {
      setError(res.data ?? {})
    }
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{budget.title}</h1>
      {budgets && <BudgetSelector className={styles.selector} budgets={budgets} currentId={String(budget.id)} />}
      {editing ? (
        <BudgetEditForm className={styles.fullRow} budget={budget} onSaved={handleSaved} onCancel={() => setEditing(false)} />
      ) : (
        <button onClick={() => setEditing(true)}>Edit budget</button>
      )}
      <button className={styles.danger} onClick={handleDelete}>Delete budget</button>
      <div className={styles.fullRow}>
        <ErrorMessage data={error} />
      </div>
    </header>
  )
}

export default BudgetHeader
