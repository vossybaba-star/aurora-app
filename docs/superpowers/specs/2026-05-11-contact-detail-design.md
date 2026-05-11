# Contact Detail Screen — Design Spec
_2026-05-11_

## Problem

The Contacts tab surfaces Apollo people as cards. There is no way to act on a contact — no research, no email generation, no sequence entry — without leaving Kammie entirely. A contact card currently shows: name, obfuscated surname, title, company, city, LinkedIn link. That is a dead end.

The Contact Detail screen is where B2B selling actually happens: you go deep on one person, understand their buying context, and start outreach.

---

## Scope

This spec covers one discrete screen: **the Contact Detail view** — triggered by tapping any contact card in the Contacts tab.

Out of scope for this spec (separate initiatives):
- Contacts database / CRM pipeline
- Bulk sequencing across multiple contacts
- Team collaboration / shared pipelines

---

## Screen Architecture

### Entry Point
Tapping a `ContactCard` in the Discover contacts tab slides up a **full-screen sheet** (mobile) or navigates to a new route (desktop). The contact is passed as state — no DB round-trip needed to open the screen.

Route: `/contacts/[apolloPersonId]` — but data is fetched client-side on mount rather than SSR, because Apollo person IDs are ephemeral (they don't live in our DB yet).

### Layout — Three Sections

```
┌──────────────────────────────────────┐
│  HEADER                              │
│  [Company logo]  Name · Title        │
│  Company · City                      │
│  [LinkedIn] [Website]                │
├──────────────────────────────────────┤
│  RESEARCH PANEL                      │
│  Company Intelligence (accordion)    │
│    · Description / what they do      │
│    · Size · Industry · Location      │
│    · Funding stage · Growth signal   │
│  Buying Signals (accordion)          │
│    · Recent hires in target function │
│    · Tech stack match                │
│    · Timing signal / recommended     │
│      angle (from ICP score)          │
│  ICP Fit (score bar)                 │
│    · Account tier badge (T1/T2/T3)   │
│    · Score rationale                 │
├──────────────────────────────────────┤
│  OUTREACH PANEL                      │
│  Role selector: [Champion] [DM]      │
│  Suggested angle (1 sentence)        │
│  [Generate first email]              │
│  [Add to 8-touch sequence]           │
│  Email preview (expandable)          │
└──────────────────────────────────────┘
```

---

## Data Model

### What we have at card-tap time (from Apollo search result)
```ts
interface ApolloPerson {
  id:                string;
  first_name:        string;
  last_name:         string;   // obfuscated at search tier ("S***h")
  title:             string | null;
  email:             string | null;
  linkedin_url:      string | null;
  photo_url:         string | null;
  organization_name: string | null;
  city:              string | null;
}
```

Company context comes from the parent opportunity in the discover list (company name, ICP score, score breakdown, recommended_angle, account_tier).

### Apollo Enrichment (per-person, on-demand)
Apollo's `/people/match` or `/people/[id]` endpoint returns the full person record including:
- Full last name (paid plan)
- Verified email
- LinkedIn profile data
- Full org object: domain, employee count, funding stage, tech stack

**New route: `POST /api/contacts/enrich`**
```ts
// Request
{ apollo_person_id: string; org_name?: string }

// Response
{
  person: {
    full_name:    string;
    email:        string | null;
    linkedin_url: string | null;
    title:        string | null;
  };
  company: {
    name:                      string;
    website_url:               string | null;
    industry:                  string | null;
    estimated_num_employees:   number | null;
    latest_funding_stage:      string | null;
    employee_count_6_month_growth: number | null;
    technology_names:          string[];
    short_description:         string | null;
  } | null;
}
```

This call is made once when the Contact Detail screen mounts. Response is cached in component state — no DB write in MVP.

### DB persistence — deferred to "Add to pipeline"
For MVP, enrichment lives in component state only. No new `contacts` table needed yet.

When user taps **"Add to pipeline"** (a future action), we write:
```sql
-- Future table (not in this sprint)
contacts (
  id              uuid primary key,
  user_id         uuid references profiles(id),
  apollo_person_id text,
  full_name       text,
  email           text,
  title           text,
  linkedin_url    text,
  company_name    text,
  company_domain  text,
  opportunity_id  uuid references opportunities(id),
  notes           text,
  created_at      timestamptz
)
```

---

## Research Panel — Detail

### Company Intelligence
Populated from enrichment response (company fields above). If enrichment hasn't returned yet, show skeleton loaders.

Accordion sections:
1. **About** — `short_description` or "No description available"
2. **Firmographics** — size pill + industry pill + city/country
3. **Funding & Growth** — funding stage badge + 6-month headcount growth %, only shown if data exists

### Buying Signals
Generated client-side from ICP score breakdown already attached to the opportunity:

| Signal | Source | Display |
|--------|--------|---------|
| Industry match | `score_breakdown.industry` | "Industry aligns with your ICP" |
| Right size | `score_breakdown.size` | "Headcount in your ICP range" |
| Timing | `score_breakdown.timing` | Funding/growth badge |
| Tech stack | `score_breakdown.tech` | "Uses enterprise tools" |
| DM reachable | `ai_analysis.decision_maker_reach` | Green tick "Decision maker reachable" |
| Champion reachable | `ai_analysis.champion_reachable` | Blue tick "Champion reachable" |

If no ICP score breakdown exists (contact came from manual search, not AI Find), show: "Run AI Find to generate buying signals for this company."

### ICP Fit Score Bar
- 0-100 score bar with gradient (red → amber → green)
- Account tier badge: T1 (green) / T2 (amber) / T3 (grey)
- Score rationale: 1-2 lines from `score_rationale`

---

## Outreach Panel — Detail

### Role Selector
Two tabs: **Champion** | **Decision Maker**

- Champion = mid-level buyer / daily user of your product/service
- DM = C-suite / Head of / budget holder

Switching role changes:
- The suggested outreach angle
- The email generated (tone + content differ: DMs get ROI/strategic framing, champions get workflow/pain framing)

### Suggested Angle
Pre-populated from `recommended_angle` on the opportunity. Editable text field so the user can refine before generating.

### Email Generation
**Button: "Generate first email"**

Calls `POST /api/generate-message` with:
```ts
{
  opportunityId: string;        // opportunity.id (if exists, else null)
  contactRole: "champion" | "decision_maker";
  recipientName: string;        // first name from enrichment
  recipientTitle: string;
  companyName: string;
  angle: string;                // suggested angle (edited by user)
  emailType: "first_touch";
}
```

Displays generated email in an expandable card with:
- Subject line
- Body (3-4 paragraphs)
- [Copy] [Edit] buttons

### Add to 8-Touch Sequence
**Button: "Add to sequence"**

Creates or appends to a sequence via `POST /api/sequences`. The 8-touch cadence (from the sales skills pipeline) maps to:
1. First touch — personalised cold email
2. +3 days — LinkedIn connection request (manual prompt)
3. +5 days — Value-add follow-up (case study / insight)
4. +7 days — Second LinkedIn (comment on their post)
5. +10 days — Pain-point email
6. +14 days — Pattern interrupt (short, direct ask)
7. +21 days — Break-up email
8. +30 days — Re-engage (new angle / news hook)

Steps 1, 3, 5, 6, 7, 8 are AI-generated emails. Steps 2, 4 are manual LinkedIn prompts.

Sequence preview shows the first 3 steps with dates relative to "Day 0" (today). Full sequence visible on expand.

---

## Navigation & State

### Opening
```
ContactCard (tap) → navigate to /contacts/[apolloPersonId]
```
Pass full `ApolloPerson` object + parent opportunity data via router state (Next.js `router.push` with `state`) — avoids needing a DB lookup to render the header.

On hard refresh, the screen will be empty (no URL-only fetching in MVP). Acceptable: this is a push navigation only.

### Back
Standard browser back / swipe gesture returns to Discover contacts tab with scroll position preserved.

### Loading States
1. Screen mounts → show header immediately from passed state
2. Enrichment call fires → show Research skeleton
3. Enrichment returns → populate research panel
4. Email generation → inline spinner in email card

---

## Error States

| Scenario | Handling |
|----------|----------|
| Enrichment 401/500 | Show "Couldn't load company details" banner; Research panel hides gracefully |
| Email generation fails | Inline error with retry button |
| No opportunity linked (manual search contact) | ICP Fit + Buying Signals sections hidden; show "Add to pipeline to see ICP fit" |
| Apollo person has no email | Show email section greyed with "Email not available on this plan — LinkedIn only" |

---

## MVP vs Future

### MVP (this sprint)
- Contact Detail screen with header + research panel
- Enrichment call on mount (company data)
- ICP fit + buying signals from opportunity data
- Generate first email button
- No DB persistence (state only)

### Future sprints
- `contacts` table in Supabase
- "Add to pipeline" action → persists contact + links to opportunity
- Full 8-touch sequence creation from detail screen
- LinkedIn action prompts (manual step cards)
- Contact notes / activity log
- CRM-style status progression (New → Contacted → Replied → Meeting → Won/Lost)

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/contacts/[id]/page.tsx` | New — contact detail page shell |
| `components/kammie/contact-detail.tsx` | New — full screen component |
| `app/api/contacts/enrich/route.ts` | New — Apollo per-person enrichment |
| `components/kammie/discover-page.tsx` | Add `onClick` to `ContactCard` → `router.push` |
| `lib/apollo.ts` | Add `enrichPerson(apolloId)` function wrapping Apollo people/match |

---

## Open Questions (resolve before implementation)

1. **Routing vs sheet**: Full-page route (`/contacts/[id]`) vs slide-up sheet. Route is cleaner for sharing / bookmarking; sheet is faster UX. Recommendation: **sheet** for MVP — avoids the "hard refresh shows empty" problem and matches mobile feel.

2. **Apollo enrichment credits**: `/people/match` costs credits on paid plan. Do we rate-limit to T1/T2 contacts only? Recommendation: no gate in MVP, add credit check when we track usage.

3. **Email generation without DB opportunity**: If contact came from manual search (no opportunity row), `generate-message` route needs an opportunity_id. Do we create a lightweight opportunity row on "Generate email"? Recommendation: yes — create a minimal opportunity row (`source: 'contact_detail'`) so the email system works without special-casing.
