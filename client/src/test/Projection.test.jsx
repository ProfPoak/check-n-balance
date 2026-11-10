import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { formatDate } from '../utils/format.js'
import { CURRENT, scheduleRoutes, summary, UNTITLED, WHAT_IF } from './fixtures.js'
import { callsTo, DEMO, mockFetch } from './mockFetch.js'

// A US time zone, so a UTC date bug would show the day before
globalThis.process.env.TZ = 'America/Denver'

const TO_DEC_31 = 'GET /api/budgets/1/projection?to=2026-12-31'

// What GET /budgets/1/projection?to=2026-12-31 sends for "Current" (Checking 2500 + Savings 8000)
const PROJECTION = {
  as_of: '2026-11-09',
  to: '2026-12-31',
  starting_balance: '10500.00',
  income: '8400.00',
  expenses: '4310.00',
  net: '4090.00',
  projected_balance: '14590.00',
}

// The whole app at `path`, logged in
function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/2': [200, WHAT_IF],
    ...scheduleRoutes(1, 2),
    [TO_DEC_31]: [200, PROJECTION],
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

const panel = () => within(screen.getByRole('region', { name: 'Projected asset value' }))
const itemsPanel = () => within(screen.getByRole('region', { name: 'Cash flow items' }))
const loaded = (name) => screen.findByRole('heading', { level: 1, name })
const panelText = () => screen.getByRole('region', { name: 'Projected asset value' }).textContent
const AS_OF = `Balances as of ${formatDate('2026-11-09')}`

// "Starting balance" followed by its value, with or without a colon
const pair = (label, money) => new RegExp(`${label}:?\\s*${money.replace(/[$.]/g, '\\$&')}`)

// Loads "Current", types the date and clicks Calculate All
async function calculate(routes, date = '2026-12-31') {
  const result = renderAt('/budgets/1', routes)
  await loaded('Current')
  if (date) await result.user.type(panel().getByLabelText('Project to'), date)
  await result.user.click(panel().getByRole('button', { name: 'Calculate All' }))
  return result
}

// Loads "Current" and shows the Dec 31 projection
async function withResult(routes) {
  const result = await calculate(routes)
  await panel().findByText(AS_OF)
  return result
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the projection form', () => {
  it('has a "Project to" date input and a Calculate All button in the Projected asset value panel', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    expect(panel().getByLabelText('Project to').type).toBe('date')
    expect(panel().getByRole('button', { name: 'Calculate All' })).toBeTruthy()
  })

  it('shows no result before you calculate', async () => {
    const { fetchMock } = renderAt('/budgets/1')
    await loaded('Current')
    expect(panel().queryByText(/Balances as of/)).toBeNull()
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/projection'))).toHaveLength(0)
  })

  it('Calculate All sends GET /budgets/:id/projection?to=<date> once', async () => {
    const { fetchMock } = await withResult()
    expect(callsTo(fetchMock, TO_DEC_31)).toHaveLength(1)
  })
})

describe('the result', () => {
  it('shows the balance date, starting balance, net change and projected balance', async () => {
    await withResult()
    const text = panelText()
    expect(text).toContain(AS_OF)
    expect(text).toMatch(pair('Starting balance', '$10,500.00'))
    expect(text).toMatch(pair('Net change', '$4,090.00'))
    expect(text).toMatch(pair('Projected balance', '$14,590.00'))
  })

  it('shows a negative net change and projected balance with a minus sign', async () => {
    const losing = { ...PROJECTION, starting_balance: '500.00', income: '0.00', expenses: '1500.00', net: '-1500.00', projected_balance: '-1000.00' }
    await withResult({ [TO_DEC_31]: [200, losing] })
    expect(panelText()).toMatch(pair('Net change', '-$1,500.00'))
    expect(panelText()).toMatch(pair('Projected balance', '-$1,000.00'))
  })

  it('keeps the asset list showing alongside the result', async () => {
    await withResult()
    expect(panel().getByRole('button', { name: 'Edit Checking' })).toBeTruthy()
    expect(panel().getByRole('button', { name: 'Edit Savings' })).toBeTruthy()
  })
})

describe('errors', () => {
  it("shows the server's error for a date before the balance date", async () => {
    const early = 'GET /api/budgets/1/projection?to=2026-10-01'
    await calculate(
      { [early]: [422, { errors: { to: ['Projection date must be on or after the assets balance date'] } }] },
      '2026-10-01',
    )
    expect((await panel().findByRole('alert')).textContent).toContain(
      'to: Projection date must be on or after the assets balance date',
    )
    expect(panel().queryByText(/Balances as of/)).toBeNull()
  })

  it("a blank date still asks the server and shows its error", async () => {
    const { fetchMock } = await calculate(
      { 'GET /api/budgets/1/projection?to=': [422, { errors: { to: ['to must be in YYYY-MM-DD format'] } }] },
      '',
    )
    expect((await panel().findByRole('alert')).textContent).toContain('to: to must be in YYYY-MM-DD format')
    expect(callsTo(fetchMock, 'GET /api/budgets/1/projection?to=')).toHaveLength(1)
  })

  it('shows "Could not reach the server" when Flask is down', async () => {
    await calculate({ [TO_DEC_31]: 'down' })
    expect((await panel().findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('a successful calculate clears the earlier error', async () => {
    const { routes, user } = await calculate({ [TO_DEC_31]: [500, { error: 'Boom' }] })
    await panel().findByRole('alert')

    routes[TO_DEC_31] = [200, PROJECTION]
    await user.click(panel().getByRole('button', { name: 'Calculate All' }))

    await panel().findByText(AS_OF)
    expect(panel().queryByRole('alert')).toBeNull()
  })
})

describe('clearing a stale projection', () => {
  const gone = () => waitFor(() => expect(panel().queryByText(/Balances as of/)).toBeNull())

  it('adding an item clears it', async () => {
    const GYM = { id: 50, kind: 'expense', name: 'Gym', amount: '40.00', start_date: '2026-11-15', end_date: null, interval: 1, unit: 'month' }
    const { user } = await withResult({ 'POST /api/budgets/1/cash_flow_items': [201, GYM] })
    const form = within(itemsPanel().getByRole('button', { name: 'Add item' }).closest('form'))
    await user.type(form.getByLabelText('Name'), 'Gym')
    await user.type(form.getByLabelText('Amount'), '40')
    await user.type(form.getByLabelText('Date'), '2026-11-15')
    await user.click(form.getByRole('button', { name: 'Add item' }))
    await itemsPanel().findByRole('button', { name: 'Edit Gym' })
    await gone()
  })

  it('deleting an item clears it', async () => {
    const { user } = await withResult({ 'DELETE /api/cash_flow_items/5': [204, null] })
    await user.click(itemsPanel().getByRole('button', { name: 'Delete Vet visit' }))
    await waitFor(() => expect(itemsPanel().queryByRole('button', { name: 'Edit Vet visit' })).toBeNull())
    await gone()
  })

  it('adding an asset clears it', async () => {
    const { user } = await withResult({ 'POST /api/budgets/1/assets': [201, { id: 50, name: 'Brokerage', balance: '3000.00' }] })
    const form = within(panel().getByRole('button', { name: 'Add asset' }).closest('form'))
    await user.type(form.getByLabelText('Name'), 'Brokerage')
    await user.type(form.getByLabelText('Balance'), '3000')
    await user.click(form.getByRole('button', { name: 'Add asset' }))
    await panel().findByRole('button', { name: 'Edit Brokerage' })
    await gone()
  })

  it("editing an asset's balance clears it", async () => {
    const { user } = await withResult({ 'PATCH /api/assets/1': [200, { id: 1, name: 'Checking', balance: '2750.00' }] })
    await user.click(panel().getByRole('button', { name: 'Edit Checking' }))
    const form = within(panel().getByRole('button', { name: 'Save' }).closest('form'))
    await user.clear(form.getByLabelText('Balance'))
    await user.type(form.getByLabelText('Balance'), '2750')
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(panel().queryByRole('button', { name: 'Save' })).toBeNull())
    await gone()
  })

  it('deleting an asset clears it', async () => {
    const { user } = await withResult({ 'DELETE /api/assets/1': [204, null] })
    await user.click(panel().getByRole('button', { name: 'Delete Checking' }))
    await waitFor(() => expect(panel().queryByRole('button', { name: 'Edit Checking' })).toBeNull())
    await gone()
  })

  it('saving the budget (a new balance-as-of date) clears it', async () => {
    const { user } = await withResult({ 'PATCH /api/budgets/1': [200, { ...CURRENT, balance_as_of: '2026-11-01' }] })
    await user.click(screen.getByRole('button', { name: 'Edit budget' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    await gone()
  })

  it('a failed asset add keeps it', async () => {
    const { user } = await withResult({ 'POST /api/budgets/1/assets': [422, { errors: { name: ['Name is required'] } }] })
    const form = within(panel().getByRole('button', { name: 'Add asset' }).closest('form'))
    await user.type(form.getByLabelText('Balance'), '3000')
    await user.click(form.getByRole('button', { name: 'Add asset' }))
    await panel().findByRole('alert')
    expect(panel().getByText(AS_OF)).toBeTruthy()
  })

  it('you can calculate again after it clears', async () => {
    const { routes, user } = await withResult({ 'DELETE /api/assets/1': [204, null] })
    await user.click(panel().getByRole('button', { name: 'Delete Checking' }))
    await gone()

    routes[TO_DEC_31] = [200, { ...PROJECTION, starting_balance: '8000.00', projected_balance: '12090.00' }]
    const input = panel().getByLabelText('Project to')
    if (!input.value) await user.type(input, '2026-12-31')
    await user.click(panel().getByRole('button', { name: 'Calculate All' }))

    await panel().findByText(AS_OF)
    expect(panelText()).toMatch(pair('Projected balance', '$12,090.00'))
  })

  it('switching budgets clears it', async () => {
    const { user } = await withResult()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Budget' }), '2')
    await loaded('New car what-if')
    expect(panel().queryByText(/Balances as of/)).toBeNull()
  })
})
