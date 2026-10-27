"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

function toText(v: number) {
  return v === 0 ? "" : String(v)
}

export function NumberField({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(() => toText(value))

  // Resync when the value changes from outside (e.g. localStorage restore)
  useEffect(() => {
    setText((prev) => (parseFloat(prev.replace(",", ".")) || 0) === value ? prev : toText(value))
  }, [value])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      placeholder="0"
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        if (!/^\d*[.,]?\d*$/.test(raw)) return
        setText(raw)
        onChange(parseFloat(raw.replace(",", ".")) || 0)
      }}
    />
  )
}
