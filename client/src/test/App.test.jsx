import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { mockFetch } from './mockFetch.js'

// Logged out until Block C adds the guards (then these tests grow a logged-in mode)
async function renderAt(path) {
  mockFetch({ 'GET /api/check_session': [401, { error: 'Not logged in' }] })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByRole('navigation')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('routes', () => {
  it.each([
    ['/login', 'Login'],
    ['/signup', 'Signup'],
    ['/', 'Home'],
    ['/budgets/1', 'Budget 1'],
    ['/budgets/42', 'Budget 42'],
    ['/nonsense', 'Page not found'],
    ['/budgets/1/extra', 'Page not found'],
  ])('%s renders the "%s" page', async (path, heading) => {
    await renderAt(path)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(heading)
  })
})

describe('layout', () => {
  it.each(['/login', '/signup', '/', '/budgets/1', '/nonsense'])('%s shows the nav', async (path) => {
    await renderAt(path)
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})
