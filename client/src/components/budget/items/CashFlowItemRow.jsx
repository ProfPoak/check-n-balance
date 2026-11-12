import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import { useBusy } from '../../../hooks/useBusy.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import { recurrenceLabel } from '../../../utils/recurrence.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import CashFlowItemForm from './CashFlowItemForm.jsx'
import styles from '../../../styles/budget/items/CashFlowItemRow.module.css'
import buttons from '../../../styles/shared/Buttons.module.css'

function CashFlowItemRow({ item, onReplace, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [busy, whileBusy] = useBusy()

  async function handleSave(body) {
    const res = await apiFetch(`/cash_flow_items/${item.id}`, { method: 'PATCH', body })
    if (res.ok) {
      onReplace(res.data)
      setEditing(false)
    }
    return res
  }

  async function handleDelete() {
    setError(null)
    const res = await whileBusy(() => apiFetch(`/cash_flow_items/${item.id}`, { method: 'DELETE' }))
    if (res.ok) {
      onRemove(item.id)
    }
    else {
      setError(res.data ?? {})
    }
  }

  if (editing) {
    return (
      <li className={styles.editing}>
        <CashFlowItemForm
          initial={item}
          submitLabel="Save"
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={styles.row}>
      <strong className={styles.name}>{item.name}</strong>
      <span className={styles.detail}> {item.kind === 'income' ? 'Income' : 'Expense'}</span>
      <span className={`${styles.amount} ${styles[item.kind]}`}> {formatMoney(item.amount)}</span>
      <span className={styles.detail}> {recurrenceLabel(item)}</span>
      <span className={styles.detail}> {formatDate(item.start_date)}</span>
      {item.end_date && <span className={styles.detail}> until {formatDate(item.end_date)}</span>}
      <button className={`${buttons.small} ${styles.edit}`} aria-label={`Edit ${item.name}`} onClick={() => setEditing(true)}>Edit</button>
      <button className={`${buttons.small} ${buttons.danger} ${styles.delete}`} aria-label={`Delete ${item.name}`} onClick={handleDelete} disabled={busy}>Delete</button>
      <ErrorMessage data={error} />
    </li>
  )
}

export default CashFlowItemRow
