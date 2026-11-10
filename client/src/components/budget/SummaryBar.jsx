import { formatMoney, formatMonth } from '../../utils/format.js'

function SummaryBar({ monthly }) {
  if (!monthly || monthly.length === 0) {
    return null
  }
  // The server's window always starts at the current month
  const row = monthly[0]

  return (
    <section aria-label="Summary">
      <span>{formatMonth(row.month)}</span>{' '}
      <span>Income: {formatMoney(row.income)}</span>{' '}
      <span>Expenses: {formatMoney(row.expenses)}</span>{' '}
      <span>Net: {formatMoney(row.net)}</span>
    </section>
  )
}

export default SummaryBar
