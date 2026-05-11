# Sales Skills Pipeline Integration — Implementation Plan
**Date:** 2026-05-11  
**Spec:** `2026-05-11-sales-skills-pipeline-design.md`

## Order of execution

Dependencies flow downward — data model first, then APIs that consume it, then UI last.

---

## Step 1 — Data model (`lib/types.ts`)

**Change `CompanyAnalysis`:**
- Remove `tone` field
- Update `description` JSDoc comment to "3-5 sentences"
- Add `completeness_score: number`

**Change `ICP`:**
- Remove `personas: string[]`
- Add `champions: string[]`
- Add `decision_makers: string[]`
- Add `goals: Record<string, string[]>`
- Add `objections: Record<string, string[]>`

**Change `ApolloCompany` (`lib/apollo.ts`):**
- Remove `reachable?: boolean`
- Add `champion_reachable?: boolean`
- Add `decision_maker_reachable?: boolean`

---

## Step 2 — `analyze-company` route

File: `app/api/analyze-company/route.ts`

- Update Claude prompt: "3-5 sentences" for description, remove tone instruction
- Update ICP suggestion output: replace `personas` with `champions` + `decision_makers` arrays — prompt Claude to classify which titles are mid-level (champion) vs C-suite/heads-of (decision maker)
- Compute and return `completeness_score`:
  - Full scrape (homepage + about + services content all returned) → 1.0
  - Homepage only → 0.6
  - Apollo description fallback (no Firecrawl data) → 0.3

---

## Step 3 — `generate-pain-points` route

File: `app/api/generate-pain-points/route.ts`

- Extend Claude prompt to return `goals` (3-4 items) and `objections` (2-3 items) alongside existing `pain_points` (4-6 items) in same JSON response
- Update response type and any callers that destructure the output

---

## Step 4 — `apollo/companies` scoring

File: `app/api/apollo/companies/route.ts`

**Add `scoreTiming()` helper (0-20 pts):**
```
Seed / Series A           → 10
Series B / C              → 6  
headcount growth > 10%    → +5
headcount growth 5-10%    → +3
Late stage / bootstrapped → 1
No data                   → 0
```

**Split `checkReachability()` into two calls:**
- `checkChampionReachability(company, icp.champions)` → `{ reachable: boolean, count: number }`
- `checkDMReachability(company, icp.decision_makers)` → `{ reachable: boolean, count: number }`
- Run both in parallel via `Promise.allSettled`
- Bonus: DM reachable → +8, Champion only → +5, neither → 0

**Update `batchScoreCompanies`:**
- Add `scoreTiming()` to firmographic step
- Replace single reachability call with dual calls
- Return `champion_reachable` + `decision_maker_reachable` on each company

**Update score rationale strings** to reference new signals.

---

## Step 5 — `find-opportunities` route

File: `app/api/find-opportunities/route.ts`

- Move Firecrawl enrichment from on-click to discovery time for AI Find results (top 5 suggestions)
- After enrichment, detect trigger signals from available data:
  - `latest_funding_stage` + recency → funding trigger
  - `employee_count_6_month_growth > 0.10` → growth trigger
  - Enterprise tech stack detected → tooling trigger
- Map trigger to `recommended_angle` string stored on opportunity upsert
- Compute `signal_score` at insert using enriched data (existing `calculateSignalScore` in `lib/scoring.ts`)

---

## Step 6 — `generate-sequence` route

File: `app/api/generate-sequence/route.ts`

**Extend to 8 touches:**

| Touch | Day | Angle |
|-------|-----|-------|
| 1 | 1 | Trigger / research hook |
| 2 | 3 | Value reinforcement |
| 3 | 6 | Social proof |
| 4 | 9 | Different pain point |
| 5 | 12 | Question-led |
| 6 | 16 | Content / resource |
| 7 | 21 | Referral ask |
| 8 | 27 | Graceful exit |

**Accept `persona_type: "champion" | "decision_maker"`** (default `"champion"` if absent):
- Champion: tactical, feature-level, 80-100 word limit
- Decision Maker: outcomes + ROI, 60-80 word limit

Update `lib/copy-engine/buildPrompt.ts` system prompt and per-touch angle instructions to reflect new 8-touch structure and persona_type calibration.

---

## Step 7 — Profile settings UI

File: `components/kammie/profile-page.tsx`

- Remove tone selector from B2BSection company analysis editor
- Update description field placeholder to "3-5 sentences describing what you do and who you help"
- Replace single `Personas` PillInput with two:
  - **Champions** — placeholder: "Marketing Manager, Sales Ops, Account Executive..."
  - **Decision Makers** — placeholder: "CMO, VP Sales, CEO, Head of Growth..."
- Pain points expand panel: no change (already keyed by title, works for both tiers)
- Add Goals + Objections collapsible rows per persona (same expand-on-click as pain points)

---

## Step 8 — CompanySetupWizard UI

File: `components/onboarding/CompanySetupWizard.tsx`

- Step 3 (ICP review): replace `Personas` chip section with Champions + Decision Makers sections
- Goals + Objections shown as optional expandable per persona (collapsed by default)

---

## Step 9 — CompanyCard UI

File: `components/discover/CompanyCard.tsx`

- Replace `reachable` boolean chip with `champion_reachable` and `decision_maker_reachable` chips
- Add timing signal badge: if `latest_funding_stage` present → show e.g. `Series B` badge alongside account tier

---

## Step 10 — Type check + smoke test

```bash
pnpm build
```

Verify:
- No TS errors from removed `tone`, removed `personas`, renamed `reachable`
- `analyze-company` returns `completeness_score`
- `generate-pain-points` returns `goals` + `objections`
- Discover page renders dual reachability chips without crash
- Sequence generation produces 8 touches

---

## Files touched

| File | Change |
|------|--------|
| `lib/types.ts` | `CompanyAnalysis` + `ICP` interface changes |
| `lib/apollo.ts` | `ApolloCompany` reachability field split |
| `app/api/analyze-company/route.ts` | Prompt + output changes |
| `app/api/generate-pain-points/route.ts` | Extended output |
| `app/api/apollo/companies/route.ts` | Timing score + dual reachability |
| `app/api/find-opportunities/route.ts` | Enrichment at discovery, trigger → angle |
| `app/api/generate-sequence/route.ts` | 8 touches + persona_type |
| `lib/copy-engine/buildPrompt.ts` | 8-touch angles + persona_type calibration |
| `components/kammie/profile-page.tsx` | Champions/DMs UI, remove tone, goals/objections |
| `components/onboarding/CompanySetupWizard.tsx` | Step 3 champion/DM split |
| `components/discover/CompanyCard.tsx` | Dual reachability chips, timing badge |
