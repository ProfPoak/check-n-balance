import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import SignupPage from '../pages/SignupPage.jsx'
import { callsTo, mockFetch } from './mockFetch.js'

const LOGGED_OUT = [401, { error: 'Not logged in' }]
const NEW_USER = { id: 7, email: 'new@example.com' }

// Renders /signup with stand-in pages for where it can send you.
// Uses the routes object itself (not a copy) so tests can change answers mid-test.
async function renderSignup(routes) {
  routes['GET /api/check_session'] ??= LOGGED_OUT
  const fetchMock = mockFetch(routes)
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <AuthProvider>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<h1>HOME</h1>} />
          <Route path="/login" element={<h1>LOGIN PAGE</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Signup' })
  return fetchMock
}

async function fillAndSubmit({
  email = 'new@example.com',
  password = 'password123',
  confirm = password,
} = {}) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirm)
  await user.click(screen.getByRole('button', { name: 'Sign up' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the signup form', () => {
  it('has Email, Password and Confirm password inputs and a Sign up button', async () => {
    await renderSignup({})
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password').type).toBe('password')
    expect(screen.getByLabelText('Confirm password').type).toBe('password')
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy()
  })

  it('links to /login', async () => {
    await renderSignup({})
    await userEvent.setup().click(screen.getByRole('link', { name: /log ?in/i }))
    expect(await screen.findByRole('heading', { name: 'LOGIN PAGE' })).toBeTruthy()
  })
})

describe('mismatched passwords', () => {
  it('shows "Passwords do not match" and never calls the server', async () => {
    const fetchMock = await renderSignup({ 'POST /api/signup': [201, NEW_USER] })
    await fillAndSubmit({ password: 'password123', confirm: 'password124' })
    expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match')
    expect(callsTo(fetchMock, 'POST /api/signup')).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Signup' })).toBeTruthy()
  })
})

describe('submitting', () => {
  it('POSTs only the email and password (not the confirmation) to /signup', async () => {
    const fetchMock = await renderSignup({ 'POST /api/signup': [201, NEW_USER] })
    await fillAndSubmit()
    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/signup')).toHaveLength(1))
    const [, options] = callsTo(fetchMock, 'POST /api/signup')[0]
    expect(JSON.parse(options.body)).toEqual({ email: 'new@example.com', password: 'password123' })
  })

  it('on 201 goes to /', async () => {
    await renderSignup({ 'POST /api/signup': [201, NEW_USER] })
    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'HOME' })).toBeTruthy()
  })

  it("sends a short password to the server and shows the server's message (no minLength)", async () => {
    const fetchMock = await renderSignup({
      'POST /api/signup': [422, { errors: { password: ['Password must be at least 8 characters'] } }],
    })
    await fillAndSubmit({ password: 'short' })
    expect((await screen.findByRole('alert')).textContent).toContain(
      'password: Password must be at least 8 characters',
    )
    expect(callsTo(fetchMock, 'POST /api/signup')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Signup' })).toBeTruthy()
  })

  it('is not blocked by browser validation (noValidate): a bad email still reaches the server', async () => {
    const fetchMock = await renderSignup({
      'POST /api/signup': [422, { errors: { email: ['An email address must have an @-sign.'] } }],
    })
    await fillAndSubmit({ email: 'not-an-email' })
    expect((await screen.findByRole('alert')).textContent).toContain(
      'email: An email address must have an @-sign.',
    )
    expect(callsTo(fetchMock, 'POST /api/signup')).toHaveLength(1)
  })

  it('when the server is unreachable, shows the apiFetch message', async () => {
    await renderSignup({ 'POST /api/signup': 'down' })
    await fillAndSubmit()
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('disables the button while the request is in flight', async () => {
    await renderSignup({ 'POST /api/signup': () => new Promise(() => {}) })
    await fillAndSubmit()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign up' }).disabled).toBe(true))
  })

  it('clears the mismatch error once the passwords match and you submit again', async () => {
    await renderSignup({ 'POST /api/signup': () => new Promise(() => {}) })
    await fillAndSubmit({ password: 'password123', confirm: 'password12' })
    await screen.findByRole('alert')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Confirm password'), '3')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
