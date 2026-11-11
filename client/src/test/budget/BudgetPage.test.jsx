import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { CURRENT, scheduleRoutes, summary, UNTITLED, WHAT_IF } from '../fixtures.js'
import { callsTo, DEMO, mockFetch } from '../mockFetch.js'

const PANELS = ['Cash flow items', 'Timeline', 'Monthly cash flow', 'Projected asset value']

// Grabs the router's navigate so a test can change :id the way the Block B selector will
const router = { navigate: null }
function Navigator() {
  const navigate = useNavigate()
  useEffect(() => {
    router.navigate = navigate
  }, [navigate])
  return null
}
const navigateTo = (path) => router.navigate(path)

// The whole app at `path`, logged in. GET /budgets (the Block B selector list) is mocked
// now so these tests keep passing once the page fetches it.
function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    ...scheduleRoutes(1, 2, 9),
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/2': [200, WHAT_IF],
    'GET /api/budgets/9': [200, UNTITLED],
    ...routes,
  }
  const fetchMock = mockFetch(allRoutes)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Navigator />
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { fetchMock, routes: allRoutes }
}

const title = (name) => screen.findByRole('heading', { level: 1, name })
const panel = (name) => screen.getByRole('region', { name })

// A response the test resolves by hand
function deferred(status, body) {
  let resolve
  const promise = new Promise((r) => {
    resolve = () => r(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  })
  return { route: () => promise, resolve }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loading', () => {
  it('shows "Loading budget" while GET /budgets/:id is in flight', async () => {
    renderAt('/budgets/1', { 'GET /api/budgets/1': () => new Promise(() => {}) })
    expect(await screen.findByText(/Loading budget/)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('GETs /budgets/:id for the id in the URL', async () => {
    const { fetchMock } = renderAt('/budgets/2')
    await title('New car what-if')
    expect(callsTo(fetchMock, 'GET /api/budgets/2')).toHaveLength(1)
    expect(callsTo(fetchMock, 'GET /api/budgets/1')).toHaveLength(0)
  })
})

describe('a loaded budget', () => {
  it("shows the budget's title as the page heading", async () => {
    renderAt('/budgets/1')
    expect(await title('Current')).toBeTruthy()
    expect(screen.queryByText(/Loading budget/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(PANELS)('has a "%s" panel', async (name) => {
    renderAt('/budgets/1')
    await title('Current')
    expect(panel(name)).toBeTruthy()
  })
})

describe('an empty budget (fresh from Home\'s "+")', () => {
  it.each(PANELS)('still has a "%s" panel', async (name) => {
    renderAt('/budgets/9')
    await title('Untitled budget')
    expect(panel(name)).toBeTruthy()
  })

  it('shows no error and does not print null', async () => {
    renderAt('/budgets/9')
    await title('Untitled budget')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/null|undefined|NaN/)).toBeNull()
  })
})

describe('when the budget does not load', () => {
  it.each([
    ['404', [404, { error: 'Budget not found' }], 'Budget not found'],
    ['403', [403, { error: 'Forbidden' }], 'Forbidden'],
    ['Flask down', 'down', 'Could not reach the server'],
    ['a 502 with no JSON', [502, 'Bad Gateway'], 'Something went wrong'],
  ])('%s shows the error, not Loading or a heading', async (_, route, message) => {
    renderAt('/budgets/1', { 'GET /api/budgets/1': route })
    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(screen.queryByText(/Loading budget/)).toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Cash flow items' })).toBeNull()
  })

  it('offers a "Back to Home" link that goes Home', async () => {
    renderAt('/budgets/1', { 'GET /api/budgets/1': [404, { error: 'Budget not found' }] })
    const link = await screen.findByRole('link', { name: 'Back to Home' })
    expect(link.getAttribute('href')).toBe('/')

    await userEvent.setup().click(link)
    expect(await title('Welcome, demo@example.com')).toBeTruthy()
  })
})

describe('switching budgets (only :id changes)', () => {
  it('loads and shows the new budget', async () => {
    const { fetchMock } = renderAt('/budgets/1')
    await title('Current')

    act(() => navigateTo('/budgets/2'))
    expect(await title('New car what-if')).toBeTruthy()
    expect(callsTo(fetchMock, 'GET /api/budgets/2')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Current' })).toBeNull()
  })

  it("does not show the old budget while the new one loads", async () => {
    renderAt('/budgets/1', { 'GET /api/budgets/2': () => new Promise(() => {}) })
    await title('Current')

    act(() => navigateTo('/budgets/2'))
    expect(await screen.findByText(/Loading budget/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Current' })).toBeNull()
  })

  it('does not keep the old budget when the new one fails', async () => {
    renderAt('/budgets/1', { 'GET /api/budgets/2': [404, { error: 'Budget not found' }] })
    await title('Current')

    act(() => navigateTo('/budgets/2'))
    expect((await screen.findByRole('alert')).textContent).toContain('Budget not found')
    expect(screen.queryByRole('heading', { name: 'Current' })).toBeNull()
  })

  it('a slow answer for the old budget does not overwrite the new one', async () => {
    const slow = deferred(200, CURRENT)
    renderAt('/budgets/1', { 'GET /api/budgets/1': slow.route })
    await screen.findByText(/Loading budget/)

    act(() => navigateTo('/budgets/2'))
    await title('New car what-if')

    await act(async () => slow.resolve())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New car what-if')
  })

  it('an error on one budget is gone after switching to a good one', async () => {
    renderAt('/budgets/1', { 'GET /api/budgets/1': [404, { error: 'Budget not found' }] })
    await screen.findByRole('alert')

    act(() => navigateTo('/budgets/2'))
    await title('New car what-if')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(panel('Cash flow items')).toBeTruthy()
  })
})
