import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api.js'
import BudgetEditForm from './BudgetEditForm.jsx'
import BudgetSelector from './BudgetSelector.jsx'
import ErrorMessage from './ErrorMessage.jsx'

function Panel({ id, title, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

function BudgetView({ id }) {
  const [budget, setBudget] = useState(null)
  const [items, setItems] = useState([])
  const [assets, setAssets] = useState([])
  const [error, setError] = useState(null)
  const [budgets, setBudgets] = useState(null)

  // The selector's list
  useEffect(() => {
    let ignore = false
    apiFetch('/budgets').then(res => {
      if (!ignore && res.ok) {
        setBudgets(res.data)
      }
    })
    return () => {
      ignore = true
    }
  }, [])

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
      <header>
        <h1>{budget.title}</h1>
        {budgets && <BudgetSelector budgets={budgets} currentId={id} />}
      </header>

      <div>
        <div>
          <Panel id="cash-flow-items" title="Cash flow items" />
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
