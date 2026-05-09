-- Align DB admin checks with the configured admin emails used by the app UI.
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'enochaseks@yahoo.co.uk',
    'enochaseks@gmail.com'
  );
$$;

-- stores policies
DROP POLICY IF EXISTS "Admins can update store verification" ON public.stores;
CREATE POLICY "Admins can update store verification"
  ON public.stores
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
  );

DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;
CREATE POLICY "Admins can view all stores"
  ON public.stores
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
    OR published = true
    OR owner_id = auth.uid()
  );

-- verification request policies
DROP POLICY IF EXISTS "Merchants can view own verification requests" ON public.store_verification_requests;
CREATE POLICY "Merchants can view own verification requests"
  ON public.store_verification_requests
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
  );

DROP POLICY IF EXISTS "Admins can update verification requests" ON public.store_verification_requests;
CREATE POLICY "Admins can update verification requests"
  ON public.store_verification_requests
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_email()
  );

-- review notifications policies
DROP POLICY IF EXISTS "Admins can read review notifications" ON public.review_notifications;
CREATE POLICY "Admins can read review notifications"
  ON public.review_notifications
  FOR SELECT
  USING (
    (
      recipient_role = 'admin'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_admin_email()
      )
    )
    OR recipient_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can mark review notifications read" ON public.review_notifications;
CREATE POLICY "Admins can mark review notifications read"
  ON public.review_notifications
  FOR UPDATE
  USING (
    (
      recipient_role = 'admin'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_admin_email()
      )
    )
    OR recipient_user_id = auth.uid()
  )
  WITH CHECK (
    (
      recipient_role = 'admin'
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_admin_email()
      )
    )
    OR recipient_user_id = auth.uid()
  );
