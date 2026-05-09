-- Create verification requests table
CREATE TABLE public.store_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  business_name TEXT NOT NULL,
  business_registration_number TEXT,
  owner_name TEXT NOT NULL,
  owner_id_url TEXT,
  business_document_url TEXT,
  submission_reason TEXT,
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_verification_requests_store_id ON public.store_verification_requests(store_id);
CREATE INDEX idx_verification_requests_status ON public.store_verification_requests(status);
CREATE INDEX idx_verification_requests_owner_id ON public.store_verification_requests(owner_id);

-- RLS Policies for verification requests
CREATE POLICY "Merchants can view own verification requests"
  ON public.store_verification_requests
  FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Merchants can insert own verification requests"
  ON public.store_verification_requests
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update verification requests"
  ON public.store_verification_requests
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Updated trigger for store verification requests
CREATE TRIGGER set_verification_requests_updated_at BEFORE UPDATE ON public.store_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
