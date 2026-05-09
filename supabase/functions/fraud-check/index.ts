export {};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface FraudCheckRequest {
  user_id: string;
  email: string;
  phone?: string;
  display_name?: string;
  store_name?: string;
  store_category?: string;
  metadata?: Record<string, unknown>;
  entity_type: "user" | "store";
}

// Known bot email domains
const BOT_EMAIL_DOMAINS = [
  "tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com",
  "10minutemail.com", "testing.com", "test.com", "example.com"
];

// Suspicious name patterns
const SUSPICIOUS_PATTERNS = [
  /^user\d+$/i,
  /^test\d*$/i,
  /^admin\d*$/i,
  /^a+$/i,
  /^\d+$/,
  /^[x]{3,}$/i,
  /fake|bot|spam|scam|fake|shop|store|seller/i,
];

function scoreEmail(email: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const domain = email.split("@")[1] || "";
  
  // Check for bot domains
  if (BOT_EMAIL_DOMAINS.includes(domain)) {
    flags.push("disposable_email_domain");
    score += 30;
  }

  // Check for free email domains (lower risk but flag)
  if (["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(domain)) {
    flags.push("free_email_domain");
    score += 5;
  }

  // Check for suspicious email patterns
  if (/^[0-9]{6,}@/i.test(email)) {
    flags.push("numeric_email");
    score += 15;
  }

  if (/^[a-z]+\d{1,3}@/i.test(email)) {
    flags.push("generic_email_pattern");
    score += 10;
  }

  return { score, flags };
}

function scoreDisplayName(name: string | undefined): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (!name || name.trim().length === 0) {
    flags.push("missing_display_name");
    score += 20;
    return { score, flags };
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(name)) {
      flags.push("suspicious_name_pattern");
      score += 25;
      break;
    }
  }

  // Check name length
  if (name.length < 2) {
    flags.push("very_short_name");
    score += 15;
  }

  // Check for all caps (sometimes bot-like)
  if (name === name.toUpperCase() && name.length > 3) {
    flags.push("all_caps_name");
    score += 5;
  }

  // Check for repeated characters
  if (/(.)\1{4,}/.test(name)) {
    flags.push("repeated_characters");
    score += 20;
  }

  return { score, flags };
}

function scorePhone(phone: string | undefined): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (!phone || phone.trim().length === 0) {
    flags.push("missing_phone");
    score += 10;
    return { score, flags };
  }

  const digits = phone.replace(/\D/g, "");

  // Check for suspicious phone patterns
  if (digits.length < 8) {
    flags.push("invalid_phone_length");
    score += 25;
  }

  if (/^0+$/.test(digits)) {
    flags.push("all_zeros_phone");
    score += 30;
  }

  if (/^(\d)\1+$/.test(digits)) {
    flags.push("repeated_digits_phone");
    score += 25;
  }

  if (/^123/.test(digits)) {
    flags.push("sequential_phone");
    score += 20;
  }

  return { score, flags };
}

function scoreStoreName(storeName: string | undefined): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (!storeName || storeName.trim().length === 0) {
    flags.push("missing_store_name");
    score += 15;
    return { score, flags };
  }

  // Check for suspicious store names
  if (/^store\d*$/i.test(storeName)) {
    flags.push("generic_store_name");
    score += 20;
  }

  if (storeName.length < 3) {
    flags.push("very_short_store_name");
    score += 15;
  }

  // Check for all numbers
  if (/^\d+$/.test(storeName)) {
    flags.push("numeric_store_name");
    score += 30;
  }

  return { score, flags };
}

function scoreMetadata(metadata: Record<string, unknown> | undefined): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (!metadata) return { score, flags };

  // Check for missing common metadata fields
  const hasAddress = !!metadata.address;
  const hasDescription = !!metadata.description;
  
  if (!hasAddress) {
    flags.push("missing_address");
    score += 10;
  }

  if (!hasDescription) {
    flags.push("missing_description");
    score += 5;
  }

  // Check for suspicious metadata values
  if (typeof metadata.description === "string" && metadata.description.length < 10) {
    flags.push("very_short_description");
    score += 10;
  }

  return { score, flags };
}

async function scoreFraudRisk(req: FraudCheckRequest): Promise<{
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  fraud_flags: string[];
}> {
  let totalScore = 0;
  const allFlags: string[] = [];

  // Score email
  const emailScore = scoreEmail(req.email);
  totalScore += emailScore.score;
  allFlags.push(...emailScore.flags);

  // Score display name
  const nameScore = scoreDisplayName(req.display_name);
  totalScore += nameScore.score;
  allFlags.push(...nameScore.flags);

  // Score phone
  const phoneScore = scorePhone(req.phone);
  totalScore += phoneScore.score;
  allFlags.push(...phoneScore.flags);

  // Score store name if applicable
  if (req.entity_type === "store") {
    const storeScore = scoreStoreName(req.store_name);
    totalScore += storeScore.score;
    allFlags.push(...storeScore.flags);
  }

  // Score metadata
  const metadataScore = scoreMetadata(req.metadata);
  totalScore += metadataScore.score;
  allFlags.push(...metadataScore.flags);

  // Cap score at 100
  const risk_score = Math.min(totalScore, 100);

  let risk_level: "low" | "medium" | "high" = "low";
  if (risk_score >= 60) risk_level = "high";
  else if (risk_score >= 30) risk_level = "medium";

  return {
    risk_score,
    risk_level,
    fraud_flags: [...new Set(allFlags)], // Remove duplicates
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: FraudCheckRequest = await req.json();
    const { user_id, email, phone, display_name, store_name, store_category, metadata, entity_type } = body;

    if (!user_id || !email || !entity_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score the fraud risk
    const fraudScore = await scoreFraudRisk({
      user_id,
      email,
      phone,
      display_name,
      store_name,
      store_category,
      metadata,
      entity_type,
    });

    // Insert into profile_risk_scores
    const { data: riskRecord, error: insertError } = await supabase
      .from("profile_risk_scores")
      .insert({
        user_id,
        risk_score: fraudScore.risk_score,
        risk_level: fraudScore.risk_level,
        fraud_flags: fraudScore.fraud_flags,
        status: fraudScore.risk_level === "high" ? "pending" : "approved",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Risk score insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to score profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If high risk, add to review queue
    if (fraudScore.risk_level === "high" && riskRecord) {
      const storeId = entity_type === "store" ? user_id : null; // Simplification; in real app, track actual store_id
      
      await supabase
        .from("fraud_review_queue")
        .insert({
          risk_score_id: riskRecord.id,
          entity_type,
          entity_id: user_id,
          user_id,
          risk_score: fraudScore.risk_score,
          fraud_flags: fraudScore.fraud_flags,
          reason: `High fraud risk detected: ${fraudScore.fraud_flags.join(", ")}`,
          status: "pending",
        });
    }

    // Log activity
    await supabase
      .from("fraud_activity_log")
      .insert({
        user_id,
        activity_type: `${entity_type}_created`,
        entity_type,
        entity_id: user_id,
        risk_flags: fraudScore.fraud_flags,
        metadata: { risk_score: fraudScore.risk_score, risk_level: fraudScore.risk_level },
      });

    return new Response(
      JSON.stringify({
        risk_score: fraudScore.risk_score,
        risk_level: fraudScore.risk_level,
        fraud_flags: fraudScore.fraud_flags,
        status: fraudScore.risk_level === "high" ? "flagged_for_review" : "approved",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fraud check error:", error);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
