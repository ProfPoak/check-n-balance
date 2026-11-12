import { useState } from 'react'

export function useBusy() {
  const [busy, setBusy] = useState(false)

  async function whileBusy(task) {
    setBusy(true)
    try {
      return await task()
    }
    finally {
      setBusy(false)
    }
  }

  return [busy, whileBusy]
}
