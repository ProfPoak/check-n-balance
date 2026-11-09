import { useState } from 'react'
import ErrorMessage from '../../shared/ErrorMessage.jsx'

function AssetForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [balance, setBalance] = useState(initial?.balance ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await onSubmit({ name, balance })
    setSaving(false)
    if (!res.ok) {
      setError(res.data ?? {})
    }
    else if (!initial) {
      setName('')
      setBalance('')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      
      <label>
        Balance
        <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </label>
      
      <button type="submit" disabled={saving}>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      <ErrorMessage data={error} />
    </form>
  )
}

export default AssetForm
