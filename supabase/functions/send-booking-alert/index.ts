const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingPayload = {
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_phone: string;
  service: string | null;
  slot_start: string; // "2026-05-10T09:00:00"
  note: string | null;
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
  // iso is "YYYY-MM-DDTHH:MM:00"
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
    const payload = (await req.json()) as BookingPayload;

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

    // Look up merchant email and phone via service role
    const storeRes = await fetch(
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=owner_id,phone`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
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

    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerId}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const user = await userRes.json();
    const merchantEmail = user?.email ?? user?.user?.email ?? null;

    const slotStr = prettySlot(payload.slot_start);
    const serviceLabel = payload.service ? `<strong>Service:</strong> ${payload.service}<br>` : "";
    const ageLabel = payload.age_restricted
      ? `<strong>Age/ID check required:</strong> Yes (${payload.minimum_age_required ?? 18}+). Customer confirmed age and valid ID commitment.<br>`
      : "";

    const html = `
      <h2>📅 New booking request on Lokal</h2>
      <p><strong>Store:</strong> ${payload.store_name}</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      <p><strong>Phone:</strong> ${payload.customer_phone}</p>
      ${serviceLabel}
      ${ageLabel}
      <p><strong>Slot:</strong> ${slotStr}</p>
      ${payload.note ? `<p><strong>Note:</strong> ${payload.note}</p>` : ""}
      <p>Log in to confirm or cancel the booking: <a href="https://lokalshops.co.uk">Open Lokal →</a></p>
    `;

    const smsLines = [
      `📅 New booking – ${payload.store_name}`,
      `${payload.customer_name} • ${slotStr}`,
      payload.service ? `Service: ${payload.service}` : null,
      payload.age_restricted ? `ID check required (${payload.minimum_age_required ?? 18}+).` : null,
      `Phone: ${payload.customer_phone}`,
      `Manage: lokalshops.co.uk`,
    ]
      .filter(Boolean)
      .join("\n");

    // Try SMS first; fall back to email if SMS is unavailable or fails.
    let smsResult: { ok: boolean; body: string } = { ok: false, body: "merchant phone not found" };
    if (merchantPhone) {
      const smsRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: smsSender,
          recipient: merchantPhone,
          content: smsLines,
          type: "transactional",
          tag: "merchant-new-booking",
        }),
      });
      smsResult = { ok: smsRes.ok, body: await smsRes.text() };
    }

    let emailResult: { ok: boolean; body: string } = { ok: false, body: "sms succeeded" };
    if (!smsResult.ok) {
      if (merchantEmail) {
        const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: emailFrom, name: "Lokal" },
            to: [{ email: merchantEmail }],
            subject: `New booking: ${payload.customer_name} – ${slotStr}`,
            htmlContent: html,
          }),
        });
        emailResult = { ok: emailRes.ok, body: await emailRes.text() };
      } else {
        emailResult = { ok: false, body: "merchant email not found" };
      }
    }

    return new Response(
      JSON.stringify({ sent: emailResult.ok || smsResult.ok, email: emailResult, sms: smsResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ sent: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
