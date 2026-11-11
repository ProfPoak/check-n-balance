import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/format.js'
import styles from '../../styles/home/BudgetList.module.css'

function BudgetList({ budgets }) {
  if (budgets.length === 0) {
    return <p className={styles.empty}>No budgets yet</p>
  }

  return (
    <ul className={styles.list}>
      {budgets.map((budget) => (
        <li key={budget.id}>
          <Link className={styles.card} to={`/budgets/${budget.id}`}>
            <strong className={styles.title}>{budget.title}</strong>
            {budget.description && <span className={styles.description}> {budget.description}</span>}
            <span className={styles.date}> Balance as of {formatDate(budget.balance_as_of)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default BudgetList
