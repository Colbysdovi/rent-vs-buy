"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface BudgetScenario {
  label: string
  logement: number        // mensualité (achat) ou loyer CC (location)
  chargesLogement: number // charges proprio (achat) ou assurance locataire (location)
  chargesFixes: number
  autresCredits: number
  reste: number           // Math.max(0, resteAVivre)
  deficit: number         // Math.abs(Math.min(0, resteAVivre))
}

const KEYS = ["logement", "chargesLogement", "chargesFixes", "autresCredits", "reste", "deficit"] as const

const COLORS: Record<(typeof KEYS)[number], string> = {
  logement:        "#31485D",   /* Pickled Bluewood */
  chargesLogement: "#3A546A",   /* Fiord */
  chargesFixes:    "#005DAD",   /* Endeavour */
  autresCredits:   "#006DFF",   /* Brandeis Blue */
  reste:           "#C4CACE",   /* Loblolly */
  deficit:         "#EE523D",   /* Carmine Pink */
}

const LABELS: Record<(typeof KEYS)[number], string> = {
  logement:        "Logement",
  chargesLogement: "Charges logement",
  chargesFixes:    "Charges fixes",
  autresCredits:   "Autres crédits",
  reste:           "Reste à vivre",
  deficit:         "Déficit budgétaire",
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const items = [...payload].reverse().filter((e) => e.value > 0)
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-sm shadow-md">
      {items.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: entry.fill }}
          />
          <span className="text-muted-foreground">{LABELS[entry.dataKey as (typeof KEYS)[number]]}</span>
          <span className="ml-2 font-mono font-medium tabular-nums">
            {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(entry.value)} €
          </span>
        </div>
      ))}
    </div>
  )
}

export function BudgetChart({ achat, location }: { achat: BudgetScenario; location: BudgetScenario }) {
  const data = [
    { scenario: achat.label, ...achat },
    { scenario: location.label, ...location },
  ]

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 90 }}
          barSize={34}
        >
          <XAxis
            type="number"
            tickFormatter={(v) => `${Math.round(v)}€`}
            tick={{ fontSize: 11, fill: "hsl(0 0% 55%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="scenario"
            width={90}
            tick={{ fontSize: 13, fill: "hsl(0 0% 20%)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(0 0% 97%)" }} />
          {KEYS.map((k) => (
            <Bar key={k} dataKey={k} stackId="a" fill={COLORS[k]} name={LABELS[k]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[90px] text-xs text-muted-foreground">
        {KEYS.filter((k) => k !== "deficit").map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: COLORS[k] }}
            />
            {LABELS[k]}
          </span>
        ))}
      </div>
    </div>
  )
}
