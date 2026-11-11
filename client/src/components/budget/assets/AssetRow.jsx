import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import { formatMoney } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import AssetForm from './AssetForm.jsx'
import styles from '../../../styles/budget/assets/AssetRow.module.css'
import buttons from '../../../styles/shared/Buttons.module.css'

function AssetRow({ asset, onReplace, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(body) {
    const res = await apiFetch(`/assets/${asset.id}`, { method: 'PATCH', body })
    if (res.ok) {
      onReplace(res.data)
      setEditing(false)
    }
    return res
  }

  async function handleDelete() {
    setError(null)
    const res = await apiFetch(`/assets/${asset.id}`, { method: 'DELETE' })
    if (res.ok) {
      onRemove(asset.id)
    }
    else {
      setError(res.data ?? {})
    }
  }

  if (editing) {
    return (
      <li className={styles.editing}>
        <AssetForm
          initial={asset}
          submitLabel="Save"
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={styles.row}>
      <strong className={styles.name}>{asset.name}</strong>
      <span className={`${styles.balance} ${Number(asset.balance) < 0 ? styles.negative : ''}`}> {formatMoney(asset.balance)}</span>
      <button className={buttons.small} aria-label={`Edit ${asset.name}`} onClick={() => setEditing(true)}>Edit</button>
      <button className={`${buttons.small} ${buttons.danger}`} aria-label={`Delete ${asset.name}`} onClick={handleDelete}>Delete</button>
      <ErrorMessage data={error} />
    </li>
  )
}

export default AssetRow
