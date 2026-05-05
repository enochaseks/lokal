const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingCustomerConfirmationPayload = {
  store_name: string;
  customer_name: string;
  customer_email: string;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
  customer_phone: string;
};

function prettySlot(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const dateStr = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = timePart.slice(0, 5);
  return `${dateStr} at ${time}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as BookingCustomerConfirmationPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";

    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload.customer_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no customer email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prettyTime = prettySlot(payload.slot_start);

    const emailBody = `
Hi ${payload.customer_name},

Your booking request with ${payload.store_name} has been received!

**Booking details:**
- Service: ${payload.service || "General booking"}
- Staff: ${payload.staff_name || "Any available"}
- Date & time: ${prettyTime}
- Your phone: ${payload.customer_phone}

${payload.service?.toLowerCase().includes("hair") || payload.service?.toLowerCase().includes("beauty") ? `💳 **Important**: If a deposit was quoted, please arrange payment with the merchant before your appointment.` : ""}

${payload.store_name} will contact you within 24 hours to confirm your appointment.

If you need to make changes, please reply to this email or contact them directly.

Best regards,
Lokal
lokalshops.co.uk
    `.trim();

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify({
        sender: { name: "Lokal", email: emailFrom },
        to: [{ email: payload.customer_email, name: payload.customer_name }],
        subject: `Booking request received from ${payload.store_name}`,
        htmlContent: emailBody.replace(/\n/g, "<br>"),
      }),
    });

    const result = await response.json();

    return new Response(JSON.stringify({ success: response.ok, result }), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
