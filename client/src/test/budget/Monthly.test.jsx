import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import {
  CURRENT,
  CURRENT_MONTHLY,
  CURRENT_TIMELINE,
  emptyMonthly,
  monthRow,
  MONTHS,
  scheduleRoutes,
  summary,
  UNTITLED,
  WHAT_IF,
  WHAT_IF_MONTHLY,
} from '../fixtures.js'
import { DEMO, mockFetch } from '../mockFetch.js'

// A US time zone, so a UTC date bug would show the month before
globalThis.process.env.TZ = 'America/Denver'

const MONTHLY_1 = 'GET /api/budgets/1/monthly'
const MONTHLY_9 = 'GET /api/budgets/9/monthly'
const MONTH_LABELS = ['Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027', 'Apr 2027']

// The whole app at `path`, logged in. 1 = "Current", 2 = "New car what-if", 9 = empty.
function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/2': [200, WHAT_IF],
    'GET /api/budgets/9': [200, UNTITLED],
    ...scheduleRoutes(1, 2, 9),
    'GET /api/budgets/1/timeline': [200, CURRENT_TIMELINE],
    [MONTHLY_1]: [200, CURRENT_MONTHLY],
    'GET /api/budgets/2/monthly': [200, WHAT_IF_MONTHLY],
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

const panel = () => within(screen.getByRole('region', { name: 'Monthly cash flow' }))
const itemsPanel = () => within(screen.getByRole('region', { name: 'Cash flow items' }))
const loaded = (name) => screen.findByRole('heading', { level: 1, name })
const summaryBar = () => screen.queryByRole('region', { name: 'Summary' })

// Waits for the page, then for the table
async function findTable() {
  const region = await screen.findByRole('region', { name: 'Monthly cash flow' })
  return within(region).findByRole('table')
}
// The body rows (the first row is the header), each as its cells' text: [Month, In, Out, Net, Trend]
const bodyRows = () =>
  within(panel().getByRole('table'))
    .getAllByRole('row')
    .slice(1)
const cellsOf = (row) => [...row.cells].map((c) => c.textContent.trim())
const rowFor = (label) => bodyRows().find((r) => cellsOf(r)[0] === label)
const trendCell = (label) => within(rowFor(label).cells[4])

// "Income" followed by its value, e.g. "Income $4,200.00" or "Income: $4,200.00"
const pair = (label, money) => new RegExp(`${label}:?\\s*${money.replace(/[$.]/g, '\\$&')}`)

// Adds an item through the Cash flow items form
async function addItem(user, { name, amount, date, recurrence }) {
  const form = within(itemsPanel().getByRole('button', { name: 'Add item' }).closest('form'))
  await user.type(form.getByLabelText('Name'), name)
  await user.type(form.getByLabelText('Amount'), amount)
  await user.type(form.getByLabelText('Date'), date)
  if (recurrence) await user.selectOptions(form.getByLabelText('Recurrence'), recurrence)
  await user.click(form.getByRole('button', { name: 'Add item' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the monthly table', () => {
  it('has the columns Month, In, Out, Net and Trend', async () => {
    renderAt('/budgets/1')
    const table = await findTable()
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent.trim())
    expect(headers).toEqual(['Month', 'In', 'Out', 'Net', 'Trend'])
  })

  it("has one row per month the server sent, in the server's order", async () => {
    renderAt('/budgets/1')
    await findTable()
    expect(bodyRows().map((r) => cellsOf(r)[0])).toEqual(MONTH_LABELS)
  })

  it('shows In, Out and Net as money', async () => {
    renderAt('/budgets/1')
    await findTable()
    expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['$4,200.00', '$1,770.00', '$2,430.00'])
    expect(cellsOf(rowFor('Jan 2027')).slice(1, 4)).toEqual(['$6,300.00', '$1,770.00', '$4,530.00'])
  })

  it('shows a negative Net with a minus sign', async () => {
    renderAt('/budgets/2')
    await findTable()
    expect(cellsOf(rowFor('Dec 2026'))[3]).toBe('-$540.00')
  })

  it('shows "—" in In, Out and Net for a month with nothing in it', async () => {
    renderAt('/budgets/2')
    await findTable()
    expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['—', '—', '—'])
    // Only the income side being 0 is not an empty month
    expect(cellsOf(rowFor('Dec 2026')).slice(1, 4)).toEqual(['$0.00', '$540.00', '-$540.00'])
  })

  it('a month where In equals Out is not empty: it shows the numbers and $0.00 Net', async () => {
    const rows = [monthRow('2026-11', '500.00', '500.00'), ...emptyMonthly().slice(1)]
    renderAt('/budgets/1', { [MONTHLY_1]: [200, rows] })
    await findTable()
    expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['$500.00', '$500.00', '$0.00'])
  })

  it('shows all six months as "—" for a brand-new budget', async () => {
    renderAt('/budgets/9')
    await findTable()
    expect(bodyRows().map((r) => cellsOf(r)[0])).toEqual(MONTH_LABELS)
    for (const row of bodyRows()) {
      expect(cellsOf(row).slice(1, 4)).toEqual(['—', '—', '—'])
    }
  })

  it('shows ▲ "Up" when Net rose from the month before', async () => {
    renderAt('/budgets/1')
    await findTable()
    expect(trendCell('Jan 2027').getByLabelText('Up').textContent).toContain('▲')
    expect(trendCell('Jan 2027').queryByLabelText('Down')).toBeNull()
  })

  it('shows ▼ "Down" when Net fell, including into the negatives', async () => {
    renderAt('/budgets/1')
    await findTable()
    expect(trendCell('Dec 2026').getByLabelText('Down').textContent).toContain('▼')
    expect(trendCell('Mar 2027').getByLabelText('Down')).toBeTruthy()
    expect(trendCell('Mar 2027').queryByLabelText('Up')).toBeNull()
  })

  it('compares Net as numbers, not as text', async () => {
    // As text, "900.00" > "1000.00"
    const rows = [monthRow('2026-11', '900.00', '0.00'), monthRow('2026-12', '1000.00', '0.00'), ...emptyMonthly().slice(2)]
    renderAt('/budgets/1', { [MONTHLY_1]: [200, rows] })
    await findTable()
    expect(trendCell('Dec 2026').getByLabelText('Up')).toBeTruthy()
  })

  it('shows no arrow for the first month or when Net did not change', async () => {
    renderAt('/budgets/1')
    await findTable()
    expect(cellsOf(rowFor('Nov 2026'))[4]).toBe('')
    expect(cellsOf(rowFor('Apr 2027'))[4]).toBe('')
  })

  it('a month after an empty one compares against 0', async () => {
    renderAt('/budgets/2')
    await findTable()
    expect(trendCell('Dec 2026').getByLabelText('Down')).toBeTruthy()
    expect(cellsOf(rowFor('Jan 2027'))[4]).toBe('')
  })

  it.each([
    ['a server error', [500, { error: 'Boom' }], 'Boom'],
    ['Flask down', 'down', 'Could not reach the server'],
  ])('shows an error in the panel on %s, and the rest of the page still works', async (_, route, message) => {
    renderAt('/budgets/1', { [MONTHLY_1]: route })
    await loaded('Current')
    expect((await panel().findByRole('alert')).textContent).toContain(message)
    expect(panel().queryByRole('table')).toBeNull()
    expect(itemsPanel().getByRole('button', { name: 'Edit Rent' })).toBeTruthy()
  })
})

describe('the summary bar', () => {
  it("shows the current month's Income, Expenses and Net from the first row", async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    const bar = await screen.findByRole('region', { name: 'Summary' })
    expect(bar.textContent).toContain('Nov 2026')
    expect(bar.textContent).toMatch(pair('Income', '$4,200.00'))
    expect(bar.textContent).toMatch(pair('Expenses', '$1,770.00'))
    expect(bar.textContent).toMatch(pair('Net', '$2,430.00'))
  })

  it('does not add up the other months', async () => {
    renderAt('/budgets/1')
    const bar = await screen.findByRole('region', { name: 'Summary' })
    // The 6-month totals would be $27,300.00 / $12,940.00
    expect(bar.textContent).not.toContain('27,300.00')
    expect(bar.textContent).not.toContain('12,940.00')
  })

  it('reads $0.00 for an empty budget', async () => {
    renderAt('/budgets/9')
    const bar = await screen.findByRole('region', { name: 'Summary' })
    expect(bar.textContent).toMatch(pair('Income', '$0.00'))
    expect(bar.textContent).toMatch(pair('Expenses', '$0.00'))
    expect(bar.textContent).toMatch(pair('Net', '$0.00'))
  })

  it('shows a negative Net with a minus sign', async () => {
    const rows = [monthRow('2026-11', '100.00', '600.00'), ...emptyMonthly().slice(1)]
    renderAt('/budgets/1', { [MONTHLY_1]: [200, rows] })
    const bar = await screen.findByRole('region', { name: 'Summary' })
    expect(bar.textContent).toMatch(pair('Net', '-$500.00'))
  })

  it('is hidden until /monthly loads', async () => {
    renderAt('/budgets/1', { [MONTHLY_1]: () => new Promise(() => {}) })
    await loaded('Current')
    expect(summaryBar()).toBeNull()
  })

  it('is hidden when /monthly fails', async () => {
    renderAt('/budgets/1', { [MONTHLY_1]: [500, { error: 'Boom' }] })
    await loaded('Current')
    await panel().findByRole('alert')
    expect(summaryBar()).toBeNull()
  })
})

describe('keeping it in sync', () => {
  const VET2 = { id: 60, kind: 'expense', name: 'Vet', amount: '500.00', start_date: '2026-12-05', end_date: null, interval: null, unit: 'once' }

  it("a $500 one-time expense next month changes that month's Out and Net, not the summary", async () => {
    const { routes, user } = renderAt('/budgets/1', { 'POST /api/budgets/1/cash_flow_items': [201, VET2] })
    await findTable()
    await screen.findByRole('region', { name: 'Summary' })

    routes[MONTHLY_1] = [200, CURRENT_MONTHLY.map((r) => (r.month === '2026-12' ? monthRow(r.month, '4200.00', '2670.00') : r))]
    await addItem(user, { name: 'Vet', amount: '500', date: '2026-12-05', recurrence: 'One-time' })

    await waitFor(() => expect(cellsOf(rowFor('Dec 2026')).slice(2, 4)).toEqual(['$2,670.00', '$1,530.00']))
    expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['$4,200.00', '$1,770.00', '$2,430.00'])
    expect(summaryBar().textContent).toMatch(pair('Expenses', '$1,770.00'))
  })

  it('a $500 one-time expense this month also changes the summary', async () => {
    const thisMonth = { ...VET2, start_date: '2026-11-20' }
    const { routes, user } = renderAt('/budgets/1', { 'POST /api/budgets/1/cash_flow_items': [201, thisMonth] })
    await findTable()
    await screen.findByRole('region', { name: 'Summary' })

    routes[MONTHLY_1] = [200, CURRENT_MONTHLY.map((r) => (r.month === '2026-11' ? monthRow(r.month, '4200.00', '2270.00') : r))]
    await addItem(user, { name: 'Vet', amount: '500', date: '2026-11-20', recurrence: 'One-time' })

    await waitFor(() => expect(summaryBar().textContent).toMatch(pair('Expenses', '$2,270.00')))
    expect(summaryBar().textContent).toMatch(pair('Net', '$1,930.00'))
    expect(cellsOf(rowFor('Nov 2026')).slice(2, 4)).toEqual(['$2,270.00', '$1,930.00'])
  })

  it("an empty budget's first item fills in the table and the summary", async () => {
    const GYM = { id: 50, kind: 'expense', name: 'Gym', amount: '40.00', start_date: '2026-11-15', end_date: null, interval: 1, unit: 'month' }
    const { routes, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': [201, GYM] })
    await findTable()
    await screen.findByRole('region', { name: 'Summary' })

    routes[MONTHLY_9] = [200, MONTHS.map((m) => monthRow(m, '0.00', '40.00'))]
    await addItem(user, { name: 'Gym', amount: '40', date: '2026-11-15' })

    await waitFor(() => expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['$0.00', '$40.00', '-$40.00']))
    expect(cellsOf(rowFor('Apr 2027')).slice(1, 4)).toEqual(['$0.00', '$40.00', '-$40.00'])
    expect(summaryBar().textContent).toMatch(pair('Expenses', '$40.00'))
    expect(summaryBar().textContent).toMatch(pair('Net', '-$40.00'))
  })

  it("switching budgets shows the other budget's months and summary", async () => {
    const { user } = renderAt('/budgets/1')
    await findTable()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Budget' }), '2')

    await loaded('New car what-if')
    await waitFor(() => expect(cellsOf(rowFor('Dec 2026'))[3]).toBe('-$540.00'))
    expect(cellsOf(rowFor('Nov 2026')).slice(1, 4)).toEqual(['—', '—', '—'])
    expect(summaryBar().textContent).toMatch(pair('Income', '$0.00'))
  })
})
