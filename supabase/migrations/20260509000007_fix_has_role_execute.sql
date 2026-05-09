-- Fix runtime RLS failures: policies call public.has_role(), so authenticated users need EXECUTE.
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;
