"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"

interface YearPoint {
  year: number
  acheteur: number
  locataire: number
  propertyValue: number
  capitalRestantDu: number
  delta: number
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} M€`
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} k€`
  return `${Math.round(n)} €`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-4 py-3 text-sm shadow-md">
      <p className="mb-2 font-medium text-foreground">Année {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name} :</span>
          <span className="font-mono font-semibold text-foreground">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function PatrimoineChart({
  points,
  breakeven,
}: {
  points: YearPoint[]
  breakeven: number | null
}) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" vertical={false} />
        <XAxis
          dataKey="year"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 13, fill: "oklch(0.556 0 0)" }}
          tickFormatter={(v) => `${v} ans`}
          interval={4}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 13, fill: "oklch(0.556 0 0)" }}
          tickFormatter={fmtK}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="oklch(0.708 0 0)" strokeWidth={1} />
        {breakeven !== null && (
          <ReferenceLine
            x={breakeven}
            stroke="oklch(0.439 0 0)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `Équilibre an ${breakeven}`,
              position: "insideTopRight",
              fontSize: 12,
              fill: "oklch(0.439 0 0)",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="acheteur"
          name="Acheteur"
          stroke="oklch(0.205 0 0)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="locataire"
          name="Locataire"
          stroke="oklch(0.556 0 0)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
