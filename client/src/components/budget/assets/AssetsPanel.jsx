import AssetForm from './AssetForm.jsx'
import AssetRow from './AssetRow.jsx'
import Panel from '../Panel.jsx'
import ProjectionForm from './ProjectionForm.jsx'
import styles from '../../../styles/budget/PanelList.module.css'

function AssetsPanel({ budgetId, assets, onAdd, onReplace, onRemove, version }) {
  return (
    <Panel id="projected-asset-value" title="Projected asset value">
      <AssetForm
        submitLabel="Add asset"
        method="POST"
        path={`/budgets/${budgetId}/assets`}
        onSaved={onAdd}
      />

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
