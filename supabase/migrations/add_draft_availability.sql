-- Draft Availability Migration
-- Allows owners to indicate which dates/times they're available for the in-person draft

-- Create table for draft availability selections
CREATE TABLE IF NOT EXISTS salarycap_draft_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  -- Store selected time slots as an array of slot identifiers
  -- Slots: tue_18_pm, wed_19_pm, thu_20_pm, fri_21_pm,
  --        sat_22_am, sat_22_mid, sat_22_pm,
  --        sun_23_mid, sun_23_pm, mon_24_pm
  selected_slots TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id)
);

-- Enable RLS
ALTER TABLE salarycap_draft_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view salarycap_draft_availability" ON salarycap_draft_availability
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage salarycap_draft_availability" ON salarycap_draft_availability
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Owners can update their own availability
CREATE POLICY "Owners can update own draft_availability" ON salarycap_draft_availability
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM salarycap_owners
      WHERE salarycap_owners.id = salarycap_draft_availability.owner_id
      AND salarycap_owners.profile_id = auth.uid()
    )
  );

-- Owners can insert their own availability
CREATE POLICY "Owners can insert own draft_availability" ON salarycap_draft_availability
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM salarycap_owners
      WHERE salarycap_owners.id = owner_id
      AND salarycap_owners.profile_id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_salarycap_draft_availability_owner ON salarycap_draft_availability(owner_id);
