import { useState } from 'react'
import { apiFetch } from '../api.js'
import { useBusy } from './useBusy.js'

// One request with its own busy and error state:
//   const { busy, error, send } = useRequest()
//   const res = await send(`/assets/${id}`, { method: 'PATCH', body })
//   if (res.ok) ...
// send clears the last error, disables the button while in flight, and keeps the error on failure.
export function useRequest() {
  const [busy, whileBusy] = useBusy()
  const [error, setError] = useState(null)

  async function send(path, options) {
    setError(null)
    const res = await whileBusy(() => apiFetch(path, options))
    if (!res.ok) {
      setError(res.data ?? {})
    }
    return res
  }

  return { busy, error, setError, send }
}
