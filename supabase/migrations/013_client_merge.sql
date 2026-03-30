-- 013: Client identity resolution — walk-in merge, pending merges, and family/dependent profiles

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add phone to profiles (auth clients had no phone field)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extend walk_in_clients with merge tracking + dependent link
-- ─────────────────────────────────────────────────────────────────────────────

-- Soft-delete: when a walk-in is merged into an auth account, we don't delete
-- the row — we mark it so history is preserved.
ALTER TABLE walk_in_clients
  ADD COLUMN IF NOT EXISTS merged_into_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

-- Dependent link: a walk-in can be "owned" by a registered account (e.g. a child).
-- No email/phone required. Reminders for their appointments go to the parent's contact.
ALTER TABLE walk_in_clients
  ADD COLUMN IF NOT EXISTS linked_to_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_walk_in_clients_merged
  ON walk_in_clients(merged_into_profile_id)
  WHERE merged_into_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_walk_in_clients_linked
  ON walk_in_clients(linked_to_profile_id)
  WHERE linked_to_profile_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pending_merges: suggested or admin-initiated merge candidates
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  auth_client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  walk_in_client_id UUID NOT NULL REFERENCES walk_in_clients(id) ON DELETE CASCADE,
  match_reason TEXT NOT NULL CHECK (match_reason IN ('signup_email_match', 'admin_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(auth_client_id, walk_in_client_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_merges_stylist_status
  ON pending_merges(stylist_id, status);

ALTER TABLE pending_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stylists manage own pending merges"
  ON pending_merges FOR ALL
  USING (stylist_id IN (SELECT id FROM stylists WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Atomic merge RPC function
--    Transfers all history from a walk-in to an auth client in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION merge_walk_in_into_auth_client(
  p_walk_in_client_id UUID,
  p_auth_client_id UUID,
  p_stylist_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_walk_in walk_in_clients%ROWTYPE;
  v_auth_phone TEXT;
BEGIN
  -- Lock the walk-in row to prevent concurrent merges
  SELECT * INTO v_walk_in
  FROM walk_in_clients
  WHERE id = p_walk_in_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Walk-in client % not found', p_walk_in_client_id;
  END IF;

  IF v_walk_in.merged_into_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Walk-in client % has already been merged', p_walk_in_client_id;
  END IF;

  -- Transfer appointments
  UPDATE appointments
  SET client_id = p_auth_client_id,
      walk_in_client_id = NULL
  WHERE walk_in_client_id = p_walk_in_client_id;

  -- Transfer service log entries
  -- (Sets both columns in one statement — satisfies the one_client_type CHECK)
  UPDATE client_service_log
  SET client_id = p_auth_client_id,
      walk_in_client_id = NULL
  WHERE walk_in_client_id = p_walk_in_client_id;

  -- Transfer waitlist entries
  UPDATE waitlist_entries
  SET client_id = p_auth_client_id,
      walk_in_client_id = NULL
  WHERE walk_in_client_id = p_walk_in_client_id;

  -- Preserve phone number: copy to auth profile if auth client has no phone
  SELECT phone INTO v_auth_phone FROM profiles WHERE id = p_auth_client_id;
  IF (v_auth_phone IS NULL OR v_auth_phone = '') AND v_walk_in.phone IS NOT NULL THEN
    UPDATE profiles SET phone = v_walk_in.phone WHERE id = p_auth_client_id;
  END IF;

  -- Append walk-in notes to stylist_client_notes (upsert)
  IF v_walk_in.notes IS NOT NULL AND v_walk_in.notes <> '' THEN
    INSERT INTO stylist_client_notes (stylist_id, client_id, notes, updated_at)
    VALUES (p_stylist_id, p_auth_client_id, v_walk_in.notes, NOW())
    ON CONFLICT (stylist_id, client_id) DO UPDATE
      SET notes = CASE
            WHEN stylist_client_notes.notes IS NULL OR stylist_client_notes.notes = ''
            THEN EXCLUDED.notes
            ELSE stylist_client_notes.notes || E'\n\n[Merged from walk-in]\n' || EXCLUDED.notes
          END,
          updated_at = NOW();
  END IF;

  -- Update any dependents that were linked to this walk-in's parent profile
  -- (linked_to_profile_id stays as-is — they remain dependents of the auth client)

  -- Soft-delete the walk-in record
  UPDATE walk_in_clients
  SET merged_into_profile_id = p_auth_client_id,
      merged_at = NOW()
  WHERE id = p_walk_in_client_id;

  -- Mark pending_merge as resolved if one exists
  UPDATE pending_merges
  SET status = 'merged',
      resolved_at = NOW()
  WHERE walk_in_client_id = p_walk_in_client_id
    AND auth_client_id = p_auth_client_id
    AND status = 'pending';

END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper: check if an email is already registered (used by admin API)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(p_email));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Update handle_new_user() trigger to detect email matches
--    When a user signs up, check if any unmerged walk-in has the same email.
--    If found, create a pending_merge suggestion for the stylist to review.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_walk_in RECORD;
BEGIN
  -- Create profile (existing behaviour)
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'client')::user_role,
    new.raw_user_meta_data->>'full_name'
  );

  -- Check for walk-in clients with the same email (auto-suggest merge)
  IF new.email IS NOT NULL THEN
    FOR v_walk_in IN
      SELECT id, stylist_id
      FROM walk_in_clients
      WHERE LOWER(email) = LOWER(new.email)
        AND merged_into_profile_id IS NULL
    LOOP
      INSERT INTO pending_merges (stylist_id, auth_client_id, walk_in_client_id, match_reason)
      VALUES (v_walk_in.stylist_id, new.id, v_walk_in.id, 'signup_email_match')
      ON CONFLICT (auth_client_id, walk_in_client_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN new;
END;
$$;
