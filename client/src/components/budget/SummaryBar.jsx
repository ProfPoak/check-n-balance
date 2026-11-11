import { formatMoney, formatMonth } from '../../utils/format.js'
import styles from '../../styles/budget/SummaryBar.module.css'

function SummaryBar({ monthly }) {
  if (!monthly || monthly.length === 0) {
    return null
  }
  // The server's window always starts at the current month
  const row = monthly[0]
  // Green above zero, red below, gray at $0.00 (Expenses are red whenever there are any)
  const net = Number(row.net)
  const netClass = net > 0 ? styles.positive : net < 0 ? styles.negative : styles.zero
  const incomeClass = Number(row.income) > 0 ? styles.positive : styles.zero
  const expensesClass = Number(row.expenses) > 0 ? styles.negative : styles.zero

  return (
    <section className={styles.bar} aria-label="Summary">
      <span className={styles.month}>{formatMonth(row.month)}</span>
      <span className={styles.stat}>
        <span className={styles.label}>Income</span>{' '}
        <span className={`${styles.value} ${incomeClass}`}>{formatMoney(row.income)}</span>
      </span>
      <span className={styles.stat}>
        <span className={styles.label}>Expenses</span>{' '}
        <span className={`${styles.value} ${expensesClass}`}>{formatMoney(row.expenses)}</span>
      </span>
      <span className={styles.stat}>
        <span className={styles.label}>Net</span>{' '}
        <span className={`${styles.value} ${netClass}`}>{formatMoney(row.net)}</span>
      </span>
    </section>
  )
}

export default SummaryBar
