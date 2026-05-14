export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingPreEndPayload = {
  booking_id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
  slot_end: string;
  age_restricted: boolean;
  minimum_age_required: number | null;
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
    const payload = (await req.json()) as BookingPreEndPayload;
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!brevoKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ sent: false, reason: "env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: storeRow } = await admin
      .from("stores")
      .select("owner_id")
      .eq("id", payload.store_id)
      .maybeSingle();

    let merchantEmail: string | null = null;
    if (storeRow?.owner_id) {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${storeRow.owner_id}`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
      const userData = await userRes.json();
      merchantEmail = userData?.email ?? userData?.user?.email ?? null;
    }

    const slotStr = prettySlot(payload.slot_start);
    const endStr = prettySlot(payload.slot_end);
    const serviceText = payload.service ? `<p><strong>Service:</strong> ${payload.service}</p>` : "";
    const staffText = payload.staff_name ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>` : "";
    const ageText = payload.age_restricted
      ? `<p><strong>Age-restricted service:</strong> Yes (minimum age ${payload.minimum_age_required ?? 18}+).</p>`
      : "";

    const customerHtml = `
      <h2>Your appointment is in progress</h2>
      <p>Hi ${payload.customer_name}, your appointment with <strong>${payload.store_name}</strong> is scheduled for ${slotStr} and is nearing completion.</p>
      ${serviceText}
      ${staffText}
      ${ageText}
      <p>If any details changed (service, timing, or concerns), contact the merchant now so they can update your booking.</p>
      <p><a href="https://lokalshops.co.uk/booking">View booking status</a></p>
    `;

    const merchantHtml = `
      <h2>Booking confirmation reminder</h2>
      <p><strong>${payload.store_name}</strong> booking is approaching end time.</p>
      <p><strong>Customer:</strong> ${payload.customer_name}</p>
      <p><strong>Scheduled:</strong> ${slotStr}</p>
      <p><strong>Ends at:</strong> ${endStr}</p>
      ${serviceText}
      ${staffText}
      ${ageText}
      <p>Please confirm any required age/ID checks and mark the booking completed in your merchant dashboard when finished.</p>
      <p><a href="https://lokalshops.co.uk/merchant">Open merchant dashboard</a></p>
    `;

    const recipients: Array<{ email: string; name?: string }> = [];
    if (payload.customer_email) {
      recipients.push({ email: payload.customer_email, name: payload.customer_name });
    }
    if (merchantEmail) {
      recipients.push({ email: merchantEmail, name: payload.store_name });
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no recipients" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sends: Array<Promise<Response>> = [];
    if (payload.customer_email) {
      sends.push(fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: emailFrom, name: "Lokal" },
          to: [{ email: payload.customer_email, name: payload.customer_name }],
          subject: `Reminder: appointment update for ${payload.store_name}`,
          htmlContent: customerHtml,
        }),
      }));
    }
    if (merchantEmail) {
      sends.push(fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: emailFrom, name: "Lokal" },
          to: [{ email: merchantEmail, name: payload.store_name }],
          subject: `Action needed: confirm booking completion`,
          htmlContent: merchantHtml,
        }),
      }));
    }

    const responses = await Promise.all(sends);
    const details = await Promise.all(
      responses.map(async (res) => ({ ok: res.ok, status: res.status, body: await res.text() })),
    );

    return new Response(JSON.stringify({ sent: details.some((d) => d.ok), details }), {
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
