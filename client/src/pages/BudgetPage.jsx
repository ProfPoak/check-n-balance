import { useParams } from 'react-router-dom'

function BudgetPage() {
  const { id } = useParams()

  return <h1>Budget {id}</h1>
}

export default BudgetPage
