-- Fix stores UPDATE policy by adding explicit WITH CHECK clause
-- This ensures merchants can update their own store fields (including image_url)

DROP POLICY IF EXISTS "Owners update own stores" ON public.stores;
CREATE POLICY "Owners update own stores" ON public.stores
  FOR UPDATE 
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
