import { formatMoney, formatMonth } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import Panel from '../Panel.jsx'

function Trend({ net, prev }) {
  if (!prev) return null
  const now = Number(net)
  const before = Number(prev.net)
  if (now > before) return <span aria-label="Up">▲</span>
  if (now < before) return <span aria-label="Down">▼</span>
  return null
}

function MonthlyPanel({ monthly, error }) {
  let content = null
  if (error) {
    content = <ErrorMessage data={error} />
  }
  else if (monthly) {
    content = (
      <table>
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
            return (
              <tr key={row.month}>
                <td>{formatMonth(row.month)}</td>
                <td>{show(row.income)}</td>
                <td>{show(row.expenses)}</td>
                <td>{show(row.net)}</td>
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
