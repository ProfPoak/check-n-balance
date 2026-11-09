import { useNavigate } from 'react-router-dom'

function BudgetSelector({ budgets, currentId }) {
  const navigate = useNavigate()

  return (
    <select aria-label='Budget' value={currentId} onChange={(e) => navigate(`/budgets/${e.target.value}`)}>
      {budgets.map((b) => (
        <option key={b.id} value={b.id}>
          {b.title}
        </option>
      ))}
    </select>
  )
}

export default BudgetSelector
