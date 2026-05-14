export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["enochaseks@yahoo.co.uk", "enochaseks@gmail.com"];

type VerificationRequestRow = {
  id: string;
  store_id: string;
  status: "pending" | "approved" | "rejected";
  business_name: string;
  owner_name: string;
  verification_method?: "registration_number" | "online_presence" | "manual_review";
  online_presence_url?: string | null;
  business_registration_number?: string | null;
  manual_review_details?: string | null;
  supporting_links?: string | null;
  is_tattoo_verification?: boolean | null;
  tattoo_minimum_age?: number | null;
  tattoo_portfolio_url?: string | null;
  tattoo_license_url?: string | null;
  tattoo_age_restriction_acknowledged?: boolean | null;
  submission_reason?: string | null;
  submitted_at: string;
  admin_notes?: string | null;
  store_category?: string | null;
  store_subcategory?: string | null;
};

type ReviewNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  store_id: string;
  recipient_role: "admin" | "merchant";
  is_read: boolean;
  created_at: string;
};

function authBearer(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`,
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = String(userRes.data?.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    let requests: VerificationRequestRow[] = [];
    const requestsFull = await fetchJson(
      `${supabaseUrl}/rest/v1/store_verification_requests?select=id,store_id,status,business_name,owner_name,verification_method,online_presence_url,business_registration_number,manual_review_details,supporting_links,is_tattoo_verification,tattoo_minimum_age,tattoo_portfolio_url,tattoo_license_url,tattoo_age_restriction_acknowledged,submission_reason,submitted_at,admin_notes&order=submitted_at.desc`,
      adminHeaders,
    );

    if (requestsFull.ok) {
      requests = (requestsFull.data ?? []) as VerificationRequestRow[];
    } else {
      const requestsFallback = await fetchJson(
        `${supabaseUrl}/rest/v1/store_verification_requests?select=id,store_id,status,business_name,owner_name,submitted_at,admin_notes&order=submitted_at.desc`,
        adminHeaders,
      );
      if (!requestsFallback.ok) {
        return new Response(
          JSON.stringify({
            error: "Could not load verification requests",
            details: requestsFallback.data,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      requests = (requestsFallback.data ?? []) as VerificationRequestRow[];
    }

    const storeIds = Array.from(new Set(requests.map((r) => r.store_id).filter(Boolean)));
    const storeMetaById: Record<
      string,
      { name: string; category: string | null; subcategory: string | null }
    > = {};
    if (storeIds.length > 0) {
      const storesRes = await fetchJson(
        `${supabaseUrl}/rest/v1/stores?select=id,name,category,subcategory&id=in.(${storeIds.join(",")})`,
        adminHeaders,
      );
      if (storesRes.ok) {
        for (const row of (storesRes.data ?? []) as Array<{
          id: string;
          name: string;
          category: string | null;
          subcategory: string | null;
        }>) {
          storeMetaById[row.id] = {
            name: row.name,
            category: row.category ?? null,
            subcategory: row.subcategory ?? null,
          };
        }
      }
    }

    const mappedRequests = requests.map((reqRow) => ({
      ...reqRow,
      store_name: storeMetaById[reqRow.store_id]?.name ?? "Unknown Store",
      store_category: storeMetaById[reqRow.store_id]?.category ?? null,
      store_subcategory: storeMetaById[reqRow.store_id]?.subcategory ?? null,
    }));

    let notifications: ReviewNotificationRow[] = [];
    const notificationsRes = await fetchJson(
      `${supabaseUrl}/rest/v1/review_notifications?select=id,title,body,store_id,recipient_role,is_read,created_at&recipient_role=eq.admin&order=created_at.desc&limit=10`,
      adminHeaders,
    );

    if (notificationsRes.ok) {
      notifications = (notificationsRes.data ?? []) as ReviewNotificationRow[];
    } else if (notificationsRes.status !== 404) {
      return new Response(
        JSON.stringify({ error: "Could not load notifications", details: notificationsRes.data }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const mappedNotifications = notifications.map((row) => ({
      ...row,
      stores: { name: storeMetaById[row.store_id]?.name ?? "Unknown store" },
    }));

    return new Response(
      JSON.stringify({ requests: mappedRequests, notifications: mappedNotifications }),
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
