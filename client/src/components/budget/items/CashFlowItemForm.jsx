import { useState } from 'react'
import { PRESETS, recurrenceLabel } from '../../../utils/recurrence.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/items/CashFlowItemForm.module.css'

const MONTHLY = '1-month'

// "custom" when the interval/unit matches no preset
function keyFor(item) {
  const preset = PRESETS.find((p) => p.interval === item.interval && p.unit === item.unit)
  return preset ? preset.key : 'custom'
}

function CashFlowItemForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [kind, setKind] = useState(initial?.kind ?? 'expense')
  const [recurrence, setRecurrence] = useState(initial ? keyFor(initial) : MONTHLY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Keep a non-preset recurrence as its own option, so saving an "every 10 days" item
  // doesn't turn it into Monthly
  const options = [...PRESETS]
  if (initial && keyFor(initial) === 'custom') {
    options.push({ key: 'custom', label: recurrenceLabel(initial), interval: initial.interval, unit: initial.unit })
  }

  function reset() {
    setName('')
    setAmount('')
    setStartDate('')
    setEndDate('')
    setKind('expense')
    setRecurrence(MONTHLY)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { interval, unit } = options.find((o) => o.key === recurrence)
    const res = await onSubmit({
      kind,
      name,
      amount,
      start_date: startDate,
      end_date: endDate || null,
      interval,
      unit,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.data ?? {})
    }
    else if (!initial) {
      reset()
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.full}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      
      <label>
        Amount
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      
      <label>
        Date
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      
      <label>
        End date
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>

      <fieldset className={styles.type}>
        <legend>Type</legend>
        <label>
          <input type="radio" checked={kind === 'income'} onChange={() => setKind('income')} />
          Income
        </label>
        <label>
          <input type="radio" checked={kind === 'expense'} onChange={() => setKind('expense')} />
          Expense
        </label>
      </fieldset>

      <label className={styles.full}>
        Recurrence
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={saving}>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      <ErrorMessage data={error} />
    </form>
  )
}

export default CashFlowItemForm
