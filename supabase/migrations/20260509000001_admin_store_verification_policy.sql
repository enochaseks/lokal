-- Allow admins to update store verification fields
CREATE POLICY "Admins can update store verification"
  ON public.stores
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to view all stores (for admin dashboard)
CREATE POLICY "Admins can view all stores"
  ON public.stores
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    published = true OR
    owner_id = auth.uid()
  );
