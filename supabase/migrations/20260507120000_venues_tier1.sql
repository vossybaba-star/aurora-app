-- =============================================================================
-- Migration: 20260507120000_venues_tier1.sql
-- Purpose  : Create global venues table (Tier 1) and extend opportunities with
--            personal contact intelligence columns (Tier 2).
-- =============================================================================

-- ─── Global venues table (Tier 1) ────────────────────────────────────────────
-- One row per Google Place, shared across all Aurora users.
-- Written by service role; readable by authenticated users (for caching).

CREATE TABLE IF NOT EXISTS venues (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id       text UNIQUE NOT NULL,
  name                  text NOT NULL,
  formatted_address     text,
  website               text,
  phone                 text,
  rating                numeric(3,1),
  rating_count          integer,
  photo_reference       text,
  types                 text[],

  -- Contact intelligence (extracted by Tier 1)
  instagram_handle      text,
  instagram_url         text,
  contact_email         text,
  contact_email_type    text,           -- 'direct' | 'info' | 'booking' | 'other'
  contact_form_url      text,
  has_contact_form      boolean DEFAULT false,

  -- Generic venue analysis (not personalised)
  venue_summary         text,           -- ~150 word generic summary for copy engine
  venue_vibe_tags       text[],
  venue_capacity        integer,
  price_tier            text,           -- 'budget' | 'mid' | 'premium' | 'luxury'
  hosts_weddings        boolean,
  hosts_corporate       boolean,

  -- Crawl metadata
  website_markdown      text,
  last_crawled_at       timestamptz,
  enrichment_status     text DEFAULT 'pending',  -- 'pending' | 'complete' | 'failed'
  last_enriched_at      timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Service role can read/write; authenticated users can read (for cache lookup)
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_service_write" ON venues
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── Extend opportunities with Tier 2 columns ────────────────────────────────

-- Link to global venues cache
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;

-- Contact intelligence (copied from Tier 1 + personalised)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS instagram_url        text,
  ADD COLUMN IF NOT EXISTS contact_email        text,
  ADD COLUMN IF NOT EXISTS contact_email_type   text,
  ADD COLUMN IF NOT EXISTS contact_form_url     text,
  ADD COLUMN IF NOT EXISTS contact_form_type    text,
  ADD COLUMN IF NOT EXISTS has_contact_form     boolean DEFAULT false;

-- Personal AI analysis (Tier 2 — user-specific)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS personal_analysis         jsonb,
  ADD COLUMN IF NOT EXISTS personal_score            integer,
  ADD COLUMN IF NOT EXISTS personal_analysis_status  text DEFAULT 'pending';

-- Index for fast venue lookups from opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_venue_id ON opportunities(venue_id);
CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues(google_place_id);
CREATE INDEX IF NOT EXISTS idx_venues_enrichment_status ON venues(enrichment_status);
