import { vi } from 'vitest'

// Stubs global fetch with fake server routes, keyed by "METHOD /api/path".
//   [status, body]  body object -> JSON, string -> text/plain (like Vite's 502), null -> empty
//   'down'          fetch rejects (server unreachable)
//   () => Promise   full control, e.g. a response that never arrives
// Unknown routes reject, so a stray request fails loudly.
// The routes object stays live: change routes[key] mid-test to change the answer.
export function mockFetch(routes) {
  const fetchMock = vi.fn((url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`
    const route = routes[key]

    if (route === undefined) return Promise.reject(new TypeError(`No mock for ${key}`))
    if (route === 'down') return Promise.reject(new TypeError('Failed to fetch'))
    if (typeof route === 'function') return route()

    const [status, body] = route
    if (body === null || status === 204) return Promise.resolve(new Response(null, { status }))
    if (typeof body === 'string') {
      return Promise.resolve(
        new Response(body, { status, headers: { 'Content-Type': 'text/plain' } }),
      )
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The calls made to one route, e.g. callsTo(fetchMock, 'POST /api/login')
export function callsTo(fetchMock, key) {
  return fetchMock.mock.calls.filter(([url, options = {}]) => `${options.method ?? 'GET'} ${url}` === key)
}

export const DEMO = { id: 1, email: 'demo@example.com' }
