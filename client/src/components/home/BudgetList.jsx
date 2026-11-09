import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/format.js'

function BudgetList({ budgets }) {
  if (budgets.length === 0) {
    return <p>No budgets yet</p>
  }

  return (
    <ul>
      {budgets.map((budget) => (
        <li key={budget.id}>
          <Link to={`/budgets/${budget.id}`}>
            <strong>{budget.title}</strong>
            {budget.description && <span> {budget.description}</span>}
            <span> Balance as of {formatDate(budget.balance_as_of)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default BudgetList
