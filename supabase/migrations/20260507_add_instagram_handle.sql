-- =============================================================================
-- Migration: 20260507_add_instagram_handle.sql
-- Purpose  : Add instagram_handle column to opportunities table so enrich-venue
--            can persist the Instagram handle extracted from Firecrawl crawls.
-- =============================================================================

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS instagram_handle text;
