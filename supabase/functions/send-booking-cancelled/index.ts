export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingCancelledPayload = {
  booking_id: string;
  store_name: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone?: string | null;
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
    const payload = (await req.json()) as BookingCancelledPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerEmail = payload.customer_email;
    const customerPhone = toE164(payload.customer_phone);

    // Fallback: resolve customer email from profile if booking row did not capture email.
    if (!customerEmail && payload.customer_phone) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const admin = createClient(supabaseUrl, supabaseServiceKey);
        const exact = await admin
          .from("customers")
          .select("email")
          .eq("phone", payload.customer_phone)
          .not("email", "is", null)
          .maybeSingle();

        if (!exact.error && exact.data?.email) {
          customerEmail = exact.data.email;
        } else {
          const phoneDigits = payload.customer_phone.replace(/\D/g, "");
          const tail = phoneDigits.slice(-9);
          if (tail) {
            const fallback = await admin
              .from("customers")
              .select("email")
              .ilike("phone", `%${tail}`)
              .not("email", "is", null)
              .limit(1)
              .maybeSingle();
            if (!fallback.error && fallback.data?.email) {
              customerEmail = fallback.data.email;
            }
          }
        }
      }
    }

    const slotStr = prettySlot(payload.slot_start);
    const serviceText = payload.service ? `<p><strong>Service:</strong> ${payload.service}</p>` : "";
    const staffText = payload.staff_name ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>` : "";

    const html = `
      <h2>Booking cancelled</h2>
      <p>Hi ${payload.customer_name}, unfortunately your appointment at <strong>${payload.store_name}</strong> has been cancelled.</p>
      <p><strong>Original date and time:</strong> ${slotStr}</p>
      ${serviceText}
      ${staffText}
      <p>We're sorry for any inconvenience. Please contact the store directly to rebook or if you have any questions.</p>
      <p><a href="https://lokalshops.co.uk">Find another store on Lokal</a></p>
    `;

    const smsSender = Deno.env.get("BREVO_SMS_SENDER") ?? "Lokal";
    const smsContent = [
      `Hi ${payload.customer_name}, your booking has been cancelled.`,
      `${payload.store_name} - ${slotStr}`,
      payload.service ? `Service: ${payload.service}` : null,
      payload.staff_name ? `With: ${payload.staff_name}` : null,
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
          content: smsContent,
          type: "transactional",
          tag: "customer-booking-cancelled",
        }),
      });
      smsResult = { ok: smsRes.ok, body: await smsRes.text() };
    }

    let emailResult: { ok: boolean; body: string } = { ok: false, body: "sms succeeded" };
    if (!smsResult.ok) {
      if (customerEmail) {
        const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: emailFrom, name: "Lokal" },
            to: [{ email: customerEmail, name: payload.customer_name }],
            subject: `Your booking at ${payload.store_name} has been cancelled`,
            htmlContent: html,
          }),
        });
        emailResult = { ok: emailRes.ok, body: await emailRes.text() };
      } else {
        emailResult = { ok: false, body: "customer email missing" };
      }
    }

    return new Response(JSON.stringify({ sent: emailResult.ok || smsResult.ok, email: emailResult, sms: smsResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
