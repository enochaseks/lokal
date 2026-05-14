export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReverifyAlertPayload = {
  store_id: string;
  store_name: string;
  owner_name: string;
  reverify_reason: string;
  category?: string | null;
  subcategory?: string | null;
  verification_method?: "registration_number" | "online_presence" | "manual_review" | null;
  business_registration_number?: string | null;
  online_presence_url?: string | null;
  manual_review_details?: string | null;
  supporting_links?: string | null;
  submission_reason?: string | null;
  is_body_arts_verification?: boolean;
  tattoo_minimum_age?: number | null;
  tattoo_portfolio_url?: string | null;
  tattoo_license_url?: string | null;
  tattoo_age_restriction_acknowledged?: boolean | null;
};

function parseSubmissionEvidence(reason?: string | null) {
  const text = reason ?? "";
  const minimumAge = text.match(/Minimum age:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const portfolio = text.match(/Portfolio:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const licence = text.match(/Licence(?:\/ID)?:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const ageAck = text.match(/Age restriction acknowledged:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  return {
    minimumAge: minimumAge && !/^not provided$/i.test(minimumAge) ? minimumAge : null,
    portfolio: portfolio && !/^not provided$/i.test(portfolio) ? portfolio : null,
    licence: licence && !/^not provided$/i.test(licence) ? licence : null,
    ageAck: ageAck && !/^not provided$/i.test(ageAck) ? ageAck : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ReverifyAlertPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "brevo not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeRes = await fetch(
      `${supabaseUrl}/rest/v1/stores?select=owner_id&id=eq.${encodeURIComponent(payload.store_id)}&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!storeRes.ok) {
      const text = await storeRes.text();
      throw new Error(`Could not load store owner: ${storeRes.status} ${text}`);
    }

    const storeRows = (await storeRes.json()) as Array<{ owner_id?: string | null }>;
    const ownerId = storeRows?.[0]?.owner_id ?? null;
    if (!ownerId) {
      throw new Error("Store owner not found");
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${ownerId}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!userRes.ok) {
      const text = await userRes.text();
      throw new Error(`Could not load owner email: ${userRes.status} ${text}`);
    }

    const userPayload = (await userRes.json()) as {
      user?: { email?: string | null };
      email?: string | null;
      data?: { user?: { email?: string | null }; email?: string | null };
      users?: Array<{ email?: string | null }>;
    };
    const ownerEmail =
      userPayload?.user?.email
      ?? userPayload?.email
      ?? userPayload?.data?.user?.email
      ?? userPayload?.data?.email
      ?? userPayload?.users?.[0]?.email
      ?? null;
    if (!ownerEmail) {
      throw new Error("Owner email not found");
    }

    const parsedEvidence = parseSubmissionEvidence(payload.submission_reason);
    const displayMinimumAge = payload.tattoo_minimum_age ?? parsedEvidence.minimumAge ?? "Not provided";
    const displayPortfolio = payload.tattoo_portfolio_url ?? parsedEvidence.portfolio ?? null;
    const displayLicence = payload.tattoo_license_url ?? parsedEvidence.licence ?? null;
    const displayAgeAck =
      payload.tattoo_age_restriction_acknowledged != null
        ? (payload.tattoo_age_restriction_acknowledged ? "Yes" : "No")
        : (parsedEvidence.ageAck ?? "Not provided");

    const html = `
      <h2>Your store verification has been requested for re-submission</h2>
      <p>Hi ${payload.owner_name},</p>
      <p>Our admin team has requested that you re-submit verification for your store <strong>${payload.store_name}</strong>.</p>
      
      <h3>Store Information:</h3>
      <div style="background-color: #f9f9f9; padding: 12px; border-radius: 4px; margin: 12px 0; border-left: 3px solid #4CAF50;">
        <p><strong>Category:</strong> ${payload.category ?? "Not specified"}</p>
        ${payload.subcategory ? `<p><strong>Service Type:</strong> ${payload.subcategory}</p>` : ""}
        <p><strong>Verification Method:</strong> ${
          payload.verification_method === "registration_number"
            ? "Registered business"
            : payload.verification_method === "online_presence"
              ? "Online business / social storefront"
              : payload.verification_method === "manual_review"
                ? "Manual review"
                : "Standard verification"
        }</p>
      </div>
      
      ${payload.is_body_arts_verification ? `
      <h3>Body Arts & Crafts Verification Requirements:</h3>
      <div style="background-color: #fff3e0; padding: 12px; border-radius: 4px; margin: 12px 0;">
        <p><strong>Minimum Age Policy:</strong> ${displayMinimumAge}</p>
        <p><strong>Portfolio URL:</strong> ${displayPortfolio ? `<a href="${displayPortfolio}" target="_blank">${displayPortfolio}</a>` : "Not provided"}</p>
        <p><strong>License/ID URL:</strong> ${displayLicence ? `<a href="${displayLicence}" target="_blank">${displayLicence}</a>` : "Not provided"}</p>
        <p><strong>Age restriction acknowledged:</strong> ${displayAgeAck}</p>
      </div>
      ` : ""}
      
      ${payload.verification_method === "registration_number" && payload.business_registration_number ? `
      <h3>Business Registration:</h3>
      <div style="background-color: #f9f9f9; padding: 12px; border-radius: 4px; margin: 12px 0;">
        <p><strong>Registration Number:</strong> ${payload.business_registration_number}</p>
      </div>
      ` : ""}
      
      ${payload.verification_method === "online_presence" && payload.online_presence_url ? `
      <h3>Online Presence:</h3>
      <div style="background-color: #f9f9f9; padding: 12px; border-radius: 4px; margin: 12px 0;">
        <p><a href="${payload.online_presence_url}" target="_blank">${payload.online_presence_url}</a></p>
      </div>
      ` : ""}

      ${payload.verification_method === "manual_review" && payload.manual_review_details ? `
      <h3>Manual Review Details:</h3>
      <div style="background-color: #f9f9f9; padding: 12px; border-radius: 4px; margin: 12px 0;">
        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${payload.manual_review_details}</pre>
      </div>
      ` : ""}

      ${payload.supporting_links ? `
      <h3>Supporting Links:</h3>
      <div style="background-color: #f9f9f9; padding: 12px; border-radius: 4px; margin: 12px 0;">
        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${payload.supporting_links}</pre>
      </div>
      ` : ""}
      
      <h3>Reason for re-verification:</h3>
      <div style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; margin: 12px 0; border-left: 3px solid #ff9800;">
        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${payload.reverify_reason}</pre>
      </div>
      
      <p>Please log in to your Lokal account and update your store information with the necessary changes. Once you've made the updates, you can re-submit your verification request.</p>
      
      <p>If you have any questions, please reach out to our support team.</p>
      
      <p><a href="https://lokalshops.co.uk/auth" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Sign in to Lokal</a></p>
      
      <p style="color: #999; font-size: 12px;">—<br>The Lokal Team</p>
    `;

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: [{ email: ownerEmail }],
        subject: `Re-verification requested for ${payload.store_name}`,
        htmlContent: html,
      }),
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.error("Brevo error:", errorText);
      throw new Error(`Email send failed: ${emailRes.status}`);
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send-reverify-alert:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
