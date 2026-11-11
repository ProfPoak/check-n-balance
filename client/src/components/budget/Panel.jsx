// A budget page panel. The <h2> names the <section>, so tests find it as a region by that name.
function Panel({ id, title, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

export default Panel
