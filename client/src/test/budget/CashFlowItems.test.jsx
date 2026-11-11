import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { formatDate } from '../../utils/format.js'
import { CURRENT, scheduleRoutes, summary, UNTITLED, WHAT_IF } from '../fixtures.js'
import { callsTo, DEMO, mockFetch } from '../mockFetch.js'

// A US time zone, so a UTC date bug would show the day before
globalThis.process.env.TZ = 'America/Denver'

// Every 10 days matches no preset
const CUSTOM = {
  ...UNTITLED,
  id: 7,
  cash_flow_items: [{ id: 70, kind: 'expense', name: 'Dog food', amount: '45.00', start_date: '2026-11-02', end_date: null, interval: 10, unit: 'day' }],
}

function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    ...scheduleRoutes(1, 2, 7, 9),
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/2': [200, WHAT_IF],
    'GET /api/budgets/7': [200, CUSTOM],
    'GET /api/budgets/9': [200, UNTITLED],
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
  return { fetchMock, user: userEvent.setup() }
}

const panel = () => within(screen.getByRole('region', { name: 'Cash flow items' }))
const loaded = (name) => screen.findByRole('heading', { level: 1, name })
// The add form is the one with the "Add item" button
const addForm = () => within(panel().getByRole('button', { name: 'Add item' }).closest('form'))
// A row is the <li> holding that item's buttons
const rowText = (name) => panel().getByRole('button', { name: `Edit ${name}` }).closest('li').textContent
const bodyOf = (call) => JSON.parse(call[1].body)
const selectedText = (select) => select.selectedOptions[0].textContent

// Fills the add form. Leaves Type and Recurrence at their defaults unless given.
async function fill(user, form, { name, amount, date, endDate, type, recurrence }) {
  if (name !== undefined) {
    await user.clear(form.getByLabelText('Name'))
    if (name) await user.type(form.getByLabelText('Name'), name)
  }
  if (amount !== undefined) {
    await user.clear(form.getByLabelText('Amount'))
    if (amount) await user.type(form.getByLabelText('Amount'), amount)
  }
  if (date) await user.type(form.getByLabelText('Date'), date)
  if (endDate) await user.type(form.getByLabelText('End date'), endDate)
  if (type) await user.click(form.getByRole('radio', { name: type }))
  if (recurrence) await user.selectOptions(form.getByLabelText('Recurrence'), recurrence)
}

const RENT_ROW = CURRENT.cash_flow_items[1]
const NEW_ITEM = { id: 50, kind: 'expense', name: 'Gym', amount: '40.00', start_date: '2026-11-15', end_date: null, interval: 1, unit: 'month' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the list', () => {
  it('shows "No cash flow items yet" for an empty budget', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    expect(panel().getByText('No cash flow items yet')).toBeTruthy()
  })

  it('shows one row per item', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    expect(panel().queryByText('No cash flow items yet')).toBeNull()
    for (const { name } of CURRENT.cash_flow_items) {
      expect(rowText(name)).toContain(name)
    }
  })

  it('a row shows the kind, amount, recurrence and start date', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    const text = rowText('Rent')
    expect(text).toContain('Expense')
    expect(text).toContain('$1,450.00')
    expect(text).toContain('Monthly')
    expect(text).toContain(formatDate('2026-01-01'))
  })

  it('an income row says Income, and a one-time row says One-time', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    const paycheck = rowText('Paycheck')
    expect(paycheck).toContain('Income')
    expect(paycheck).toContain('Every 2 weeks')
    expect(rowText('Vet visit')).toContain('One-time')
  })

  it('shows "until <end date>" only when there is one', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    expect(rowText('Car payment')).toContain(`until ${formatDate('2029-05-15')}`)
    expect(rowText('Rent')).not.toMatch(/until|null/)
  })

  it('labels a custom recurrence "Every 10 days"', async () => {
    renderAt('/budgets/7')
    await loaded('Untitled budget')
    expect(rowText('Dog food')).toContain('Every 10 days')
  })
})

describe('the add form', () => {
  it('starts empty, with Expense and Monthly picked', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    const form = addForm()
    expect(form.getByLabelText('Name').value).toBe('')
    expect(form.getByLabelText('Amount').value).toBe('')
    expect(form.getByLabelText('Date').value).toBe('')
    expect(form.getByLabelText('End date').value).toBe('')
    expect(form.getByRole('radio', { name: 'Expense' }).checked).toBe(true)
    expect(form.getByRole('radio', { name: 'Income' }).checked).toBe(false)
    expect(selectedText(form.getByLabelText('Recurrence'))).toBe('Monthly')
  })

  it('offers the six presets as Recurrence options', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    const options = [...addForm().getByLabelText('Recurrence').options].map((o) => o.textContent)
    expect(options).toEqual(['One-time', 'Weekly', 'Every 2 weeks', 'Monthly', 'Every 3 months', 'Yearly'])
  })

  it('POSTs a monthly expense to /budgets/:id/cash_flow_items', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': [201, NEW_ITEM] })
    await loaded('Untitled budget')
    await fill(user, addForm(), { name: 'Gym', amount: '40', date: '2026-11-15' })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))

    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')[0])).toEqual({
      kind: 'expense',
      name: 'Gym',
      amount: '40',
      start_date: '2026-11-15',
      end_date: null,
      interval: 1,
      unit: 'month',
    })
  })

  it('sends income, an end date and the chosen preset', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', {
      'POST /api/budgets/9/cash_flow_items': [201, { ...NEW_ITEM, kind: 'income', name: 'Side job', interval: 2, unit: 'week' }],
    })
    await loaded('Untitled budget')
    await fill(user, addForm(), {
      name: 'Side job', amount: '300', date: '2026-11-06', endDate: '2027-06-30', type: 'Income', recurrence: 'Every 2 weeks',
    })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))

    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')[0])).toMatchObject({
      kind: 'income',
      name: 'Side job',
      amount: '300',
      start_date: '2026-11-06',
      end_date: '2027-06-30',
      interval: 2,
      unit: 'week',
    })
  })

  it('One-time sends interval null and unit "once"', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', {
      'POST /api/budgets/9/cash_flow_items': [201, { ...NEW_ITEM, interval: null, unit: 'once' }],
    })
    await loaded('Untitled budget')
    await fill(user, addForm(), { name: 'Gym', amount: '40', date: '2026-11-15', recurrence: 'One-time' })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))

    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')[0])).toMatchObject({ interval: null, unit: 'once' })
  })

  it('on success, adds the row without a refetch and clears the form', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': [201, NEW_ITEM] })
    await loaded('Untitled budget')
    await fill(user, addForm(), { name: 'Gym', amount: '40', date: '2026-11-15' })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))

    expect(await panel().findByRole('button', { name: 'Edit Gym' })).toBeTruthy()
    expect(panel().queryByText('No cash flow items yet')).toBeNull()
    expect(addForm().getByLabelText('Name').value).toBe('')
    expect(addForm().getByLabelText('Amount').value).toBe('')
    expect(callsTo(fetchMock, 'GET /api/budgets/9')).toHaveLength(1)
  })

  it.each([
    ['a blank name', { name: '', amount: '40' }, { name: ['Name is required'] }, 'name: Name is required'],
    ['amount 0', { name: 'Gym', amount: '0' }, { amount: ['Must be greater than 0 and less than 100000000.'] }, 'amount: Must be greater than 0'],
  ])("%s shows the server's message and keeps what you typed", async (_, input, errors, message) => {
    const { user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': [422, { errors }] })
    await loaded('Untitled budget')
    await fill(user, addForm(), { ...input, date: '2026-11-15' })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))

    expect((await panel().findByRole('alert')).textContent).toContain(message)
    expect(addForm().getByLabelText('Amount').value).toBe(input.amount)
    expect(addForm().getByLabelText('Date').value).toBe('2026-11-15')
    expect(panel().getByText('No cash flow items yet')).toBeTruthy()
  })

  it('lets the server judge a blank form (no browser validation)', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', {
      'POST /api/budgets/9/cash_flow_items': [422, { errors: { name: ['Name is required'] } }],
    })
    await loaded('Untitled budget')
    await user.click(addForm().getByRole('button', { name: 'Add item' }))
    await panel().findByRole('alert')
    expect(callsTo(fetchMock, 'POST /api/budgets/9/cash_flow_items')).toHaveLength(1)
  })

  it('shows an error when the server is unreachable', async () => {
    const { user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': 'down' })
    await loaded('Untitled budget')
    await fill(user, addForm(), { name: 'Gym', amount: '40', date: '2026-11-15' })
    await user.click(addForm().getByRole('button', { name: 'Add item' }))
    expect((await panel().findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('disables Add item while the request is in flight', async () => {
    const { user } = renderAt('/budgets/9', { 'POST /api/budgets/9/cash_flow_items': () => new Promise(() => {}) })
    await loaded('Untitled budget')
    await fill(user, addForm(), { name: 'Gym', amount: '40', date: '2026-11-15' })
    const button = addForm().getByRole('button', { name: 'Add item' })
    await user.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
  })
})

describe('editing an item', () => {
  async function openEdit(path, budgetTitle, name, routes) {
    const result = renderAt(path, routes)
    await loaded(budgetTitle)
    await result.user.click(panel().getByRole('button', { name: `Edit ${name}` }))
    // The edit form replaces the row's buttons; find it by its Save button
    const form = within(panel().getByRole('button', { name: 'Save' }).closest('form'))
    return { ...result, form }
  }

  it('opens the form in the row, filled in with the item', async () => {
    const { form } = await openEdit('/budgets/1', 'Current', 'Car payment')
    expect(form.getByLabelText('Name').value).toBe('Car payment')
    expect(form.getByLabelText('Amount').value).toBe('320.00')
    expect(form.getByLabelText('Date').value).toBe('2025-06-15')
    expect(form.getByLabelText('End date').value).toBe('2029-05-15')
    expect(form.getByRole('radio', { name: 'Expense' }).checked).toBe(true)
    expect(selectedText(form.getByLabelText('Recurrence'))).toBe('Monthly')
  })

  it('fills in Income and the matching preset for an income item', async () => {
    const { form } = await openEdit('/budgets/1', 'Current', 'Paycheck')
    expect(form.getByRole('radio', { name: 'Income' }).checked).toBe(true)
    expect(selectedText(form.getByLabelText('Recurrence'))).toBe('Every 2 weeks')
  })

  it('Cancel closes the form and sends nothing', async () => {
    const { fetchMock, form, user } = await openEdit('/budgets/1', 'Current', 'Rent')
    await fill(user, form, { amount: '9999' })
    await user.click(form.getByRole('button', { name: 'Cancel' }))

    expect(panel().queryByRole('button', { name: 'Save' })).toBeNull()
    expect(rowText('Rent')).toContain('$1,450.00')
    expect(callsTo(fetchMock, 'PATCH /api/cash_flow_items/2')).toHaveLength(0)
  })

  it('Save PATCHes /cash_flow_items/:id with the full item and updates the row', async () => {
    const { fetchMock, form, user } = await openEdit('/budgets/1', 'Current', 'Rent', {
      'PATCH /api/cash_flow_items/2': [200, { ...RENT_ROW, amount: '1500.00' }],
    })
    await fill(user, form, { amount: '1500' })
    await user.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(panel().queryByRole('button', { name: 'Save' })).toBeNull())
    expect(rowText('Rent')).toContain('$1,500.00')
    const patches = callsTo(fetchMock, 'PATCH /api/cash_flow_items/2')
    expect(patches).toHaveLength(1)
    expect(bodyOf(patches[0])).toEqual({
      kind: 'expense',
      name: 'Rent',
      amount: '1500',
      start_date: '2026-01-01',
      end_date: null,
      interval: 1,
      unit: 'month',
    })
  })

  it('keeps the other rows as they were', async () => {
    const { form, user } = await openEdit('/budgets/1', 'Current', 'Rent', {
      'PATCH /api/cash_flow_items/2': [200, { ...RENT_ROW, amount: '1500.00' }],
    })
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(panel().queryByRole('button', { name: 'Save' })).toBeNull())
    for (const { name } of CURRENT.cash_flow_items) {
      expect(panel().getByRole('button', { name: `Edit ${name}` })).toBeTruthy()
    }
  })

  it("on a 422, shows the server's message and keeps the form open", async () => {
    const { form, user } = await openEdit('/budgets/1', 'Current', 'Rent', {
      'PATCH /api/cash_flow_items/2': [422, { errors: { amount: ['Must be greater than 0 and less than 100000000.'] } }],
    })
    await fill(user, form, { amount: '0' })
    await user.click(form.getByRole('button', { name: 'Save' }))

    expect((await panel().findByRole('alert')).textContent).toContain('amount: Must be greater than 0')
    expect(form.getByLabelText('Amount').value).toBe('0')
  })

  it('a custom recurrence survives an unchanged save', async () => {
    const dogFood = CUSTOM.cash_flow_items[0]
    const { fetchMock, form, user } = await openEdit('/budgets/7', 'Untitled budget', 'Dog food', {
      'PATCH /api/cash_flow_items/70': [200, dogFood],
    })
    expect(selectedText(form.getByLabelText('Recurrence'))).toBe('Every 10 days')
    await user.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(callsTo(fetchMock, 'PATCH /api/cash_flow_items/70')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, 'PATCH /api/cash_flow_items/70')[0])).toMatchObject({ interval: 10, unit: 'day' })
  })
})

describe('deleting an item', () => {
  it('DELETEs /cash_flow_items/:id and removes only that row', async () => {
    const { fetchMock, user } = renderAt('/budgets/1', { 'DELETE /api/cash_flow_items/2': [204, null] })
    await loaded('Current')
    await user.click(panel().getByRole('button', { name: 'Delete Rent' }))

    await waitFor(() => expect(panel().queryByRole('button', { name: 'Edit Rent' })).toBeNull())
    expect(callsTo(fetchMock, 'DELETE /api/cash_flow_items/2')).toHaveLength(1)
    expect(panel().getByRole('button', { name: 'Edit Paycheck' })).toBeTruthy()
  })

  it('deleting the last item shows the empty state', async () => {
    const { user } = renderAt('/budgets/7', { 'DELETE /api/cash_flow_items/70': [204, null] })
    await loaded('Untitled budget')
    await user.click(panel().getByRole('button', { name: 'Delete Dog food' }))
    expect(await panel().findByText('No cash flow items yet')).toBeTruthy()
  })

  it('shows the error and keeps the row when the DELETE fails', async () => {
    const { user } = renderAt('/budgets/1', { 'DELETE /api/cash_flow_items/2': [403, { error: 'Forbidden' }] })
    await loaded('Current')
    await user.click(panel().getByRole('button', { name: 'Delete Rent' }))

    expect((await panel().findByRole('alert')).textContent).toContain('Forbidden')
    expect(panel().getByRole('button', { name: 'Edit Rent' })).toBeTruthy()
  })
})
