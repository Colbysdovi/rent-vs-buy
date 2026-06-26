"use client"

import { useState, useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ——————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————

interface Inputs {
  // Bien
  prix: number
  surface: number
  fraisAgenceAchat: number
  travaux: number
  // Financement
  apport: number
  tauxInteret: number
  dureePret: number
  assuranceEmprunteur: number // €/an
  // Charges propriétaire
  taxeFonciere: number
  chargesCopro: number
  entretienPct: number // % du prix/an
  assuranceHabProprio: number // €/an
  // Alternative location
  loyerMensuelCC: number
  assuranceLocataire: number // €/an
  // Marché
  tauxAppreciation: number // %/an
  tauxIRL: number // %/an
  tauxEpargne: number // %/an
  // Horizon
  horizon: number
}

// ——————————————————————————————————————————————————
// Simulation
// ——————————————————————————————————————————————————

interface YearPoint {
  year: number
  acheteur: number
  locataire: number
  propertyValue: number
  capitalRestantDu: number
  delta: number
}

function simulate(i: Inputs): { points: YearPoint[]; breakeven: number | null } {
  const fraisNotaire = i.prix * 0.078
  const fraisAchat = fraisNotaire + i.fraisAgenceAchat + i.travaux

  // The buyer puts in `apport` total (covers frais + equity in property)
  // If apport < fraisAchat → not realistic but we handle it
  const apportBien = Math.max(0, i.apport - fraisAchat)
  const emprunt = Math.max(0, i.prix - apportBien)

  // Mortgage monthly payment
  const tauxMensuel = i.tauxInteret / 100 / 12
  const nbMois = i.dureePret * 12
  const mensualiteCapInt =
    tauxMensuel > 0 && emprunt > 0
      ? (emprunt * (tauxMensuel * Math.pow(1 + tauxMensuel, nbMois))) /
        (Math.pow(1 + tauxMensuel, nbMois) - 1)
      : emprunt / nbMois

  const assuranceMensuelle = i.assuranceEmprunteur / 12
  const mensualiteTotale = mensualiteCapInt + assuranceMensuelle

  // Monthly buyer fixed charges (non-mortgage)
  const chargesAnnuellesProprio =
    i.taxeFonciere +
    i.chargesCopro +
    (i.prix * i.entretienPct) / 100 +
    i.assuranceHabProprio

  const buyerMonthlyNonMortgage = chargesAnnuellesProprio / 12

  // The renter starts with the same cash the buyer spends at day 0
  // = apport (which covers fraisAchat + equity input)
  const renterPortfolioInit = i.apport

  const r_invest = i.tauxEpargne / 100 / 12
  const r_immo_mensuel = i.tauxAppreciation / 100 / 12
  const r_loyer_mensuel = i.tauxIRL / 100 / 12

  // Simulation state
  let capitalRestantDu = emprunt
  let renterPortfolio = renterPortfolioInit
  let buyerSurplusPortfolio = 0 // buyer invests surplus if monthly outflow < renter
  let currentLoyer = i.loyerMensuelCC
  const assuranceLocataireMensuelle = i.assuranceLocataire / 12

  const points: YearPoint[] = []
  let breakeven: number | null = null

  for (let t = 0; t <= i.horizon; t++) {
    // Property value at year t
    const propertyValue = i.prix * Math.pow(1 + i.tauxAppreciation / 100, t)
    // Selling costs at resale (~5% agency + misc)
    const fraisRevente = propertyValue * 0.05
    // Buyer net worth = equity after selling costs + any surplus portfolio
    const buyerEquity = propertyValue - fraisRevente - capitalRestantDu
    const buyerNetWorth = buyerEquity + buyerSurplusPortfolio
    // Renter net worth = portfolio
    const renterNetWorth = renterPortfolio

    const delta = buyerNetWorth - renterNetWorth

    points.push({
      year: t,
      acheteur: Math.round(buyerNetWorth),
      locataire: Math.round(renterNetWorth),
      propertyValue: Math.round(propertyValue),
      capitalRestantDu: Math.round(capitalRestantDu),
      delta: Math.round(delta),
    })

    if (breakeven === null && delta >= 0 && t > 0) {
      breakeven = t
    }

    // Simulate month by month for the next year
    for (let m = 0; m < 12; m++) {
      // Mortgage amortization
      if (capitalRestantDu > 0) {
        const interest = capitalRestantDu * tauxMensuel
        const principal = Math.min(mensualiteCapInt - interest, capitalRestantDu)
        capitalRestantDu = Math.max(0, capitalRestantDu - principal)
      }

      // Renter portfolio grows
      renterPortfolio *= 1 + r_invest

      // Buyer surplus portfolio grows
      buyerSurplusPortfolio *= 1 + r_invest

      // Monthly outflows
      const buyerMonthly =
        (capitalRestantDu > 0 ? mensualiteTotale : 0) + buyerMonthlyNonMortgage
      const renterMonthly = currentLoyer + assuranceLocataireMensuelle

      // Invest monthly surplus
      const surplusRenter = buyerMonthly - renterMonthly
      if (surplusRenter > 0) {
        // Renter pays less → invests the difference
        renterPortfolio += surplusRenter
      } else {
        // Buyer pays less → invests the difference
        buyerSurplusPortfolio += -surplusRenter
      }

      // Update rent with IRL
      currentLoyer *= 1 + r_loyer_mensuel
    }
  }

  return { points, breakeven }
}

// ——————————————————————————————————————————————————
// Helpers UI
// ——————————————————————————————————————————————————

function fmt(n: number, opts: { suffix?: string; decimals?: number } = {}): string {
  const { suffix = " €", decimals = 0 } = opts
  if (!isFinite(n)) return "—"
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + suffix
  )
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} M€`
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} k€`
  return `${Math.round(n)} €`
}

function NumericInput({
  id,
  label,
  value,
  onChange,
  suffix,
  step = 100,
  min = 0,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  min?: number
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative flex items-center">
        <Input
          id={id}
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="pr-10 font-mono text-sm"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatRow({
  label,
  value,
  muted,
  highlight,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          highlight ? "font-semibold" : "",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  negative,
  accent,
}: {
  label: string
  value: string
  sub?: string
  negative?: boolean
  accent?: boolean
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          negative && "text-destructive",
          accent && "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// Custom tooltip for the chart
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
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">Année {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name} :</span>
          <span className="font-mono font-medium text-foreground">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ——————————————————————————————————————————————————
// Defaults
// ——————————————————————————————————————————————————

const defaults: Inputs = {
  prix: 300000,
  surface: 70,
  fraisAgenceAchat: 0,
  travaux: 10000,
  apport: 60000,
  tauxInteret: 3.3,
  dureePret: 25,
  assuranceEmprunteur: 300,
  taxeFonciere: 1200,
  chargesCopro: 2400,
  entretienPct: 0.5,
  assuranceHabProprio: 200,
  loyerMensuelCC: 1200,
  assuranceLocataire: 150,
  tauxAppreciation: 2,
  tauxIRL: 2.5,
  tauxEpargne: 5,
  horizon: 30,
}

// ——————————————————————————————————————————————————
// Main
// ——————————————————————————————————————————————————

export default function Page() {
  const [inputs, setInputs] = useState<Inputs>(defaults)

  function set<K extends keyof Inputs>(key: K) {
    return (v: number) => setInputs((prev) => ({ ...prev, [key]: v }))
  }

  const { points, breakeven } = useMemo(() => simulate(inputs), [inputs])

  // Derived for metrics
  const fraisNotaire = inputs.prix * 0.078
  const fraisAchat = fraisNotaire + inputs.fraisAgenceAchat + inputs.travaux
  const apportBien = Math.max(0, inputs.apport - fraisAchat)
  const emprunt = Math.max(0, inputs.prix - apportBien)
  const tauxMensuel = inputs.tauxInteret / 100 / 12
  const nbMois = inputs.dureePret * 12
  const mensualite =
    tauxMensuel > 0 && emprunt > 0
      ? (emprunt * (tauxMensuel * Math.pow(1 + tauxMensuel, nbMois))) /
        (Math.pow(1 + tauxMensuel, nbMois) - 1)
      : emprunt / nbMois
  const mensualiteTotale = mensualite + inputs.assuranceEmprunteur / 12
  const chargesProprioMensuel =
    (inputs.taxeFonciere + inputs.chargesCopro + (inputs.prix * inputs.entretienPct) / 100 + inputs.assuranceHabProprio) / 12
  const buyerMonthlyTotal = mensualiteTotale + chargesProprioMensuel
  const renterMonthlyTotal = inputs.loyerMensuelCC + inputs.assuranceLocataire / 12
  const surplusMensuel = renterMonthlyTotal - buyerMonthlyTotal

  // Chart color scheme (monochrome)
  const colorAcheteur = "oklch(0.205 0 0)"
  const colorLocataire = "oklch(0.556 0 0)"

  // Reference snapshots
  const snap = (yr: number) => points.find((p) => p.year === yr)

  const lastPoint = points[points.length - 1]

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Résidence Principale — Acheter ou Louer ?
          </h1>
          <p className="text-sm text-muted-foreground">
            Comparez le patrimoine net d&apos;un acheteur et d&apos;un locataire qui investit la
            différence. Le point d&apos;équilibre est l&apos;année à partir de laquelle acheter
            devient plus avantageux.
          </p>
        </div>

        {/* Métriques clés */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Mensualité totale achat"
            value={fmt(mensualiteTotale, { decimals: 0 })}
            sub="capital + intérêts + assurance"
          />
          <MetricCard
            label="Coût mensuel achat tout compris"
            value={fmt(buyerMonthlyTotal, { decimals: 0 })}
            sub="+ charges, taxe, entretien"
          />
          <MetricCard
            label="Coût mensuel location"
            value={fmt(renterMonthlyTotal, { decimals: 0 })}
            sub="loyer CC + assurance"
          />
          <MetricCard
            label={breakeven !== null ? `Point d'équilibre` : "Pas d'équilibre"}
            value={breakeven !== null ? `Année ${breakeven}` : `> ${inputs.horizon} ans`}
            sub={
              breakeven !== null
                ? surplusMensuel > 0
                  ? `Loyer > mensualité de ${fmt(surplusMensuel, { decimals: 0 }).trim()}`
                  : `Mensualité > loyer de ${fmt(-surplusMensuel, { decimals: 0 }).trim()}`
                : "Augmentez l'horizon ou réduisez les coûts"
            }
            accent={breakeven !== null}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Chart + Params */}
          <div className="space-y-6">
            {/* Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Patrimoine net comparé</CardTitle>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" />
                      Acheteur
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                      Locataire
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.922 0 0)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
                      tickFormatter={(v) => `${v} ans`}
                      interval={4}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "oklch(0.556 0 0)" }}
                      tickFormatter={fmtK}
                      width={64}
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
                          fontSize: 10,
                          fill: "oklch(0.439 0 0)",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="acheteur"
                      name="Acheteur"
                      stroke={colorAcheteur}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="locataire"
                      name="Locataire"
                      stroke={colorLocataire}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Snapshot table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Patrimoine net par horizon</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left font-medium text-muted-foreground">Année</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Acheteur</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Locataire</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Avantage achat</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[3, 5, 7, 10, 15, 20, 25, 30]
                        .filter((y) => y <= inputs.horizon)
                        .map((y) => {
                          const s = snap(y)
                          if (!s) return null
                          const positive = s.delta >= 0
                          return (
                            <tr key={y} className="border-b border-border/50 last:border-0">
                              <td className="py-2 text-muted-foreground">{y} ans</td>
                              <td className="py-2 text-right">{fmtK(s.acheteur)}</td>
                              <td className="py-2 text-right">{fmtK(s.locataire)}</td>
                              <td
                                className={cn(
                                  "py-2 text-right font-medium",
                                  positive ? "text-foreground" : "text-destructive"
                                )}
                              >
                                {positive ? "+" : ""}
                                {fmtK(s.delta)}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Paramètres */}
            <Tabs defaultValue="bien">
              <TabsList className="w-full">
                <TabsTrigger value="bien" className="flex-1 text-xs">Bien</TabsTrigger>
                <TabsTrigger value="financement" className="flex-1 text-xs">Financement</TabsTrigger>
                <TabsTrigger value="charges" className="flex-1 text-xs">Charges</TabsTrigger>
                <TabsTrigger value="location" className="flex-1 text-xs">Location</TabsTrigger>
                <TabsTrigger value="marche" className="flex-1 text-xs">Marché</TabsTrigger>
              </TabsList>

              <TabsContent value="bien" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <NumericInput id="prix" label="Prix d'achat" value={inputs.prix} onChange={set("prix")} suffix="€" step={5000} />
                    <NumericInput id="surface" label="Surface" value={inputs.surface} onChange={set("surface")} suffix="m²" step={1} />
                    <NumericInput id="agence" label="Frais d'agence (achat)" value={inputs.fraisAgenceAchat} onChange={set("fraisAgenceAchat")} suffix="€" step={500} />
                    <NumericInput id="travaux" label="Travaux initiaux" value={inputs.travaux} onChange={set("travaux")} suffix="€" step={1000} />
                    <NumericInput id="apport" label="Apport disponible" value={inputs.apport} onChange={set("apport")} suffix="€" step={1000} hint="Couvre frais de notaire + mise de fonds" />
                    <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Frais de notaire (7,8 %)</p>
                        <p className="font-mono text-sm font-medium">{fmt(fraisNotaire)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Montant emprunté</p>
                        <p className="font-mono text-sm font-semibold">{fmt(emprunt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financement" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <NumericInput id="taux" label="Taux d'intérêt" value={inputs.tauxInteret} onChange={set("tauxInteret")} suffix="%" step={0.05} min={0} />
                    <NumericInput id="duree" label="Durée du prêt" value={inputs.dureePret} onChange={set("dureePret")} suffix="ans" step={1} min={5} hint="Max 25 ans en France (résidence principale)" />
                    <NumericInput id="assurance" label="Assurance emprunteur" value={inputs.assuranceEmprunteur} onChange={set("assuranceEmprunteur")} suffix="€/an" step={50} min={0} />
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Mensualité (capital + intérêts + assurance)</p>
                      <p className="font-mono text-lg font-semibold">{fmt(mensualiteTotale, { decimals: 0 })} / mois</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="charges" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <NumericInput id="tf" label="Taxe foncière" value={inputs.taxeFonciere} onChange={set("taxeFonciere")} suffix="€/an" />
                    <NumericInput id="copro" label="Charges de copropriété" value={inputs.chargesCopro} onChange={set("chargesCopro")} suffix="€/an" />
                    <NumericInput id="entretien" label="Entretien / maintenance" value={inputs.entretienPct} onChange={set("entretienPct")} suffix="% prix/an" step={0.1} min={0} hint={`= ${fmt((inputs.prix * inputs.entretienPct) / 100, { decimals: 0 })} / an`} />
                    <NumericInput id="asshabproprio" label="Assurance habitation" value={inputs.assuranceHabProprio} onChange={set("assuranceHabProprio")} suffix="€/an" step={20} />
                    <div className="col-span-full rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Total charges annuelles (hors emprunt)</p>
                      <p className="font-mono text-sm font-semibold">{fmt(chargesProprioMensuel * 12, { decimals: 0 })} / an · {fmt(chargesProprioMensuel, { decimals: 0 })} / mois</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="location" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <NumericInput id="loyer" label="Loyer mensuel charges comprises" value={inputs.loyerMensuelCC} onChange={set("loyerMensuelCC")} suffix="€/mois" step={50} hint="Loyer + provisions sur charges" />
                    <NumericInput id="asslocataire" label="Assurance habitation locataire" value={inputs.assuranceLocataire} onChange={set("assuranceLocataire")} suffix="€/an" step={10} />
                    <div className="col-span-full rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Coût mensuel total location</p>
                      <p className="font-mono text-sm font-semibold">{fmt(renterMonthlyTotal, { decimals: 0 })} / mois</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {surplusMensuel > 0
                          ? `Le loyer dépasse la mensualité de ${fmt(surplusMensuel, { decimals: 0 }).trim()} — le locataire investit cet écart chaque mois.`
                          : `La mensualité dépasse le loyer de ${fmt(-surplusMensuel, { decimals: 0 }).trim()} — l'acheteur investit cet écart chaque mois.`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="marche" className="mt-4">
                <Card>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <NumericInput id="apprec" label="Valorisation immobilier" value={inputs.tauxAppreciation} onChange={set("tauxAppreciation")} suffix="%/an" step={0.1} hint="Moyenne long terme France ≈ 2-3 %/an" />
                    <NumericInput id="irl" label="Hausse des loyers (IRL)" value={inputs.tauxIRL} onChange={set("tauxIRL")} suffix="%/an" step={0.1} min={0} hint="Indice de référence des loyers" />
                    <NumericInput id="epargne" label="Rendement épargne alternative" value={inputs.tauxEpargne} onChange={set("tauxEpargne")} suffix="%/an" step={0.5} min={0} hint="Ex : PEA diversifié ≈ 5-7 %/an" />
                    <NumericInput id="horizon" label="Horizon de simulation" value={inputs.horizon} onChange={set("horizon")} suffix="ans" step={1} min={5} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Bilan */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Synthèse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Investissement initial</p>
                <StatRow label="Prix d'achat" value={fmt(inputs.prix)} />
                <StatRow label="Frais d'achat" value={fmt(fraisAchat)} muted />
                <StatRow label="Apport total" value={fmt(inputs.apport)} />
                <StatRow label="Montant emprunté" value={fmt(emprunt)} muted />

                <Separator className="my-3" />

                <p className="mb-1 text-xs font-medium text-muted-foreground">Coûts mensuels</p>
                <StatRow label="Mensualité (crédit)" value={fmt(mensualiteTotale, { decimals: 0 })} />
                <StatRow label="Charges proprio" value={fmt(chargesProprioMensuel, { decimals: 0 })} muted />
                <StatRow label="Total achat/mois" value={fmt(buyerMonthlyTotal, { decimals: 0 })} highlight />
                <StatRow label="Total location/mois" value={fmt(renterMonthlyTotal, { decimals: 0 })} highlight />

                <Separator className="my-3" />

                <p className="mb-1 text-xs font-medium text-muted-foreground">Point d'équilibre</p>
                {breakeven !== null ? (
                  <>
                    <StatRow label="Année" value={`Année ${breakeven}`} highlight />
                    <StatRow
                      label="Âge estimé"
                      value={`~${35 + breakeven} ans`}
                      muted
                    />
                  </>
                ) : (
                  <p className="py-1 text-sm text-destructive">
                    Aucun équilibre sur {inputs.horizon} ans
                  </p>
                )}

                <Separator className="my-3" />

                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  À {inputs.horizon} ans
                </p>
                {lastPoint && (
                  <>
                    <StatRow label="Patrimoine acheteur" value={fmtK(lastPoint.acheteur)} highlight />
                    <StatRow label="Patrimoine locataire" value={fmtK(lastPoint.locataire)} highlight />
                    <StatRow
                      label="Avantage achat"
                      value={(lastPoint.delta >= 0 ? "+" : "") + fmtK(lastPoint.delta)}
                      highlight
                    />
                    <StatRow label="Valeur du bien" value={fmtK(lastPoint.propertyValue)} muted />
                    <StatRow label="Capital restant dû" value={lastPoint.capitalRestantDu > 0 ? `− ${fmtK(lastPoint.capitalRestantDu)}` : "Soldé"} muted />
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
              <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">Hypothèses</Badge>
              <p className="text-xs text-muted-foreground">
                Frais de revente estimés à 5 %. Pas de plus-value sur résidence principale. Le locataire investit l&apos;apport + l&apos;écart mensuel si location &lt; achat. Simulation avant impôt sur revenus du capital.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
              <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">Info</Badge>
              <p className="text-xs text-muted-foreground">
                Appuyez sur <kbd className="rounded border border-border px-1 font-mono text-xs">D</kbd> pour basculer le thème.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
