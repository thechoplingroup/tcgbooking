-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/zevdjxmnxdinqflhjeaq/sql/new

-- 1. Add reschedule_requested status to appointments
--    (Supabase uses text for appointment_status enum — we extend via a new column
--     so we don't break existing enum constraints; store extra state in a separate column)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reschedule_note TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_preferred_time TEXT;

-- Change status column to TEXT so we can use 'reschedule_requested' without altering the enum
-- (Safe: existing values are still valid strings)
ALTER TABLE appointments ALTER COLUMN status TYPE TEXT;

-- 2. Rebooking reminders sent by stylist
CREATE TABLE IF NOT EXISTS rebooking_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  suggested_date DATE,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rebooking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stylists manage own reminders" ON rebooking_reminders
  FOR ALL USING (
    stylist_id IN (SELECT id FROM stylists WHERE user_id = auth.uid())
  );

-- 3. Stylist client notes
CREATE TABLE IF NOT EXISTS stylist_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stylist_id, client_id)
);

ALTER TABLE stylist_client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stylists manage own client notes" ON stylist_client_notes
  FOR ALL USING (
    stylist_id IN (SELECT id FROM stylists WHERE user_id = auth.uid())
  );

-- 4. Allow overrides to have a UPSERT key on (stylist_id, effective_from, effective_until, day_of_week)
--    for single-day overrides — add a note column for Keri's personal reminders
ALTER TABLE operational_hours_overrides
  ADD COLUMN IF NOT EXISTS note TEXT;
