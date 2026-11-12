import CashFlowItemForm from './CashFlowItemForm.jsx'
import CashFlowItemRow from './CashFlowItemRow.jsx'
import Panel from '../Panel.jsx'
import styles from '../../../styles/budget/PanelList.module.css'

function CashFlowItemsPanel({ budgetId, items, onAdd, onReplace, onRemove }) {
  return (
    <Panel id="cash-flow-items" title="Cash flow items">
      <CashFlowItemForm
        submitLabel="Add item"
        method="POST"
        path={`/budgets/${budgetId}/cash_flow_items`}
        onSaved={onAdd}
      />

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
