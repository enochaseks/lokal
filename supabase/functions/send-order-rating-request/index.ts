export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  order_id: string;
  order_reference: string;
  rating_token: string;
  customer_name: string;
  customer_email: string;
  store_name: string;
  store_id: string;
};

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
    const html = `
      <h2>How was your order from ${payload.store_name}? ⭐</h2>
      <p>Hi ${payload.customer_name},</p>
      <p>Thanks for ordering from <strong>${payload.store_name}</strong>.</p>
      <p><strong>Order reference:</strong> ${payload.order_reference}</p>
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
        subject: `How was your order from ${payload.store_name}?`,
        htmlContent: html,
      }),
    });

    const body = await result.text();
    let ratingUpdate: { ok: boolean; status: number; body: string } | null = null;
    if (result.ok) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${payload.order_id}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ rating_sent: true }),
        });
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
