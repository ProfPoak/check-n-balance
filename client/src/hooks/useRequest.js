import { useState } from 'react'
import { apiFetch } from '../api.js'
import { useBusy } from './useBusy.js'

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

  return { busy, error, send }
}
