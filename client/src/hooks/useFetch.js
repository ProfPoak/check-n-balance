import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

export function useFetch(path, refreshKey) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ignore = false
    apiFetch(path).then((res) => {
      if (ignore) return
      if (res.ok) {
        setData(res.data)
        setError(null)
      }
      else {
        setError(res.data ?? {})
      }
    })
    return () => {
      ignore = true
    }
  }, [path, refreshKey])

  return { data, error, setData }
}
