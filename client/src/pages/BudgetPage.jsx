import { useParams } from 'react-router-dom'
import BudgetView from '../components/BudgetView.jsx'

function BudgetPage() {
  const id = useParams().id

  return (
    <BudgetView key={id} id={id} />
  )
}

export default BudgetPage
