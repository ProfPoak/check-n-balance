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

    return Promise.resolve(respond(...route))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function respond(status, body) {
  if (body === null || status === 204) return new Response(null, { status })
  if (typeof body === 'string') {
    return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// A response held open until the test lets it go, to check what the UI does mid-request.
//   const del = held()
//   mockFetch({ 'DELETE /api/assets/1': del.route })
//   ...click...  expect the button disabled
//   del.release(403, { error: 'Forbidden' })   or   del.release('down')
export function held() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    route: () => promise,
    release: (status, body) =>
      status === 'down' ? reject(new TypeError('Failed to fetch')) : resolve(respond(status, body)),
  }
}

// The calls made to one route, e.g. callsTo(fetchMock, 'POST /api/login')
export function callsTo(fetchMock, key) {
  return fetchMock.mock.calls.filter(([url, options = {}]) => `${options.method ?? 'GET'} ${url}` === key)
}

export const DEMO = { id: 1, email: 'demo@example.com' }
