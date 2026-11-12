import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../../hooks/useFetch.js'
import AssetsPanel from './assets/AssetsPanel.jsx'
import BudgetHeader from './header/BudgetHeader.jsx'
import CashFlowItemsPanel from './items/CashFlowItemsPanel.jsx'
import MonthlyPanel from './monthly/MonthlyPanel.jsx'
import SummaryBar from './SummaryBar.jsx'
import TimelinePanel from './timeline/TimelinePanel.jsx'
import ErrorMessage from '../shared/ErrorMessage.jsx'
import styles from '../../styles/budget/BudgetView.module.css'

function BudgetView({ id }) {
  const { data: budget, error, setData: setBudget } = useFetch(`/budgets/${id}`)
  // Bumped after every change, so the server-computed timeline and monthly refetch
  const [version, setVersion] = useState(0)
  const { data: timeline, error: timelineError } = useFetch(`/budgets/${id}/timeline`, version)
  const { data: monthly, error: monthlyError } = useFetch(`/budgets/${id}/monthly`, version)

  function change(update) {
    setBudget(update)
    setVersion((v) => v + 1)
  }

  function changeList(key, fn) {
    change((b) => ({ ...b, [key]: fn(b[key]) }))
  }

  const addItem = (item) => changeList('cash_flow_items', (list) => [...list, item])
  const replaceItem = (item) => changeList('cash_flow_items', (list) => list.map((i) => (i.id === item.id ? item : i)))
  const removeItem = (itemId) => changeList('cash_flow_items', (list) => list.filter((i) => i.id !== itemId))

  const addAsset = (asset) => changeList('assets', (list) => [...list, asset])
  const replaceAsset = (asset) => changeList('assets', (list) => list.map((a) => (a.id === asset.id ? asset : a)))
  const removeAsset = (assetId) => changeList('assets', (list) => list.filter((a) => a.id !== assetId))

  const changeBudget = (fields) => change((b) => ({ ...b, ...fields }))

  if (error) {
    return (
      <div className={styles.message}>
        <ErrorMessage data={error} />
        <Link to="/">Back to Home</Link>
      </div>
  )}
  if (!budget) {
    return <div className={`${styles.message} ${styles.loading}`}>Loading budget...</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <BudgetHeader budget={budget} onBudgetChange={changeBudget} />
        <SummaryBar monthly={monthly} />
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <CashFlowItemsPanel
            budgetId={budget.id}
            items={budget.cash_flow_items}
            onAdd={addItem}
            onReplace={replaceItem}
            onRemove={removeItem}
          />
        </div>

        <div className={styles.column}>
          <TimelinePanel timeline={timeline} error={timelineError} />
        </div>

        <div className={styles.column}>
          <MonthlyPanel monthly={monthly} error={monthlyError} />
          <AssetsPanel
            budgetId={budget.id}
            assets={budget.assets}
            onAdd={addAsset}
            onReplace={replaceAsset}
            onRemove={removeAsset}
            version={version}
          />
        </div>
      </div>
    </div>
  )
}

export default BudgetView
