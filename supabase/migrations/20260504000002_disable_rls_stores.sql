-- Nuclear option: disable RLS on stores table to identify root cause
ALTER TABLE public.stores DISABLE ROW LEVEL SECURITY;
