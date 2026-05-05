-- Team members for bookable stores
CREATE TABLE IF NOT EXISTS public.store_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_staff_store_idx ON public.store_staff(store_id);

ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read staff for published stores"
  ON public.store_staff FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.published = true
  ));

CREATE POLICY "owners read staff"
  ON public.store_staff FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "owners insert staff"
  ON public.store_staff FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "owners update staff"
  ON public.store_staff FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "owners delete staff"
  ON public.store_staff FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));

-- Store chosen team member directly on the booking for easy merchant workflow
ALTER TABLE public.store_bookings
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.store_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS staff_phone text;

CREATE INDEX IF NOT EXISTS store_bookings_staff_id_idx ON public.store_bookings(staff_id);
