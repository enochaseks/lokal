# send-whatsapp-alert

Sends a WhatsApp notification to a merchant when a new order is placed.

## Required Supabase secrets

Set these in Supabase project secrets before deploying:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (example: `whatsapp:+14155238886` for sandbox)

Optional for production template messages:

- `TWILIO_WHATSAPP_CONTENT_SID`

## Deploy

```bash
supabase functions deploy send-whatsapp-alert
```

## Payload expected from app

```json
{
  "reference": "LKL-ABC123",
  "total_gbp": 42.5,
  "customer_name": "Jane Doe",
  "customer_phone": "+447700900123",
  "merchant_phone": "+447700900999",
  "store_name": "Mama Adwoa's Pantry",
  "items": [{ "name": "Ripe Plantain", "qty": 2, "unit": "each" }]
}
```
