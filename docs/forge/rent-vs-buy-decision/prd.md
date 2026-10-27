# PRD: Résidence Principale — sharper buy-vs-rent verdict (Wave 1)

Upstream: `docs/forge/rent-vs-buy-decision/research.md` (items A, C, D, H, J and the price-to-rent part of F). No idea brief exists; the problem and scope come from the owner's request and that research. Built-state check: git history (17 commits up to `50c592a`) and the current page contain none of these six capabilities.

## 1. Context & Objectives

**The why.** The owner uses the Résidence Principale simulator to decide, listing by listing, whether to buy or keep renting. Research found that several built-in assumptions are wrong for 2026, and that they bias the verdict:

- One notary rate is applied to every property, though new-build purchases cost roughly a third as much in fees.
- Loan guarantee and file fees are missing from the purchase costs.
- The renter's invested savings are never taxed, while the owner's resale gain on a main residence is legally tax-free.

The simulator also can't answer the single most decisive question for a listing: *will I stay long enough for buying to pay off?* It also gives no quick read on whether the asking price is sane, or the most the owner could borrow for.

**The what.** Six additions to the Résidence Principale page:

1. a new-build / existing-property choice that drives the notary fees
2. loan guarantee and file fees
3. an expected length of stay, compared with the break-even year
4. a tax rate on the renter's investment gains
5. a price-to-rent ratio for the listing
6. the maximum purchase price the owner's profile can finance

**Objectives.**

1. Make the up-front cost of buying match reality for both new-build and existing homes.
2. Remove the tax asymmetry that currently flatters renting.
3. Turn the verdict into an answer for *this owner's plans*: the planned stay vs break-even.
4. Give two fast sanity checks while browsing listings: is the price high relative to rent, and is it within reach?

**Non-goals (this version).**

- Energy rating (DPE), renovation budgets, stress scenarios and the zero-rate loan (PTZ). These are Wave 2 in the research.
- Automatic market price lookup from public sales data. It is a separate, large project with reuse restrictions.
- Department-by-department notary-rate lookup, and automatic first-time-buyer reductions. The owner enters the rate manually if it differs from the default.
- Any change to the Rendement Locatif page.

## 2. Target Users & Personas

The owner: a single household in France, evaluating individual apartments or houses as they find them, deciding whether to buy one as their main home or keep renting. They are comfortable with numbers but are not a tax or mortgage specialist.

## 3. User Stories & Acceptance Criteria

### A. Property type and notary fees

> As the owner, I want to say whether the listing is a new build or an existing property, so that notary fees reflect what I would actually pay.

- A two-option choice (existing / new build) sits with the other property inputs, and the existing-property option is preselected.
- Choosing an option sets a sensible default notary rate: about 7.8 % of the price for existing property and about 2.5 % for a new build.
- The rate is shown and editable. If the owner edits it, their value is kept until they switch property type again; switching type resets the rate to that type's default.
- Notary fees feed every place the current fixed fee feeds today: up-front cost, loan amount, the net-worth simulation, the financial summary and the non-recoverable totals.
- Notary fees keep their "non récupérable" label.
- A short hint explains why the two rates differ (transfer taxes are much lower on new builds).

### B. Guarantee and file fees

> As the owner, I want loan guarantee and bank file fees included, so that the purchase cost is not understated.

- A new cost input, "frais de garantie et de dossier", is expressed as a percentage of the amount borrowed, with a default of about 1 %. A hint shows the amount in euros.
- It is labelled "non récupérable".
- It adds to the up-front purchase cost and to the non-recoverable total, and it affects the simulation the same way notary fees do: paid out of the down payment first, then financed if the down payment runs out.
- A value of 0 is valid, for example when there is no guarantee.

### C. Expected length of stay vs break-even

> As the owner, I want to enter how long I expect to live in the home, so that the verdict tells me whether buying pays off within *my* time frame.

- A new input, "durée prévue dans le logement", in years. Its default equals the simulation horizon.
- The recommendation logic compares the planned stay with the break-even year:
  - Break-even later than the planned stay, or never: the verdict leans toward renting. The explanation names both numbers ("vous prévoyez d'y rester X ans, l'achat devient rentable à partir de l'année Y").
  - Break-even within the planned stay: the explanation states the margin in years.
  - The existing affordability rules (35 % debt ratio, minimum remaining budget) still take precedence over this comparison.
- The financial summary shows the projected net-worth gap between buying and renting *at the planned stay*, alongside the existing end-of-horizon figures.
- The net-worth chart visibly marks the planned-stay year, distinct from the break-even marker.
- If the planned stay is longer than the horizon, the horizon extends to cover it (or the owner is told it is capped). The verdict must never compare against a year the simulation didn't compute.

### D. Tax on the renter's investment gains

> As the owner, I want the renter's invested savings to be taxed, so that renting is not artificially favoured.

- A new market input, "fiscalité sur les gains de l'épargne", as a percentage. It is editable, with a default confirmed per §9.
- The tax applies to the *gains* of the renter's portfolio, not to the contributions, and is recognised when the comparison is made. This means net worth at a given year assumes the portfolio is cashed out then. The same treatment applies to any surplus the buyer invests.
- The owner's resale gain stays untaxed, and the assumptions note says so explicitly: "plus-value de la résidence principale exonérée".
- The assumptions note no longer says the simulation is before tax on capital income. It states the tax rate in use.
- A rate of 0 % reproduces today's results exactly.

### E. Price-to-rent ratio

> As the owner, I want to see how many years of rent the asking price represents, so that I can tell at a glance whether the listing is expensive relative to renting.

- The ratio is the purchase price divided by the annual rent of the comparable rental (the rent input already on the page). It is shown in years, with one decimal.
- It appears near the key metrics, with a one-line interpretation band: lower values favour buying, higher favour renting. The thresholds are in §9.
- If the comparable rent is 0, the ratio shows a dash, not infinity or an error.

### F. Maximum affordable price

> As the owner, I want to know the highest price my profile can finance, so that I can filter listings before simulating each one.

- Shown only when income is entered, in the "Ma situation financière" area.
- It is the price at which the loan payment, including borrower insurance, plus existing credits reaches 35 % of net income. It uses the current rate, loan length, down payment, notary rate, and guarantee and file fees.
- It is shown next to the current listing price, with a clear state: within reach, or over by X €.
- If existing credits alone already exceed 35 % of income, it shows "aucun financement possible" instead of a negative number.
- The figure updates live as inputs change.

### G. Saved values

> As the returning owner, I want my previously saved simulation to keep working after these fields are added, so that I don't lose my inputs.

- A simulation saved before this release loads without errors. New fields take their defaults, and every existing value is preserved.
- No field ever shows as empty or "NaN" because it was missing from a saved simulation.

## 4. Functional Requirements & Modules

**M1 — Purchase-cost model** (must-have). It holds property type, notary rate, and guarantee and file rate. It exposes the up-front fees, split into notary and guarantee/file, and the resulting loan amount. Every consumer on the page (summary, simulation, non-recoverable total, budget chart, affordability) reads from this one source, so the figures can never disagree.

**M2 — Simulation engine** (must-have). It gains:

- the savings-tax rate, applied to portfolio gains at each yearly comparison point
- a planned-stay output: the net-worth gap at that year, and whether break-even falls within it

Existing outputs keep their meaning.

**M3 — Recommendation engine** (must-have). It adds the planned-stay rule from story C, ordered after the affordability rules, and its explanations name the planned stay and the break-even year.

**M4 — Listing indicators** (must-have). The price-to-rent ratio with its interpretation band, and the maximum affordable price with its within-reach state. Both are pure derivations of current inputs.

**M5 — Inputs & persistence** (must-have). New inputs:

- property type
- notary rate
- guarantee/file rate
- planned stay
- savings-tax rate

Placement:

- Property type and both fee rates go with the purchase inputs; property type and notary rate go together.
- The savings tax goes with the market assumptions.
- The planned stay goes with the horizon.

Restored saves are completed with defaults.

**UI/UX.**

- New inputs follow the existing field pattern: large field, unit suffix, a hint line, and the discreet "non récupérable" tag where it applies.
- The property-type choice is a segmented control and follows the project rule for segmented controls: one persistent surface with a sliding selection.
- Interpretation states (ratio band, within reach / over budget) use the existing semantic colours (accent, warning, destructive) and always pair colour with text.

## 5. Non-Functional Requirements

- **Performance:** recomputing the full simulation after any input change takes under 50 ms on a mid-range laptop for a 40-year horizon. Typing stays free of visible lag.
- **Accessibility (WCAG 2.1 AA):**
  - Every new input has a visible label tied to the field.
  - The property-type control is keyboard operable, with arrow keys and a visible focus ring, and announces its selected state.
  - The ratio band and the within-reach state are conveyed in text, not colour alone; text meets 4.5:1 contrast in light and dark themes.
- **Correctness:** with property type "existing", notary rate 7.8 %, guarantee/file 0 %, savings tax 0 % and planned stay equal to the horizon, every figure on the page matches the current release to the euro (regression baseline).
- **Persistence reliability:** 100 % of simulations saved by the current release load without error and keep all of their prior values.
- **Privacy:** all inputs stay in the browser's local storage; nothing is sent to a server.

## 6. Technical Constraints & Dependencies

- Client-only web app with no backend. All calculation happens in the browser.
- Saved simulations are stored as one object per page. Currently a restore replaces the in-memory state wholesale, so missing new keys would be absent unless defaults are merged.
- The page already renders only after saved values are restored, to avoid an animated jump. New fields must respect that.
- Regulatory facts used as defaults, from research.md:
  - New-build transfer taxes capped at 0.715 % (total notary fees about 2–3 %).
  - Departments may raise transfer taxes on existing property to 5 % until 31 March 2028.
  - Guarantee costs: a fixed fee plus about 0.8 % of the loan, partly refunded.
  - A main-residence resale gain is fully tax-exempt.
  - The 35 % debt-ratio cap includes borrower insurance.

  These defaults are time-sensitive, which is why each is an editable input rather than a constant.
- French number formatting and French UI copy throughout.

## 7. Edge Cases & Failure Handling

- **Zero or empty inputs:**
  - A 0 rate for notary, guarantee or tax is valid and means "none".
  - A planned stay of 0 or empty falls back to the horizon.
  - A comparable rent of 0 shows a dash for the ratio.
- **Down payment smaller than fees:** fees beyond the down payment are financed, consistently for notary and guarantee/file fees. The loan amount and the debt ratio reflect it.
- **No break-even within the horizon:** the planned-stay verdict says buying does not pay off within the simulated period. It never invents a year.
- **Planned stay longer than the horizon:** see story C. Never compare against an uncomputed year.
- **Affordability impossible:** existing credits ≥ 35 % of income, or a zero loan length, shows "aucun financement possible", never a negative or infinite price.
- **Out-of-range entries** (rate > 100 %, negative years): they are clamped or ignored and the page never breaks. The field shows what is being used.
- **Old saved simulations:** see story G.
- **Time-sensitive defaults** (transfer-tax increase ends 31 March 2028): the hints state the defaults as "valeur indicative" so the owner knows to check them.

## 8. Success Metrics

This is a personal tool, so the signals are qualitative and checked by the owner:

- **Decision usefulness:** for the next 5 listings evaluated, the planned-stay verdict and the two indicators are cited by the owner as part of the decision.
- **Accuracy:** for one real offer, the simulator's up-front costs land within 2 % of the notary's estimate and the bank's offer.
- **Regression:** the §5 regression baseline holds.
- **Anti-signal:** the owner overriding the default rates on most listings means the defaults are poor and should be revisited.

## 9. Gap Analysis — Assumptions to Validate

1. **Default savings-tax rate (story D).** Assumed 30 % (the French flat tax on investment gains), labelled indicative. It matters because it directly shifts the verdict. *Resolve:* the owner confirms their actual vehicle (PEA, assurance-vie, ordinary account); a short research check on the current rates. Unverified in research.md.
2. **Default new-build notary rate (story A).** Assumed 2.5 %, within the 2–3 % range reported by secondary sources. *Resolve:* the owner accepts, or checks one notary simulator.
3. **Default guarantee/file rate (story B).** Assumed 1 % of the loan: about 0.8 % to the mutual fund plus a fixed fee and file fees, ignoring the partial refund. *Resolve:* compare with the owner's bank offer when available.
4. **When tax is recognised (story D).** Assumed the portfolio is cashed out at each comparison year. Taxing yearly would understate renting. *Resolve:* settled for this version unless the owner objects.
5. **Ratio interpretation thresholds (story E).** Assumed below about 20 years favours buying, 20–25 is neutral, and above 25 favours renting. These are common rules of thumb and are not sourced. *Resolve:* the owner validates, or a short research check on French market price-to-rent levels.
6. **Planned stay longer than horizon (story C).** Extend the horizon automatically, or cap it with a message. Either satisfies the requirement. *Open: build decides.*
7. **Resale cost (5 % fixed).** It remains unchanged and non-editable in this version. *Explicitly out of scope, not an open gap.*
8. **Department-specific notary rates and first-time-buyer reductions.** Handled only by manual editing of the notary rate. *Explicitly out of scope, not an open gap.*
