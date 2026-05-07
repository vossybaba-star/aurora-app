-- ============================================================
-- Relationships module
-- contacts · contact_notes · contact_interactions · nurture_sequences
-- ============================================================

-- ── contacts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name                text NOT NULL,
  email               text,
  phone               text,
  instagram_handle    text,
  website             text,

  -- Relationship meta
  relationship_type   text NOT NULL DEFAULT 'venue_target',
  -- 'venue_customer' | 'venue_target' | 'past_client' | 'lead' | 'partner'
  source              text,
  -- 'won_opportunity' | 'csv_import' | 'manual' | 'opportunity_active'

  -- Linked entities
  opportunity_id      uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  venue_id            uuid REFERENCES venues(id)       ON DELETE SET NULL,

  -- Engagement
  last_contacted_at   timestamptz,
  next_action         text,
  next_action_due     timestamptz,
  tags                text[]   DEFAULT '{}',

  -- GDPR
  unsubscribed_at     timestamptz,
  unsubscribe_token   text UNIQUE,

  -- AI
  ai_notes            text,     -- re-engagement suggestion (24hr cached)
  ai_notes_updated_at timestamptz,

  -- Fresha / booking platform
  booking_platform    text,     -- 'fresha' | 'treatwell' | null
  external_id         text,     -- platform customer ID

  -- Status
  status              text NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'unsubscribed'

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, email)
);

-- ── contact_notes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── contact_interactions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,
  type            text NOT NULL,
  -- 'email_sent' | 'email_reply' | 'instagram_dm' | 'call' | 'meeting' | 'nurture_sent' | 'note'
  subject         text,
  body            text,
  direction       text,  -- 'outbound' | 'inbound'
  nurture_step    int,   -- which step in sequence (1 | 2 | 3)
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── nurture_sequences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurture_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,

  -- The 3 emails
  step1_subject  text,
  step1_body     text,
  step1_sent_at  timestamptz,

  step2_subject  text,
  step2_body     text,
  step2_send_at  timestamptz,  -- scheduled send time
  step2_sent_at  timestamptz,

  step3_subject  text,
  step3_body     text,
  step3_send_at  timestamptz,
  step3_sent_at  timestamptz,

  status         text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'active' | 'completed' | 'cancelled'

  generated_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, contact_id)
);

-- ── Calendly URL on profiles ──────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendly_url text;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurture_sequences    ENABLE ROW LEVEL SECURITY;

-- contacts
CREATE POLICY "contacts_owner" ON contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contact_notes
CREATE POLICY "contact_notes_owner" ON contact_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contact_interactions
CREATE POLICY "contact_interactions_owner" ON contact_interactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- nurture_sequences
CREATE POLICY "nurture_sequences_owner" ON nurture_sequences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS contacts_user_id_idx             ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_opportunity_id_idx      ON contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS contacts_relationship_type_idx   ON contacts(user_id, relationship_type);
CREATE INDEX IF NOT EXISTS contacts_status_idx              ON contacts(user_id, status);
CREATE INDEX IF NOT EXISTS contact_notes_contact_id_idx     ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS contact_interactions_contact_idx ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS nurture_sequences_contact_idx    ON nurture_sequences(contact_id);
CREATE INDEX IF NOT EXISTS nurture_sequences_send_at_idx    ON nurture_sequences(step2_send_at, step3_send_at);

-- ── Auto-create contact when opportunity status → 'closed' (won) ──────────────
CREATE OR REPLACE FUNCTION create_contact_on_win()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contact_id uuid;
  v_email      text;
  v_ig         text;
BEGIN
  -- Only fire when status changes to 'closed'
  IF NEW.status <> 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  -- Pull email / instagram from the opportunity
  v_email := COALESCE(NEW.contact_email, NULL);
  v_ig    := COALESCE(NEW.instagram_handle, NULL);

  -- Upsert a contact (dedup on email within user scope)
  IF v_email IS NOT NULL THEN
    INSERT INTO contacts (
      user_id, name, email, instagram_handle, relationship_type,
      source, opportunity_id, venue_id, status
    )
    VALUES (
      NEW.user_id, NEW.name, v_email, v_ig, 'venue_customer',
      'won_opportunity', NEW.id, NEW.venue_id, 'active'
    )
    ON CONFLICT (user_id, email) DO UPDATE SET
      relationship_type = 'venue_customer',
      opportunity_id    = EXCLUDED.opportunity_id,
      venue_id          = EXCLUDED.venue_id,
      updated_at        = now()
    RETURNING id INTO v_contact_id;
  ELSE
    -- No email — create without unique constraint
    INSERT INTO contacts (
      user_id, name, instagram_handle, relationship_type,
      source, opportunity_id, venue_id, status
    )
    VALUES (
      NEW.user_id, NEW.name, v_ig, 'venue_customer',
      'won_opportunity', NEW.id, NEW.venue_id, 'active'
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Log the interaction
  IF v_contact_id IS NOT NULL THEN
    INSERT INTO contact_interactions (user_id, contact_id, type, direction, body)
    VALUES (NEW.user_id, v_contact_id, 'note', 'outbound', 'Contact created from won opportunity.');
  END IF;

  RETURN NEW;
END;
$$;

-- Drop before recreate (idempotent)
DROP TRIGGER IF EXISTS on_opportunity_won ON opportunities;

CREATE TRIGGER on_opportunity_won
  AFTER UPDATE OF status ON opportunities
  FOR EACH ROW EXECUTE FUNCTION create_contact_on_win();

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS contacts_updated_at             ON contacts;
DROP TRIGGER IF EXISTS contact_notes_updated_at        ON contact_notes;
DROP TRIGGER IF EXISTS nurture_sequences_updated_at    ON nurture_sequences;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER contact_notes_updated_at
  BEFORE UPDATE ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER nurture_sequences_updated_at
  BEFORE UPDATE ON nurture_sequences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
