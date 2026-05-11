# Sales Skills Pipeline Integration — Design Spec
**Date:** 2026-05-11

## Overview

Embed four sales methodology skills across the full Kammie B2B pipeline: ICP construction, company analysis, prospect scoring, AI Find enrichment, and outreach generation. The goal is to move from ad-hoc prompting to a structured, framework-driven brain.

**Skills:**
- `outbound-prospecting` — ICP development, persona definition, account tiering
- `prospect-research-integration` — data enrichment, trigger detection, completeness scoring
- `territory-account-launch` — Champion/Decision Maker stakeholder model, multi-threading
- `email-sequence` — 8-touch angle progression, persona-based sequence design

---

## 1. Data Model

### `CompanyAnalysis` (`lib/types.ts`)

Remove `tone`. Expand description requirement to 3-5 sentences. Add `completeness_score`.

```ts
export interface CompanyAnalysis {
  description:         string               // 3-5 sentences
  value_proposition:   string               // max 15 words
  key_products:        Record<string, string>
  key_features:        string[]             // up to 5
  completeness_score:  number               // 0-1, scrape confidence
}
```

### `ICP` (`lib/types.ts`)

Remove flat `personas` array. Add `champions`, `decision_makers`, `goals`, `objections`.

```ts
export interface ICP {
  industries:       string[]
  company_sizes:    string[]
  geography:        string[]
  champions:        string[]                  // mid-level titles: daily users, internal advocates
  decision_makers:  string[]                  // C-suite / heads of: budget authority
  pain_points:      Record<string, string[]>  // keyed by persona title (both tiers)
  goals:            Record<string, string[]>  // keyed by persona title — what they're measured on
  objections:       Record<string, string[]>  // keyed by persona title — common blockers
}
```

**DB:** No migration needed. `icp` is already JSONB. Old `personas` field is gracefully ignored on read.

---

## 2. APIs

### `app/api/analyze-company/route.ts`

- Claude prompt: change description instruction from "2-3 sentences" to "3-5 sentences"
- Remove `tone` from prompt and response
- ICP suggestion uses `champions` + `decision_makers` instead of flat `personas` — Claude infers which titles are mid-level vs C-suite from website content
- Return `completeness_score: number (0-1)`:
  - Full site scraped (homepage + about + services) → 1.0
  - Homepage only → 0.6
  - Apollo description fallback → 0.3

### `app/api/generate-pain-points/route.ts`

Extend output beyond pain points. Single Claude call, same input, richer output:

```ts
// Input: company name, description, value_prop, key_products, persona title
// Output (extended):
{
  pain_points: string[]   // 4-6 items (existing)
  goals:       string[]   // 3-4 items — what this persona is measured on (new)
  objections:  string[]   // 2-3 items — common blockers to buying (new)
}
```

### `app/api/apollo/companies/route.ts` — `batchScoreCompanies`

**Add timing dimension (0-20 pts)** using existing Apollo fields:

| Signal | Source | Points |
|--------|--------|--------|
| Recent early funding (Seed/Series A) | `latest_funding_stage` | 10 |
| Recent growth funding (Series B/C) | `latest_funding_stage` | 6 |
| Strong headcount growth (>10% 6mo) | `employee_count_6_month_growth` | 5 |
| Moderate growth (5-10%) | `employee_count_6_month_growth` | 3 |
| Late stage / bootstrapped | `latest_funding_stage` | 1 |

**Split reachability check** — run people search against `icp.champions` and `icp.decision_makers` separately:

| Result | Bonus |
|--------|-------|
| Decision Maker reachable | +8 |
| Champion only reachable | +5 |
| Neither | 0 |

Return `champion_reachable: boolean` and `decision_maker_reachable: boolean` instead of single `reachable`.

Update `ApolloCompany` interface in `lib/apollo.ts` accordingly.

### `app/api/find-opportunities/route.ts` — AI Find

When Kammie surfaces companies via AI Find, run full enrichment at discovery time (not on user click):

1. Detect trigger events from Apollo fields already available: `latest_funding_stage`, `employee_count_6_month_growth`, `technology_names`
2. Run Firecrawl enrichment per suggested company at discovery time
3. Map detected triggers to `recommended_angle` on the opportunity record:
   - Recent funding → "just raised [round] — lead with scale challenges and budget availability"
   - High headcount growth → "growing fast — lead with operational efficiency"
   - Enterprise tech stack → "already investing in tooling — lead with integration and ROI"
4. Trigger signals contribute to score and surface as the suggested outreach hook

### `app/api/generate-sequence/route.ts`

**Extend from 4 to 8 touches** following `email-sequence` angle progression:

| Touch | Day | Angle |
|-------|-----|-------|
| 1 | 1 | Trigger / research hook |
| 2 | 3 | Value reinforcement |
| 3 | 6 | Social proof |
| 4 | 9 | Different pain point |
| 5 | 12 | Question-led ("are you dealing with X?") |
| 6 | 16 | Content / resource share |
| 7 | 21 | Referral ask ("is there someone better placed?") |
| 8 | 27 | Graceful exit |

**Accept `persona_type: "champion" | "decision_maker"`** in request body — adjusts copy accordingly:

| Type | Tone | Focus | Word limit |
|------|------|-------|------------|
| `champion` | Tactical, feature-level | "makes your day easier" | 80-100 words |
| `decision_maker` | Outcomes, ROI, risk | Business impact | 60-80 words |

---

## 3. UI

### `profile-page.tsx` — B2BSection

- Remove tone selector
- Description field: update label/placeholder to "3-5 sentences"
- Replace single `Personas` pill input with two:
  - **Champions** — "Mid-level users and advocates (e.g. Marketing Manager, Sales Ops)"
  - **Decision Makers** — "Budget holders and sign-off (e.g. CMO, VP Sales, CEO)"
- Pain points expand panel works as before, keyed by title from either tier
- Goals and Objections: two additional collapsible rows per persona (same expand-on-click pattern)

### `CompanySetupWizard.tsx` — Step 3

- Same Champion / Decision Maker chip split as profile settings
- Goals + Objections shown as optional expandable fields to avoid overwhelming new users

### `CompanyCard.tsx`

- Replace single `reachable` chip with two: `Champion ✓` and `DM ✓`
- Show timing signal badge if present: e.g. `Series B · 3mo ago` alongside account tier

### `discover-page.tsx` / `dashboard-home.tsx`

No structural change — pass `icp` through as before. Scoring improvements are server-side.

---

## 4. Skill → Brain Summary

| Skill | Brain Layer |
|-------|------------|
| `outbound-prospecting` | ICP form (persona fields, goals, objections), account tier scoring |
| `prospect-research-integration` | `analyze-company` completeness score, AI Find trigger detection, enrichment at discovery |
| `territory-account-launch` | Champion/DM persona split, dual reachability check, per-persona sequence targeting |
| `email-sequence` | 8-touch angle progression, Champion vs DM copy calibration |

---

## 5. Out of Scope

- User-defined buying triggers (detected at enrichment, not set in ICP)
- LinkedIn / phone sequence channels (email-only for now)
- Objection handling in outreach copy (captured in ICP, not yet wired into sequence prompts — future)
