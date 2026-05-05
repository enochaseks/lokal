-- Allow each team member to choose which days of week they accept bookings on.
-- 0=Sun ... 6=Sat. NULL means legacy/unset (treated as all days in app logic).
ALTER TABLE public.store_staff
  ADD COLUMN IF NOT EXISTS available_days int[];
