import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { callsTo, DEMO, mockFetch } from './mockFetch.js'

// A US time zone, so `new Date("2026-11-07")` (midnight UTC) would show as Nov 6
globalThis.process.env.TZ = 'America/Denver'

const CURRENT = { id: 1, title: 'Current', description: 'Real numbers', balance_as_of: '2026-11-07' }
const WHAT_IF = { id: 2, title: 'New car what-if', description: null, balance_as_of: '2026-11-07' }
const UNTITLED = { id: 9, title: 'Untitled budget', description: null, balance_as_of: '2026-11-07' }

// Nov 7, 2026 in the formats a date might reasonably be shown in
const NOV_7 = /2026-11-07|11\/7\/2026|Nov(ember)? 7,? 2026|7 Nov(ember)? 2026/
const NOV_6 = /2026-11-06|11\/6\/2026|Nov(ember)? 6,? 2026|6 Nov(ember)? 2026/

// The whole app at "/", logged in, with `budgets` as the GET /budgets answer
function renderHome(budgets, extraRoutes = {}) {
  const routes = {
    'GET /api/check_session': [200, DEMO],
    'GET /api/budgets': budgets,
    ...extraRoutes,
  }
  const fetchMock = mockFetch(routes)
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { fetchMock, routes }
}

const plusButton = () => screen.findByRole('button', { name: 'New budget' })
const budgetLink = (title) => screen.findByRole('link', { name: new RegExp(title) })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the welcome', () => {
  it('greets the user by email', async () => {
    renderHome([200, []])
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, demo@example.com' })).toBeTruthy()
  })
})

describe('the budget list', () => {
  it('shows Loading while GET /budgets is in flight', async () => {
    renderHome(() => new Promise(() => {}))
    await screen.findByRole('heading', { name: 'Welcome, demo@example.com' })
    expect(screen.getByText(/Loading/)).toBeTruthy()
  })

  it('shows "No budgets yet" for an empty list', async () => {
    renderHome([200, []])
    expect(await screen.findByText('No budgets yet')).toBeTruthy()
  })

  it('links each budget to /budgets/:id', async () => {
    renderHome([200, [CURRENT, WHAT_IF]])
    expect((await budgetLink('Current')).getAttribute('href')).toBe('/budgets/1')
    expect((await budgetLink('New car what-if')).getAttribute('href')).toBe('/budgets/2')
    expect(screen.queryByText('No budgets yet')).toBeNull()
  })

  it('shows the description, and nothing for a null one', async () => {
    renderHome([200, [CURRENT, WHAT_IF]])
    await budgetLink('Current')
    expect(screen.getByText(/Real numbers/)).toBeTruthy()
    expect(screen.queryByText(/null/)).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('shows "Balance as of" with the right day (not shifted to Nov 6 by UTC)', async () => {
    renderHome([200, [CURRENT]])
    await budgetLink('Current')
    const item = screen.getByText(/Balance as of/)
    expect(item.textContent).toMatch(NOV_7)
    expect(item.textContent).not.toMatch(NOV_6)
  })

  it('shows the error when GET /budgets fails', async () => {
    renderHome([502, 'Bad Gateway'])
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong')
    expect(screen.queryByText(/Loading/)).toBeNull()
  })
})

describe('the "+" button', () => {
  it('shows on an empty list too', async () => {
    renderHome([200, []])
    await screen.findByText('No budgets yet')
    expect(await plusButton()).toBeTruthy()
  })

  it('POSTs an empty JSON object to /budgets and opens the new budget', async () => {
    const { fetchMock } = renderHome([200, []], { 'POST /api/budgets': [201, UNTITLED] })
    await userEvent.setup().click(await plusButton())

    expect(await screen.findByRole('heading', { name: 'Budget 9' })).toBeTruthy()
    const posts = callsTo(fetchMock, 'POST /api/budgets')
    expect(posts).toHaveLength(1)
    expect(posts[0][1].body).toBe('{}')
  })

  it('is disabled while the request is in flight', async () => {
    renderHome([200, []], { 'POST /api/budgets': () => new Promise(() => {}) })
    const button = await plusButton()
    await userEvent.setup().click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
  })

  it('shows the error and stays on Home when the POST fails', async () => {
    renderHome([200, []], { 'POST /api/budgets': 'down' })
    await userEvent.setup().click(await plusButton())
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
    expect(screen.getByRole('heading', { name: 'Welcome, demo@example.com' })).toBeTruthy()
  })

  it('the new budget shows up on Home when you go back (Home refetches)', async () => {
    const { fetchMock, routes } = renderHome([200, [CURRENT]], { 'POST /api/budgets': [201, UNTITLED] })
    const user = userEvent.setup()
    await user.click(await plusButton())
    await screen.findByRole('heading', { name: 'Budget 9' })

    routes['GET /api/budgets'] = [200, [CURRENT, UNTITLED]]
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Home' }))

    expect((await budgetLink('Untitled budget')).getAttribute('href')).toBe('/budgets/9')
    expect(callsTo(fetchMock, 'GET /api/budgets')).toHaveLength(2)
  })
})
