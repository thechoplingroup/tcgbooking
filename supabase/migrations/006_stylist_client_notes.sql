-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/zevdjxmnxdinqflhjeaq/sql/new
-- Note: stylist_client_notes was already included in migration 005_reschedule_and_client_features.sql
-- This file is provided as a standalone reference / idempotent re-run.

CREATE TABLE IF NOT EXISTS stylist_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stylist_id, client_id)
);

ALTER TABLE stylist_client_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stylist_client_notes'
      AND policyname = 'Stylists manage own client notes'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Stylists manage own client notes" ON stylist_client_notes
        FOR ALL USING (stylist_id IN (SELECT id FROM stylists WHERE user_id = auth.uid()))
    $policy$;
  END IF;
END $$;
