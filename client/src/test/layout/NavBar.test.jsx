import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { CURRENT, scheduleRoutes } from '../fixtures.js'
import { callsTo, DEMO, mockFetch } from '../mockFetch.js'

const LOGGED_OUT = [401, { error: 'Not logged in' }]
const LOGGED_IN = [200, DEMO]
const HOME = /^(Home|Welcome, demo@example\.com)$/

// The NavBar is tested inside the real App, so its links and logout redirect are real
function renderAt(path, routes) {
  const fetchMock = mockFetch({ 'GET /api/budgets': [200, []], 'GET /api/budgets/1': [200, CURRENT], ...scheduleRoutes(1), ...routes })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return fetchMock
}

const nav = () => within(screen.getByRole('navigation'))

async function heading() {
  return (await screen.findByRole('heading', { level: 1 })).textContent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('while the session check is in flight', () => {
  it('shows no auth links or buttons', async () => {
    renderAt('/nonsense', { 'GET /api/check_session': () => new Promise(() => {}) })
    await heading()
    expect(nav().queryByRole('link', { name: 'Login' })).toBeNull()
    expect(nav().queryByRole('link', { name: 'Signup' })).toBeNull()
    expect(nav().queryByRole('button', { name: 'Log out' })).toBeNull()
  })
})

describe('logged out', () => {
  it('shows Login and Signup links, and no Log out', async () => {
    renderAt('/nonsense', { 'GET /api/check_session': LOGGED_OUT })
    expect(await nav().findByRole('link', { name: 'Login' })).toBeTruthy()
    expect(nav().getByRole('link', { name: 'Signup' })).toBeTruthy()
    expect(nav().queryByRole('button', { name: 'Log out' })).toBeNull()
  })

  it('the Login link opens /login', async () => {
    renderAt('/nonsense', { 'GET /api/check_session': LOGGED_OUT })
    await userEvent.setup().click(await nav().findByRole('link', { name: 'Login' }))
    expect(await heading()).toBe('Login')
  })

  it('the Signup link opens /signup', async () => {
    renderAt('/nonsense', { 'GET /api/check_session': LOGGED_OUT })
    await userEvent.setup().click(await nav().findByRole('link', { name: 'Signup' }))
    expect(await heading()).toBe('Signup')
  })
})

describe('logged in', () => {
  it("shows the Check'N Balance home link, the user's email and Log out, and no Login or Signup", async () => {
    renderAt('/budgets/1', { 'GET /api/check_session': LOGGED_IN })
    expect(await nav().findByRole('button', { name: 'Log out' })).toBeTruthy()
    expect(nav().getByRole('link', { name: "Check'N Balance" })).toBeTruthy()
    expect(nav().getByText('demo@example.com')).toBeTruthy()
    expect(nav().queryByRole('link', { name: 'Login' })).toBeNull()
    expect(nav().queryByRole('link', { name: 'Signup' })).toBeNull()
  })

  it("the Check'N Balance link opens /", async () => {
    renderAt('/budgets/1', { 'GET /api/check_session': LOGGED_IN })
    await userEvent.setup().click(await nav().findByRole('link', { name: "Check'N Balance" }))
    expect(await heading()).toMatch(HOME)
  })
})

describe('log out', () => {
  it('DELETEs /logout and lands on the Login page', async () => {
    const fetchMock = renderAt('/', {
      'GET /api/check_session': LOGGED_IN,
      'DELETE /api/logout': [204, null],
    })
    await userEvent.setup().click(await nav().findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(callsTo(fetchMock, 'DELETE /api/logout')).toHaveLength(1)
    expect(nav().queryByText('demo@example.com')).toBeNull()
    expect(nav().getByRole('link', { name: 'Login' })).toBeTruthy()
  })

  it('also goes to /login from an unguarded page like /nonsense', async () => {
    renderAt('/nonsense', {
      'GET /api/check_session': LOGGED_IN,
      'DELETE /api/logout': [204, null],
    })
    await userEvent.setup().click(await nav().findByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy()
  })

  it('when it fails, shows the error and stays logged in', async () => {
    renderAt('/', {
      'GET /api/check_session': LOGGED_IN,
      'DELETE /api/logout': 'down',
    })
    await userEvent.setup().click(await nav().findByRole('button', { name: 'Log out' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
    expect(nav().getByRole('button', { name: 'Log out' })).toBeTruthy()
    expect(nav().getByText('demo@example.com')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull())
  })
})
