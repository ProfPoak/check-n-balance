import { apiFetch } from '../../../api.js'
import AssetForm from './AssetForm.jsx'
import AssetRow from './AssetRow.jsx'
import Panel from '../Panel.jsx'

function AssetsPanel({ budgetId, assets, onAdd, onReplace, onRemove }) {
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
        <p>No assets yet</p>
      ) : (
        <ul>
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} onReplace={onReplace} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default AssetsPanel
