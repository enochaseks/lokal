export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingConfirmedPayload = {
  booking_id: string;
  store_name: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
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

function prettySlot(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = timePart.slice(0, 5);
  return `${dateStr} at ${time}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as BookingConfirmedPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const smsSender = Deno.env.get("BREVO_SMS_SENDER") ?? "Lokal";
    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slotStr = prettySlot(payload.slot_start);
    const serviceText = payload.service ? `<p><strong>Service:</strong> ${payload.service}</p>` : "";
    const staffText = payload.staff_name ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>` : "";

    const html = `
      <h2>Booking confirmed</h2>
      <p>Hi ${payload.customer_name}, your appointment at <strong>${payload.store_name}</strong> has been confirmed.</p>
      <p><strong>Date and time:</strong> ${slotStr}</p>
      ${serviceText}
      ${staffText}
      <p>If you need to make changes, please contact the store directly.</p>
      <p><a href="https://lokalshops.co.uk">Open Lokal</a></p>
    `;

    const customerPhone = toE164(payload.customer_phone);
    const smsLines = [
      `Hi ${payload.customer_name}, your booking is confirmed.`,
      `${payload.store_name} - ${slotStr}`,
      payload.service ? `Service: ${payload.service}` : null,
      payload.staff_name ? `With: ${payload.staff_name}` : null,
      `Need changes? Contact the store.`,
      `https://lokalshops.co.uk`,
    ]
      .filter(Boolean)
      .join("\n");

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
              subject: `Booking confirmed: ${payload.store_name} - ${slotStr}`,
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
              content: smsLines,
              type: "transactional",
              tag: "customer-booking-confirmed",
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
