import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import { formatDate, formatMoney } from '../../../utils/format.js'
import { recurrenceLabel } from '../../../utils/recurrence.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import CashFlowItemForm from './CashFlowItemForm.jsx'

function CashFlowItemRow({ item, onReplace, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)

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
    const res = await apiFetch(`/cash_flow_items/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      onRemove(item.id)
    }
    else {
      setError(res.data ?? {})
    }
  }

  if (editing) {
    return (
      <li>
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
    <li>
      <strong>{item.name}</strong>
      <span> {item.kind === 'income' ? 'Income' : 'Expense'}</span>
      <span> {formatMoney(item.amount)}</span>
      <span> {recurrenceLabel(item)}</span>
      <span> {formatDate(item.start_date)}</span>
      {item.end_date && <span> until {formatDate(item.end_date)}</span>}
      <button aria-label={`Edit ${item.name}`} onClick={() => setEditing(true)}>Edit</button>
      <button aria-label={`Delete ${item.name}`} onClick={handleDelete}>Delete</button>
      <ErrorMessage data={error} />
    </li>
  )
}

export default CashFlowItemRow
