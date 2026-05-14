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
  age_restricted?: boolean;
  minimum_age_required?: number | null;
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
    const serviceText = payload.service
      ? `<p><strong>Service:</strong> ${payload.service}</p>`
      : "";
    const staffText = payload.staff_name
      ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>`
      : "";
    const ageText = payload.age_restricted
      ? `<p><strong>Important:</strong> This is an age-restricted service (${payload.minimum_age_required ?? 18}+). Please bring valid government-issued ID to your appointment.</p>`
      : "";

    const html = `
      <h2>Booking confirmed</h2>
      <p>Hi ${payload.customer_name}, your appointment at <strong>${payload.store_name}</strong> has been confirmed.</p>
      <p><strong>Date and time:</strong> ${slotStr}</p>
      ${serviceText}
      ${staffText}
      ${ageText}
      <p>If you need to make changes, please contact the store directly.</p>
      <p><a href="https://lokalshops.co.uk">Open Lokal</a></p>
    `;

    const customerPhone = toE164(payload.customer_phone);
    const smsLines = [
      `Hi ${payload.customer_name}, your booking is confirmed.`,
      `${payload.store_name} - ${slotStr}`,
      payload.service ? `Service: ${payload.service}` : null,
      payload.staff_name ? `With: ${payload.staff_name}` : null,
      payload.age_restricted
        ? `Bring valid ID (${payload.minimum_age_required ?? 18}+ service).`
        : null,
      `Need changes? Contact the store.`,
      `https://lokalshops.co.uk`,
    ]
      .filter(Boolean)
      .join("\n");

    // Try SMS first; fall back to email if SMS is unavailable or fails.
    let smsResult: { ok: boolean; body: string } = { ok: false, body: "customer phone missing" };
    if (customerPhone) {
      const smsRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: smsSender,
          recipient: customerPhone,
          content: smsLines,
          type: "transactional",
          tag: "customer-booking-confirmed",
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
            subject: `Booking confirmed: ${payload.store_name} - ${slotStr}`,
            htmlContent: html,
          }),
        });
        emailResult = { ok: emailRes.ok, body: await emailRes.text() };
      } else {
        emailResult = { ok: false, body: "customer email missing" };
      }
    }

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
