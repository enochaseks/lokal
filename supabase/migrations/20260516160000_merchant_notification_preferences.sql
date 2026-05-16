-- Merchant-level notification channel preferences.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS merchant_sms_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS merchant_email_alerts boolean NOT NULL DEFAULT true;

UPDATE public.stores
SET merchant_sms_alerts = COALESCE(merchant_sms_alerts, true),
    merchant_email_alerts = COALESCE(merchant_email_alerts, true)
WHERE merchant_sms_alerts IS NULL OR merchant_email_alerts IS NULL;
