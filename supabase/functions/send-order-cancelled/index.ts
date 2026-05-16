export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OrderCancelledPayload = {
  order_id?: string;
  reference: string;
  store_id: string;
  store_name?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  total_gbp: number;
  fulfillment_method?: "collection" | "delivery" | null;
  delivery_fee_gbp?: number | null;
};

function toE164(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;
  if (/^07\d{9}$/.test(digits)) return `+44${digits.slice(1)}`;
  if (digits.startsWith("0")) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as OrderCancelledPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const smsSender = Deno.env.get("BREVO_SMS_SENDER") ?? "Lokal";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!brevoKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeRes = await fetch(
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=owner_id,phone,name,merchant_sms_alerts,merchant_email_alerts`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const stores = await storeRes.json();
    const ownerId = stores?.[0]?.owner_id;
    const merchantPhone = toE164(stores?.[0]?.phone);
    const merchantSmsAlerts = stores?.[0]?.merchant_sms_alerts ?? true;
    const merchantEmailAlerts = stores?.[0]?.merchant_email_alerts ?? true;
    const storeName = stores?.[0]?.name ?? payload.store_name ?? "Your store";

    if (!ownerId) {
      return new Response(JSON.stringify({ skipped: true, reason: "store owner not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerId}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const user = await userRes.json();
    const merchantEmail = user?.email ?? user?.user?.email ?? null;

    const fulfillment = payload.fulfillment_method === "delivery" ? "Delivery" : "Collection";
    const total = Number(payload.total_gbp ?? 0).toFixed(2);

    const smsText = [
      "Order cancelled by customer",
      `${storeName} • #${payload.reference}`,
      `${fulfillment} • GBP ${total}`,
      `Customer: ${payload.customer_name}${payload.customer_phone ? ` (${payload.customer_phone})` : ""}`,
      "Open: https://lokalshops.co.uk/merchant",
    ].join("\n");

    const html = `
      <h2>Customer cancelled an order</h2>
      <p>A customer cancelled an order at <strong>${storeName}</strong>.</p>
      <p><strong>Reference:</strong> ${payload.reference}</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      ${payload.customer_phone ? `<p><strong>Phone:</strong> ${payload.customer_phone}</p>` : ""}
      <p><strong>Fulfilment:</strong> ${fulfillment}</p>
      <p><strong>Total:</strong> GBP ${total}</p>
      <p><a href="https://lokalshops.co.uk/merchant">Open Merchant Dashboard →</a></p>
    `;

    const [smsResult, emailResult] = await Promise.all([
      merchantSmsAlerts && merchantPhone
        ? fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: smsSender,
              recipient: merchantPhone,
              content: smsText,
              type: "transactional",
              tag: "merchant-order-cancelled-by-customer",
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({
            ok: false,
            body: merchantSmsAlerts ? "merchant phone missing" : "merchant sms alerts disabled",
          }),
      merchantEmailAlerts && merchantEmail
        ? fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { email: emailFrom, name: "Lokal" },
              to: [{ email: merchantEmail }],
              subject: `Customer cancelled order ${payload.reference}`,
              htmlContent: html,
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({
            ok: false,
            body: merchantEmailAlerts ? "merchant email missing" : "merchant email alerts disabled",
          }),
    ]);

    return new Response(
      JSON.stringify({ sent: smsResult.ok || emailResult.ok, sms: smsResult, email: emailResult }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ sent: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
