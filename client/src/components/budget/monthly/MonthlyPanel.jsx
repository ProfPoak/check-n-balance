import { formatMoney, formatMonth } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import Panel from '../Panel.jsx'
import styles from '../../../styles/budget/monthly/MonthlyPanel.module.css'

function Trend({ net, prev }) {
  if (!prev) return null
  const now = Number(net)
  const before = Number(prev.net)
  if (now > before) return <span className={styles.up} aria-label="Up">▲</span>
  if (now < before) return <span className={styles.down} aria-label="Down">▼</span>
  return null
}

function MonthlyPanel({ monthly, error }) {
  let content = null
  if (error) {
    content = <ErrorMessage data={error} />
  }
  else if (monthly) {
    content = (
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Month</th>
            <th>In</th>
            <th>Out</th>
            <th>Net</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((row, i) => {
            // Empty means nothing in or out, not just Net 0 ($500 in and $500 out isn't empty)
            const empty = Number(row.income) === 0 && Number(row.expenses) === 0
            const show = (value) => (empty ? '—' : formatMoney(value))
            const net = Number(row.net)
            const netColor = net > 0 ? styles.positive : net < 0 ? styles.negative : ''
            const cell = empty ? styles.empty : ''
            return (
              <tr key={row.month}>
                <td>{formatMonth(row.month)}</td>
                <td className={cell}>{show(row.income)}</td>
                <td className={cell}>{show(row.expenses)}</td>
                <td className={empty ? styles.empty : `${styles.net} ${netColor}`}>{show(row.net)}</td>
                <td>
                  <Trend net={row.net} prev={monthly[i - 1]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <Panel id="monthly-cash-flow" title="Monthly cash flow">
      {content}
    </Panel>
  )
}

export default MonthlyPanel
