import { formatDate, formatMoney, formatMonth } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import Panel from '../Panel.jsx'

// [{date: "2026-11-01", ...}, ...] -> [{month: "2026-11", entries: [...]}, ...]
// The server already sorts by date, so an entry either joins the last group or starts a new one.
function groupByMonth(timeline) {
  const groups = []
  for (const entry of timeline) {
    const month = entry.date.slice(0, 7)
    const last = groups.at(-1)
    if (last && last.month === month) {
      last.entries.push(entry)
    }
    else {
      groups.push({ month, entries: [entry] })
    }
  }
  return groups
}

// The center panel: the server's timeline, grouped by month.
// Props: timeline (null while loading, then the list), error (null or the failed response's data)
function TimelinePanel({ timeline, error }) {
  let content = null
  if (error) {
    content = <ErrorMessage data={error} />
  }
  else if (timeline && timeline.length === 0) {
    content = <p>No items yet</p>
  }
  else if (timeline) {
    content = groupByMonth(timeline).map(({ month, entries }) => (
      <div key={month}>
        <h3>{formatMonth(month)}</h3>
        <ul>
          {entries.map((entry) => (
            <li key={`${entry.item_id}-${entry.date}`} className={entry.kind}>
              <span>{formatDate(entry.date)}</span>{' '}
              <span>{entry.name}</span>{' '}
              <span>
                {entry.kind === 'income' ? '+' : '-'}
                {formatMoney(entry.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ))
  }

  return (
    <Panel id="timeline" title="Timeline">
      {content}
    </Panel>
  )
}

export default TimelinePanel
