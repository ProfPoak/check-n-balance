import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { DEMO, mockFetch } from './mockFetch.js'

const LOGGED_OUT = [401, { error: 'Not logged in' }]
const LOGGED_IN = [200, DEMO]

// Home is "Home" until Block D makes it "Welcome, <email>"; either one means we landed on Home
const HOME = /^(Home|Welcome, demo@example\.com)$/

// Renders the whole app at `path`. `session` is the /check_session answer.
// GET /budgets is mocked too, so Home keeps working once Block D fetches it.
function renderAt(path, session) {
  const routes = {
    'GET /api/check_session': session,
    'GET /api/budgets': [200, []],
  }
  mockFetch(routes)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return routes
}

async function heading() {
  return (await screen.findByRole('heading', { level: 1 })).textContent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logged out', () => {
  it.each([
    ['/login', 'Login'],
    ['/signup', 'Signup'],
    ['/', 'Login'],
    ['/budgets/1', 'Login'],
    ['/nonsense', 'Page not found'],
    ['/budgets/1/extra', 'Page not found'],
  ])('%s shows the "%s" page', async (path, expected) => {
    renderAt(path, LOGGED_OUT)
    expect(await heading()).toBe(expected)
  })
})

describe('logged in', () => {
  it.each(['/', '/login', '/signup'])('%s lands on Home', async (path) => {
    renderAt(path, LOGGED_IN)
    expect(await heading()).toMatch(HOME)
  })

  it.each([
    ['/budgets/1', 'Budget 1'],
    ['/budgets/42', 'Budget 42'],
    ['/nonsense', 'Page not found'],
  ])('%s shows the "%s" page', async (path, expected) => {
    renderAt(path, LOGGED_IN)
    expect(await heading()).toBe(expected)
  })
})

describe('while the session check is in flight', () => {
  const pending = () => new Promise(() => {})

  it.each(['/', '/budgets/1'])('%s shows Loading…, not the login page', async (path) => {
    renderAt(path, pending)
    expect(await screen.findByText(/Loading/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
  })

  it.each(['/login', '/signup'])('%s shows Loading…, not the form', async (path) => {
    renderAt(path, pending)
    expect(await screen.findByText(/Loading/)).toBeTruthy()
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  it('/nonsense is not guarded, so it renders right away', async () => {
    renderAt('/nonsense', pending)
    expect(await heading()).toBe('Page not found')
  })
})

describe('when the session check fails (Flask down)', () => {
  it.each(['/', '/budgets/1'])('%s shows the error and Try again, not Loading… or the login page', async (path) => {
    renderAt(path, [502, 'Bad Gateway'])
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText(/Loading/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
  })

  it('shows the apiFetch message when the server is unreachable', async () => {
    renderAt('/', 'down')
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('Try again recovers once the server is back', async () => {
    const routes = renderAt('/', [502, 'Bad Gateway'])
    const button = await screen.findByRole('button', { name: 'Try again' })

    routes['GET /api/check_session'] = LOGGED_IN
    await userEvent.setup().click(button)
    expect(await heading()).toMatch(HOME)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('/login still shows the form', async () => {
    renderAt('/login', [502, 'Bad Gateway'])
    expect(await heading()).toBe('Login')
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})

describe('layout', () => {
  it.each(['/login', '/signup', '/', '/budgets/1', '/nonsense'])('%s shows the nav', async (path) => {
    renderAt(path, LOGGED_IN)
    await heading()
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})
