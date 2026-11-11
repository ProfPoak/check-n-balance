import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { formatDate, formatMonth } from '../../utils/format.js'
import {
  CURRENT,
  CURRENT_TIMELINE,
  emptyMonthly,
  entry,
  scheduleRoutes,
  summary,
  UNTITLED,
  WHAT_IF,
  WHAT_IF_TIMELINE,
} from '../fixtures.js'
import { callsTo, DEMO, mockFetch } from '../mockFetch.js'

// A US time zone, so a UTC date bug would show the day (or month) before
globalThis.process.env.TZ = 'America/Denver'

const TIMELINE_1 = 'GET /api/budgets/1/timeline'
const MONTHLY_1 = 'GET /api/budgets/1/monthly'
const TIMELINE_9 = 'GET /api/budgets/9/timeline'
const MONTHLY_9 = 'GET /api/budgets/9/monthly'

// The whole app at `path`, logged in. "Current" (1) has CURRENT_TIMELINE, the others are empty.
function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/2': [200, WHAT_IF],
    'GET /api/budgets/9': [200, UNTITLED],
    ...scheduleRoutes(9),
    [TIMELINE_1]: [200, CURRENT_TIMELINE],
    [MONTHLY_1]: [200, emptyMonthly()],
    'GET /api/budgets/2/timeline': [200, WHAT_IF_TIMELINE],
    'GET /api/budgets/2/monthly': [200, emptyMonthly()],
    ...routes,
  }
  const fetchMock = mockFetch(allRoutes)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { fetchMock, routes: allRoutes, user: userEvent.setup() }
}

const panel = () => within(screen.getByRole('region', { name: 'Timeline' }))
const itemsPanel = () => within(screen.getByRole('region', { name: 'Cash flow items' }))
const loaded = (name) => screen.findByRole('heading', { level: 1, name })
// Waits for the page, then for that month's heading in the Timeline panel
const findMonth = async (name) =>
  within(await screen.findByRole('region', { name: 'Timeline' })).findByRole('heading', { level: 3, name })
const monthHeadings = () => panel().queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const entries = () => panel().queryAllByRole('listitem')
const entryFor = (name, date) =>
  entries().find((li) => li.textContent.includes(name) && li.textContent.includes(formatDate(date)))

// The month heading an entry sits under: the last <h3> before it in the panel.
// Works whether or not each month is wrapped in its own element.
function monthOf(li) {
  const before = panel()
    .getAllByRole('heading', { level: 3 })
    .filter((h) => h.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_FOLLOWING)
  return before.at(-1)?.textContent
}

const [, RENT, , , VET] = CURRENT.cash_flow_items
const GYM = { id: 50, kind: 'expense', name: 'Gym', amount: '40.00', start_date: '2026-11-15', end_date: null, interval: 1, unit: 'month' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loading the timeline', () => {
  it('fetches /timeline and /monthly once each, with no query params', async () => {
    // mockFetch matches the exact URL, so "?start=..." would not be answered
    const { fetchMock } = renderAt('/budgets/1')
    await loaded('Current')
    await findMonth('Nov 2026')
    expect(callsTo(fetchMock, TIMELINE_1)).toHaveLength(1)
    expect(callsTo(fetchMock, MONTHLY_1)).toHaveLength(1)
  })

  it('shows "No items yet" for an empty timeline', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    expect(await panel().findByText('No items yet')).toBeTruthy()
    expect(entries()).toHaveLength(0)
  })

  it('does not say "No items yet" before the timeline has loaded', async () => {
    renderAt('/budgets/9', { [TIMELINE_9]: () => new Promise(() => {}) })
    await loaded('Untitled budget')
    expect(panel().queryByText('No items yet')).toBeNull()
  })

  it.each([
    ['a server error', [500, { error: 'Boom' }], 'Boom'],
    ['Flask down', 'down', 'Could not reach the server'],
  ])('shows an error in the Timeline panel on %s, and the rest of the page still works', async (_, route, message) => {
    renderAt('/budgets/1', { [TIMELINE_1]: route })
    await loaded('Current')
    expect((await panel().findByRole('alert')).textContent).toContain(message)
    expect(panel().queryByText('No items yet')).toBeNull()
    expect(itemsPanel().getByRole('button', { name: 'Edit Rent' })).toBeTruthy()
  })
})

describe('entries', () => {
  it('has one month heading per month with entries, in order', async () => {
    renderAt('/budgets/1')
    await findMonth('Nov 2026')
    expect(monthHeadings()).toEqual(['Nov 2026', 'Dec 2026'])
  })

  it('skips months with no entries', async () => {
    const sparse = [entry(RENT, '2026-11-01'), entry(RENT, '2027-02-01')]
    renderAt('/budgets/1', { [TIMELINE_1]: [200, sparse] })
    await findMonth('Nov 2026')
    expect(monthHeadings()).toEqual(['Nov 2026', 'Feb 2027'])
  })

  it("lists every entry in the server's order, each under its own month", async () => {
    renderAt('/budgets/1')
    await findMonth('Nov 2026')
    const lis = entries()
    expect(lis).toHaveLength(CURRENT_TIMELINE.length)
    CURRENT_TIMELINE.forEach((e, i) => {
      expect(lis[i].textContent).toContain(e.name)
      expect(lis[i].textContent).toContain(formatDate(e.date))
      expect(monthOf(lis[i])).toBe(formatMonth(e.date.slice(0, 7)))
    })
  })

  it('signs the amount: + for income, - for expenses', async () => {
    renderAt('/budgets/1')
    await findMonth('Nov 2026')
    expect(entryFor('Paycheck', '2026-11-06').textContent).toContain('+$2,100.00')
    expect(entryFor('Rent', '2026-11-01').textContent).toContain('-$1,450.00')
    expect(entryFor('Rent', '2026-11-01').textContent).not.toContain('+')
  })

  it('gives each entry the class "income" or "expense"', async () => {
    renderAt('/budgets/1')
    await findMonth('Nov 2026')
    expect(entryFor('Paycheck', '2026-11-06').classList.contains('income')).toBe(true)
    expect(entryFor('Vet visit', '2026-12-10').classList.contains('expense')).toBe(true)
    expect(entryFor('Vet visit', '2026-12-10').classList.contains('income')).toBe(false)
  })
})

describe('keeping it in sync', () => {
  it('adding an item refetches /timeline and /monthly and shows the new entry', async () => {
    const { fetchMock, routes, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': [201, GYM] })
    await loaded('Untitled budget')
    await panel().findByText('No items yet')

    routes[TIMELINE_9] = [200, [entry(GYM, '2026-11-15')]]
    const form = within(itemsPanel().getByRole('button', { name: 'Add item' }).closest('form'))
    await user.type(form.getByLabelText('Name'), 'Gym')
    await user.type(form.getByLabelText('Amount'), '40')
    await user.type(form.getByLabelText('Date'), '2026-11-15')
    await user.click(form.getByRole('button', { name: 'Add item' }))

    await findMonth('Nov 2026')
    expect(entryFor('Gym', '2026-11-15').textContent).toContain('-$40.00')
    expect(panel().queryByText('No items yet')).toBeNull()
    expect(callsTo(fetchMock, TIMELINE_9)).toHaveLength(2)
    expect(callsTo(fetchMock, MONTHLY_9)).toHaveLength(2)
  })

  it('a failed add does not refetch', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', {
      'POST /api/budgets/9/cash_flow_items': [422, { errors: { name: ['Name is required'] } }],
    })
    await loaded('Untitled budget')
    await panel().findByText('No items yet')
    const form = within(itemsPanel().getByRole('button', { name: 'Add item' }).closest('form'))
    await user.click(form.getByRole('button', { name: 'Add item' }))

    await itemsPanel().findByRole('alert')
    expect(callsTo(fetchMock, TIMELINE_9)).toHaveLength(1)
    expect(callsTo(fetchMock, MONTHLY_9)).toHaveLength(1)
  })

  it('editing an item refetches and shows the new amount', async () => {
    const { fetchMock, routes, user } = renderAt('/budgets/1', {
      'PATCH /api/cash_flow_items/2': [200, { ...RENT, amount: '1500.00' }],
    })
    await findMonth('Nov 2026')

    const newRent = { ...RENT, amount: '1500.00' }
    routes[TIMELINE_1] = [200, CURRENT_TIMELINE.map((e) => (e.item_id === RENT.id ? entry(newRent, e.date) : e))]
    await user.click(itemsPanel().getByRole('button', { name: 'Edit Rent' }))
    const form = within(itemsPanel().getByRole('button', { name: 'Save' }).closest('form'))
    await user.clear(form.getByLabelText('Amount'))
    await user.type(form.getByLabelText('Amount'), '1500')
    await user.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(entryFor('Rent', '2026-11-01').textContent).toContain('-$1,500.00'))
    expect(callsTo(fetchMock, TIMELINE_1)).toHaveLength(2)
    expect(callsTo(fetchMock, MONTHLY_1)).toHaveLength(2)
  })

  it('deleting an item refetches and its entries disappear', async () => {
    const { fetchMock, routes, user } = renderAt('/budgets/1', { 'DELETE /api/cash_flow_items/5': [204, null] })
    await findMonth('Nov 2026')
    expect(entryFor('Vet visit', '2026-12-10')).toBeTruthy()

    routes[TIMELINE_1] = [200, CURRENT_TIMELINE.filter((e) => e.item_id !== VET.id)]
    await user.click(itemsPanel().getByRole('button', { name: 'Delete Vet visit' }))

    await waitFor(() => expect(entryFor('Vet visit', '2026-12-10')).toBeUndefined())
    expect(entries()).toHaveLength(CURRENT_TIMELINE.length - 1)
    expect(callsTo(fetchMock, TIMELINE_1)).toHaveLength(2)
    expect(callsTo(fetchMock, MONTHLY_1)).toHaveLength(2)
  })

  it("switching budgets shows the other budget's timeline", async () => {
    const { user } = renderAt('/budgets/1')
    await findMonth('Nov 2026')
    expect(entryFor('Paycheck', '2026-11-06')).toBeTruthy()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Budget' }), '2')

    await loaded('New car what-if')
    await waitFor(() => expect(entryFor('New car payment', '2026-12-01')).toBeTruthy())
    expect(entries()).toHaveLength(WHAT_IF_TIMELINE.length)
    expect(monthHeadings()).toEqual(['Dec 2026'])
    expect(entryFor('Paycheck', '2026-11-06')).toBeUndefined()
  })
})
