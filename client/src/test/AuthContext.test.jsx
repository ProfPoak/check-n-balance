import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../context/AuthContext.jsx'
import { callsTo, DEMO, mockFetch } from './mockFetch.js'

// The latest value an action returned, so tests can check what the form will get back
let lastResult

function Probe() {
  const { user, checkingSession, sessionError, login, signup, logout, retrySession } = useAuth()
  return (
    <>
      <p data-testid="user">{user ? user.email : 'none'}</p>
      <p data-testid="checking">{String(checkingSession)}</p>
      <p data-testid="error">{sessionError === null ? 'none' : JSON.stringify(sessionError)}</p>
      <button onClick={async () => { lastResult = await login('demo@example.com', 'password123') }}>
        login
      </button>
      <button onClick={async () => { lastResult = await signup('new@example.com', 'password123') }}>
        signup
      </button>
      <button onClick={async () => { lastResult = await logout() }}>logout</button>
      <button onClick={() => retrySession()}>retry</button>
    </>
  )
}

function renderProbe() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

const text = (id) => screen.getByTestId(id).textContent

async function settled() {
  await waitFor(() => expect(text('checking')).toBe('false'))
}

async function click(name) {
  await userEvent.setup().click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  lastResult = undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the session check on load', () => {
  it('is checking until /check_session answers', async () => {
    let answer
    mockFetch({
      'GET /api/check_session': () => new Promise((resolve) => { answer = resolve }),
    })
    renderProbe()
    expect(text('checking')).toBe('true')
    expect(text('user')).toBe('none')

    answer(new Response(JSON.stringify(DEMO), { status: 200 }))
    await settled()
  })

  it('calls GET /check_session once', async () => {
    const fetchMock = mockFetch({ 'GET /api/check_session': [401, { error: 'Not logged in' }] })
    renderProbe()
    await settled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callsTo(fetchMock, 'GET /api/check_session')).toHaveLength(1)
  })

  it('200 sets the user', async () => {
    mockFetch({ 'GET /api/check_session': [200, DEMO] })
    renderProbe()
    await settled()
    expect(text('user')).toBe('demo@example.com')
    expect(text('error')).toBe('none')
  })

  it('401 is a logged-out visitor, not an error', async () => {
    mockFetch({ 'GET /api/check_session': [401, { error: 'Not logged in' }] })
    renderProbe()
    await settled()
    expect(text('user')).toBe('none')
    expect(text('error')).toBe('none')
  })

  it('a 502 with a text body (Flask down) is a session error of {}', async () => {
    mockFetch({ 'GET /api/check_session': [502, 'Bad Gateway'] })
    renderProbe()
    await settled()
    expect(text('user')).toBe('none')
    expect(text('error')).toBe('{}')
  })

  it('a 500 with a JSON body keeps that body as the session error', async () => {
    mockFetch({ 'GET /api/check_session': [500, { error: 'Boom' }] })
    renderProbe()
    await settled()
    expect(text('error')).toBe('{"error":"Boom"}')
  })

  it('an unreachable server is a session error with the apiFetch message', async () => {
    mockFetch({ 'GET /api/check_session': 'down' })
    renderProbe()
    await settled()
    expect(text('user')).toBe('none')
    expect(text('error')).toBe('{"error":"Could not reach the server"}')
  })
})

describe('retrySession', () => {
  it('checks again, clears the error, and sets the user', async () => {
    const routes = { 'GET /api/check_session': [502, 'Bad Gateway'] }
    const fetchMock = mockFetch(routes)
    renderProbe()
    await settled()
    expect(text('error')).toBe('{}')

    routes['GET /api/check_session'] = [200, DEMO]
    await click('retry')
    await waitFor(() => expect(text('user')).toBe('demo@example.com'))
    expect(text('error')).toBe('none')
    expect(text('checking')).toBe('false')
    expect(callsTo(fetchMock, 'GET /api/check_session')).toHaveLength(2)
  })

  it('is checking again while the retry is in flight', async () => {
    const routes = { 'GET /api/check_session': [502, 'Bad Gateway'] }
    mockFetch(routes)
    renderProbe()
    await settled()

    routes['GET /api/check_session'] = () => new Promise(() => {})
    await click('retry')
    expect(text('checking')).toBe('true')
    expect(text('error')).toBe('none')
  })
})

describe('login', () => {
  it('POSTs the email and password to /login', async () => {
    const fetchMock = mockFetch({
      'GET /api/check_session': [401, { error: 'Not logged in' }],
      'POST /api/login': [200, DEMO],
    })
    renderProbe()
    await settled()
    await click('login')

    await waitFor(() => expect(callsTo(fetchMock, 'POST /api/login')).toHaveLength(1))
    const [, options] = callsTo(fetchMock, 'POST /api/login')[0]
    expect(JSON.parse(options.body)).toEqual({ email: 'demo@example.com', password: 'password123' })
  })

  it('on success sets the user and returns the apiFetch result', async () => {
    mockFetch({
      'GET /api/check_session': [401, { error: 'Not logged in' }],
      'POST /api/login': [200, DEMO],
    })
    renderProbe()
    await settled()
    await click('login')

    await waitFor(() => expect(text('user')).toBe('demo@example.com'))
    expect(lastResult).toEqual({ ok: true, status: 200, data: DEMO })
  })

  it('on 401 leaves the user null and returns the error for the form', async () => {
    mockFetch({
      'GET /api/check_session': [401, { error: 'Not logged in' }],
      'POST /api/login': [401, { error: 'Invalid email or password' }],
    })
    renderProbe()
    await settled()
    await click('login')

    await waitFor(() => expect(lastResult).toBeDefined())
    expect(lastResult).toEqual({ ok: false, status: 401, data: { error: 'Invalid email or password' } })
    expect(text('user')).toBe('none')
  })
})

describe('signup', () => {
  it('POSTs to /signup, sets the user, and returns the result', async () => {
    const newUser = { id: 7, email: 'new@example.com' }
    const fetchMock = mockFetch({
      'GET /api/check_session': [401, { error: 'Not logged in' }],
      'POST /api/signup': [201, newUser],
    })
    renderProbe()
    await settled()
    await click('signup')

    await waitFor(() => expect(text('user')).toBe('new@example.com'))
    expect(lastResult).toEqual({ ok: true, status: 201, data: newUser })
    const [, options] = callsTo(fetchMock, 'POST /api/signup')[0]
    expect(JSON.parse(options.body)).toEqual({ email: 'new@example.com', password: 'password123' })
  })

  it('on 422 leaves the user null and returns the errors', async () => {
    const errors = { errors: { password: ['Password must be at least 8 characters'] } }
    mockFetch({
      'GET /api/check_session': [401, { error: 'Not logged in' }],
      'POST /api/signup': [422, errors],
    })
    renderProbe()
    await settled()
    await click('signup')

    await waitFor(() => expect(lastResult).toBeDefined())
    expect(lastResult).toEqual({ ok: false, status: 422, data: errors })
    expect(text('user')).toBe('none')
  })
})

describe('logout', () => {
  it('DELETEs /logout and clears the user', async () => {
    const fetchMock = mockFetch({
      'GET /api/check_session': [200, DEMO],
      'DELETE /api/logout': [204, null],
    })
    renderProbe()
    await settled()
    expect(text('user')).toBe('demo@example.com')
    await click('logout')

    await waitFor(() => expect(text('user')).toBe('none'))
    expect(callsTo(fetchMock, 'DELETE /api/logout')).toHaveLength(1)
    expect(lastResult).toEqual({ ok: true, status: 204, data: null })
  })

  it('keeps the user when the request fails (the cookie is still set)', async () => {
    mockFetch({
      'GET /api/check_session': [200, DEMO],
      'DELETE /api/logout': 'down',
    })
    renderProbe()
    await settled()
    await click('logout')

    await waitFor(() => expect(lastResult).toBeDefined())
    expect(lastResult.ok).toBe(false)
    expect(text('user')).toBe('demo@example.com')
  })
})
