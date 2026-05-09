export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VerificationAlertPayload = {
  store_id: string;
  store_name: string;
  business_name: string;
  owner_name: string;
  verification_method: "registration_number" | "online_presence" | "manual_review";
  submission_reason: string;
  requester_email: string | null;
};

const ADMIN_EMAILS = ["enochaseks@yahoo.co.uk", "enochaseks@gmail.com"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as VerificationAlertPayload;

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";

    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const methodLabel =
      payload.verification_method === "registration_number"
        ? "Registered business"
        : payload.verification_method === "online_presence"
          ? "Online business"
          : "Manual review";

    const html = `
      <h2>New verification request submitted</h2>
      <p><strong>Store:</strong> ${payload.store_name}</p>
      <p><strong>Business name:</strong> ${payload.business_name}</p>
      <p><strong>Owner:</strong> ${payload.owner_name}</p>
      <p><strong>Route:</strong> ${methodLabel}</p>
      <p><strong>Requester email:</strong> ${payload.requester_email ?? "Not provided"}</p>
      <p><strong>Reason:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${payload.submission_reason}</pre>
      <p><a href="https://lokalshops.co.uk/admin">Open admin dashboard</a></p>
    `;

    const recipients = [...ADMIN_EMAILS, payload.requester_email]
      .filter((email, index, list) => Boolean(email) && list.indexOf(email) === index);

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: recipients.map((email) => ({ email })),
        subject: `New verification request: ${payload.store_name}`,
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
