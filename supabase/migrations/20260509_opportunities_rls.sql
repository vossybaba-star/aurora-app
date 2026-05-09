-- Ensure the opportunities table has RLS enabled and the correct per-user policies.
-- Safe to run multiple times (uses IF NOT EXISTS / DO block guards).

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'opportunities'
      AND policyname = 'Users can manage their own opportunities'
  ) THEN
    CREATE POLICY "Users can manage their own opportunities"
      ON opportunities FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
