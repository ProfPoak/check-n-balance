import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { CURRENT, scheduleRoutes, summary, UNTITLED, WHAT_IF } from '../fixtures.js'
import { callsTo, DEMO, held, mockFetch } from '../mockFetch.js'

// The whole app at `path`, logged in, with the demo's three budgets
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
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { fetchMock, routes: allRoutes }
}

const title = (name) => screen.findByRole('heading', { level: 1, name })
const selector = () => screen.findByRole('combobox', { name: 'Budget' })
const button = (name) => screen.getByRole('button', { name })

// Loads /budgets/1 and opens the Edit budget form
async function openEdit(routes) {
  const result = renderAt('/budgets/1', routes)
  const user = userEvent.setup()
  await title('Current')
  await user.click(button('Edit budget'))
  return { ...result, user }
}

async function retype(user, label, value) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (value) await user.type(input, value)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the budget selector', () => {
  it("lists every budget by title, with the budget's id as the value", async () => {
    renderAt('/budgets/1')
    const select = await selector()
    const options = [...select.options].map((o) => [o.value, o.textContent])
    expect(options).toEqual([
      ['1', 'Current'],
      ['2', 'New car what-if'],
      ['9', 'Untitled budget'],
    ])
  })

  it('has the current budget selected', async () => {
    renderAt('/budgets/2')
    await title('New car what-if')
    expect((await selector()).value).toBe('2')
  })

  it('switches to the chosen budget', async () => {
    const { fetchMock } = renderAt('/budgets/1')
    await title('Current')
    await userEvent.setup().selectOptions(await selector(), '2')

    expect(await title('New car what-if')).toBeTruthy()
    expect(callsTo(fetchMock, 'GET /api/budgets/2')).toHaveLength(1)
    expect((await selector()).value).toBe('2')
  })

  it('is hidden when GET /budgets fails, and the page still works', async () => {
    renderAt('/budgets/1', { 'GET /api/budgets': [502, 'Bad Gateway'] })
    await title('Current')
    expect(screen.queryByRole('combobox', { name: 'Budget' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit budget' })).toBeTruthy()
  })
})

describe('editing the budget', () => {
  it('opens a form filled in with the current values', async () => {
    await openEdit()
    expect(screen.getByLabelText('Title').value).toBe('Current')
    expect(screen.getByLabelText('Description').value).toBe('Real numbers')
    expect(screen.getByLabelText('Balance as of').value).toBe('2026-11-09')
  })

  it('shows an empty Description (not "null") for a budget with no description', async () => {
    renderAt('/budgets/9')
    await title('Untitled budget')
    await userEvent.setup().click(button('Edit budget'))
    expect(screen.getByLabelText('Description').value).toBe('')
  })

  it('Cancel closes the form and sends nothing', async () => {
    const { fetchMock, user } = await openEdit()
    await retype(user, 'Title', 'Changed my mind')
    await user.click(button('Cancel'))

    expect(screen.queryByLabelText('Title')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current')
    expect(callsTo(fetchMock, 'PATCH /api/budgets/1')).toHaveLength(0)
  })

  it('Save PATCHes /budgets/:id with title, description and balance_as_of', async () => {
    const { fetchMock, user } = await openEdit({
      'PATCH /api/budgets/1': [200, { ...CURRENT, title: 'Household', balance_as_of: '2026-12-01' }],
    })
    await retype(user, 'Title', 'Household')
    await retype(user, 'Balance as of', '2026-12-01')
    await user.click(button('Save'))

    await title('Household')
    const patches = callsTo(fetchMock, 'PATCH /api/budgets/1')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0][1].body)).toEqual({
      title: 'Household',
      description: 'Real numbers',
      balance_as_of: '2026-12-01',
    })
  })

  it('on success, updates the heading and the selector and closes the form', async () => {
    const { user } = await openEdit({ 'PATCH /api/budgets/1': [200, { ...CURRENT, title: 'Household' }] })
    await retype(user, 'Title', 'Household')
    await user.click(button('Save'))

    expect(await title('Household')).toBeTruthy()
    expect(screen.queryByLabelText('Title')).toBeNull()
    const select = await selector()
    expect([...select.options].map((o) => o.textContent)).toEqual(['Household', 'New car what-if', 'Untitled budget'])
    expect(select.value).toBe('1')
  })

  it("on a 422, shows the server's message and keeps the form and what you typed", async () => {
    const { user } = await openEdit({
      'PATCH /api/budgets/1': [422, { errors: { title: ['Title must be 1 to 50 characters'] } }],
    })
    await retype(user, 'Title', '')
    await retype(user, 'Description', 'Still here')
    await user.click(button('Save'))

    expect((await screen.findByRole('alert')).textContent).toContain('title: Title must be 1 to 50 characters')
    expect(screen.getByLabelText('Description').value).toBe('Still here')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current')
  })

  it('shows an error when the server is unreachable', async () => {
    const { user } = await openEdit({ 'PATCH /api/budgets/1': 'down' })
    await user.click(button('Save'))
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
    expect(screen.getByLabelText('Title')).toBeTruthy()
  })

  it('an open form does not carry over to another budget', async () => {
    const { user } = await openEdit()
    await retype(user, 'Title', 'Half typed')
    await user.selectOptions(await selector(), '2')

    await title('New car what-if')
    expect(screen.queryByLabelText('Title')).toBeNull()
    expect(screen.queryByDisplayValue('Half typed')).toBeNull()
  })
})

describe('deleting the budget', () => {
  it('asks first, and Cancel sends nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { fetchMock } = renderAt('/budgets/1')
    await title('Current')
    await userEvent.setup().click(button('Delete budget'))

    expect(confirm).toHaveBeenCalledWith('Delete this budget?')
    expect(callsTo(fetchMock, 'DELETE /api/budgets/1')).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current')
  })

  it('OK DELETEs /budgets/:id and goes Home', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { fetchMock, routes } = renderAt('/budgets/1', { 'DELETE /api/budgets/1': [204, null] })
    await title('Current')

    routes['GET /api/budgets'] = [200, [WHAT_IF, UNTITLED].map(summary)]
    await userEvent.setup().click(button('Delete budget'))

    expect(await title('Welcome, demo@example.com')).toBeTruthy()
    expect(callsTo(fetchMock, 'DELETE /api/budgets/1')).toHaveLength(1)
    await screen.findByRole('link', { name: /New car what-if/ })
    expect(screen.queryByRole('link', { name: /^Current/ })).toBeNull()
  })

  it('shows the error and stays when the DELETE fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/budgets/1', { 'DELETE /api/budgets/1': [403, { error: 'Forbidden' }] })
    await title('Current')
    await userEvent.setup().click(button('Delete budget'))

    expect((await screen.findByRole('alert')).textContent).toContain('Forbidden')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current'))
  })

  it('Delete budget is disabled while the DELETE is in flight (one request), and comes back after a failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const del = held()
    const { fetchMock } = renderAt('/budgets/1', { 'DELETE /api/budgets/1': del.route })
    const user = userEvent.setup()
    await title('Current')

    await user.click(button('Delete budget'))
    await waitFor(() => expect(button('Delete budget').disabled).toBe(true))
    await user.click(button('Delete budget'))
    expect(callsTo(fetchMock, 'DELETE /api/budgets/1')).toHaveLength(1)

    del.release(500, { error: 'Boom' })
    await waitFor(() => expect(button('Delete budget').disabled).toBe(false))
    expect(screen.getByRole('alert').textContent).toContain('Boom')
  })

  it('Cancel on the confirm leaves Delete budget enabled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/budgets/1')
    await title('Current')
    await userEvent.setup().click(button('Delete budget'))
    expect(button('Delete budget').disabled).toBe(false)
  })
})
