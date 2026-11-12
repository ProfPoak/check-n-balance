import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../api.js'

const fetchMock = vi.fn()

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sentOptions() {
  return fetchMock.mock.calls[0][1]
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse({}))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the request', () => {
  it('adds /api to the path', async () => {
    await apiFetch('/budgets')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/budgets')
  })

  it('sends JSON headers', async () => {
    await apiFetch('/budgets')
    expect(new Headers(sentOptions().headers).get('Content-Type')).toBe('application/json')
  })

  it('passes the method through', async () => {
    await apiFetch('/budgets/1', { method: 'DELETE' })
    expect(sentOptions().method).toBe('DELETE')
  })

  it('turns a body object into JSON', async () => {
    await apiFetch('/login', { method: 'POST', body: { email: 'a@example.com' } })
    expect(sentOptions().body).toBe('{"email":"a@example.com"}')
  })

  it('still sends an empty object as a body', async () => {
    await apiFetch('/budgets', { method: 'POST', body: {} })
    expect(sentOptions().body).toBe('{}')
  })

  it('sends no body when there is none', async () => {
    await apiFetch('/budgets')
    expect(sentOptions().body).toBeUndefined()
  })
})

describe('the result', () => {
  it('returns ok, status and the parsed body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201))
    expect(await apiFetch('/budgets')).toEqual({ ok: true, status: 201, data: { id: 1 } })
  })

  it('returns the parsed body on an error status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Not logged in' }, 401))
    expect(await apiFetch('/budgets')).toEqual({
      ok: false,
      status: 401,
      data: { error: 'Not logged in' },
    })
  })

  it('returns null data for a 204 with an empty body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await apiFetch('/logout')).toEqual({ ok: true, status: 204, data: null })
  })

  // Vite's proxy answers 502/503/504 with a text body when Flask is down
  it.each([502, 503, 504])('turns a %i with a text body into "Could not reach the server"', async (status) => {
    fetchMock.mockResolvedValue(
      new Response('Bad Gateway', { status, headers: { 'Content-Type': 'text/plain' } }),
    )
    expect(await apiFetch('/budgets')).toEqual({
      ok: false,
      status,
      data: { error: 'Could not reach the server' },
    })
  })

  it('keeps a JSON body on a 503', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Down for maintenance' }, 503))
    expect(await apiFetch('/budgets')).toEqual({
      ok: false,
      status: 503,
      data: { error: 'Down for maintenance' },
    })
  })

  it('returns null data for any other error body that is not JSON (a 500 HTML page)', async () => {
    fetchMock.mockResolvedValue(
      new Response('<h1>Internal Server Error</h1>', { status: 500, headers: { 'Content-Type': 'text/html' } }),
    )
    expect(await apiFetch('/budgets')).toEqual({ ok: false, status: 500, data: null })
  })

  it('does not throw when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await apiFetch('/budgets')).toEqual({
      ok: false,
      status: 0,
      data: { error: 'Could not reach the server' },
    })
  })
})
