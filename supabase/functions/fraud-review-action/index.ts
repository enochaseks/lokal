export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReviewActionRequest {
  review_id: string;
  action: "approve" | "reject" | "block";
  admin_id: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const body: ReviewActionRequest = await req.json();
    const { review_id, action, admin_id } = body;

    if (!review_id || !action || !admin_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get the review
    const { data: review, error: reviewErr } = await supabase
      .from("fraud_review_queue")
      .select("*")
      .eq("id", review_id)
      .single();

    if (reviewErr || !review) {
      return new Response(JSON.stringify({ error: "Review not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Handle approve action
    if (action === "approve") {
      // Update review status
      await supabase
        .from("fraud_review_queue")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review_id);

      // Update risk score status
      await supabase
        .from("profile_risk_scores")
        .update({
          status: "approved",
          reviewed_by: admin_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.risk_score_id);

      return new Response(JSON.stringify({ success: true, message: "Store approved" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Handle reject action (delete store)
    if (action === "reject") {
      // Delete associated products and staff first (FK constraints)
      if (review.entity_type === "store") {
        await supabase.from("store_products").delete().eq("store_id", review.entity_id);

        await supabase.from("store_staff").delete().eq("store_id", review.entity_id);

        await supabase.from("store_availability").delete().eq("store_id", review.entity_id);

        // Delete the store
        await supabase.from("stores").delete().eq("id", review.entity_id);
      }

      // Update review and risk score
      await supabase
        .from("fraud_review_queue")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review_id);

      await supabase
        .from("profile_risk_scores")
        .update({
          status: "rejected",
          reviewed_by: admin_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.risk_score_id);

      return new Response(
        JSON.stringify({ success: true, message: "Store rejected and deleted" }),
        { status: 200, headers: corsHeaders },
      );
    }

    // Handle block action (block user, delete all their stores)
    if (action === "block") {
      // Get all stores owned by this user
      const { data: userStores } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", review.user_id);

      // Delete all their stores and related data
      if (userStores && userStores.length > 0) {
        const storeIds = userStores.map((s) => s.id);

        // Delete products, staff, availability for all stores
        await supabase.from("store_products").delete().in("store_id", storeIds);

        await supabase.from("store_staff").delete().in("store_id", storeIds);

        await supabase.from("store_availability").delete().in("store_id", storeIds);

        // Delete stores
        await supabase.from("stores").delete().in("id", storeIds);
      }

      // Mark user as blocked in profile_risk_scores
      await supabase
        .from("profile_risk_scores")
        .update({
          status: "blocked",
          reviewed_by: admin_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", review.user_id);

      // Update review
      await supabase
        .from("fraud_review_queue")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review_id);

      // Log activity
      await supabase.from("fraud_activity_log").insert({
        user_id: review.user_id,
        activity_type: "user_blocked",
        entity_type: "user",
        entity_id: review.user_id,
        risk_flags: review.fraud_flags,
        metadata: {
          admin_id,
          reason: "admin_blocked_user",
          review_id,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "User blocked and stores deleted" }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("Error processing fraud review action:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
