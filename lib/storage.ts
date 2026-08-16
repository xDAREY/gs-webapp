'use client'

import { useEffect, useState } from 'react'

/**
 * IMPORTANT: this reads localStorage safely. It never runs on the server,
 * and never runs during the client's first render either — only after
 * mount, inside useEffect. That first-render-must-match-server rule is
 * what the earlier version of this app violated (a `useState(read(...))`
 * initializer that behaved differently on server vs. client), which is
 * what caused the hydration error. Don't reintroduce that pattern.
 */
export function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setValue(JSON.parse(raw) as T)
    } catch {
      // ignore malformed storage
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage full or unavailable — fail silently in this prototype
    }
  }, [key, value, hydrated])

  return [value, setValue, hydrated] as const
}

export function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  )
}

export function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function generateTempPin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}