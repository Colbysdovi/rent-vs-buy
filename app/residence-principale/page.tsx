"use client"

import React, { useMemo } from "react"
import dynamic from "next/dynamic"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NumberField } from "@/components/number-field"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsPanels, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CascadeItem, Disclosure, RollText } from "@/components/reveal"

const PatrimoineChart = dynamic(
  () => import("@/components/patrimoine-chart").then((m) => m.PatrimoineChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center text-base text-muted-foreground">
        Chargement du graphique…
      </div>
    ),
  }
)

const DepensesChart = dynamic(
  () => import("@/components/depenses-chart").then((m) => m.DepensesChart),
  { ssr: false, loading: () => <div className="h-[360px]" /> }
)

const BudgetChart = dynamic(
  () => import("@/components/budget-chart").then((m) => m.BudgetChart),
  { ssr: false, loading: () => <div className="h-[140px]" /> }
)

// ——————————————————————————————————————————————————
// Types
// ——————————————————————————————————————————————————

type TypeBien = "ancien" | "neuf"

interface Inputs {
  // Bien
  typeBien: TypeBien
  fraisNotairePct: number
  prix: number
  surface: number
  fraisAgenceAchat: number
  travaux: number
  // Financement
  apport: number
  tauxInteret: number
  dureePret: number
  assuranceEmprunteur: number
  fraisGarantiePct: number
  // Charges proprio
  taxeFonciere: number
  chargesCopro: number
  entretienPct: number
  assuranceHabProprio: number
  // Location alternative
  loyerMensuelCC: number
  assuranceLocataire: number
  // Marché
  tauxAppreciation: number
  tauxIRL: number
  hausseCharges: number
  tauxEpargne: number
  fiscaliteEpargne: number
  horizon: number
  dureeSejour: number
  // Profil financier
  revenusNets: number
  chargesFixes: number
  autresCredits: number
  personnesACharge: number
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
  depenseAchat: number
  depenseLocation: number
}

export const NOTAIRE_DEFAUT: Record<TypeBien, number> = { ancien: 7.8, neuf: 2.5 }

function mensualiteHorsAssurance(emprunt: number, tauxMensuel: number, nbMois: number) {
  if (emprunt <= 0 || nbMois <= 0) return 0
  return tauxMensuel > 0
    ? (emprunt * (tauxMensuel * Math.pow(1 + tauxMensuel, nbMois))) /
        (Math.pow(1 + tauxMensuel, nbMois) - 1)
    : emprunt / nbMois
}

// Single source for purchase costs and the loan. Fees beyond the down payment are financed.
function financement(i: Inputs) {
  const fraisNotaire = (i.prix * i.fraisNotairePct) / 100
  const fraisHorsGarantie = fraisNotaire + i.fraisAgenceAchat + i.travaux
  // Guarantee is based on the loan before itself, avoiding a circular calculation
  const empruntHorsGarantie = Math.max(0, i.prix + fraisHorsGarantie - i.apport)
  const fraisGarantie = (empruntHorsGarantie * i.fraisGarantiePct) / 100
  const fraisAchat = fraisHorsGarantie + fraisGarantie
  const emprunt = Math.max(0, i.prix + fraisAchat - i.apport)
  const tauxMensuel = i.tauxInteret / 100 / 12
  const nbMois = Math.max(0, i.dureePret * 12)
  const mensualite = mensualiteHorsAssurance(emprunt, tauxMensuel, nbMois)
  const mensualiteTotale = mensualite + (emprunt > 0 ? i.assuranceEmprunteur / 12 : 0)
  return {
    fraisNotaire,
    fraisGarantie,
    fraisAchat,
    emprunt,
    tauxMensuel,
    nbMois,
    mensualite,
    mensualiteTotale,
    interetsTotaux: Math.max(0, mensualite * nbMois - emprunt),
  }
}

// Sum of (1 + g)^t for t = 0..years-1: total of a yearly amount growing at g %
function cumulCroissant(pct: number, years: number) {
  const g = pct / 100
  return g === 0 ? years : (Math.pow(1 + g, years) - 1) / g
}

function horizonEffectif(i: Inputs) {
  return Math.max(i.horizon, i.dureeSejour > 0 ? i.dureeSejour : 0)
}

function simulate(i: Inputs): { points: YearPoint[]; breakeven: number | null } {
  const f = financement(i)
  const emprunt = f.emprunt
  const tauxMensuel = f.tauxMensuel
  const mensualiteCapInt = f.mensualite
  const mensualiteTotale = f.mensualiteTotale
  const horizon = horizonEffectif(i)
  const impot = Math.min(100, Math.max(0, i.fiscaliteEpargne)) / 100

  const chargesAnnuellesProprio =
    i.taxeFonciere +
    i.chargesCopro +
    (i.prix * i.entretienPct) / 100 +
    i.assuranceHabProprio

  const renterPortfolioInit = i.apport
  const r_invest = i.tauxEpargne / 100 / 12

  let capitalRestantDu = emprunt
  let renterPortfolio = renterPortfolioInit
  let renterApports = renterPortfolioInit
  let buyerSurplusPortfolio = 0
  let buyerApports = 0
  const netDImpot = (valeur: number, apports: number) =>
    valeur - impot * Math.max(0, valeur - apports)
  const assuranceLocataireMensuelle = i.assuranceLocataire / 12

  const points: YearPoint[] = []
  let breakeven: number | null = null

  for (let t = 0; t <= horizon; t++) {
    const propertyValue = i.prix * Math.pow(1 + i.tauxAppreciation / 100, t)
    const fraisRevente = propertyValue * 0.05
    const buyerEquity = propertyValue - fraisRevente - capitalRestantDu
    const buyerNetWorth = buyerEquity + netDImpot(buyerSurplusPortfolio, buyerApports)
    const renterNetWorth = netDImpot(renterPortfolio, renterApports)
    const delta = buyerNetWorth - renterNetWorth

    points.push({
      year: t,
      acheteur: Math.round(buyerNetWorth),
      locataire: Math.round(renterNetWorth),
      propertyValue: Math.round(propertyValue),
      capitalRestantDu: Math.round(capitalRestantDu),
      delta: Math.round(delta),
      depenseAchat: 0,
      depenseLocation: 0,
    })

    if (breakeven === null && delta >= 0 && t > 0) breakeven = t

    // Rent is revised once a year (lease anniversary); owner charges rise once a year too
    const loyerAnnee = i.loyerMensuelCC * Math.pow(1 + i.tauxIRL / 100, t)
    const chargesProprioAnnee =
      (chargesAnnuellesProprio * Math.pow(1 + i.hausseCharges / 100, t)) / 12

    let totalAchat = 0
    let totalLocation = 0
    for (let m = 0; m < 12; m++) {
      if (capitalRestantDu > 0) {
        const interest = capitalRestantDu * tauxMensuel
        const principal = Math.min(mensualiteCapInt - interest, capitalRestantDu)
        capitalRestantDu = Math.max(0, capitalRestantDu - principal)
      }
      renterPortfolio *= 1 + r_invest
      buyerSurplusPortfolio *= 1 + r_invest

      const buyerMonthly =
        (capitalRestantDu > 0 ? mensualiteTotale : 0) + chargesProprioAnnee
      const renterMonthly = loyerAnnee + assuranceLocataireMensuelle
      totalAchat += buyerMonthly
      totalLocation += renterMonthly
      const surplus = buyerMonthly - renterMonthly
      if (surplus > 0) {
        renterPortfolio += surplus
        renterApports += surplus
      } else {
        buyerSurplusPortfolio += -surplus
        buyerApports += -surplus
      }
    }
    // Average monthly spending during year t (owner: loan + charges; renter: rent + insurance)
    points[points.length - 1].depenseAchat = Math.round(totalAchat / 12)
    points[points.length - 1].depenseLocation = Math.round(totalLocation / 12)
  }

  return { points, breakeven }
}

// ——————————————————————————————————————————————————
// Recommendation engine
// ——————————————————————————————————————————————————

type Decision = "acheter" | "louer" | "prudence"

interface RecoResult {
  decision: Decision
  titre: string
  explication: string
}

function getRecommendation({
  tauxEndettement,
  resteAVivreAchat,
  resteAVivreLocation,
  seuilResteAVivre,
  breakeven,
  horizon,
  dureeSejour,
  revenusNets,
  mensualiteTotale,
  buyerMonthlyTotal,
  renterMonthlyTotal,
  personnesACharge,
}: {
  tauxEndettement: number
  resteAVivreAchat: number
  resteAVivreLocation: number
  seuilResteAVivre: number
  breakeven: number | null
  horizon: number
  dureeSejour: number
  revenusNets: number
  mensualiteTotale: number
  buyerMonthlyTotal: number
  renterMonthlyTotal: number
  personnesACharge: number
}): RecoResult {
  const pctEndetStr = `${Math.round(tauxEndettement * 100)} %`
  const foyer =
    personnesACharge === 0
      ? "sans personne à charge"
      : `avec ${personnesACharge} personne${personnesACharge > 1 ? "s" : ""} à charge`

  if (tauxEndettement > 0.35) {
    return {
      decision: "louer",
      titre: "À Louer",
      explication: `Avec des revenus de ${fmt(revenusNets)}/mois, la mensualité de ${fmt(mensualiteTotale, { decimals: 0 })} porte votre taux d'endettement à ${pctEndetStr} — au-delà de la limite réglementaire HCSF de 35 %. Un crédit serait très probablement refusé dans ces conditions. Commencez par constituer un apport plus important ou visez un bien à prix inférieur.`,
    }
  }

  if (resteAVivreAchat < seuilResteAVivre) {
    return {
      decision: "louer",
      titre: "À Louer",
      explication: `Votre taux d'endettement de ${pctEndetStr} reste dans les limites bancaires, mais le reste à vivre après achat (${fmt(resteAVivreAchat)}/mois) passerait sous le seuil recommandé de ${fmt(seuilResteAVivre)} ${foyer}. La moindre dépense imprévue fragiliserait votre budget. La location laisse ${fmt(resteAVivreLocation)}/mois de marge supplémentaire.`,
    }
  }

  const ans = (n: number) => `${n} an${n > 1 ? "s" : ""}`

  if (breakeven === null || breakeven > horizon) {
    return {
      decision: "louer",
      titre: "À Louer",
      explication: `La situation financière le permet (taux d'endettement ${pctEndetStr}, reste à vivre ${fmt(resteAVivreAchat)}/mois), mais l'achat ne rattrape jamais un locataire qui investit la différence sur les ${ans(horizon)} simulés. Revoyez l'apport, le prix ou le loyer de référence.`,
    }
  }

  if (breakeven > dureeSejour) {
    return {
      decision: "louer",
      titre: "À Louer",
      explication: `Vous prévoyez d'y rester ${ans(dureeSejour)}, mais l'achat ne devient rentable qu'à partir de l'année ${breakeven}. En partant avant, les frais d'achat et de revente ne sont pas amortis : la location reste plus avantageuse pour votre projet.`,
    }
  }

  const marge = dureeSejour - breakeven
  if (marge < 3) {
    return {
      decision: "prudence",
      titre: "Prudence",
      explication: `L'achat est finançable (taux d'endettement ${pctEndetStr}, reste à vivre ${fmt(resteAVivreAchat)}/mois ${foyer}) et devient rentable à l'année ${breakeven}, mais vous prévoyez d'y rester ${ans(dureeSejour)} : la marge n'est que de ${ans(marge)}. Un départ anticipé rendrait la location plus avantageuse.`,
    }
  }

  return {
    decision: "acheter",
    titre: "À Acheter",
    explication: `Profil favorable : taux d'endettement de ${pctEndetStr} (limite 35 %), reste à vivre de ${fmt(resteAVivreAchat)}/mois ${foyer}. L'achat devient rentable à l'année ${breakeven} et vous prévoyez d'y rester ${ans(dureeSejour)}, soit ${ans(marge)} de marge.`,
  }
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

function pct(n: number, decimals = 1) {
  return fmt(n * 100, { suffix: " %", decimals })
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
  badge,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  min?: number
  hint?: string
  badge?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
        {badge && (
          <span className="ml-2 font-normal text-xs text-muted-foreground/70">{badge}</span>
        )}
      </Label>
      <div className="relative flex items-center">
        <NumberField
          id={id}
          value={value}
          onChange={onChange}
          className="pr-24 font-mono text-base"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatRow({
  label,
  value,
  muted,
  highlight,
}: {
  label: React.ReactNode
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={cn("text-base", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-base tabular-nums",
          highlight && "font-semibold",
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
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-3xl font-semibold tabular-nums",
          negative && "text-destructive",
          accent && "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ——————————————————————————————————————————————————
// Defaults
// ——————————————————————————————————————————————————

const defaults: Inputs = {
  typeBien: "ancien",
  fraisNotairePct: NOTAIRE_DEFAUT.ancien,
  prix: 300000,
  surface: 70,
  fraisAgenceAchat: 0,
  travaux: 10000,
  apport: 60000,
  tauxInteret: 3.3,
  dureePret: 25,
  assuranceEmprunteur: 300,
  fraisGarantiePct: 1,
  taxeFonciere: 1200,
  chargesCopro: 2400,
  entretienPct: 0.5,
  assuranceHabProprio: 200,
  loyerMensuelCC: 1200,
  assuranceLocataire: 150,
  tauxAppreciation: 2,
  tauxIRL: 2.5,
  hausseCharges: 2,
  tauxEpargne: 5,
  fiscaliteEpargne: 30,
  horizon: 30,
  dureeSejour: 30,
  revenusNets: 0,
  chargesFixes: 800,
  autresCredits: 0,
  personnesACharge: 0,
}

// ——————————————————————————————————————————————————
// Main
// ——————————————————————————————————————————————————

export default function Page() {
  const [inputs, setInputs, hydrated] = useLocalStorage<Inputs>("sim-res-principale-v1", defaults)

  function set<K extends keyof Inputs>(key: K) {
    return (v: number) => setInputs((prev) => ({ ...prev, [key]: v }))
  }
  function setClamped<K extends keyof Inputs>(key: K, max: number) {
    return (v: number) => setInputs((prev) => ({ ...prev, [key]: Math.min(max, Math.max(0, v)) }))
  }
  function setTypeBien(t: TypeBien) {
    setInputs((prev) => ({ ...prev, typeBien: t, fraisNotairePct: NOTAIRE_DEFAUT[t] }))
  }

  const { points, breakeven } = useMemo(() => simulate(inputs), [inputs])

  // ── Derived metrics ──
  const {
    fraisNotaire,
    fraisGarantie,
    fraisAchat,
    emprunt,
    tauxMensuel,
    nbMois,
    mensualiteTotale,
    interetsTotaux,
  } = financement(inputs)
  const horizon = horizonEffectif(inputs)
  const chargesNonRecuperablesTotales =
    fraisNotaire +
    fraisGarantie +
    inputs.fraisAgenceAchat +
    interetsTotaux +
    inputs.assuranceEmprunteur * inputs.dureePret +
    (inputs.taxeFonciere +
      inputs.chargesCopro +
      (inputs.prix * inputs.entretienPct) / 100 +
      inputs.assuranceHabProprio) *
      cumulCroissant(inputs.hausseCharges, horizon)
  const chargesProprioMensuel =
    (inputs.taxeFonciere +
      inputs.chargesCopro +
      (inputs.prix * inputs.entretienPct) / 100 +
      inputs.assuranceHabProprio) /
    12
  const buyerMonthlyTotal = mensualiteTotale + chargesProprioMensuel
  const renterMonthlyTotal = inputs.loyerMensuelCC + inputs.assuranceLocataire / 12
  const surplusMensuel = renterMonthlyTotal - buyerMonthlyTotal

  // ── Financial analysis ──
  const hasFinancialProfile = inputs.revenusNets > 0
  const tauxEndettement = hasFinancialProfile
    ? (mensualiteTotale + inputs.autresCredits) / inputs.revenusNets
    : 0
  const seuilResteAVivre = 700 + inputs.personnesACharge * 350
  const resteAVivreAchat = hasFinancialProfile
    ? inputs.revenusNets - buyerMonthlyTotal - inputs.chargesFixes - inputs.autresCredits
    : 0
  const resteAVivreLocation = hasFinancialProfile
    ? inputs.revenusNets - renterMonthlyTotal - inputs.chargesFixes - inputs.autresCredits
    : 0

  const recommendation: RecoResult | null = hasFinancialProfile
    ? getRecommendation({
        tauxEndettement,
        resteAVivreAchat,
        resteAVivreLocation,
        seuilResteAVivre,
        breakeven,
        horizon,
        dureeSejour: inputs.dureeSejour > 0 ? inputs.dureeSejour : horizon,
        revenusNets: inputs.revenusNets,
        mensualiteTotale,
        buyerMonthlyTotal,
        renterMonthlyTotal,
        personnesACharge: inputs.personnesACharge,
      })
    : null

  const lastPoint = points[points.length - 1]
  const snap = (yr: number) => points.find((p) => p.year === yr)
  const dureeSejour = inputs.dureeSejour > 0 ? inputs.dureeSejour : horizon
  const stayPoint = snap(dureeSejour)

  // ── Listing indicators ──
  const loyerAnnuel = inputs.loyerMensuelCC * 12
  const ratioPrixLoyer = loyerAnnuel > 0 ? inputs.prix / loyerAnnuel : null
  const ratioBand =
    ratioPrixLoyer === null
      ? "Loyer de référence manquant"
      : ratioPrixLoyer < 20
        ? "Plutôt favorable à l'achat (< 20 ans)"
        : ratioPrixLoyer <= 25
          ? "Zone neutre (20–25 ans)"
          : "Plutôt favorable à la location (> 25 ans)"

  // Highest price whose payment + insurance + other credits reaches 35 % of income
  const plafondMensuel =
    0.35 * inputs.revenusNets - inputs.autresCredits - inputs.assuranceEmprunteur / 12
  let prixMax: number | null = null
  if (hasFinancialProfile && plafondMensuel > 0 && nbMois > 0) {
    const empruntMax =
      tauxMensuel > 0
        ? (plafondMensuel * (1 - Math.pow(1 + tauxMensuel, -nbMois))) / tauxMensuel
        : plafondMensuel * nbMois
    const g = inputs.fraisGarantiePct / 100
    const a = inputs.fraisNotairePct / 100
    const p = (empruntMax / (1 + g) + inputs.apport - inputs.fraisAgenceAchat - inputs.travaux) / (1 + a)
    prixMax = p > 0 ? Math.round(p) : null
  }

  // ── Banner colors ──
  const bannerCls = recommendation
    ? recommendation.decision === "acheter"
      ? "bg-primary/5 border-primary/20"
      : recommendation.decision === "louer"
        ? "bg-destructive/5 border-destructive/20"
        : "bg-[#F4CB00]/10 border-[#F4CB00]/40"
    : ""

  const badgeCls = recommendation
    ? recommendation.decision === "acheter"
      ? "bg-primary text-primary-foreground"
      : recommendation.decision === "louer"
        ? "bg-destructive/10 text-destructive"
        : "bg-[#F4CB00]/30 text-[#DC5D00]"
    : ""

  // Render once saved values are in, so nothing animates from defaults to saved state
  if (!hydrated) return <main className="min-h-screen bg-background" />

  return (
    <>
      {/* ── Recommendation Banner ── */}
      <Disclosure show={!!recommendation}>
      {recommendation && (
        <div className="px-3 pt-3">
          <div className={cn("mx-auto flex max-w-5xl items-start gap-4 rounded-2xl border px-4 py-4 transition-colors duration-300", bannerCls)}>
            <Badge
              className={cn(
                "mt-0.5 shrink-0 rounded-2xl px-4 py-1.5 text-base font-semibold",
                badgeCls
              )}
            >
              <RollText text={recommendation.titre} />
            </Badge>
            <p className="text-base leading-relaxed text-foreground">
              {recommendation.explication}
            </p>
          </div>
        </div>
      )}
      </Disclosure>

      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-10">
          {/* ── Header ── */}
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Résidence Principale — Acheter ou Louer ?
            </h1>
            <p className="text-base text-muted-foreground">
              Comparez le patrimoine net d&apos;un acheteur et d&apos;un locataire qui investit la
              différence. Renseignez votre situation financière pour obtenir une recommandation
              personnalisée.
            </p>
          </div>

          {/* ── Inputs + Bilan ── */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Left: all inputs */}
            <div className="space-y-6">
              {/* Financial profile */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Ma situation financière</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ces informations permettent de calculer votre taux d&apos;endettement, votre
                    reste à vivre et de formuler une recommandation.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                  <NumericInput
                    id="revenus"
                    label="Revenus nets mensuels du foyer"
                    value={inputs.revenusNets}
                    onChange={set("revenusNets")}
                    suffix="€/mois"
                    step={100}
                    hint="Salaires nets + autres revenus réguliers"
                  />
                  <NumericInput
                    id="charges"
                    label="Charges fixes mensuelles"
                    value={inputs.chargesFixes}
                    onChange={set("chargesFixes")}
                    suffix="€/mois"
                    step={50}
                    hint="Alimentation, transport, abonnements — hors logement"
                  />
                  <NumericInput
                    id="autrescredits"
                    label="Autres crédits en cours"
                    value={inputs.autresCredits}
                    onChange={set("autresCredits")}
                    suffix="€/mois"
                    step={50}
                    hint="Crédit auto, conso, étudiant…"
                  />
                  <NumericInput
                    id="personnes"
                    label="Personnes à charge"
                    value={inputs.personnesACharge}
                    onChange={set("personnesACharge")}
                    suffix="pers."
                    step={1}
                    hint="Enfants, parents ou autres dépendants"
                  />

                  {/* Computed financial indicators */}
                  <Disclosure show={hasFinancialProfile} className="col-span-full">
                  {hasFinancialProfile && (
                    <CascadeItem index={0} className="grid grid-cols-3 gap-3">
                      <div
                        className={cn(
                          "rounded-xl p-4",
                          tauxEndettement > 0.35
                            ? "bg-destructive/5 border border-destructive/20"
                            : "bg-muted/50"
                        )}
                      >
                        <p className="text-sm text-muted-foreground">Taux d&apos;endettement</p>
                        <p
                          className={cn(
                            "mt-1 font-mono text-xl font-semibold",
                            tauxEndettement > 0.35 ? "text-destructive" : "text-foreground"
                          )}
                        >
                          {pct(tauxEndettement)}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">Limite HCSF : 35 %</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-xl p-4",
                          resteAVivreAchat < seuilResteAVivre
                            ? "bg-destructive/5 border border-destructive/20"
                            : "bg-muted/50"
                        )}
                      >
                        <p className="text-sm text-muted-foreground">Reste à vivre si achat</p>
                        <p
                          className={cn(
                            "mt-1 font-mono text-xl font-semibold",
                            resteAVivreAchat < seuilResteAVivre
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {fmt(resteAVivreAchat)}/mois
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Seuil : {fmt(seuilResteAVivre)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">Reste à vivre si location</p>
                        <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                          {fmt(resteAVivreLocation)}/mois
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Écart : {fmt(resteAVivreLocation - resteAVivreAchat)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "col-span-full flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl p-4",
                          prixMax !== null && inputs.prix <= prixMax
                            ? "bg-primary/5 border border-primary/20"
                            : "bg-destructive/5 border border-destructive/20"
                        )}
                      >
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Prix maximum finançable (endettement 35 %)
                          </p>
                          <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                            {prixMax !== null ? fmt(prixMax) : "Aucun financement possible"}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {prixMax === null
                            ? "Vos charges de crédit dépassent déjà la limite"
                            : inputs.prix <= prixMax
                              ? `Ce bien est dans votre budget (marge ${fmt(prixMax - inputs.prix)})`
                              : `Ce bien dépasse votre budget de ${fmt(inputs.prix - prixMax)}`}
                        </p>
                      </div>
                    </CascadeItem>
                  )}
                  </Disclosure>

                  <Disclosure show={!hasFinancialProfile} className="col-span-full">
                  {!hasFinancialProfile && (
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Renseignez vos revenus nets pour obtenir une analyse personnalisée et une
                        recommandation.
                      </p>
                    </div>
                  )}
                  </Disclosure>
                  </div>

                  <Disclosure show={hasFinancialProfile}>
                  {hasFinancialProfile && (
                    <CascadeItem index={1} className="space-y-2 pt-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Répartition du budget mensuel
                      </p>
                      <BudgetChart
                        achat={{
                          label: "Si achat",
                          logement: mensualiteTotale,
                          chargesLogement: chargesProprioMensuel,
                          chargesFixes: inputs.chargesFixes,
                          autresCredits: inputs.autresCredits,
                          reste: Math.max(0, resteAVivreAchat),
                          deficit: resteAVivreAchat < 0 ? Math.abs(resteAVivreAchat) : 0,
                        }}
                        location={{
                          label: "Si location",
                          logement: inputs.loyerMensuelCC,
                          chargesLogement: inputs.assuranceLocataire / 12,
                          chargesFixes: inputs.chargesFixes,
                          autresCredits: inputs.autresCredits,
                          reste: Math.max(0, resteAVivreLocation),
                          deficit: resteAVivreLocation < 0 ? Math.abs(resteAVivreLocation) : 0,
                        }}
                      />
                    </CascadeItem>
                  )}
                  </Disclosure>
                </CardContent>
              </Card>

              {/* Project inputs tabs */}
              <Tabs defaultValue="bien">
                <TabsList className="w-full">
                  <TabsTrigger value="bien" className="flex-1 text-sm">
                    Bien
                  </TabsTrigger>
                  <TabsTrigger value="financement" className="flex-1 text-sm">
                    Financement
                  </TabsTrigger>
                  <TabsTrigger value="charges" className="flex-1 text-sm">
                    Charges
                  </TabsTrigger>
                  <TabsTrigger value="location" className="flex-1 text-sm">
                    Location
                  </TabsTrigger>
                  <TabsTrigger value="marche" className="flex-1 text-sm">
                    Marché
                  </TabsTrigger>
                </TabsList>
                <TabsPanels className="mt-2">

                <TabsContent value="bien">
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <p id="type-bien-label" className="text-base font-medium">
                          Type de bien
                        </p>
                        <Tabs value={inputs.typeBien} onValueChange={(v) => setTypeBien(v as TypeBien)}>
                          <TabsList className="w-full" aria-labelledby="type-bien-label">
                            <TabsTrigger value="ancien" className="flex-1 text-sm">
                              Ancien
                            </TabsTrigger>
                            <TabsTrigger value="neuf" className="flex-1 text-sm">
                              Neuf
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <NumericInput
                        id="notaire"
                        label="Frais de notaire"
                        value={inputs.fraisNotairePct}
                        onChange={setClamped("fraisNotairePct", 100)}
                        suffix="% du prix"
                        step={0.1}
                        badge="non récupérable"
                        hint={`= ${fmt(fraisNotaire)} · ${inputs.typeBien === "neuf" ? "neuf : droits de mutation réduits (≈ 2–3 % au total)" : "ancien : droits de mutation pleins (≈ 7–8 %)"} · valeur indicative`}
                      />
                      <NumericInput
                        id="prix"
                        label="Prix d'achat"
                        value={inputs.prix}
                        onChange={set("prix")}
                        suffix="€"
                        step={5000}
                      />
                      <NumericInput
                        id="surface"
                        label="Surface"
                        value={inputs.surface}
                        onChange={set("surface")}
                        suffix="m²"
                        step={1}
                      />
                      <NumericInput
                        id="agence"
                        label="Frais d'agence (achat)"
                        value={inputs.fraisAgenceAchat}
                        onChange={set("fraisAgenceAchat")}
                        suffix="€"
                        step={500}
                        badge="non récupérable"
                      />
                      <NumericInput
                        id="travaux"
                        label="Travaux initiaux"
                        value={inputs.travaux}
                        onChange={set("travaux")}
                        suffix="€"
                        step={1000}
                      />
                      <NumericInput
                        id="apport"
                        label="Apport disponible"
                        value={inputs.apport}
                        onChange={set("apport")}
                        suffix="€"
                        step={1000}
                        hint="Couvre frais de notaire + mise de fonds"
                      />
                      <div className="space-y-2 rounded-xl bg-muted/50 p-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Frais de notaire ({fmt(inputs.fraisNotairePct, { suffix: " %", decimals: 1 })})
                            <span className="ml-1.5 text-xs text-muted-foreground/70">non récupérables</span>
                          </p>
                          <p className="font-mono text-base font-medium">{fmt(fraisNotaire)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Montant emprunté</p>
                          <p className="font-mono text-base font-semibold">{fmt(emprunt)}</p>
                        </div>
                      </div>
                    </CardContent>
                </TabsContent>

                <TabsContent value="financement">
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                      <NumericInput
                        id="taux"
                        label="Taux d'intérêt"
                        value={inputs.tauxInteret}
                        onChange={set("tauxInteret")}
                        suffix="%"
                        step={0.05}
                        min={0}
                      />
                      <NumericInput
                        id="duree"
                        label="Durée du prêt"
                        value={inputs.dureePret}
                        onChange={set("dureePret")}
                        suffix="ans"
                        step={1}
                        min={5}
                        hint="Max 25 ans (résidence principale — règle HCSF)"
                      />
                      <NumericInput
                        id="assurance"
                        label="Assurance emprunteur"
                        value={inputs.assuranceEmprunteur}
                        onChange={set("assuranceEmprunteur")}
                        suffix="€/an"
                        step={50}
                        min={0}
                        badge="non récupérable"
                      />
                      <NumericInput
                        id="garantie"
                        label="Frais de garantie et de dossier"
                        value={inputs.fraisGarantiePct}
                        onChange={setClamped("fraisGarantiePct", 100)}
                        suffix="% du prêt"
                        step={0.1}
                        badge="non récupérable"
                        hint={`= ${fmt(fraisGarantie)} · caution ou hypothèque + frais bancaires · valeur indicative`}
                      />
                      <div className="rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                          Mensualité (capital + intérêts + assurance)
                        </p>
                        <p className="mt-1 font-mono text-xl font-semibold">
                          {fmt(mensualiteTotale, { decimals: 0 })} / mois
                        </p>
                      </div>
                    </CardContent>
                </TabsContent>

                <TabsContent value="charges">
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                      <NumericInput
                        id="tf"
                        label="Taxe foncière"
                        value={inputs.taxeFonciere}
                        onChange={set("taxeFonciere")}
                        suffix="€/an"
                        badge="non récupérable"
                      />
                      <NumericInput
                        id="copro"
                        label="Charges de copropriété"
                        value={inputs.chargesCopro}
                        onChange={set("chargesCopro")}
                        suffix="€/an"
                        badge="non récupérable"
                      />
                      <NumericInput
                        id="entretien"
                        label="Entretien / maintenance"
                        value={inputs.entretienPct}
                        onChange={set("entretienPct")}
                        suffix="% prix/an"
                        step={0.1}
                        min={0}
                        hint={`= ${fmt((inputs.prix * inputs.entretienPct) / 100, { decimals: 0 })} / an`}
                        badge="non récupérable"
                      />
                      <NumericInput
                        id="asshabproprio"
                        label="Assurance habitation"
                        value={inputs.assuranceHabProprio}
                        onChange={set("assuranceHabProprio")}
                        suffix="€/an"
                        step={20}
                        badge="non récupérable"
                      />
                      <div className="col-span-full rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                          Total charges annuelles (hors emprunt)
                        </p>
                        <p className="font-mono text-base font-semibold">
                          {fmt(chargesProprioMensuel * 12, { decimals: 0 })} / an ·{" "}
                          {fmt(chargesProprioMensuel, { decimals: 0 })} / mois
                        </p>
                      </div>
                    </CardContent>
                </TabsContent>

                <TabsContent value="location">
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                      <NumericInput
                        id="loyer"
                        label="Loyer mensuel charges comprises"
                        value={inputs.loyerMensuelCC}
                        onChange={set("loyerMensuelCC")}
                        suffix="€/mois"
                        step={50}
                        hint="Loyer + provisions sur charges"
                      />
                      <NumericInput
                        id="asslocataire"
                        label="Assurance habitation locataire"
                        value={inputs.assuranceLocataire}
                        onChange={set("assuranceLocataire")}
                        suffix="€/an"
                        step={10}
                      />
                      <div className="col-span-full rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                          Coût mensuel total location
                        </p>
                        <p className="font-mono text-base font-semibold">
                          {fmt(renterMonthlyTotal, { decimals: 0 })} / mois
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {surplusMensuel > 0
                            ? `Le loyer dépasse la mensualité de ${fmt(surplusMensuel, { decimals: 0 }).trim()} — le locataire investit cet écart.`
                            : `La mensualité dépasse le loyer de ${fmt(-surplusMensuel, { decimals: 0 }).trim()} — l'acheteur investit cet écart.`}
                        </p>
                      </div>
                    </CardContent>
                </TabsContent>

                <TabsContent value="marche">
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                      <NumericInput
                        id="apprec"
                        label="Valorisation immobilier"
                        value={inputs.tauxAppreciation}
                        onChange={set("tauxAppreciation")}
                        suffix="%/an"
                        step={0.1}
                        hint="Moyenne long terme France ≈ 2–3 %/an"
                      />
                      <NumericInput
                        id="irl"
                        label="Hausse des loyers (IRL)"
                        value={inputs.tauxIRL}
                        onChange={set("tauxIRL")}
                        suffix="%/an"
                        step={0.1}
                        min={0}
                        hint="Révisé une fois par an, à la date anniversaire du bail"
                      />
                      <NumericInput
                        id="hausse-charges"
                        label="Hausse des charges propriétaire"
                        value={inputs.hausseCharges}
                        onChange={setClamped("hausseCharges", 100)}
                        suffix="%/an"
                        step={0.1}
                        hint="Taxe foncière, copropriété, entretien, assurance · valeur indicative"
                      />
                      <NumericInput
                        id="epargne"
                        label="Rendement épargne alternative"
                        value={inputs.tauxEpargne}
                        onChange={set("tauxEpargne")}
                        suffix="%/an"
                        step={0.5}
                        min={0}
                        hint="PEA diversifié ≈ 5–7 %/an historique"
                      />
                      <NumericInput
                        id="fiscalite"
                        label="Fiscalité sur les gains de l'épargne"
                        value={inputs.fiscaliteEpargne}
                        onChange={setClamped("fiscaliteEpargne", 100)}
                        suffix="%"
                        step={1}
                        hint="Flat tax 30 % · PEA après 5 ans ≈ 17,2 % · valeur indicative"
                      />
                      <NumericInput
                        id="horizon"
                        label="Horizon de simulation"
                        value={inputs.horizon}
                        onChange={setClamped("horizon", 60)}
                        suffix="ans"
                        step={1}
                        min={5}
                        hint={horizon > inputs.horizon ? `Étendu à ${horizon} ans pour couvrir la durée prévue` : undefined}
                      />
                      <NumericInput
                        id="sejour"
                        label="Durée prévue dans le logement"
                        value={inputs.dureeSejour}
                        onChange={setClamped("dureeSejour", 60)}
                        suffix="ans"
                        step={1}
                        hint="Combien d'années pensez-vous y vivre ? Vide = horizon"
                      />
                    </CardContent>
                </TabsContent>
                </TabsPanels>
              </Tabs>
            </div>

            {/* Right: bilan summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Bilan financier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Investissement initial
                  </p>
                  <StatRow label="Prix d'achat" value={fmt(inputs.prix)} />
                  <StatRow label="Frais d'achat" value={fmt(fraisAchat)} muted />
                  <StatRow label="Apport total" value={fmt(inputs.apport)} />
                  <StatRow label="Montant emprunté" value={fmt(emprunt)} muted />

                  <Separator className="my-3" />

                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Coûts mensuels
                  </p>
                  <StatRow label="Mensualité crédit" value={fmt(mensualiteTotale, { decimals: 0 })} />
                  <StatRow
                    label={
                      <span>
                        dont intérêts estimés
                        <span className="ml-1.5 text-xs text-muted-foreground/70">non récupérables</span>
                      </span>
                    }
                    value={`≈ ${fmt(nbMois > 0 ? interetsTotaux / nbMois : 0, { decimals: 0 })}/mois`}
                    muted
                  />
                  <StatRow label="Charges proprio" value={fmt(chargesProprioMensuel, { decimals: 0 })} muted />
                  <StatRow label="Total achat / mois" value={fmt(buyerMonthlyTotal, { decimals: 0 })} highlight />
                  <StatRow label="Total location / mois" value={fmt(renterMonthlyTotal, { decimals: 0 })} highlight />

                  <Separator className="my-3" />

                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Coûts non récupérables sur {horizon} ans
                  </p>
                  <StatRow
                    label={
                      <span>
                        dont intérêts du prêt
                        <span className="ml-1.5 text-xs text-muted-foreground/70">sur {inputs.dureePret} ans</span>
                      </span>
                    }
                    value={fmtK(interetsTotaux)}
                    muted
                  />
                  <StatRow
                    label="Total charges non récupérables"
                    value={fmtK(chargesNonRecuperablesTotales)}
                    highlight
                  />

                  <Separator className="my-3" />

                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Point d&apos;équilibre
                  </p>
                  {breakeven !== null ? (
                    <>
                      <StatRow label="Année" value={`Année ${breakeven}`} highlight />
                      <StatRow label="Âge estimé (30 ans)" value={`~${30 + breakeven} ans`} muted />
                    </>
                  ) : (
                    <p className="py-1 text-base text-destructive">
                      Aucun équilibre sur {horizon} ans
                    </p>
                  )}

                  <Separator className="my-3" />

                  {stayPoint && dureeSejour !== horizon && (
                    <>
                      <p className="mb-1 text-sm font-medium text-muted-foreground">
                        Si vous partez après {dureeSejour} ans
                      </p>
                      <StatRow label="Patrimoine acheteur" value={fmtK(stayPoint.acheteur)} />
                      <StatRow label="Patrimoine locataire" value={fmtK(stayPoint.locataire)} />
                      <StatRow
                        label="Avantage achat"
                        value={(stayPoint.delta >= 0 ? "+" : "") + fmtK(stayPoint.delta)}
                        highlight
                      />
                      <Separator className="my-3" />
                    </>
                  )}

                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    À {horizon} ans
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
                      <StatRow
                        label="Capital restant dû"
                        value={lastPoint.capitalRestantDu > 0 ? `− ${fmtK(lastPoint.capitalRestantDu)}` : "Soldé"}
                        muted
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  Hypothèses
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Frais de revente 5 %. Plus-value de la résidence principale exonérée. Le
                  locataire investit l&apos;apport + l&apos;écart mensuel ; ses gains sont imposés à{" "}
                  {fmt(inputs.fiscaliteEpargne, { suffix: " %", decimals: 0 })}{" "}à la revente
                  (même règle pour l&apos;épargne de l&apos;acheteur).
                </p>
              </div>
            </div>
          </div>

          {/* ── Key metrics ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
              label={breakeven !== null ? "Point d'équilibre" : "Pas d'équilibre"}
              value={breakeven !== null ? `Année ${breakeven}` : `> ${horizon} ans`}
              sub={
                breakeven !== null
                  ? surplusMensuel > 0
                    ? `Loyer > mensualité de ${fmt(surplusMensuel, { decimals: 0 }).trim()}`
                    : `Mensualité > loyer de ${fmt(-surplusMensuel, { decimals: 0 }).trim()}`
                  : "Revoyez l'apport ou le loyer"
              }
              accent={breakeven !== null}
            />
            <MetricCard
              label="Ratio prix / loyer"
              value={ratioPrixLoyer === null ? "—" : fmt(ratioPrixLoyer, { suffix: " ans", decimals: 1 })}
              sub={ratioBand}
            />
          </div>

          {/* ── Charts ── */}
          <Tabs defaultValue="patrimoine">
            <TabsPanels>
              <div className="flex flex-wrap items-center justify-between gap-3 px-(--card-spacing) pb-2">
                <TabsList aria-label="Graphique affiché">
                  <TabsTrigger value="patrimoine" className="text-sm">
                    Patrimoine net
                  </TabsTrigger>
                  <TabsTrigger value="depenses" className="text-sm">
                    Dépenses mensuelles
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#006DFF]" />
                    Acheteur
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#C4CACE]" />
                    Locataire
                  </span>
                </div>
              </div>
              <TabsContent value="patrimoine" className="px-(--card-spacing)">
                <p className="text-sm text-muted-foreground">
                  Ce que chacun possède s&apos;il revend ou liquide son épargne cette année-là.
                </p>
                <PatrimoineChart
                  points={points}
                  breakeven={breakeven}
                  stayYear={dureeSejour < horizon ? dureeSejour : undefined}
                />
              </TabsContent>
              <TabsContent value="depenses" className="px-(--card-spacing)">
                <p className="text-sm text-muted-foreground">
                  Coût moyen par mois : crédit + charges pour l&apos;acheteur, loyer + assurance pour le
                  locataire.
                </p>
                <DepensesChart
                  points={points}
                  finCredit={emprunt > 0 && inputs.dureePret <= horizon ? inputs.dureePret : null}
                />
              </TabsContent>
            </TabsPanels>
          </Tabs>

          {/* ── Snapshot table ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Patrimoine net par horizon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-base">
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
                      .filter((y) => y <= horizon)
                      .map((y) => {
                        const s = snap(y)
                        if (!s) return null
                        const positive = s.delta >= 0
                        return (
                          <tr key={y} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 text-muted-foreground">{y} ans</td>
                            <td className="py-2.5 text-right">{fmtK(s.acheteur)}</td>
                            <td className="py-2.5 text-right">{fmtK(s.locataire)}</td>
                            <td
                              className={cn(
                                "py-2.5 text-right font-semibold",
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
        </div>
      </main>
    </>
  )
}
