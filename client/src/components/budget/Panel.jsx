// aria-labelledby makes the <section> a region named by its heading; tests find panels that way.
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
