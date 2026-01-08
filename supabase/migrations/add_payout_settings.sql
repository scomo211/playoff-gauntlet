-- Add payout settings to league_settings table
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS commissioner_fee NUMERIC DEFAULT 0;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS payout_percentages JSONB DEFAULT '[65, 20, 10, 5]';
