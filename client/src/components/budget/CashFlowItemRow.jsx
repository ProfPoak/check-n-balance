import { useState } from 'react'
import { apiFetch } from '../../api.js'
import { formatDate } from '../../utils/format.js'
import { recurrenceLabel } from '../../utils/recurrence.js'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import CashFlowItemForm from './CashFlowItemForm.jsx'

function CashFlowItemRow({ item, onReplace, onRemove }) {
  return (
    <li>
      <strong>{item.name}</strong>
      <span> {item.kind === 'income' ? 'Income' : 'Expense'}</span>
      <span> ${item.amount}</span>
      <span> {recurrenceLabel(item)}</span>
      <span> {formatDate(item.start_date)}</span>
      {item.end_date && <span> until {formatDate(item.end_date)}</span>}
      <button aria-label={`Edit ${item.name}`}>Edit</button>
      <button aria-label={`Delete ${item.name}`}>Delete</button>
    </li>
  )
}

export default CashFlowItemRow
