import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../api.js'
import AssetsPanel from './AssetsPanel.jsx'
import BudgetHeader from './BudgetHeader.jsx'
import CashFlowItemsPanel from './CashFlowItemsPanel.jsx'
import Panel from './Panel.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'

function BudgetView({ id }) {
  const [budget, setBudget] = useState(null)
  const [items, setItems] = useState([])
  const [assets, setAssets] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let ignore = false
    apiFetch(`/budgets/${id}`).then(res => {
      if (ignore) return
      if (res.ok) {
        const { cash_flow_items, assets: budgetAssets, ...budgetFields } = res.data
        setBudget(budgetFields)
        setItems(cash_flow_items)
        setAssets(budgetAssets)
      }
      else {
        setError(res.data ?? {})
      }
    })
    return () => {
      ignore = true
    }
  }, [id])

  function addItem(item) {
    setItems((list) => [...list, item])
  }

  function replaceItem(item) {
    setItems((list) => list.map((i) => (i.id === item.id ? item : i)))
  }

  function removeItem(itemId) {
    setItems((list) => list.filter((i) => i.id !== itemId))
  }

  if (error) {
    return (
      <>
        <ErrorMessage data={error} />
        <Link to="/">Back to Home</Link>
      </>
  )}
  if (!budget) {
    return <div>Loading budget...</div>
  }

  return (
    <div>
      <BudgetHeader budget={budget} onBudgetChange={setBudget} />

      <div>
        <div>
          <CashFlowItemsPanel
            budgetId={budget.id}
            items={items}
            onAdd={addItem}
            onReplace={replaceItem}
            onRemove={removeItem}
          />
        </div>

        <div>
          <Panel id="timeline" title="Timeline">
            <p>Day 8</p>
          </Panel>
        </div>

        <div>
          <Panel id="monthly-cash-flow" title="Monthly cash flow">
            <p>Day 8</p>
          </Panel>
          <Panel id="projected-asset-value" title="Projected asset value" />
        </div>
      </div>
    </div>
  )
}

export default BudgetView
