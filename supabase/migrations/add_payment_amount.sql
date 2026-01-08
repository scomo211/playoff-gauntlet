-- Add payment_amount column to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS payment_amount NUMERIC DEFAULT 0;

-- Update existing entries: set payment_amount to 25 if payment_received is true
UPDATE entries SET payment_amount = 25 WHERE payment_received = true AND payment_amount = 0;
