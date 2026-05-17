export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["enochaseks@yahoo.co.uk", "enochaseks@gmail.com"];

type ProcessVerificationPayload = {
  request_id: string;
  action: "approve" | "reject";
  admin_notes?: string;
};

type VerificationRequestRow = {
  id: string;
  store_id: string;
  owner_id: string;
  business_name: string;
  owner_name: string;
  verification_method: "registration_number" | "online_presence" | "manual_review" | null;
  is_tattoo_verification?: boolean | null;
  status: "pending" | "approved" | "rejected";
};

function authBearer(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, data: parsed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ProcessVerificationPayload;

    if (!payload?.request_id || !payload?.action) {
      return new Response(JSON.stringify({ error: "request_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ?? "noreply@lokalshops.co.uk";
    const appUrl = (Deno.env.get("APP_URL") ?? "https://lokalshops.co.uk").replace(/\/+$/, "");
    const merchantDashboardUrl = `${appUrl}/merchant`;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authBearer(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetchJson(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmail = String(userRes.data?.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(adminEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const reqRes = await fetchJson(
      `${supabaseUrl}/rest/v1/store_verification_requests?id=eq.${payload.request_id}&select=id,store_id,owner_id,business_name,owner_name,verification_method,is_tattoo_verification,status`,
      { headers: adminHeaders },
    );

    if (!reqRes.ok || !Array.isArray(reqRes.data) || reqRes.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "Verification request not found", details: reqRes.data }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const requestRow = reqRes.data[0] as VerificationRequestRow;

    const nowIso = new Date().toISOString();
    const updateReqRes = await fetchJson(
      `${supabaseUrl}/rest/v1/store_verification_requests?id=eq.${payload.request_id}`,
      {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: payload.action === "approve" ? "approved" : "rejected",
          admin_notes: payload.admin_notes ?? null,
          reviewed_at: nowIso,
          reviewed_by: userRes.data?.id ?? null,
        }),
      },
    );

    if (!updateReqRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to update request", details: updateReqRes.data }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (payload.action === "approve") {
      const verificationReason = requestRow.is_tattoo_verification
        ? "Verified artist"
        : requestRow.verification_method === "registration_number"
          ? "Registered business verified"
          : requestRow.verification_method === "online_presence"
            ? "Online business verified"
            : "Store verified after manual review";

      const storeUpdate: Record<string, unknown> = {
        is_verified: true,
        published: true,
        verified_at: nowIso,
        verification_reason: verificationReason,
      };

      if (requestRow.is_tattoo_verification) {
        storeUpdate.is_verified_tattoo_artist = true;
      }

      const updateStoreRes = await fetchJson(
        `${supabaseUrl}/rest/v1/stores?id=eq.${requestRow.store_id}`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify(storeUpdate),
        },
      );

      if (!updateStoreRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to update store", details: updateStoreRes.data }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    let requesterEmail: string | null = null;
    const ownerUserRes = await fetchJson(
      `${supabaseUrl}/auth/v1/admin/users/${requestRow.owner_id}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (ownerUserRes.ok) {
      requesterEmail = ownerUserRes.data?.email ?? ownerUserRes.data?.user?.email ?? null;
    }

    if (brevoKey && requesterEmail) {
      const decision = payload.action === "approve" ? "approved" : "rejected";
      const decisionTitle = payload.action === "approve" ? "approved" : "rejected";
      const notes = payload.admin_notes?.trim()
        ? `<p><strong>Admin notes:</strong> ${payload.admin_notes.trim()}</p>`
        : "";

      let html = "";
      let subject = "";

      if (payload.action === "approve") {
        subject = `🎉 Your store is verified! Go live on Lokal`;
        html = `
          <h2>🎉 Congratulations! Your store is verified!</h2>
          <p>Your store <strong>${requestRow.business_name}</strong> has been approved and verified on Lokal.</p>
          
          <p><strong>You can now publish your store:</strong></p>
          <ol>
            <li>Go to your merchant dashboard at <a href="${merchantDashboardUrl}">${merchantDashboardUrl}</a></li>
            <li>Click the <strong>Publish</strong> button on your store</li>
            <li>Your store will be live and visible to customers across the Lokal platform!</li>
          </ol>
          
          <p><strong>What this means:</strong></p>
          <ul>
            <li>✅ Customers can now find and order from your store</li>
            <li>✅ Your store will display a verification badge</li>
            <li>✅ Customers know your store has been reviewed by our team</li>
          </ul>
          
          ${notes}
          
          <p>Questions? Reply to this email or contact us at helplokal@gmail.com</p>
          <p><a href="${merchantDashboardUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:8px;display:inline-block">Go to Dashboard</a></p>
        `;
      } else {
        subject = `Store verification request - Not approved`;
        html = `
          <h2>Your store verification request was ${decisionTitle}</h2>
          <p><strong>Business:</strong> ${requestRow.business_name}</p>
          <p><strong>Owner:</strong> ${requestRow.owner_name}</p>
          <p><strong>Status:</strong> ${decision}</p>
          ${notes}
          <p>You can submit another verification request after addressing the feedback above.</p>
          <p><a href="https://lokalshops.co.uk/">Open Lokal</a></p>
        `;
      }

      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: emailFrom, name: "Lokal" },
          to: [{ email: requesterEmail }],
          subject: subject,
          htmlContent: html,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: payload.request_id,
        action: payload.action,
        requester_email: requesterEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
