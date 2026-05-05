-- Add payment tracking to bookings (unpaid / deposit_paid / paid)
ALTER TABLE store_bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

-- Add optional deposit amount to stores (null = no deposit required)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS deposit_amount numeric;

-- Add optional daily booking cap per staff member (null = unlimited)
ALTER TABLE store_staff ADD COLUMN IF NOT EXISTS daily_capacity int;
