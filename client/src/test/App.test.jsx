import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  it.each([
    ['/login', 'Login'],
    ['/signup', 'Signup'],
    ['/', 'Home'],
    ['/budgets/1', 'Budget 1'],
    ['/budgets/42', 'Budget 42'],
    ['/nonsense', 'Page not found'],
    ['/budgets/1/extra', 'Page not found'],
  ])('%s renders the "%s" page', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading)
  })
})

describe('layout', () => {
  it.each(['/login', '/signup', '/', '/budgets/1', '/nonsense'])('%s shows the nav', (path) => {
    renderAt(path)
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})
