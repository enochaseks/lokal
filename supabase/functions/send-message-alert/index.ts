export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MessageAlertPayload = {
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  body: string;
};

const merchantMessagesUrl = "https://lokalshops.co.uk/merchant?tab=messages";

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
    const payload = (await req.json()) as MessageAlertPayload;

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
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=owner_id,phone,merchant_sms_alerts,merchant_email_alerts`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const stores = await storeRes.json();
    const ownerId = stores?.[0]?.owner_id;
    const merchantPhone = toE164(stores?.[0]?.phone);
    const merchantSmsAlerts = stores?.[0]?.merchant_sms_alerts ?? true;
    const merchantEmailAlerts = stores?.[0]?.merchant_email_alerts ?? true;

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

    const bodyText = payload.body.trim();
    const customerContact = payload.customer_phone || payload.customer_email || "Not provided";
    const html = `
      <h2>💬 New enquiry on Lokal</h2>
      <p><strong>Store:</strong> ${payload.store_name}</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      <p><strong>Phone / Email:</strong> ${customerContact}</p>
      <p><strong>Message:</strong></p>
      <p>${bodyText.replace(/\n/g, "<br>")}</p>
      <p>Please check your merchant dashboard inbox here:</p>
      <p><a href="${merchantMessagesUrl}">Open Messages →</a></p>
    `;

    const smsText = [
      `💬 New enquiry – ${payload.store_name}`,
      `${payload.customer_name}`,
      payload.customer_phone ? `Phone: ${payload.customer_phone}` : payload.customer_email ? `Email: ${payload.customer_email}` : null,
      bodyText,
      `Check your message inbox: ${merchantMessagesUrl}`,
    ].join("\n");

    const [emailResult, smsResult] = await Promise.all([
      merchantEmailAlerts && merchantEmail
        ? fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { email: emailFrom, name: "Lokal" },
              to: [{ email: merchantEmail }],
              subject: `New enquiry from ${payload.customer_name} - ${payload.store_name}`,
              htmlContent: html,
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({
            ok: false,
            body: merchantEmailAlerts ? "merchant email not found" : "merchant email alerts disabled",
          }),
      merchantSmsAlerts && merchantPhone
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
              tag: "merchant-new-enquiry",
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({
            ok: false,
            body: merchantSmsAlerts ? "merchant phone not found" : "merchant sms alerts disabled",
          }),
    ]);

    return new Response(
      JSON.stringify({ sent: emailResult.ok || smsResult.ok, email: emailResult, sms: smsResult }),
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
