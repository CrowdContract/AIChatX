import { useState, useEffect } from 'react'
import axios from 'axios'

const BASE = '/api'

export function useApi(endpoint, params = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const key = endpoint + JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    axios
      .get(`${BASE}${endpoint}`, { params })
      .then(r => { if (!cancelled) { setData(r.data); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })

    return () => { cancelled = true }
  }, [key])

  return { data, loading, error }
}

export const fmt = {
  currency: v => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }),
  number:   v => Number(v).toLocaleString('en-US'),
  pct:      v => Number(v).toFixed(1) + '%',
  short:    v => {
    const n = Number(v)
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K'
    return '$' + n.toFixed(0)
  },
}
