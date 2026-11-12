import { useState } from 'react'
import { useRequest } from '../../../hooks/useRequest.js'
import { formatMoney } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import AssetForm from './AssetForm.jsx'
import styles from '../../../styles/budget/assets/AssetRow.module.css'
import buttons from '../../../styles/shared/Buttons.module.css'

function AssetRow({ asset, onReplace, onRemove }) {
  const [editing, setEditing] = useState(false)
  const { busy, error, send } = useRequest()

  function handleSaved(saved) {
    onReplace(saved)
    setEditing(false)
  }

  async function handleDelete() {
    const res = await send(`/assets/${asset.id}`, { method: 'DELETE' })
    if (res.ok) {
      onRemove(asset.id)
    }
  }

  if (editing) {
    return (
      <li className={styles.editing}>
        <AssetForm
          initial={asset}
          submitLabel="Save"
          method="PATCH"
          path={`/assets/${asset.id}`}
          onSaved={handleSaved}
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
      <button className={`${buttons.small} ${buttons.danger}`} aria-label={`Delete ${asset.name}`} onClick={handleDelete} disabled={busy}>Delete</button>
      <ErrorMessage data={error} />
    </li>
  )
}

export default AssetRow
