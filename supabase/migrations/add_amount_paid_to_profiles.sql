-- Add amount_paid column to profiles table for tracking user payments
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- Remove payment_amount from entries since payments are now tracked at user level
-- (keeping payment_received for backwards compatibility, will be derived from amount_paid vs amount_owed)
