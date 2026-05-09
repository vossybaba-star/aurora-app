-- B2B/Agency profile fields
-- Adds company_domain, company_analysis (AI-extracted product info), and icp (Ideal Customer Profile)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_domain   TEXT,
  ADD COLUMN IF NOT EXISTS company_analysis JSONB,
  ADD COLUMN IF NOT EXISTS icp              JSONB;

COMMENT ON COLUMN profiles.company_domain   IS 'Primary domain of the user''s own company (e.g. acme.com)';
COMMENT ON COLUMN profiles.company_analysis IS 'AI-extracted: { description, value_proposition, key_features[], tone }';
COMMENT ON COLUMN profiles.icp              IS 'Ideal Customer Profile: { industries[], company_sizes[], personas[], pain_points[], geography[] }';
