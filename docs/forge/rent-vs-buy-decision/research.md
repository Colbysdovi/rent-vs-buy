# Research: What to add to the Résidence Principale simulator to sharpen the buy-vs-rent decision

Date: 2026-10-27. Scope: the "Résidence Principale" page of Calculateur Immo (`app/residence-principale/page.tsx`).

## The question(s)

1. **Which inputs or costs does the simulator get wrong or leave out today**, in a way that would flip or shift the buy-vs-rent verdict for a typical French purchase? (Decides what to fix first.)
2. **Which additional calculations would help the owner judge one specific listing** they come across (is the price sane, how long must they stay, what could go wrong)? (Decides what to add.)
3. **Which official data or rules can be relied on** for these additions, and which are too volatile or contested to hard-code? (Decides what is an input vs a constant.)

Constraints: client-only Next.js app, no backend; French market and regulation; one user deciding on listings one at a time; values persisted in localStorage.

Out of scope: the Rendement Locatif page; tax optimisation of rental investment; mortgage-broker comparison; legal advice on any individual case.

## Summary & recommendation

The simulator's core model (month-by-month net-worth comparison, renter invests the difference) is sound. But three of its built-in assumptions are now wrong or incomplete for 2026, and they all bias the result:

- **Notary fees are fixed at 7.8 %.** New-build fees are far lower.
- **Loan guarantee fees are missing.**
- **The renter's portfolio is taxed nowhere,** while the owner's resale gain is genuinely tax-free.

The highest-value additions:

1. A **neuf / ancien switch** with editable notary rate.
2. **Guarantee + dossier fees.**
3. An **expected length of stay** compared against the break-even year.
4. A **DPE (energy class)** input feeding energy cost, renovation budget and a resale-risk flag.
5. A **price-to-rent ratio** sanity check.

**Go, with conditions** (see below).

## Options compared

| # | Addition | What it changes in the verdict | Data reliability | Effort |
|---|---|---|---|---|
| A | **Neuf / ancien switch + editable notary rate** (replace fixed 7.8 %) | Ancien ≈ 7.5–8.5 % since departments could raise DMTO to 5 % [S3]; neuf/VEFA DMTO capped at 0.715 % [S3]. On a 300 k€ purchase that is ~15–18 k€ of upfront cost, which moves break-even by years. | High for the rule; the per-department rate varies, so keep it as an editable input with a default | S |
| B | **Primo-accédant toggle** | Some departments apply a reduced or zero DMTO increase to first-time buyers. unverified: rule is departmental, not national | Low (varies by department) | S, only as a manual rate override |
| C | **Loan guarantee + dossier fees** | Caution: organism fee 150–600 € + ~0.8 % of the loan to the FMG, up to 75 % refunded at the end [S4]. Missing today, so buying looks slightly cheaper than it is. | Medium (varies by bank) | S |
| D | **Expected length of stay vs break-even** | Median holding in Île-de-France: 13.7 yrs for flats, 15.8 for houses (2024) [S6]. Today the page compares at a fixed horizon. "You plan to stay 6 years, break-even is year 12" is the decisive message for a single listing. | High (user input) | S |
| E | **DPE class input** → monthly energy cost, renovation budget, resale/relet flag | G homes are "non décents" since 1 Jan 2025, F from 2028, E from 2034 [S2]. A G/F purchase carries forced work if ever rented out and a resale discount. Today energy and DPE are ignored entirely. | High for the calendar; energy €/m² by class is unverified, so make it an input | M |
| F | **Price-to-rent ratio + price/m²** | Price ÷ annual rent of a comparable home; a quick sanity check on the listing. Comparison against local sale prices is possible via DVF open data [S5], but it has reuse limits and no simple API. | Ratio: computed from inputs. DVF: high quality but heavy | Ratio: S. DVF: L |
| G | **PTZ (zero-rate loan) tranche** | Lowers interest cost for eligible first-time buyers: not owner of a main residence in the last 2 years; ancien only in zones B2/C with ≥ 25 % works; neuf with no zone condition since April 2025 [S1]. | High, but income caps by zone/household are complex | M (manual PTZ amount input) / L (full eligibility) |
| H | **Tax on the renter's invested portfolio** | Today it is "avant impôt" (stated in the page's assumptions). The owner's resale gain on a main residence is fully exempt [S7], so leaving the renter untaxed overstates renting. | Exemption verified; the PFU/PEA rates are unverified in this pass | S (a "fiscalité épargne %" input) |
| I | **Sensitivity / stress row** | Break-even with rate +1 pt, appreciation 0 %, rent growth 0 %. Shows how fragile the verdict is. | n/a (model) | M |
| J | **Max affordable price** at 35 % debt ratio | The 35 % cap includes borrower insurance; max duration 25 yrs (27 with deferral for new build) [S8]. Inverse of the current check, useful while browsing listings. | High | S |

## Integration points & dependencies

- **Constants in code that would become inputs:**
  - notary rate: `app/residence-principale/page.tsx:81` and `:415` (`prix * 0.078`)
  - resale fee: `:119` (`propertyValue * 0.05`)
- **Persisted state:** new fields extend the `Inputs` interface and `defaults`. The localStorage key `sim-res-principale-v1` stores the whole object, so old saves lack the new keys. Merge defaults on load, or bump the key (bumping loses the user's saved values).
- **Recommendation engine** (`getRecommendation`): items D, E and I add new reasons. "Stay shorter than break-even" and "DPE F/G" deserve their own banner sentences.
- **DVF (item F, full version):** static yearly files plus a geolocated Etalab variant; Alsace, Moselle and Mayotte are excluded; reuse must not allow re-identification or search-engine indexing [S5]. A client-only app would need a pre-aggregated price-per-m² table, not raw transactions.
- **PTZ (item G):** eligibility depends on household income (revenu fiscal de référence), zone and household size [S1]. The commune zone lookup is a separate dataset that wasn't investigated in this pass.

## Recommendation & rationale

Ship in two waves.

**Wave 1 (correctness + decisive inputs, all small):**

- **A.** Neuf/ancien switch: default 7.8 % for ancien and ~2.5 % for neuf, editable.
- **C.** Guarantee/dossier fees: one input, default ~1 % of the loan, labelled non-récupérable.
- **D.** "Durée prévue dans le logement": the banner compares it to break-even, and the snapshot uses it instead of a fixed horizon.
- **H.** "Fiscalité sur l'épargne du locataire %" input, default to a user-confirmed value.
- **J.** Max affordable price.
- **F-ratio.** Price-to-rent ratio.

**Wave 2 (richer, medium effort):**

- **E.** DPE class: energy cost and renovation budget inputs, plus a risk flag.
- **I.** Stress row.
- **G.** PTZ, as a manual "montant PTZ" input. Full eligibility logic is too complex and too volatile to hard-code.

**What this trades away:**

- No automatic market-price lookup (DVF needs data prep and has reuse constraints).
- No automatic PTZ eligibility.
- Department-specific notary rates stay a manual input rather than a lookup.

All of this stays within the no-backend constraint.

## Blockers & gotchas

- **New-build notary fees are ~3× lower than the hard-coded 7.8 %.** The simulator overstates buying costs for any VEFA/new listing.
  - **Found by:** Selexium, "les DMTO restent plafonnés à 0,715 % lorsque le bien est acquis en VEFA" [S3], vs `page.tsx:81` `prix * 0.078`.
- **The DMTO increase is temporary (until 31 March 2028).** A hard-coded 2026 rate will be wrong later.
  - **Found by:** Selexium, "autorise les collectivités à relever leur part de taxes jusqu'au 31 mars 2028" [S3].
- **PTZ in the ancien is limited to zones B2/C with ≥ 25 % works.** Most city-centre resales are not eligible, so a generic "PTZ" checkbox would mislead.
  - **Found by:** service-public F10871: "Votre futur logement doit être dans une commune située en zone B2 ou C." [S1]
- **The asymmetric tax treatment biases the model toward renting.** The page's own assumption note says "Simulation avant impôt sur revenus du capital", yet the owner's gain is legally tax-free.
  - **Found by:** impots.gouv [S7] vs the "Hypothèses" note in `page.tsx`.
- **DVF data cannot simply be fetched and displayed per address.** Reuse must not enable re-identification or search-engine indexing.
  - **Found by:** data.gouv.fr DVF page [S5].
- **Adding fields breaks restored saves unless defaults are merged.** `useLocalStorage` replaces the whole object with the stored JSON.
  - **Found by:** `hooks/use-local-storage.ts:14` (`setValue(JSON.parse(stored))`).

## Go / No-Go

Go, with conditions

- Make every legally volatile figure (notary rate, guarantee %, savings tax, PTZ amount) an **editable input with a sourced default**, not a constant.
- Merge new defaults into restored localStorage state before shipping any new field.
- Pick and confirm the renter's savings tax rate (item H) before defaulting it. It was not verified here.
- **What would change the answer:** if the owner only ever looks at ancien in big cities, items A-neuf and G drop in value. If they want automatic local price checks, DVF becomes the main project (L effort) and needs its own research.

## Open questions & suggested spikes

- **Savings tax rate for the renter's portfolio** (PFU, PEA after 5 years, assurance-vie): not verified in this pass. Spike: read impots.gouv pages on PFU and PEA and pick a default.
- **Energy cost per m² by DPE class**, to give DPE input a default: unverified. Spike: find an ADEME/official table; otherwise ask the user for the listing's estimated annual energy cost (DPE reports show a range).
- **Department DMTO rates and primo-accédant reductions**: varies; sources disagree on counts. Spike: check whether the DGFiP publishes a per-department rate table that could be bundled.
- **Pre-aggregated DVF price/m² by commune** (e.g. Etalab statistics files): not investigated. Spike: one hour to see if a ready commune-level CSV exists and its size.
- **Typical renovation budget for DPE G/F → D**: not investigated.

## Sources

### Verified externally

1. [S1] https://www.service-public.gouv.fr/particuliers/vosdroits/F10871 (accessed 2026-10-27). "Vous ne devez pas avoir été propriétaire de votre résidence principale au cours des 2 années précédant le PTZ" / "Votre futur logement doit être dans une commune située en zone B2 ou C." / "Ces travaux doivent représenter au moins 25 % du coût total de l'opération à financer."
2. [S2] https://www.service-public.gouv.fr/particuliers/actualites/A17975 (accessed 2026-10-27). "à compter du 1er janvier 2025, les logements étiquetés G sur le DPE sont considérés comme non décents" / "à compter du 1er janvier 2028, les logements étiquetés F" / "À partir du 1er janvier 2034, les logements étiquetés E sur le DPE seront eux aussi considérés comme non décents"
3. [S3] https://www.selexium.com/actualites/hausse-dmto-5-confirme-2025/ (accessed 2026-10-27; secondary source). "appliqueront le taux maximal de 5 % sur les droits de mutation à titre onéreux (DMTO)" / "jusqu'au 31 mars 2028" / "les DMTO restent plafonnés à 0,715 % lorsque le bien est acquis en VEFA"
4. [S4] https://www.maif.fr/habitation/guide-achat-immobilier/frais-garantie (accessed 2026-10-27). "(entre 150 € et 600 €)" / "(autour de 0,8% de la somme empruntée, plus 200 € forfaitaires)" / "remboursement de la contribution au FMG jusqu'à hauteur de 75%"
5. [S5] https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/ (accessed 2026-10-27). "transactions immobilières intervenues au cours des cinq dernières années" / "ne doit pas permettre l'indexation des données depuis les moteurs de recherche externes"
6. [S6] https://www.mysweetimmo.com/2025/11/01/immobilier-ile-de-france-les-proprietaires-gardent-leurs-biens-plus-longtemps/ (accessed 2026-10-27; secondary, citing Notaires du Grand Paris). "la durée de détention médiane est de 13,7 ans pour les appartements vendus" / "de 15,8 ans pour les maisons"
7. [S7] https://www.impots.gouv.fr/particulier/plus-values-exonerees (accessed 2026-10-27). "La plus-value que vous réalisez lors de la vente de votre résidence principale est totalement exonérée."
8. [S8] https://www.cpim.fr/hcsf-2026-plafond-endettement/ (accessed 2026-10-27; broker site). "le HCSF plafonne le taux d'endettement à 35 % des revenus nets, assurance emprunteur comprise" / "27 ans si différé de 2 ans sur le neuf VEFA"

Note: service-public F17701 (frais de notaire) was opened but does not state ancien/neuf rates or the 2025 DMTO increase, so the DMTO figures rest on a secondary source [S3].

### Verified in this codebase / runtime

- `app/residence-principale/page.tsx:81` and `:415`: `const fraisNotaire = i.prix * 0.078`, a fixed rate with no neuf/ancien distinction.
- `app/residence-principale/page.tsx:119`: `const fraisRevente = propertyValue * 0.05`, a fixed resale cost.
- `app/residence-principale/page.tsx` "Hypothèses" block: "Simulation avant impôt sur revenus du capital", so the renter's portfolio is untaxed.
- No input exists for guarantee/dossier fees, DPE, energy cost, PTZ, or expected stay (checked the `Inputs` interface, lines 35–64).
- `hooks/use-local-storage.ts:14`: `setValue(JSON.parse(stored))` replaces state wholesale, so new fields would be missing from old saves.
