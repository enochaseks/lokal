export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingCancelledPayload = {
  booking_id: string;
  store_id?: string | null;
  store_name: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone?: string | null;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
  cancelled_by?: "customer" | "merchant";
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
    const cancelledBy = payload.cancelled_by ?? "merchant";

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
    const serviceText = payload.service
      ? `<p><strong>Service:</strong> ${payload.service}</p>`
      : "";
    const staffText = payload.staff_name
      ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>`
      : "";

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

    let merchantResult: { ok: boolean; body: string } = {
      ok: false,
      body: "merchant notification not required",
    };
    if (cancelledBy === "customer") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const smsSenderForMerchant = Deno.env.get("BREVO_SMS_SENDER") ?? "Lokal";

      if (supabaseUrl && serviceRoleKey) {
        let resolvedStoreId = payload.store_id ?? null;
        if (!resolvedStoreId) {
          const bookingRes = await fetch(
            `${supabaseUrl}/rest/v1/store_bookings?id=eq.${payload.booking_id}&select=store_id`,
            { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
          );
          const bookingRows = await bookingRes.json();
          resolvedStoreId = bookingRows?.[0]?.store_id ?? null;
        }

        if (resolvedStoreId) {
          const storeRes = await fetch(
            `${supabaseUrl}/rest/v1/stores?id=eq.${resolvedStoreId}&select=owner_id,phone,name,merchant_sms_alerts,merchant_email_alerts`,
            { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
          );
          const stores = await storeRes.json();
          const ownerId = stores?.[0]?.owner_id;
          const merchantPhone = toE164(stores?.[0]?.phone);
          const merchantSmsAlerts = stores?.[0]?.merchant_sms_alerts ?? true;
          const merchantEmailAlerts = stores?.[0]?.merchant_email_alerts ?? true;
          const merchantStoreName = stores?.[0]?.name ?? payload.store_name;

          let merchantEmail: string | null = null;
          if (ownerId) {
            const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerId}`, {
              headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
            });
            const user = await userRes.json();
            merchantEmail = user?.email ?? user?.user?.email ?? null;
          }

          const merchantSmsText = [
            `Booking cancelled by customer`,
            `${merchantStoreName} • ${slotStr}`,
            `${payload.customer_name}${payload.customer_phone ? ` • ${payload.customer_phone}` : ""}`,
            payload.service ? `Service: ${payload.service}` : null,
            `Open: https://lokalshops.co.uk/merchant`,
          ]
            .filter(Boolean)
            .join("\n");

          const merchantHtml = `
            <h2>Customer cancelled a booking</h2>
            <p>A customer cancelled an appointment at <strong>${merchantStoreName}</strong>.</p>
            <p><strong>Customer:</strong> ${payload.customer_name}</p>
            ${payload.customer_phone ? `<p><strong>Phone:</strong> ${payload.customer_phone}</p>` : ""}
            <p><strong>Date and time:</strong> ${slotStr}</p>
            ${payload.service ? `<p><strong>Service:</strong> ${payload.service}</p>` : ""}
            ${payload.staff_name ? `<p><strong>Team member:</strong> ${payload.staff_name}</p>` : ""}
            <p><a href="https://lokalshops.co.uk/merchant">Open Merchant Dashboard →</a></p>
          `;

          if (merchantSmsAlerts && merchantPhone) {
            const merchantSmsRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
              method: "POST",
              headers: { "api-key": brevoKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                sender: smsSenderForMerchant,
                recipient: merchantPhone,
                content: merchantSmsText,
                type: "transactional",
                tag: "merchant-booking-cancelled-by-customer",
              }),
            });
            merchantResult = { ok: merchantSmsRes.ok, body: await merchantSmsRes.text() };
          } else if (!merchantSmsAlerts) {
            merchantResult = { ok: false, body: "merchant sms alerts disabled" };
          }

          if (!merchantResult.ok && merchantEmailAlerts && merchantEmail) {
            const merchantEmailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { "api-key": brevoKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                sender: { email: emailFrom, name: "Lokal" },
                to: [{ email: merchantEmail }],
                subject: `Customer cancelled booking at ${merchantStoreName}`,
                htmlContent: merchantHtml,
              }),
            });
            merchantResult = { ok: merchantEmailRes.ok, body: await merchantEmailRes.text() };
          } else if (!merchantResult.ok && !merchantEmailAlerts) {
            merchantResult = { ok: false, body: "merchant email alerts disabled" };
          }
        } else {
          merchantResult = { ok: false, body: "store not found for booking" };
        }
      } else {
        merchantResult = { ok: false, body: "supabase env missing for merchant lookup" };
      }
    }

    return new Response(
      JSON.stringify({
        sent: emailResult.ok || smsResult.ok,
        email: emailResult,
        sms: smsResult,
        merchant: merchantResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
