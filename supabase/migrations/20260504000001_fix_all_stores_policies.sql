-- Fix all stores UPDATE policies with proper WITH CHECK clauses
-- This resolves the "new row violates row-level security policy" error

DROP POLICY IF EXISTS "Owners update own stores" ON public.stores;
DROP POLICY IF EXISTS "Owners delete own stores" ON public.stores;

-- Recreate with explicit WITH CHECK
CREATE POLICY "Owners update own stores" ON public.stores
  FOR UPDATE 
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete own stores" ON public.stores
  FOR DELETE 
  USING (auth.uid() = owner_id);
