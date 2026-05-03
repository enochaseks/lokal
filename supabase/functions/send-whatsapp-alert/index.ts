const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertPayload = {
  reference: string;
  total_gbp: number;
  customer_name: string;
  store_name: string;
  store_id: string;
  items: Array<{ name: string; qty: number; unit?: string }>;
};

function toE164(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as AlertPayload;

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

    // Look up merchant email via service role
    const storeRes = await fetch(
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=owner_id,phone`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const stores = await storeRes.json();
    const ownerId = stores?.[0]?.owner_id;
    const merchantPhone = toE164(stores?.[0]?.phone);
    if (!ownerId) {
      return new Response(JSON.stringify({ skipped: true, reason: "store owner not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${ownerId}`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const user = await userRes.json();
    const merchantEmail = user?.email ?? user?.user?.email ?? null;

    const itemLines = payload.items.map((i) => `<li>${i.qty}× ${i.name}</li>`).join("");
    const itemCount = payload.items.reduce((acc, i) => acc + i.qty, 0);

    const html = `
      <h2>🛒 New order on Lokal</h2>
      <p><strong>Reference:</strong> ${payload.reference}</p>
      <p><strong>Store:</strong> ${payload.store_name}</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      <p><strong>Items (${itemCount} total):</strong></p>
      <ul>${itemLines}</ul>
      <p><strong>Total:</strong> £${Number(payload.total_gbp).toFixed(2)}</p>
      <p><a href="https://lokalshops.co.uk">Open Lokal →</a></p>
    `;

    const smsText = [
      `New Lokal order: ${payload.reference}`,
      `${payload.store_name} • £${Number(payload.total_gbp).toFixed(2)}`,
      `Customer: ${payload.customer_name}`,
      `Open: https://lokalshops.co.uk`,
    ].join("\n");

    const [emailResult, smsResult] = await Promise.all([
      merchantEmail
        ? fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { email: emailFrom, name: "Lokal" },
              to: [{ email: merchantEmail }],
              subject: `New order ${payload.reference} - GBP ${Number(payload.total_gbp).toFixed(2)}`,
              htmlContent: html,
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({ ok: false, body: "merchant email not found" }),
      merchantPhone
        ? fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: smsSender,
              recipient: merchantPhone,
              content: smsText,
              type: "transactional",
              tag: "merchant-new-order",
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({ ok: false, body: "merchant phone not found" }),
    ]);

    return new Response(JSON.stringify({ sent: emailResult.ok || smsResult.ok, email: emailResult, sms: smsResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ sent: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
