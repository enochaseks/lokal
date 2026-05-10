export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WebhookPayload = {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    email: string;
    created_at: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;

    const email = payload.record?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "No email in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";

    if (!brevoKey) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Lokal", email: emailFrom },
        to: [{ email }],
        subject: "Welcome to Lokal 🎉",
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Welcome to Lokal! 🎉</h2>
            <p style="color: #555; margin-bottom: 24px;">
              We're so glad you're here. Lokal is a home for African and Caribbean stores — connecting merchants directly with customers, no fees, no middlemen.
            </p>

            <div style="background: #f9f5f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="font-weight: 600; margin-bottom: 12px;">Do you run a business?</p>
              <p style="color: #555; margin-bottom: 16px;">
                List your store on Lokal for free. Sell groceries, beauty products, clothing, and more — or take bookings for services like barbering and hair styling. Get paid directly, no platform fees.
              </p>
              <a href="https://lokalshops.co.uk/list-store"
                style="display: inline-block; background-color: #c2410c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                List your store →
              </a>
            </div>

            <div style="background: #f0f4f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="font-weight: 600; margin-bottom: 12px;">Just here to shop?</p>
              <p style="color: #555; margin-bottom: 16px;">
                Browse African and Caribbean stores near you. Order directly, pay by bank transfer — no card fees. Discover groceries, beauty stores, barbers, and more.
              </p>
              <a href="https://lokalshops.co.uk/#stores"
                style="display: inline-block; background-color: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Browse stores →
              </a>
            </div>

            <p style="color: #888; font-size: 13px; margin-top: 32px;">
              Questions? Visit our <a href="https://lokalshops.co.uk/help" style="color: #c2410c;">help centre</a> or just reply to this email.
            </p>
            <p style="color: #bbb; font-size: 12px; margin-top: 8px;">
              Lokal · Made with warmth for the diaspora
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: "Failed to send email", details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sentTo: email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
