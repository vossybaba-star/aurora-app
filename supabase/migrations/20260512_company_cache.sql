-- Shared company description cache (cross-user, keyed by domain)
CREATE TABLE IF NOT EXISTS company_descriptions (
  domain       text PRIMARY KEY,
  apollo_id    text,
  description  text NOT NULL,
  cached_at    timestamptz NOT NULL DEFAULT now()
);

-- Per-user score/angle cache (keyed by user_id + apollo_id)
CREATE TABLE IF NOT EXISTS company_score_cache (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apollo_id       text NOT NULL,
  score           integer NOT NULL,
  score_label     text NOT NULL,
  suggested_angle text NOT NULL DEFAULT '',
  caution         text,
  why_good        jsonb NOT NULL DEFAULT '[]',
  cached_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, apollo_id)
);

-- Any authenticated user can read company descriptions (shared cache)
ALTER TABLE company_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read descriptions" ON company_descriptions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "anyone can insert descriptions" ON company_descriptions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anyone can update descriptions" ON company_descriptions
  FOR UPDATE TO authenticated USING (true);

-- Users can read/write their own score cache
ALTER TABLE company_score_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own score cache" ON company_score_cache
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
