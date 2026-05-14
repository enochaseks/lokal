const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  booking_id: string;
  rating_token: string;
  customer_name: string;
  customer_email: string;
  staff_name: string | null;
  store_name: string;
  store_id: string;
  slot_start: string; // "2026-05-10T09:00:00"
};

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
    const payload = (await req.json()) as Payload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";

    if (!brevoKey) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "BREVO_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ratingUrl = `https://lokalshops.co.uk/rate?token=${payload.rating_token}`;
    const slotStr = prettySlot(payload.slot_start);
    const staffLine = payload.staff_name
      ? `<p>You were seen by <strong>${payload.staff_name}</strong>.</p>`
      : "";

    const html = `
      <h2>How was your visit to ${payload.store_name}? ⭐</h2>
      <p>Hi ${payload.customer_name},</p>
      <p>Thanks for booking with <strong>${payload.store_name}</strong> on ${slotStr}.</p>
      ${staffLine}
      <p>It only takes 10 seconds — leave a rating to help other customers:</p>
      <p style="margin: 24px 0;">
        <a href="${ratingUrl}"
           style="background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Leave a rating →
        </a>
      </p>
      <p style="color:#888;font-size:12px;">
        Or copy this link: ${ratingUrl}
      </p>
    `;

    const result = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: [{ email: payload.customer_email, name: payload.customer_name }],
        subject: `How was your visit to ${payload.store_name}?`,
        htmlContent: html,
      }),
    });

    const body = await result.text();
    let ratingUpdate: { ok: boolean; status: number; body: string } | null = null;
    if (result.ok) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/store_bookings?id=eq.${payload.booking_id}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ rating_sent: true }),
          },
        );
        ratingUpdate = {
          ok: updateRes.ok,
          status: updateRes.status,
          body: await updateRes.text(),
        };
      }
    }

    return new Response(
      JSON.stringify({ sent: result.ok, status: result.status, body, rating_update: ratingUpdate }),
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
