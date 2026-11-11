// A budget page panel. The <h2> names the <section>, so tests find it as a region by that name.
import styles from '../../styles/budget/Panel.module.css'

function Panel({ id, title, children }) {
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>{title}</h2>
      {children}
    </section>
  )
}

export default Panel
