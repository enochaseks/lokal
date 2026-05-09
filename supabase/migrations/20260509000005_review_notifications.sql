-- Durable notification trail for new reviews.
CREATE TABLE public.review_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('admin', 'merchant')),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS review_notifications_role_idx ON public.review_notifications(recipient_role, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS review_notifications_user_idx ON public.review_notifications(recipient_user_id, is_read, created_at DESC);

CREATE POLICY "Admins can read review notifications"
  ON public.review_notifications
  FOR SELECT
  USING (
    recipient_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role)
    OR recipient_user_id = auth.uid()
  );

CREATE POLICY "Admins can mark review notifications read"
  ON public.review_notifications
  FOR UPDATE
  USING (
    recipient_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role)
    OR recipient_user_id = auth.uid()
  )
  WITH CHECK (
    recipient_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role)
    OR recipient_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.handle_review_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_owner UUID;
BEGIN
  SELECT owner_id INTO store_owner
  FROM public.stores
  WHERE id = NEW.store_id;

  INSERT INTO public.review_notifications (
    review_id,
    store_id,
    recipient_role,
    recipient_user_id,
    title,
    body
  ) VALUES (
    NEW.id,
    NEW.store_id,
    'merchant',
    store_owner,
    'New review received',
    'A customer left a new review for your store.'
  );

  INSERT INTO public.review_notifications (
    review_id,
    store_id,
    recipient_role,
    recipient_user_id,
    title,
    body
  ) VALUES (
    NEW.id,
    NEW.store_id,
    'admin',
    NULL,
    'New review needs attention',
    'A new review was submitted and is available for admin review.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_notifications ON public.reviews;
CREATE TRIGGER trg_review_notifications
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_review_notifications();