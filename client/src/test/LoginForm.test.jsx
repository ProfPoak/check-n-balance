import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import { callsTo, DEMO, mockFetch } from './mockFetch.js'

const LOGGED_OUT = [401, { error: 'Not logged in' }]

// Renders /login with stand-in pages for where it can send you.
// Uses the routes object itself (not a copy) so tests can change answers mid-test.
async function renderLogin(routes) {
  routes['GET /api/check_session'] ??= LOGGED_OUT
  const fetchMock = mockFetch(routes)
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>HOME</h1>} />
          <Route path="/signup" element={<h1>SIGNUP PAGE</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Login' })
  return fetchMock
}

async function fillAndSubmit(email = 'demo@example.com', password = 'password123') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the login form', () => {
  it('has Email and Password inputs and a Log in button', async () => {
    await renderLogin({})
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password').type).toBe('password')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy()
  })

  it('the inputs are controlled (typing shows up)', async () => {
    await renderLogin({})
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'demo@example.com')
    expect(screen.getByLabelText('Email').value).toBe('demo@example.com')
  })

  it('shows no error before submitting', async () => {
    await renderLogin({})
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('links to /signup', async () => {
    await renderLogin({})
    await userEvent.setup().click(screen.getByRole('link', { name: /sign ?up/i }))
    expect(await screen.findByRole('heading', { name: 'SIGNUP PAGE' })).toBeTruthy()
  })
})

describe('submitting', () => {
  it('POSTs the email and password to /login', async () => {
    const fetchMock = await renderLogin({ 'POST /api/login': [200, DEMO] })
    await fillAndSubmit()
    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/login')).toHaveLength(1))
    const [, options] = callsTo(fetchMock, 'POST /api/login')[0]
    expect(JSON.parse(options.body)).toEqual({ email: 'demo@example.com', password: 'password123' })
  })

  it('on success goes to /', async () => {
    await renderLogin({ 'POST /api/login': [200, DEMO] })
    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'HOME' })).toBeTruthy()
  })

  it('on 401 shows the error and stays on the form', async () => {
    await renderLogin({ 'POST /api/login': [401, { error: 'Invalid email or password' }] })
    await fillAndSubmit('demo@example.com', 'wrongpassword')
    expect((await screen.findByRole('alert')).textContent).toContain('Invalid email or password')
    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy()
  })

  it('when the server is unreachable, shows the apiFetch message', async () => {
    await renderLogin({ 'POST /api/login': 'down' })
    await fillAndSubmit()
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server')
  })

  it('when Flask is down (502 text body), shows "Something went wrong"', async () => {
    await renderLogin({ 'POST /api/login': [502, 'Bad Gateway'] })
    await fillAndSubmit()
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong')
  })

  it('is not blocked by browser validation (noValidate): a bad email still reaches the server', async () => {
    const fetchMock = await renderLogin({ 'POST /api/login': [401, { error: 'Invalid email or password' }] })
    await fillAndSubmit('not-an-email', 'x')
    await screen.findByRole('alert')
    expect(callsTo(fetchMock, 'POST /api/login')).toHaveLength(1)
  })

  it('disables the button while the request is in flight', async () => {
    await renderLogin({ 'POST /api/login': () => new Promise(() => {}) })
    await fillAndSubmit()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' }).disabled).toBe(true))
  })

  it('clears the old error when you submit again', async () => {
    const routes = { 'POST /api/login': [401, { error: 'Invalid email or password' }] }
    await renderLogin(routes)
    await fillAndSubmit()
    await screen.findByRole('alert')

    routes['POST /api/login'] = () => new Promise(() => {})
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
