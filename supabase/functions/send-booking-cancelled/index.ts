export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BookingCancelledPayload = {
  booking_id: string;
  store_name: string;
  customer_name: string;
  customer_email: string | null;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
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
    const payload = (await req.json()) as BookingCancelledPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
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

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: [{ email: payload.customer_email, name: payload.customer_name }],
        subject: `Your booking at ${payload.store_name} has been cancelled`,
        htmlContent: html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      return new Response(JSON.stringify({ error: "email failed", detail: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
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
