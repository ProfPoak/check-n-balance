import { useState } from 'react'
import { useRequest } from '../../../hooks/useRequest.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import { recurrenceLabel } from '../../../utils/recurrence.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import CashFlowItemForm from './CashFlowItemForm.jsx'
import styles from '../../../styles/budget/items/CashFlowItemRow.module.css'
import buttons from '../../../styles/shared/Buttons.module.css'

function CashFlowItemRow({ item, onReplace, onRemove }) {
  const [editing, setEditing] = useState(false)
  const { busy, error, send } = useRequest()

  function handleSaved(saved) {
    onReplace(saved)
    setEditing(false)
  }

  async function handleDelete() {
    const res = await send(`/cash_flow_items/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      onRemove(item.id)
    }
  }

  if (editing) {
    return (
      <li className={styles.editing}>
        <CashFlowItemForm
          initial={item}
          submitLabel="Save"
          method="PATCH"
          path={`/cash_flow_items/${item.id}`}
          onSaved={handleSaved}
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
