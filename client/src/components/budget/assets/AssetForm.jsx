import { useState } from 'react'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import styles from '../../../styles/budget/assets/AssetForm.module.css'
import { useRequest } from '../../../hooks/useRequest.js'

function AssetForm({ initial, submitLabel, method, path, onSaved, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [balance, setBalance] = useState(initial?.balance ?? '')
  const { busy, error, send } = useRequest()

  async function handleSubmit(e) {
    e.preventDefault()
    const res = await send(path, { method, body: { name, balance } })
    if (res.ok) {
      onSaved(res.data)
      if (!initial) {
        setName('')
        setBalance('')
      }
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      
      <label>
        Balance
        <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </label>
      
      <button type="submit" disabled={busy}>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      <ErrorMessage data={error} />
    </form>
  )
}

export default AssetForm
