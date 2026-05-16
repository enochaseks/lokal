-- Per-staff member ratings: customers rate the team member they booked with
CREATE TABLE IF NOT EXISTS public.staff_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.store_staff(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  reviewer_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_reviews_store_idx ON public.staff_reviews(store_id);
CREATE INDEX IF NOT EXISTS staff_reviews_staff_idx ON public.staff_reviews(staff_id);
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;
-- Anyone can read staff reviews for published stores
CREATE POLICY "public read staff reviews"
  ON public.staff_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.published = true
  ));
-- Owners can read all reviews for their stores (including unpublished)
CREATE POLICY "owners read staff reviews"
  ON public.staff_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
-- Anyone can leave a staff review (anonymous rating system)
CREATE POLICY "public insert staff reviews"
  ON public.staff_reviews FOR INSERT
  WITH CHECK (true);
-- Owners can remove reviews for their own stores
CREATE POLICY "owners delete staff reviews"
  ON public.staff_reviews FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
