"use client"

import { useLocalStorage } from "@/hooks/use-local-storage"
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
  prixAcquisition: number
  surface: number
  fraisAgence: number
  travaux: number
  mobilier: number
  apport: number
  tauxInteret: number
  dureePret: number
  fraisDossier: number
  assuranceEmprunteur: number
  chargesCopro: number
  assurancePNO: number
  travauxImprevus: number
  taxeFonciere: number
  CFE: number
  comptabilite: number
  honorairesMiseLocation: number
  tauxGestion: number
  loyerMensuel: number
  forfaitCharges: number
  vacanceLocative: number
  dureéDetention: number
  valorisationMarche: number
  IRL: number
  // Profil financier
  revenusNets: number
  chargesFixes: number
  autresCredits: number
  personnesACharge: number
}

// ——————————————————————————————————————————————————
// Calculs
// ——————————————————————————————————————————————————

function compute(i: Inputs) {
  const fraisNotaire = i.prixAcquisition * 0.078
  const fraisDossierMontant =
    (i.prixAcquisition - i.apport + fraisNotaire + i.fraisAgence + i.travaux + i.mobilier) *
    (i.fraisDossier / 100)
  const investissementTotal =
    i.prixAcquisition +
    fraisNotaire +
    i.fraisAgence +
    i.travaux +
    i.mobilier +
    fraisDossierMontant
  const emprunt = Math.max(0, investissementTotal - i.apport)

  const tauxMensuel = i.tauxInteret / 100 / 12
  const nbMensualites = i.dureePret * 12
  let mensualite = 0
  if (tauxMensuel > 0 && emprunt > 0) {
    mensualite =
      (emprunt * (tauxMensuel * Math.pow(1 + tauxMensuel, nbMensualites))) /
      (Math.pow(1 + tauxMensuel, nbMensualites) - 1)
  }
  const assuranceMensuelle = i.assuranceEmprunteur / 12
  const mensualiteTotale = mensualite + assuranceMensuelle

  const loyersAnnuelsCC = (i.loyerMensuel + i.forfaitCharges) * 12
  const loyersApresVacance = loyersAnnuelsCC * (1 - i.vacanceLocative / 100)
  const honorairesGestion = loyersAnnuelsCC * (i.tauxGestion / 100)

  const totalCharges =
    i.chargesCopro +
    i.assurancePNO +
    i.travauxImprevus +
    i.taxeFonciere +
    i.CFE +
    i.comptabilite +
    i.honorairesMiseLocation +
    honorairesGestion

  const rendementBrut =
    investissementTotal > 0 ? (loyersApresVacance / investissementTotal) * 100 : 0
  const rendementNetExploitation =
    investissementTotal > 0
      ? ((loyersApresVacance - totalCharges) / investissementTotal) * 100
      : 0

  const tresorerieBrute = (loyersApresVacance - mensualiteTotale * 12) / 12
  const tresorerieNette = (loyersApresVacance - totalCharges - mensualiteTotale * 12) / 12

  let capitalRestantDu = emprunt
  for (let m = 0; m < Math.min(i.dureéDetention * 12, nbMensualites); m++) {
    const interet = capitalRestantDu * tauxMensuel
    const capital = mensualite - interet
    capitalRestantDu = Math.max(0, capitalRestantDu - capital)
  }

  const valeurRevente =
    i.prixAcquisition * Math.pow(1 + i.valorisationMarche / 100, i.dureéDetention)
  const gainNetRevente = valeurRevente - i.prixAcquisition - capitalRestantDu
  const revenusNetsExploitation = (loyersApresVacance - totalCharges) * i.dureéDetention
  const capitalRembourse = emprunt - capitalRestantDu
  const epargneeNette = capitalRembourse + gainNetRevente

  return {
    fraisNotaire,
    emprunt,
    investissementTotal,
    mensualite,
    assuranceMensuelle,
    mensualiteTotale,
    loyersAnnuelsCC,
    loyersApresVacance,
    honorairesGestion,
    totalCharges,
    rendementBrut,
    rendementNetExploitation,
    tresorerieBrute,
    tresorerieNette,
    valeurRevente,
    gainNetRevente,
    revenusNetsExploitation,
    epargneeNette,
    capitalRestantDu,
  }
}

// ——————————————————————————————————————————————————
// Recommendation (locatif)
// ——————————————————————————————————————————————————

type Decision = "favorable" | "prudence" | "defavorable"

interface RecoResult {
  decision: Decision
  titre: string
  explication: string
}

function getLocatifRecommendation({
  revenusNets,
  tauxEndettement,
  tresorerieNette,
  rendementNetExploitation,
  mensualiteTotale,
  resteAVivre,
  seuilResteAVivre,
  personnesACharge,
}: {
  revenusNets: number
  tauxEndettement: number
  tresorerieNette: number
  rendementNetExploitation: number
  mensualiteTotale: number
  resteAVivre: number
  seuilResteAVivre: number
  personnesACharge: number
}): RecoResult {
  const foyer =
    personnesACharge === 0
      ? ""
      : ` avec ${personnesACharge} personne${personnesACharge > 1 ? "s" : ""} à charge`

  if (tauxEndettement > 0.35) {
    return {
      decision: "defavorable",
      titre: "Financement Compromis",
      explication: `Avec des revenus de ${fmt(revenusNets)}/mois${foyer}, la mensualité de ${fmt(mensualiteTotale, { decimals: 0 })} porte votre taux d'endettement à ${(tauxEndettement * 100).toFixed(1)} % — au-delà de la limite HCSF de 35 %. Un crédit serait très probablement refusé. Augmentez l'apport ou ciblez un bien moins cher.`,
    }
  }

  if (resteAVivre < seuilResteAVivre && revenusNets > 0) {
    return {
      decision: "defavorable",
      titre: "Budget Tendu",
      explication: `Le taux d'endettement de ${(tauxEndettement * 100).toFixed(1)} % reste acceptable, mais l'effort lié à l'investissement ramènerait votre reste à vivre à ${fmt(resteAVivre)}/mois — sous le seuil recommandé de ${fmt(seuilResteAVivre)}${foyer}. La moindre vacance locative fragiliserait sérieusement votre budget.`,
    }
  }

  if (tresorerieNette >= 0 && rendementNetExploitation >= 5) {
    return {
      decision: "favorable",
      titre: "Investissement Solide",
      explication: `Taux d'endettement de ${(tauxEndettement * 100).toFixed(1)} % (limite 35 %). Le bien s'autofinance et dégage ${fmt(tresorerieNette, { decimals: 0 })}/mois de trésorerie positive avec un rendement net de ${rendementNetExploitation.toFixed(2)} % — excellent pour le marché français. Reste à vivre de ${fmt(resteAVivre)}/mois.`,
    }
  }

  if (tresorerieNette >= 0 && rendementNetExploitation >= 3) {
    return {
      decision: "favorable",
      titre: "Investissement Rentable",
      explication: `Taux d'endettement de ${(tauxEndettement * 100).toFixed(1)} %. Les loyers couvrent toutes les charges et la mensualité — trésorerie positive de ${fmt(tresorerieNette, { decimals: 0 })}/mois. Rendement net de ${rendementNetExploitation.toFixed(2)} % pour un investissement sans effort mensuel.`,
    }
  }

  if (tresorerieNette > -200 && rendementNetExploitation >= 4) {
    return {
      decision: "prudence",
      titre: "Effort Justifié",
      explication: `Taux d'endettement de ${(tauxEndettement * 100).toFixed(1)} %, sous la limite légale. L'effort mensuel de ${fmt(-tresorerieNette, { decimals: 0 })} est compensé par un rendement net de ${rendementNetExploitation.toFixed(2)} % et la constitution de patrimoine. Vérifiez que cet effort est soutenable dans la durée (vacance locative, travaux imprévus).`,
    }
  }

  if (tresorerieNette >= -350 && rendementNetExploitation >= 3) {
    return {
      decision: "prudence",
      titre: "Prudence",
      explication: `Effort mensuel de ${fmt(-tresorerieNette, { decimals: 0 })} et rendement net de ${rendementNetExploitation.toFixed(2)} % — les chiffres sont limites. Cet investissement peut se justifier si le marché local a un fort potentiel de valorisation, mais la marge de sécurité est faible.`,
    }
  }

  return {
    decision: "defavorable",
    titre: "À Éviter",
    explication: `L'effort mensuel de ${fmt(-tresorerieNette, { decimals: 0 })} combiné à un rendement net de ${rendementNetExploitation.toFixed(2)} % ne justifie pas cet investissement. Cherchez un bien avec un rapport loyer/prix supérieur ou négociez le prix d'achat à la baisse.`,
  }
}

// ——————————————————————————————————————————————————
// Helpers UI
// ——————————————————————————————————————————————————

function fmt(n: number, opts: { suffix?: string; decimals?: number } = {}): string {
  const { suffix = " €", decimals = 0 } = opts
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + suffix
  )
}

function pct(n: number, decimals = 2) {
  return fmt(n, { suffix: " %", decimals })
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
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
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
          className="pr-12 font-mono text-base"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">
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
  label: string
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
          highlight ? "font-semibold text-foreground" : "text-foreground",
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
}: {
  label: string
  value: string
  sub?: string
  negative?: boolean
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-3xl font-semibold tabular-nums",
          negative && "text-destructive"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ——————————————————————————————————————————————————
// Defaults (exemple du fichier Excel)
// ——————————————————————————————————————————————————

const defaults: Inputs = {
  prixAcquisition: 265000,
  surface: 80,
  fraisAgence: 16000,
  travaux: 64000,
  mobilier: 13000,
  apport: 85170,
  tauxInteret: 3.3,
  dureePret: 25,
  fraisDossier: 2,
  assuranceEmprunteur: 300,
  chargesCopro: 2500,
  assurancePNO: 80,
  travauxImprevus: 100,
  taxeFonciere: 1000,
  CFE: 220,
  comptabilite: 252,
  honorairesMiseLocation: 1040,
  tauxGestion: 7,
  loyerMensuel: 1700,
  forfaitCharges: 400,
  vacanceLocative: 3,
  dureéDetention: 20,
  valorisationMarche: 2,
  IRL: 3,
  revenusNets: 0,
  chargesFixes: 800,
  autresCredits: 0,
  personnesACharge: 0,
}

// ——————————————————————————————————————————————————
// Main component
// ——————————————————————————————————————————————————

export default function Page() {
  const [inputs, setInputs] = useLocalStorage<Inputs>("sim-locatif-v2", defaults)

  function set<K extends keyof Inputs>(key: K) {
    return (v: number) => setInputs((prev) => ({ ...prev, [key]: v }))
  }

  const r = compute(inputs)

  // ── Financial profile ──
  const hasFinancialProfile = inputs.revenusNets > 0
  const tauxEndettement = hasFinancialProfile
    ? (r.mensualiteTotale + inputs.autresCredits) / inputs.revenusNets
    : 0
  const seuilResteAVivre = 700 + inputs.personnesACharge * 350
  // After rental income: net monthly impact on budget = -tresorerieNette (positive = costs you, negative = earns you)
  const resteAVivre = hasFinancialProfile
    ? inputs.revenusNets - inputs.chargesFixes - inputs.autresCredits + r.tresorerieNette
    : 0

  const recommendation: RecoResult | null =
    hasFinancialProfile
      ? getLocatifRecommendation({
          revenusNets: inputs.revenusNets,
          tauxEndettement,
          tresorerieNette: r.tresorerieNette,
          rendementNetExploitation: r.rendementNetExploitation,
          mensualiteTotale: r.mensualiteTotale,
          resteAVivre,
          seuilResteAVivre,
          personnesACharge: inputs.personnesACharge,
        })
      : null

  const bannerCls = recommendation
    ? recommendation.decision === "favorable"
      ? "bg-secondary border-border"
      : recommendation.decision === "defavorable"
        ? "bg-destructive/5 border-destructive/20"
        : "bg-muted/60 border-border"
    : ""

  const badgeCls = recommendation
    ? recommendation.decision === "favorable"
      ? "bg-primary text-primary-foreground"
      : recommendation.decision === "defavorable"
        ? "bg-destructive/10 text-destructive"
        : "bg-secondary text-secondary-foreground"
    : ""

  return (
    <>
      {/* ── Recommendation Banner ── */}
      {recommendation && (
        <div className={cn("border-b px-4 py-5", bannerCls)}>
          <div className="mx-auto flex max-w-5xl items-start gap-4">
            <Badge
              className={cn(
                "mt-0.5 shrink-0 rounded-2xl px-4 py-1.5 text-base font-semibold",
                badgeCls
              )}
            >
              {recommendation.titre}
            </Badge>
            <p className="text-base leading-relaxed text-foreground">
              {recommendation.explication}
            </p>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Header */}
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Simulateur de rendement locatif
            </h1>
            <p className="text-base text-muted-foreground">
              Renseignez les paramètres de votre investissement pour estimer sa rentabilité.
            </p>
          </div>

          {/* ── Ma situation financière ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ma situation financière</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ces informations permettent d&apos;évaluer la faisabilité du financement et
                l&apos;impact de l&apos;investissement sur votre budget.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
                id="charges-fixes"
                label="Charges fixes mensuelles"
                value={inputs.chargesFixes}
                onChange={set("chargesFixes")}
                suffix="€/mois"
                step={50}
                hint="Alimentation, transport, abonnements — hors logement"
              />
              <NumericInput
                id="autres-credits"
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

              {hasFinancialProfile && (
                <div className="col-span-full grid grid-cols-3 gap-3">
                  {/* Taux d'endettement */}
                  <div
                    className={cn(
                      "rounded-xl p-4",
                      tauxEndettement > 0.35
                        ? "border border-destructive/20 bg-destructive/5"
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
                      {(tauxEndettement * 100).toFixed(1)} %
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">Limite HCSF : 35 %</p>
                  </div>

                  {/* Cashflow mensuel net */}
                  <div
                    className={cn(
                      "rounded-xl p-4",
                      r.tresorerieNette < -200
                        ? "border border-destructive/20 bg-destructive/5"
                        : r.tresorerieNette >= 0
                          ? "bg-muted/50"
                          : "bg-muted/50"
                    )}
                  >
                    <p className="text-sm text-muted-foreground">Cashflow net / mois</p>
                    <p
                      className={cn(
                        "mt-1 font-mono text-xl font-semibold",
                        r.tresorerieNette < 0 ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {r.tresorerieNette >= 0 ? "+" : ""}
                      {fmt(r.tresorerieNette, { decimals: 0 })}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {r.tresorerieNette >= 0 ? "Autofinancé" : "Effort mensuel"}
                    </p>
                  </div>

                  {/* Reste à vivre */}
                  <div
                    className={cn(
                      "rounded-xl p-4",
                      resteAVivre < seuilResteAVivre
                        ? "border border-destructive/20 bg-destructive/5"
                        : "bg-muted/50"
                    )}
                  >
                    <p className="text-sm text-muted-foreground">Reste à vivre</p>
                    <p
                      className={cn(
                        "mt-1 font-mono text-xl font-semibold",
                        resteAVivre < seuilResteAVivre ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {fmt(resteAVivre)}/mois
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Seuil : {fmt(seuilResteAVivre)}
                    </p>
                  </div>
                </div>
              )}

              {!hasFinancialProfile && (
                <div className="col-span-full rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Renseignez vos revenus nets pour obtenir une analyse de faisabilité et une
                    recommandation personnalisée.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Résultats clés */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Rendement brut"
              value={pct(r.rendementBrut)}
              sub="loyers / investissement"
            />
            <MetricCard
              label="Rendement net"
              value={pct(r.rendementNetExploitation)}
              sub="après charges"
            />
            <MetricCard
              label="Trésorerie brute / mois"
              value={fmt(r.tresorerieBrute, { decimals: 0 })}
              negative={r.tresorerieBrute < 0}
              sub="loyers – emprunt"
            />
            <MetricCard
              label="Trésorerie nette / mois"
              value={fmt(r.tresorerieNette, { decimals: 0 })}
              negative={r.tresorerieNette < 0}
              sub="après toutes charges"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Paramètres */}
            <div className="space-y-6">
              <Tabs defaultValue="bien">
                <TabsList className="w-full">
                  <TabsTrigger value="bien" className="flex-1 text-sm">
                    Bien &amp; Coûts
                  </TabsTrigger>
                  <TabsTrigger value="financement" className="flex-1 text-sm">
                    Financement
                  </TabsTrigger>
                  <TabsTrigger value="charges" className="flex-1 text-sm">
                    Charges
                  </TabsTrigger>
                  <TabsTrigger value="revenus" className="flex-1 text-sm">
                    Revenus
                  </TabsTrigger>
                  <TabsTrigger value="projection" className="flex-1 text-sm">
                    Projection
                  </TabsTrigger>
                </TabsList>

                {/* Bien */}
                <TabsContent value="bien" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Caractéristiques du bien</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <NumericInput
                        id="prix"
                        label="Prix d'acquisition"
                        value={inputs.prixAcquisition}
                        onChange={set("prixAcquisition")}
                        suffix="€"
                        step={1000}
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
                        label="Frais d'agence"
                        value={inputs.fraisAgence}
                        onChange={set("fraisAgence")}
                        suffix="€"
                        step={500}
                      />
                      <NumericInput
                        id="travaux"
                        label="Travaux de rénovation"
                        value={inputs.travaux}
                        onChange={set("travaux")}
                        suffix="€"
                        step={1000}
                      />
                      <NumericInput
                        id="mobilier"
                        label="Mobilier & agencement"
                        value={inputs.mobilier}
                        onChange={set("mobilier")}
                        suffix="€"
                        step={500}
                      />
                      <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Frais de notaire (7,8 %)</p>
                          <p className="font-mono text-base font-medium">{fmt(r.fraisNotaire)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Investissement total</p>
                          <p className="font-mono text-base font-semibold">
                            {fmt(r.investissementTotal)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Financement */}
                <TabsContent value="financement" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Structure de financement</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <NumericInput
                        id="apport"
                        label="Apport personnel"
                        value={inputs.apport}
                        onChange={set("apport")}
                        suffix="€"
                        step={1000}
                      />
                      <div className="space-y-1 rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">Montant emprunté</p>
                        <p className="font-mono text-base font-semibold">{fmt(r.emprunt)}</p>
                      </div>
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
                        min={1}
                      />
                      <NumericInput
                        id="fraisDossier"
                        label="Frais de dossier bancaire"
                        value={inputs.fraisDossier}
                        onChange={set("fraisDossier")}
                        suffix="% du prêt"
                        step={0.1}
                        min={0}
                      />
                      <NumericInput
                        id="assurance"
                        label="Assurance emprunteur"
                        value={inputs.assuranceEmprunteur}
                        onChange={set("assuranceEmprunteur")}
                        suffix="€/an"
                        step={50}
                        min={0}
                      />
                      <div className="col-span-full rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                          Mensualité estimée (capital + intérêts + assurance)
                        </p>
                        <p className="font-mono text-xl font-semibold">
                          {fmt(r.mensualiteTotale, { decimals: 2 })} / mois
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Charges */}
                <TabsContent value="charges" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Charges d&apos;exploitation annuelles</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <NumericInput
                        id="copro"
                        label="Charges de copropriété"
                        value={inputs.chargesCopro}
                        onChange={set("chargesCopro")}
                        suffix="€/an"
                      />
                      <NumericInput
                        id="pno"
                        label="Assurance PNO"
                        value={inputs.assurancePNO}
                        onChange={set("assurancePNO")}
                        suffix="€/an"
                        step={10}
                      />
                      <NumericInput
                        id="imprevu"
                        label="Travaux imprévus"
                        value={inputs.travauxImprevus}
                        onChange={set("travauxImprevus")}
                        suffix="€/an"
                        step={50}
                      />
                      <NumericInput
                        id="tf"
                        label="Taxe foncière"
                        value={inputs.taxeFonciere}
                        onChange={set("taxeFonciere")}
                        suffix="€/an"
                      />
                      <NumericInput
                        id="cfe"
                        label="CFE"
                        value={inputs.CFE}
                        onChange={set("CFE")}
                        suffix="€/an"
                        step={10}
                        hint="Cotisation Foncière des Entreprises"
                      />
                      <NumericInput
                        id="compta"
                        label="Comptabilité / CGA"
                        value={inputs.comptabilite}
                        onChange={set("comptabilite")}
                        suffix="€/an"
                        step={10}
                      />
                      <NumericInput
                        id="misenloc"
                        label="Honoraires mise en location"
                        value={inputs.honorairesMiseLocation}
                        onChange={set("honorairesMiseLocation")}
                        suffix="€/an"
                      />
                      <NumericInput
                        id="gestion"
                        label="Taux de gestion locative"
                        value={inputs.tauxGestion}
                        onChange={set("tauxGestion")}
                        suffix="%"
                        step={0.5}
                        min={0}
                        hint={`= ${fmt(r.honorairesGestion, { decimals: 0 })} / an`}
                      />
                      <div className="col-span-full rounded-xl bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">Total charges annuelles</p>
                        <p className="font-mono text-base font-semibold">
                          {fmt(r.totalCharges, { decimals: 0 })} / an
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Revenus */}
                <TabsContent value="revenus" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Revenus locatifs</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <NumericInput
                        id="loyer"
                        label="Loyer mensuel hors charges"
                        value={inputs.loyerMensuel}
                        onChange={set("loyerMensuel")}
                        suffix="€/mois"
                        step={50}
                      />
                      <NumericInput
                        id="charges"
                        label="Forfait charges mensuel"
                        value={inputs.forfaitCharges}
                        onChange={set("forfaitCharges")}
                        suffix="€/mois"
                        step={10}
                      />
                      <NumericInput
                        id="vacance"
                        label="Vacance locative"
                        value={inputs.vacanceLocative}
                        onChange={set("vacanceLocative")}
                        suffix="%/an"
                        step={0.5}
                        min={0}
                        hint={`≈ ${Math.round((inputs.vacanceLocative / 100) * 365)} jours/an`}
                      />
                      <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Loyers bruts annuels CC</p>
                          <p className="font-mono text-base font-medium">
                            {fmt(r.loyersAnnuelsCC)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Après vacance locative</p>
                          <p className="font-mono text-base font-semibold">
                            {fmt(r.loyersApresVacance, { decimals: 0 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Projection */}
                <TabsContent value="projection" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Paramètres de projection</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <NumericInput
                        id="detention"
                        label="Durée de détention"
                        value={inputs.dureéDetention}
                        onChange={set("dureéDetention")}
                        suffix="ans"
                        step={1}
                        min={1}
                      />
                      <NumericInput
                        id="valorisation"
                        label="Valorisation marché annuelle"
                        value={inputs.valorisationMarche}
                        onChange={set("valorisationMarche")}
                        suffix="%/an"
                        step={0.1}
                      />
                      <NumericInput
                        id="irl"
                        label="IRL moyen (révision loyers)"
                        value={inputs.IRL}
                        onChange={set("IRL")}
                        suffix="%/an"
                        step={0.1}
                        min={0}
                      />
                      <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Valeur estimée à la revente
                          </p>
                          <p className="font-mono text-base font-semibold">
                            {fmt(r.valeurRevente, { decimals: 0 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Gain net revente (après CRD)
                          </p>
                          <p className="font-mono text-base font-medium">
                            {fmt(r.gainNetRevente, { decimals: 0 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Bilan financier */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Bilan financier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  <StatRow
                    label="Investissement total"
                    value={fmt(r.investissementTotal)}
                    highlight
                  />
                  <StatRow label="dont apport" value={fmt(inputs.apport)} muted />
                  <StatRow label="dont emprunt" value={fmt(r.emprunt)} muted />

                  <Separator className="my-3" />

                  <StatRow
                    label="Loyers annuels nets"
                    value={fmt(r.loyersApresVacance, { decimals: 0 })}
                  />
                  <StatRow
                    label="Charges annuelles"
                    value={`− ${fmt(r.totalCharges, { decimals: 0 })}`}
                    muted
                  />
                  <StatRow
                    label="Annuité emprunt"
                    value={`− ${fmt(r.mensualiteTotale * 12, { decimals: 0 })}`}
                    muted
                  />

                  <Separator className="my-3" />

                  <StatRow label="Rendement brut" value={pct(r.rendementBrut)} highlight />
                  <StatRow
                    label="Rendement net exploitation"
                    value={pct(r.rendementNetExploitation)}
                    highlight
                  />

                  <Separator className="my-3" />

                  <StatRow
                    label="Trésorerie brute / mois"
                    value={fmt(r.tresorerieBrute, { decimals: 0 })}
                    highlight
                  />
                  <StatRow
                    label="Trésorerie nette / mois"
                    value={fmt(r.tresorerieNette, { decimals: 0 })}
                    highlight
                  />

                  <Separator className="my-3" />

                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    À la revente ({inputs.dureéDetention} ans)
                  </p>
                  <StatRow label="Valeur estimée" value={fmt(r.valeurRevente, { decimals: 0 })} />
                  <StatRow
                    label="Capital restant dû"
                    value={`− ${fmt(r.capitalRestantDu, { decimals: 0 })}`}
                    muted
                  />
                  <StatRow
                    label="Gain net revente"
                    value={fmt(r.gainNetRevente, { decimals: 0 })}
                    highlight
                  />
                  <StatRow
                    label="Revenus nets exploitation"
                    value={fmt(r.revenusNetsExploitation, { decimals: 0 })}
                    highlight
                  />
                  <StatRow
                    label="Épargne nette récupérée"
                    value={fmt(r.epargneeNette, { decimals: 0 })}
                    highlight
                  />
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  Info
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Simulation indicative. Fiscalité et plus-value non incluses. Appuyez sur{" "}
                  <kbd className="rounded border border-border px-1.5 font-mono text-sm">D</kbd>{" "}
                  pour basculer le thème.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
