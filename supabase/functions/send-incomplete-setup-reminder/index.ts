export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const brevoKey = Deno.env.get("BREVO_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  days_since_creation?: number;
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const daysSinceCreation = body.days_since_creation || 3;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get cutoff date (3 days ago by default)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceCreation);
    const cutoffIso = cutoffDate.toISOString();

    // Find incomplete stores (created but not published, or published but no products)
    const { data: incompleteStores, error: storesError } = await supabase
      .from("stores")
      .select(
        "id, name, created_at, published, owner_id, store_products(id), store_verification_requests(id,status)"
      )
      .eq("published", false)
      .lt("created_at", cutoffIso);

    if (storesError) {
      return new Response(JSON.stringify({ error: storesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!incompleteStores || incompleteStores.length === 0) {
      return new Response(
        JSON.stringify({ message: "No incomplete stores found", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner emails for each store
    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    for (const store of incompleteStores) {
      try {
        // Get owner email
        const ownerRes = await fetchJson(
          `${supabaseUrl}/auth/v1/admin/users/${store.owner_id}`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );

        if (!ownerRes.ok) continue;
        const ownerEmail = ownerRes.data?.email ?? null;
        if (!ownerEmail) continue;

        // Determine what's missing
        const hasProducts =
          Array.isArray(store.store_products) && store.store_products.length > 0;
        const hasVerificationRequest =
          Array.isArray(store.store_verification_requests) &&
          store.store_verification_requests.length > 0;
        const isVerified = hasVerificationRequest &&
          store.store_verification_requests.some((v: any) => v.status === "approved");

        const missingItems: string[] = [];
        if (!hasProducts) missingItems.push("products or services");
        if (!hasVerificationRequest) missingItems.push("verification submission");
        if (hasVerificationRequest && !isVerified)
          missingItems.push("verification approval");

        const missingText = missingItems.join(" and ");

        // Send email
        if (brevoKey) {
          const emailFrom = Deno.env.get("BREVO_EMAIL_FROM") ??
            "noreply@lokalshops.co.uk";

          const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Lokal", email: emailFrom },
              to: [{ email: ownerEmail }],
              subject: `Complete your Lokal store setup: ${store.name}`,
              htmlContent: `
                <h2>Complete your store setup on Lokal</h2>
                <p>Hi there,</p>
                <p>Your store <strong>${store.name}</strong> has been created on Lokal, but it's not yet published. To go live and start receiving orders, you need to complete:</p>
                <ul>
                  ${missingItems
                    .map((item) => `<li>${item}</li>`)
                    .join("")}
                </ul>
                <p style="margin-top: 20px;">
                  <a href="https://lokalshops.co.uk/merchant" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Complete Setup
                  </a>
                </p>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                  Questions? <a href="https://lokalshops.co.uk/help">Visit our help center</a>
                </p>
              `,
            }),
          });

          if (brevoRes.ok) {
            emailsSent.push(ownerEmail);
          } else {
            emailsFailed.push(ownerEmail);
          }
        }
      } catch (err) {
        emailsFailed.push(`Error processing store ${store.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Reminder emails processed",
        totalIncomplete: incompleteStores.length,
        emailsSent: emailsSent.length,
        emailsFailed: emailsFailed.length,
        sentTo: emailsSent,
        failedFor: emailsFailed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
