import { formatDate, formatMoney, formatMonth } from '../../../utils/format.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import Panel from '../Panel.jsx'
import styles from '../../../styles/budget/timeline/TimelinePanel.module.css'

// The server sorts by date, so an entry either joins the last group or starts a new one
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

// timeline is null while loading
function TimelinePanel({ timeline, error }) {
  let content = null
  if (error) {
    content = <ErrorMessage data={error} />
  }
  else if (timeline && timeline.length === 0) {
    content = <p className={styles.empty}>No items yet</p>
  }
  else if (timeline) {
    content = groupByMonth(timeline).map(({ month, entries }) => (
      <div key={month} className={styles.month}>
        <h3 className={styles.monthHeading}>{formatMonth(month)}</h3>
        <ul className={styles.list}>
          {entries.map((entry) => (
            // The plain kind class is checked by the tests; the module classes do the styling
            <li key={`${entry.item_id}-${entry.date}`} className={`${entry.kind} ${styles.entry} ${styles[entry.kind]}`}>
              <span className={styles.date}>{formatDate(entry.date)}</span>{' '}
              <span className={styles.name}>{entry.name}</span>{' '}
              <span className={styles.amount}>
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
