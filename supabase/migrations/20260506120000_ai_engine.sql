-- =============================================================================
-- Migration: 20260506120000_ai_engine.sql
-- Purpose  : Extend the Aurora schema to support the AI enrichment engine.
--
-- What this migration does:
--   1. Extends `opportunities` with deep Google Places fields, Firecrawl website
--      content, Claude Sonnet analysis output, signal scoring, Aurora network
--      signals, copy-engine outputs, and Companies House data.
--   2. Extends `profiles` with richer AI context (speciality tags, positioning,
--      past clients, work radius, portfolio URL), website import tracking, and
--      outreach behaviour settings.
--   3. Creates `lead_enrichment_log` — an audit trail of every enrichment run.
--   4. Creates `template_performance` — tracks reply/won rates per template.
--   5. Adds covering indexes for signal-score-ranked queries.
--   6. Enables RLS on the two new tables with per-user access policies.
--
-- Safety contract:
--   • Every ADD COLUMN uses IF NOT EXISTS — safe to re-run.
--   • No existing columns, constraints, indexes or RLS policies are modified.
--   • CREATE TABLE / CREATE INDEX / CREATE POLICY all use IF NOT EXISTS.
-- =============================================================================


-- ===========================================================================
-- 1. ALTER TABLE opportunities
-- ===========================================================================

ALTER TABLE opportunities
  -- ── Enrichment lifecycle ──────────────────────────────────────────────
  -- enrichment_status already exists in the base schema; guard with IF NOT EXISTS.
  ADD COLUMN IF NOT EXISTS enrichment_status         text        DEFAULT 'pending',
  -- valid values: pending | processing | complete | failed
  ADD COLUMN IF NOT EXISTS last_enriched_at          timestamptz,

  -- ── Google Places — deep fields ───────────────────────────────────────
  -- Basic fields (google_place_id, rating, rating_count, photo_reference)
  -- already exist in the base schema and are NOT touched here.
  ADD COLUMN IF NOT EXISTS price_level               integer,
  -- Google price_level: 0=Free, 1=$, 2=$$, 3=$$$, 4=$$$$
  ADD COLUMN IF NOT EXISTS google_editorial_summary  text,
  -- editorialSummary.text from Places API
  ADD COLUMN IF NOT EXISTS google_website_url        text,
  -- website field from Places API (distinct from our crawled `website` column)
  ADD COLUMN IF NOT EXISTS review_count_total        integer,
  -- userRatingCount from Places API
  ADD COLUMN IF NOT EXISTS full_reviews              jsonb,
  -- Array of { author: string, rating: number, text: string, time: number }

  -- ── Firecrawl website enrichment ──────────────────────────────────────
  ADD COLUMN IF NOT EXISTS website_markdown          text,
  -- Full markdown output from Firecrawl; stored to avoid redundant crawls
  ADD COLUMN IF NOT EXISTS website_last_crawled_at   timestamptz,

  -- ── Claude Sonnet analysis ────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS ai_analysis               jsonb,
  -- Schema (intentionally flexible — evolves with the AI engine):
  -- {
  --   wedding_relevance:           0-100,
  --   cultural_relevance:          0-100,
  --   photographer_opportunity:    0-100,
  --   has_exclusive_photographer:  boolean,
  --   contact_name:                string | null,
  --   contact_email:               string | null,
  --   venue_capacity:              number | null,
  --   positioning_match:           0-100,
  --   key_phrases_for_email:       string[],
  --   why_good_lead:               string,
  --   why_bad_lead:                string | null,
  --   recommended_angle:           string,
  --   confidence:                  "high" | "medium" | "low"
  -- }

  -- ── Signal scoring ────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS signal_score              integer     DEFAULT 0,
  -- Composite score 0-100; higher = better lead
  ADD COLUMN IF NOT EXISTS score_breakdown           jsonb,
  -- {
  --   rating_score:                    number,
  --   wedding_relevance_score:         number,
  --   cultural_relevance_score:        number,
  --   photographer_opportunity_score:  number,
  --   positioning_match_score:         number,
  --   recency_bonus:                   number,
  --   network_score:                   number,
  --   total:                           number
  -- }

  -- ── Aurora network signals ────────────────────────────────────────────
  -- Aggregate counts only — never user-identifiable
  ADD COLUMN IF NOT EXISTS network_contacted_count   integer     DEFAULT 0,
  -- How many Aurora users have contacted this venue
  ADD COLUMN IF NOT EXISTS network_reply_count       integer     DEFAULT 0,
  -- How many of those contacts received a reply
  ADD COLUMN IF NOT EXISTS network_won_count         integer     DEFAULT 0,
  -- How many contacts turned into a booking

  -- ── Copy engine outputs ───────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS generated_subject_lines   jsonb,
  -- Array of 3 subject line options generated by the copy engine
  ADD COLUMN IF NOT EXISTS generated_initial_email   text,
  -- First-draft email body; stored to avoid unnecessary regeneration
  ADD COLUMN IF NOT EXISTS copy_generated_at         timestamptz,
  ADD COLUMN IF NOT EXISTS copy_model_used           text,
  -- e.g. "claude-3-5-sonnet-20241022", "gpt-4o" — for cost attribution

  -- ── Companies House ───────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS companies_house_number    text,
  ADD COLUMN IF NOT EXISTS incorporation_date        date;


-- ===========================================================================
-- 2. ALTER TABLE profiles
-- ===========================================================================

ALTER TABLE profiles
  -- ── Richer AI context ─────────────────────────────────────────────────
  -- `name` already exists in the base schema (`full_name` is a new distinct field).
  ADD COLUMN IF NOT EXISTS full_name                 text,
  ADD COLUMN IF NOT EXISTS speciality_tags           text[],
  -- e.g. ARRAY['Black weddings', 'African ceremonies', 'Natural light']
  ADD COLUMN IF NOT EXISTS positioning               text,
  -- values: budget | mid-market | premium | luxury
  ADD COLUMN IF NOT EXISTS work_radius               text,
  -- free text, e.g. "London + Home Counties" or "UK-wide"
  ADD COLUMN IF NOT EXISTS past_clients              jsonb,
  -- Array of { name: string, type: "venue" | "client" }
  ADD COLUMN IF NOT EXISTS portfolio_url             text,
  -- Distinct from `website` (which is the business website used for outreach);
  -- portfolio_url is the creative portfolio link shown on profile.

  -- ── Website import tracking ───────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS website_import_status     text,
  -- values: idle | processing | complete | failed
  ADD COLUMN IF NOT EXISTS website_last_imported_at  timestamptz,
  ADD COLUMN IF NOT EXISTS website_imported_data     jsonb,
  -- Raw structured data extracted by Claude from the user's website;
  -- retained so we can re-derive profile fields without re-crawling.

  -- ── Outreach behaviour settings ───────────────────────────────────────
  ADD COLUMN IF NOT EXISTS max_followups             integer     DEFAULT 3,
  -- Stop following up with a lead after this many unanswered messages
  ADD COLUMN IF NOT EXISTS daily_send_limit          integer     DEFAULT 10,
  -- Hard cap on outgoing emails per calendar day
  ADD COLUMN IF NOT EXISTS weekdays_only             boolean     DEFAULT true,
  -- Skip Saturday and Sunday when scheduling sends
  ADD COLUMN IF NOT EXISTS send_notifications        boolean     DEFAULT true,
  -- Email the user when a reply is detected
  ADD COLUMN IF NOT EXISTS weekly_summary            boolean     DEFAULT false;
  -- Send a Monday morning outreach summary digest


-- ===========================================================================
-- 3. CREATE TABLE lead_enrichment_log
--    Audit trail of every enrichment run — useful for debugging the AI engine
--    and understanding cost/latency characteristics over time.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS lead_enrichment_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid        REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES profiles(id),
  triggered_by    text,
  -- values: user_click | nightly_cron | manual
  steps_completed jsonb,
  -- e.g. { "google_deep": true, "firecrawl": true, "claude_analysis": true }
  tokens_used     integer,
  model_used      text,
  cost_usd        numeric(10, 6),
  duration_ms     integer,
  error           text,
  -- Populated only when the enrichment run encountered an unrecoverable error
  created_at      timestamptz DEFAULT now()
);


-- ===========================================================================
-- 4. CREATE TABLE template_performance
--    Tracks reply/won rates per saved template over time.
--    Powers the Performance tab in the Templates modal.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS template_performance (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  template_id   uuid,
  -- Will reference the templates table once it is created
  template_name text,
  emails_sent   integer     DEFAULT 0,
  emails_replied integer    DEFAULT 0,
  emails_won    integer     DEFAULT 0,
  reply_rate    numeric(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN emails_sent > 0
        THEN (emails_replied::numeric / emails_sent * 100)
      ELSE 0
    END
  ) STORED,
  won_rate      numeric(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN emails_sent > 0
        THEN (emails_won::numeric / emails_sent * 100)
      ELSE 0
    END
  ) STORED,
  last_used_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);


-- ===========================================================================
-- 5. Indexes for query performance
-- ===========================================================================

-- Fast descending signal-score sort across all opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_signal_score
  ON opportunities (signal_score DESC);

-- Filter by enrichment pipeline state (pending / processing / complete / failed)
CREATE INDEX IF NOT EXISTS idx_opportunities_enrichment_status
  ON opportunities (enrichment_status);

-- Per-user leaderboard query: "show me my best leads"
CREATE INDEX IF NOT EXISTS idx_opportunities_user_score
  ON opportunities (user_id, signal_score DESC);

-- Join from lead_enrichment_log back to its parent opportunity
CREATE INDEX IF NOT EXISTS idx_enrichment_log_opportunity
  ON lead_enrichment_log (opportunity_id);


-- ===========================================================================
-- 6. Row-Level Security on new tables
-- ===========================================================================

ALTER TABLE lead_enrichment_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_performance ENABLE ROW LEVEL SECURITY;

-- Each user can only read and write their own enrichment audit rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_enrichment_log'
    AND   policyname = 'Users see own enrichment logs'
  ) THEN
    CREATE POLICY "Users see own enrichment logs"
      ON lead_enrichment_log FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Each user can only read and write their own template performance rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'template_performance'
    AND   policyname = 'Users see own template performance'
  ) THEN
    CREATE POLICY "Users see own template performance"
      ON template_performance FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
