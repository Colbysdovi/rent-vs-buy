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
import { useReducedMotion } from "motion/react"
import { chartAnimation } from "@/lib/motion-tokens"

interface Point {
  year: number
  depenseAchat: number
  depenseLocation: number
}

const eur = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} €`

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
          <span className="font-mono font-semibold text-foreground">{eur(p.value)}/mois</span>
        </div>
      ))}
    </div>
  )
}

export function DepensesChart({ points, finCredit }: { points: Point[]; finCredit: number | null }) {
  const reduced = useReducedMotion()
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={points} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
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
          tickFormatter={eur}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        {finCredit !== null && (
          <ReferenceLine
            x={finCredit}
            stroke="#005DAD"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `Fin du crédit an ${finCredit}`,
              position: "insideTopRight",
              fontSize: 12,
              fill: "#005DAD",
            }}
          />
        )}
        <Line
          type="stepAfter"
          dataKey="depenseAchat"
          name="Acheteur"
          stroke="#006DFF"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={!reduced}
          {...chartAnimation}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="stepAfter"
          dataKey="depenseLocation"
          name="Locataire"
          stroke="#C4CACE"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={!reduced}
          {...chartAnimation}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
