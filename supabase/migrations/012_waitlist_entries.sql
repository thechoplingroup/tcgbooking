-- 012: Waitlist / cancellation backfill system
-- Clients can be added to a waitlist for a stylist+service+date.
-- When a slot opens up (e.g. cancellation), the stylist can notify them.

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  walk_in_client_id UUID REFERENCES walk_in_clients(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  preferred_date DATE,
  preferred_time_range TEXT,
  notes TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT waitlist_has_client CHECK (client_id IS NOT NULL OR walk_in_client_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_stylist_status ON waitlist_entries(stylist_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_preferred_date ON waitlist_entries(preferred_date);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stylists manage own waitlist" ON waitlist_entries
  FOR ALL USING (stylist_id IN (SELECT id FROM stylists WHERE user_id = auth.uid()));
