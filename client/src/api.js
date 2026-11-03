export async function apiFetch(path, options = {}) {
  const { body, headers, ...rest } = options
  const request = {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) {
    request.body = JSON.stringify(body)
  }

  const res = await fetch(`/api${path}`, request)
    .catch(() => null)
  if (!res) {
    return { ok: false, status: 0, data: { error: 'Could not reach the server' } }
  }

  const data = await res.json()
    .catch(() => null)

  return { ok: res.ok, status: res.status, data }
}
