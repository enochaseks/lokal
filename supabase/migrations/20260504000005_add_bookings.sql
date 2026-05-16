-- Migration: Barber/Beauty appointment booking system

-- Weekly schedule template per store
CREATE TABLE IF NOT EXISTS store_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun … 6=Sat (JS convention)
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_mins int NOT NULL DEFAULT 30,
  UNIQUE (store_id, day_of_week)
);
-- Individual bookings
CREATE TABLE IF NOT EXISTS store_bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  service text,
  slot_start timestamp NOT NULL,   -- local UK time, no tz
  slot_end timestamp NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  note text,
  created_at timestamptz DEFAULT now()
);
-- RLS
ALTER TABLE store_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_bookings ENABLE ROW LEVEL SECURITY;
-- Availability: anyone can read; only owners can write
CREATE POLICY "public read availability"
  ON store_availability FOR SELECT USING (true);
CREATE POLICY "owners insert availability"
  ON store_availability FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "owners update availability"
  ON store_availability FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "owners delete availability"
  ON store_availability FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
-- Bookings: anyone can insert/read; only owners can update/delete
CREATE POLICY "public insert bookings"
  ON store_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "public read bookings"
  ON store_bookings FOR SELECT USING (true);
CREATE POLICY "owners update bookings"
  ON store_bookings FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "owners delete bookings"
  ON store_bookings FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
