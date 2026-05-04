-- Add max_bookings_per_slot to store_availability
-- This lets merchants set how many concurrent bookings they accept per time slot (e.g. 3 barber chairs)
ALTER TABLE public.store_availability
  ADD COLUMN IF NOT EXISTS max_bookings_per_slot integer NOT NULL DEFAULT 1;
