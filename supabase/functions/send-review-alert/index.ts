const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReviewAlertPayload = {
  store_id: string;
  store_name: string;
  reviewer_name: string;
  rating: number;
  body: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ReviewAlertPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!brevoKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeRes = await fetch(
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=owner_id`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const stores = await storeRes.json();
    const ownerId = stores?.[0]?.owner_id;

    if (!ownerId) {
      return new Response(JSON.stringify({ skipped: true, reason: "store owner not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${ownerId}`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const user = await userRes.json();
    const merchantEmail = user?.email ?? user?.user?.email ?? null;

    if (!merchantEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "merchant email not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stars = Math.max(1, Math.min(5, Math.round(payload.rating)));
    const reviewLine = payload.body?.trim() ? `<p><strong>Review:</strong> ${payload.body.trim()}</p>` : "";

    const html = `
      <h2>New store review received</h2>
      <p><strong>Store:</strong> ${payload.store_name}</p>
      <p><strong>Rating:</strong> ${"*".repeat(stars)} (${payload.rating}/5)</p>
      <p><strong>Reviewer:</strong> ${payload.reviewer_name}</p>
      ${reviewLine}
      <p><a href="https://lokalshops.co.uk">Open Lokal</a></p>
    `;

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: [{ email: merchantEmail }],
        subject: `New review for ${payload.store_name} (${payload.rating}/5)`,
        htmlContent: html,
      }),
    });

    const emailBody = await emailRes.text();

    return new Response(JSON.stringify({ sent: emailRes.ok, email: { ok: emailRes.ok, body: emailBody } }), {
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
