export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  store_id: string;
  owner_id: string;
  week_start: string;
  week_end: string;
};

type RatingRow = {
  rating: number;
  created_at: string;
};

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

function summarizeRatings(rows: RatingRow[]) {
  const ratingCount = rows.length;
  if (ratingCount === 0) {
    return {
      ratingCount,
      avgRating: null as number | null,
      lowRatingCount: 0,
      highRatingCount: 0,
    };
  }

  let sum = 0;
  let low = 0;
  let high = 0;
  for (const row of rows) {
    const r = Number(row.rating) || 0;
    sum += r;
    if (r <= 2) low += 1;
    if (r >= 4) high += 1;
  }

  return {
    ratingCount,
    avgRating: Number((sum / ratingCount).toFixed(2)),
    lowRatingCount: low,
    highRatingCount: high,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;

    if (!payload?.store_id || !payload?.owner_id || !payload?.week_start || !payload?.week_end) {
      return new Response(JSON.stringify({ error: "Missing required payload fields" }), {
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

    if (!brevoKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "BREVO_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const storeRes = await fetchJson(
      `${supabaseUrl}/rest/v1/stores?id=eq.${payload.store_id}&select=id,name,owner_id,rating_digest_opt_in`,
      { headers: adminHeaders },
    );

    if (!storeRes.ok || !Array.isArray(storeRes.data) || storeRes.data.length === 0) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const store = storeRes.data[0] as {
      id: string;
      name: string;
      owner_id: string;
      rating_digest_opt_in: boolean;
    };

    if (!store.rating_digest_opt_in) {
      return new Response(JSON.stringify({ skipped: true, reason: "Store not opted in" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [reviewsRes, staffReviewsRes] = await Promise.all([
      fetchJson(
        `${supabaseUrl}/rest/v1/reviews?store_id=eq.${payload.store_id}&created_at=gte.${payload.week_start}&created_at=lt.${payload.week_end}&select=rating,created_at`,
        { headers: adminHeaders },
      ),
      fetchJson(
        `${supabaseUrl}/rest/v1/staff_reviews?store_id=eq.${payload.store_id}&created_at=gte.${payload.week_start}&created_at=lt.${payload.week_end}&select=rating,created_at`,
        { headers: adminHeaders },
      ),
    ]);

    const mergedRatings = [
      ...((reviewsRes.data ?? []) as RatingRow[]),
      ...((staffReviewsRes.data ?? []) as RatingRow[]),
    ];

    const stats = summarizeRatings(mergedRatings);
    if (stats.ratingCount === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No new ratings this week" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerRes = await fetchJson(`${supabaseUrl}/auth/v1/admin/users/${payload.owner_id}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    const ownerEmail =
      (ownerRes.data?.email as string | undefined) ??
      (ownerRes.data?.user?.email as string | undefined) ??
      null;

    if (!ownerEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "Owner email not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekStartDate = new Date(payload.week_start);
    const weekEndDate = new Date(payload.week_end);
    const dateLabel = `${weekStartDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    })} - ${weekEndDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;

    const html = `
      <h2>Your weekly rating digest for ${store.name}</h2>
      <p>Period: <strong>${dateLabel}</strong></p>
      <ul>
        <li><strong>${stats.ratingCount}</strong> new rating${stats.ratingCount === 1 ? "" : "s"}</li>
        <li><strong>${stats.avgRating?.toFixed(2) ?? "-"}</strong> average rating</li>
        <li><strong>${stats.highRatingCount}</strong> positive rating${stats.highRatingCount === 1 ? "" : "s"} (4-5 stars)</li>
        <li><strong>${stats.lowRatingCount}</strong> low rating${stats.lowRatingCount === 1 ? "" : "s"} (1-2 stars)</li>
      </ul>
      <p><a href="${merchantDashboardUrl}">Open merchant dashboard</a></p>
    `;

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: emailFrom, name: "Lokal" },
        to: [{ email: ownerEmail }],
        subject: `${store.name}: weekly ratings digest`,
        htmlContent: html,
      }),
    });

    if (!emailRes.ok) {
      return new Response(
        JSON.stringify({ sent: false, status: emailRes.status, body: await emailRes.text() }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const logRes = await fetchJson(`${supabaseUrl}/rest/v1/merchant_rating_digest_log`, {
      method: "POST",
      headers: {
        ...adminHeaders,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        store_id: payload.store_id,
        week_start: payload.week_start,
        week_end: payload.week_end,
        sent_to: ownerEmail,
        rating_count: stats.ratingCount,
        avg_rating: stats.avgRating,
        low_rating_count: stats.lowRatingCount,
        high_rating_count: stats.highRatingCount,
      }),
    });

    return new Response(
      JSON.stringify({
        sent: true,
        logged: logRes.ok,
        stats,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ sent: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
