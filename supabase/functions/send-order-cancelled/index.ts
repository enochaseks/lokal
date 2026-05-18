export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OrderCancelledPayload = {
  order_id?: string;
  cancelled_by?: "customer" | "merchant";
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
    const appUrl = (Deno.env.get("APP_URL") ?? "https://lokalshops.co.uk").replace(/\/+$/, "");
    const merchantDashboardUrl = `${appUrl}/merchant`;
    const cancelledBy = payload.cancelled_by ?? "customer";
    const fulfillment = payload.fulfillment_method === "delivery" ? "Delivery" : "Collection";
    const total = Number(payload.total_gbp ?? 0).toFixed(2);

    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cancelledBy === "merchant") {
      const customerPhone = toE164(payload.customer_phone);
      const customerSmsText = [
        `Hi ${payload.customer_name}, your order ${payload.reference} has been cancelled by ${payload.store_name ?? "the merchant"}.`,
        `${fulfillment} • GBP ${total}`,
        `Track: ${appUrl}/order`,
      ].join("\n");

      const customerHtml = `
        <h2>Your order was cancelled</h2>
        <p>Hi ${payload.customer_name}, your order from <strong>${payload.store_name ?? "this store"}</strong> has been cancelled by the merchant.</p>
        <p><strong>Reference:</strong> ${payload.reference}</p>
        <p><strong>Fulfilment:</strong> ${fulfillment}</p>
        <p><strong>Total:</strong> GBP ${total}</p>
        <p><a href="${appUrl}/order">Track your order →</a></p>
      `;

      let smsResult: { ok: boolean; body: string } = { ok: false, body: "customer phone missing" };
      if (customerPhone) {
        const smsRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: smsSender,
            recipient: customerPhone,
            content: customerSmsText,
            type: "transactional",
            tag: "customer-order-cancelled-by-merchant",
          }),
        });
        smsResult = { ok: smsRes.ok, body: await smsRes.text() };
      }

      let emailResult: { ok: boolean; body: string } = { ok: false, body: "sms succeeded" };
      if (!smsResult.ok) {
        if (payload.customer_email) {
          const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { email: emailFrom, name: "Lokal" },
              to: [{ email: payload.customer_email, name: payload.customer_name }],
              subject: `Order ${payload.reference} was cancelled`,
              htmlContent: customerHtml,
            }),
          });
          emailResult = { ok: emailRes.ok, body: await emailRes.text() };
        } else {
          emailResult = { ok: false, body: "customer email missing" };
        }
      }

      return new Response(
        JSON.stringify({ sent: emailResult.ok || smsResult.ok, sms: smsResult, email: emailResult }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
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

    const smsText = [
      "Order cancelled by customer",
      `${storeName} • #${payload.reference}`,
      `${fulfillment} • GBP ${total}`,
      `Customer: ${payload.customer_name}${payload.customer_phone ? ` (${payload.customer_phone})` : ""}`,
      `Open: ${merchantDashboardUrl}`,
    ].join("\n");

    const html = `
      <h2>Customer cancelled an order</h2>
      <p>A customer cancelled an order at <strong>${storeName}</strong>.</p>
      <p><strong>Reference:</strong> ${payload.reference}</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      ${payload.customer_phone ? `<p><strong>Phone:</strong> ${payload.customer_phone}</p>` : ""}
      <p><strong>Fulfilment:</strong> ${fulfillment}</p>
      <p><strong>Total:</strong> GBP ${total}</p>
      <p><a href="${merchantDashboardUrl}">Open Merchant Dashboard →</a></p>
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
