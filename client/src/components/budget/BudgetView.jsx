import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../api.js'
import AssetsPanel from './assets/AssetsPanel.jsx'
import BudgetHeader from './header/BudgetHeader.jsx'
import CashFlowItemsPanel from './items/CashFlowItemsPanel.jsx'
import Panel from './Panel.jsx'
import TimelinePanel from './timeline/TimelinePanel.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'

function BudgetView({ id }) {
  const [budget, setBudget] = useState(null)
  const [items, setItems] = useState([])
  const [assets, setAssets] = useState([])
  const [error, setError] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [timelineError, setTimelineError] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [version, setVersion] = useState(0)

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

  useEffect(() => {
    let ignore = false
    setTimelineError(null)
    apiFetch(`/budgets/${id}/timeline`).then(res => {
      if (ignore) return
      if (res.ok) {
        setTimeline(res.data)
      }
      else {
        setTimelineError(res.data ?? {})
      }
    })

    apiFetch(`/budgets/${id}/monthly`).then(res => {
      if (!ignore && res.ok) {
        setMonthly(res.data)
      }
    })

    return () => {
      ignore = true
    }
  }, [id, version])

  function refresh() {
    setVersion((v) => v + 1)
  }

  function addItem(item) {
    setItems((list) => [...list, item])
    refresh()
  }

  function replaceItem(item) {
    setItems((list) => list.map((i) => (i.id === item.id ? item : i)))
    refresh()
  }

  function removeItem(itemId) {
    setItems((list) => list.filter((i) => i.id !== itemId))
    refresh()
  }

  function addAsset(asset) {
    setAssets((list) => [...list, asset])
  }

  function replaceAsset(asset) {
    setAssets((list) => list.map((a) => (a.id === asset.id ? asset : a)))
  }

  function removeAsset(assetId) {
    setAssets((list) => list.filter((a) => a.id !== assetId))
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
          <TimelinePanel timeline={timeline} error={timelineError} />
        </div>

        <div>
          <Panel id="monthly-cash-flow" title="Monthly cash flow">
            <p>Day 8</p>
          </Panel>
          <AssetsPanel
            budgetId={budget.id}
            assets={assets}
            onAdd={addAsset}
            onReplace={replaceAsset}
            onRemove={removeAsset}
          />
        </div>
      </div>
    </div>
  )
}

export default BudgetView
