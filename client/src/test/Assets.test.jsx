import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { CURRENT, summary, UNTITLED, WHAT_IF } from './fixtures.js'
import { callsTo, DEMO, mockFetch } from './mockFetch.js'

// A loan is an asset with a negative balance
const WITH_LOAN = {
  ...UNTITLED,
  id: 8,
  assets: [{ id: 80, name: 'Car loan', balance: '-1200.00' }],
}

function renderAt(path, routes = {}) {
  const allRoutes = {
    'GET /api/check_session': [200, DEMO],
    'GET /api/budgets': [200, [CURRENT, WHAT_IF, UNTITLED].map(summary)],
    'GET /api/budgets/1': [200, CURRENT],
    'GET /api/budgets/8': [200, WITH_LOAN],
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

// The item form also has a "Name" field, so everything is scoped to this panel
const panel = () => within(screen.getByRole('region', { name: 'Projected asset value' }))
const loaded = (name) => screen.findByRole('heading', { level: 1, name })
const addForm = () => within(panel().getByRole('button', { name: 'Add asset' }).closest('form'))
const rowText = (name) => panel().getByRole('button', { name: `Edit ${name}` }).closest('li').textContent
const bodyOf = (call) => JSON.parse(call[1].body)

async function retype(user, form, label, value) {
  await user.clear(form.getByLabelText(label))
  if (value) await user.type(form.getByLabelText(label), value)
}

const NEW_ASSET = { id: 50, name: 'Brokerage', balance: '3000.00' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the list', () => {
  it('shows "No assets yet" for an empty budget', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    expect(panel().getByText('No assets yet')).toBeTruthy()
  })

  it('shows each asset with its name and $balance', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    expect(panel().queryByText('No assets yet')).toBeNull()
    expect(rowText('Checking')).toContain('$2500.00')
    expect(rowText('Savings')).toContain('$8000.00')
  })

  it('shows a negative balance with its minus sign', async () => {
    renderAt('/budgets/8')
    await loaded('Untitled budget')
    expect(rowText('Car loan')).toMatch(/-\$?1200\.00/)
  })

  it('keeps assets out of the Cash flow items panel', async () => {
    renderAt('/budgets/1')
    await loaded('Current')
    const items = within(screen.getByRole('region', { name: 'Cash flow items' }))
    expect(items.queryByText(/Checking/)).toBeNull()
  })
})

describe('the add form', () => {
  it('starts with an empty Name and Balance', async () => {
    renderAt('/budgets/9')
    await loaded('Untitled budget')
    expect(addForm().getByLabelText('Name').value).toBe('')
    expect(addForm().getByLabelText('Balance').value).toBe('')
  })

  it('POSTs {name, balance} to /budgets/:id/assets', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/assets': [201, NEW_ASSET] })
    await loaded('Untitled budget')
    await retype(user, addForm(), 'Name', 'Brokerage')
    await retype(user, addForm(), 'Balance', '3000')
    await user.click(addForm().getByRole('button', { name: 'Add asset' }))

    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/budgets/9/assets')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, 'POST /api/budgets/9/assets')[0])).toEqual({ name: 'Brokerage', balance: '3000' })
  })

  it('on success, adds the row without a refetch and clears the form', async () => {
    const { fetchMock, user } = renderAt('/budgets/9', { 'POST /api/budgets/9/assets': [201, NEW_ASSET] })
    await loaded('Untitled budget')
    await retype(user, addForm(), 'Name', 'Brokerage')
    await retype(user, addForm(), 'Balance', '3000')
    await user.click(addForm().getByRole('button', { name: 'Add asset' }))

    await panel().findByRole('button', { name: 'Edit Brokerage' })
    expect(rowText('Brokerage')).toContain('$3000.00')
    expect(panel().queryByText('No assets yet')).toBeNull()
    expect(addForm().getByLabelText('Name').value).toBe('')
    expect(addForm().getByLabelText('Balance').value).toBe('')
    expect(callsTo(fetchMock, 'GET /api/budgets/9')).toHaveLength(1)
  })

  it("a blank balance shows the server's message and keeps the name", async () => {
    const { fetchMock, user } = renderAt('/budgets/9', {
      'POST /api/budgets/9/assets': [422, { errors: { balance: ['Not a valid number.'] } }],
    })
    await loaded('Untitled budget')
    await retype(user, addForm(), 'Name', 'Brokerage')
    await user.click(addForm().getByRole('button', { name: 'Add asset' }))

    expect((await panel().findByRole('alert')).textContent).toContain('balance: Not a valid number.')
    expect(addForm().getByLabelText('Name').value).toBe('Brokerage')
    expect(callsTo(fetchMock, 'POST /api/budgets/9/assets')).toHaveLength(1)
  })

  it('shows an error when the server is unreachable', async () => {
    const { user } = renderAt('/budgets/9', { 'POST /api/budgets/9/assets': 'down' })
    await loaded('Untitled budget')
    await retype(user, addForm(), 'Name', 'Brokerage')
    await user.click(addForm().getByRole('button', { name: 'Add asset' }))
    expect((await panel().findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('disables Add asset while the request is in flight', async () => {
    const { user } = renderAt('/budgets/9', { 'POST /api/budgets/9/assets': () => new Promise(() => {}) })
    await loaded('Untitled budget')
    await retype(user, addForm(), 'Name', 'Brokerage')
    const button = addForm().getByRole('button', { name: 'Add asset' })
    await user.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
  })
})

describe('editing an asset', () => {
  async function openEdit(path, title, name, routes) {
    const result = renderAt(path, routes)
    await loaded(title)
    await result.user.click(panel().getByRole('button', { name: `Edit ${name}` }))
    const form = within(panel().getByRole('button', { name: 'Save' }).closest('form'))
    return { ...result, form }
  }

  it('opens the form in the row, filled in with the asset', async () => {
    const { form } = await openEdit('/budgets/1', 'Current', 'Checking')
    expect(form.getByLabelText('Name').value).toBe('Checking')
    expect(form.getByLabelText('Balance').value).toBe('2500.00')
  })

  it('fills in a negative balance', async () => {
    const { form } = await openEdit('/budgets/8', 'Untitled budget', 'Car loan')
    expect(form.getByLabelText('Balance').value).toBe('-1200.00')
  })

  it('Cancel closes the form and sends nothing', async () => {
    const { fetchMock, form, user } = await openEdit('/budgets/1', 'Current', 'Checking')
    await retype(user, form, 'Balance', '1')
    await user.click(form.getByRole('button', { name: 'Cancel' }))

    expect(panel().queryByRole('button', { name: 'Save' })).toBeNull()
    expect(rowText('Checking')).toContain('$2500.00')
    expect(callsTo(fetchMock, 'PATCH /api/assets/1')).toHaveLength(0)
  })

  it("Save PATCHes /assets/:id and the row shows the server's answer", async () => {
    const { fetchMock, form, user } = await openEdit('/budgets/1', 'Current', 'Checking', {
      'PATCH /api/assets/1': [200, { id: 1, name: 'Checking', balance: '2750.00' }],
    })
    await retype(user, form, 'Balance', '2750')
    await user.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(panel().queryByRole('button', { name: 'Save' })).toBeNull())
    expect(rowText('Checking')).toContain('$2750.00')
    expect(rowText('Savings')).toContain('$8000.00')
    const patches = callsTo(fetchMock, 'PATCH /api/assets/1')
    expect(patches).toHaveLength(1)
    expect(bodyOf(patches[0])).toEqual({ name: 'Checking', balance: '2750' })
  })

  it("on a 422, shows the server's message and keeps the form open", async () => {
    const { form, user } = await openEdit('/budgets/1', 'Current', 'Checking', {
      'PATCH /api/assets/1': [422, { errors: { name: ['Name is required'] } }],
    })
    await retype(user, form, 'Name', '')
    await user.click(form.getByRole('button', { name: 'Save' }))

    expect((await panel().findByRole('alert')).textContent).toContain('name: Name is required')
    expect(form.getByLabelText('Balance').value).toBe('2500.00')
  })
})

describe('deleting an asset', () => {
  it('DELETEs /assets/:id and removes only that row', async () => {
    const { fetchMock, user } = renderAt('/budgets/1', { 'DELETE /api/assets/1': [204, null] })
    await loaded('Current')
    await user.click(panel().getByRole('button', { name: 'Delete Checking' }))

    await waitFor(() => expect(panel().queryByRole('button', { name: 'Edit Checking' })).toBeNull())
    expect(callsTo(fetchMock, 'DELETE /api/assets/1')).toHaveLength(1)
    expect(panel().getByRole('button', { name: 'Edit Savings' })).toBeTruthy()
  })

  it('deleting the last asset shows the empty state', async () => {
    const { user } = renderAt('/budgets/8', { 'DELETE /api/assets/80': [204, null] })
    await loaded('Untitled budget')
    await user.click(panel().getByRole('button', { name: 'Delete Car loan' }))
    expect(await panel().findByText('No assets yet')).toBeTruthy()
  })

  it('shows the error and keeps the row when the DELETE fails', async () => {
    const { user } = renderAt('/budgets/1', { 'DELETE /api/assets/1': [403, { error: 'Forbidden' }] })
    await loaded('Current')
    await user.click(panel().getByRole('button', { name: 'Delete Checking' }))

    expect((await panel().findByRole('alert')).textContent).toContain('Forbidden')
    expect(panel().getByRole('button', { name: 'Edit Checking' })).toBeTruthy()
  })
})
