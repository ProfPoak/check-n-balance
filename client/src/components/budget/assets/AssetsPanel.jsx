import { apiFetch } from '../../../api.js'
import AssetForm from './AssetForm.jsx'
import AssetRow from './AssetRow.jsx'
import Panel from '../Panel.jsx'
import ProjectionForm from './ProjectionForm.jsx'
import styles from '../../../styles/budget/assets/AssetsPanel.module.css'

function AssetsPanel({ budgetId, assets, onAdd, onReplace, onRemove, version }) {
  async function handleAdd(body) {
    const res = await apiFetch(`/budgets/${budgetId}/assets`, { method: 'POST', body })
    if (res.ok) {
      onAdd(res.data)
    }
    return res
  }

  return (
    <Panel id="projected-asset-value" title="Projected asset value">
      <AssetForm submitLabel="Add asset" onSubmit={handleAdd} />

      {assets.length === 0 ? (
        <p className={styles.empty}>No assets yet</p>
      ) : (
        <ul className={styles.list}>
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} onReplace={onReplace} onRemove={onRemove} />
          ))}
        </ul>
      )}
      <ProjectionForm key={version} budgetId={budgetId} />
    </Panel>
  )
}

export default AssetsPanel
