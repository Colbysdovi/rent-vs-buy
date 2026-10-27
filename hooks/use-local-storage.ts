"use client"

import { useState, useEffect, useCallback } from "react"

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (v: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        // Older saves lack newer fields: fill them from defaults, keep every saved value
        const isPlainObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v)
        setValue(isPlainObject(defaultValue) && isPlainObject(parsed) ? { ...defaultValue, ...parsed } : parsed)
      }
    } catch {}
    setHydrated(true)
  }, [key])

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {}
        return next
      })
    },
    [key]
  )

  return [value, set, hydrated]
}
