const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReadyPayload = {
  reference: string;
  store_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string;
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
    const payload = (await req.json()) as ReadyPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const smsSender = Deno.env.get("BREVO_SMS_SENDER") ?? "Lokal";
    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <h2>✅ Your order is ready!</h2>
      <p>Hi ${payload.customer_name}, your order from <strong>${payload.store_name}</strong> is ready for collection.</p>
      <p><strong>Reference:</strong> ${payload.reference}</p>
      <p><a href="https://lokalshops.co.uk/order">Track your order →</a></p>
    `;

    const customerPhone = toE164(payload.customer_phone);
    const smsText = [
      `Hi ${payload.customer_name}, your order is ready.`,
      `${payload.store_name} • Ref: ${payload.reference}`,
      `Track: https://lokalshops.co.uk/order`,
    ].join("\n");

    const [emailResult, smsResult] = await Promise.all([
      payload.customer_email
        ? fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { email: emailFrom, name: "Lokal" },
              to: [{ email: payload.customer_email, name: payload.customer_name }],
              subject: `Your order ${payload.reference} is ready for collection`,
              htmlContent: html,
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({ ok: false, body: "customer email missing" }),
      customerPhone
        ? fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: smsSender,
              recipient: customerPhone,
              content: smsText,
              type: "transactional",
              tag: "customer-order-ready",
            }),
          }).then(async (res) => ({ ok: res.ok, body: await res.text() }))
        : Promise.resolve({ ok: false, body: "customer phone missing" }),
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
