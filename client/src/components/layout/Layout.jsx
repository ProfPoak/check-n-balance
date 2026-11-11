import { Outlet } from 'react-router-dom'
import NavBar from './NavBar.jsx'
import styles from '../../styles/layout/Layout.module.css'

function Layout() {
  return (
    <>
      <NavBar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}

export default Layout
