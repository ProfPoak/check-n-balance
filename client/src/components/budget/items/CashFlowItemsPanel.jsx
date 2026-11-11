import { apiFetch } from '../../../api.js'
import CashFlowItemForm from './CashFlowItemForm.jsx'
import CashFlowItemRow from './CashFlowItemRow.jsx'
import Panel from '../Panel.jsx'
import styles from '../../../styles/budget/PanelList.module.css'

function CashFlowItemsPanel({ budgetId, items, onAdd, onReplace, onRemove }) {
  // Returns the apiFetch result so the form can clear itself or show the error
  async function handleAdd(body) {
    const res = await apiFetch(`/budgets/${budgetId}/cash_flow_items`, { method: 'POST', body })
    if (res.ok) {
      onAdd(res.data)
    }
    return res
  }

  return (
    <Panel id="cash-flow-items" title="Cash flow items">
      <CashFlowItemForm submitLabel="Add item" onSubmit={handleAdd} />

      {items.length === 0 ? (
        <p className={styles.empty}>No cash flow items yet</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <CashFlowItemRow key={item.id} item={item} onReplace={onReplace} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default CashFlowItemsPanel
