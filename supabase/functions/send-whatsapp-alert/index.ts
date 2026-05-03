const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertPayload = {
  reference: string;
  total_gbp: number;
  customer_name: string;
  customer_phone: string;
  merchant_phone: string;
  store_name: string;
  items: Array<{ name: string; qty: number; unit?: string }>;
};

function toE164(raw: string): string | null {
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : `+${digits}`;
}

function buildMessageBody(payload: AlertPayload): string {
  const itemCount = payload.items.reduce((acc, item) => acc + item.qty, 0);
  const itemSummary = payload.items.slice(0, 3)
    .map((item) => `${item.qty}x ${item.name}`)
    .join(", ");
  const moreItems = payload.items.length > 3 ? ` +${payload.items.length - 3} more` : "";

  return [
    `New Lokal order: ${payload.reference}`,
    `Store: ${payload.store_name}`,
    `Customer: ${payload.customer_name} (${payload.customer_phone})`,
    `Items: ${itemCount} total${itemSummary ? ` (${itemSummary}${moreItems})` : ""}`,
    `Total: GBP ${Number(payload.total_gbp).toFixed(2)}`,
    "Open merchant dashboard to confirm payment.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as AlertPayload;

    const merchantPhone = toE164(payload.merchant_phone ?? "");
    if (!merchantPhone) {
      return new Response(JSON.stringify({ skipped: true, reason: "merchant phone missing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!sid || !token || !from) {
      return new Response(JSON.stringify({ skipped: true, reason: "twilio env not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentSid = Deno.env.get("TWILIO_WHATSAPP_CONTENT_SID");
    const body = buildMessageBody(payload);

    const formData = new URLSearchParams();
    formData.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
    formData.set("To", `whatsapp:${merchantPhone}`);

    // If template SID is configured, use template mode for production-safe business-initiated messages.
    if (contentSid) {
      formData.set("ContentSid", contentSid);
      formData.set("ContentVariables", JSON.stringify({
        1: payload.store_name,
        2: payload.reference,
        3: Number(payload.total_gbp).toFixed(2),
        4: payload.customer_name,
        5: payload.customer_phone,
      }));
    } else {
      formData.set("Body", body);
    }

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioText = await twilioRes.text();
    if (!twilioRes.ok) {
      return new Response(JSON.stringify({ sent: false, error: twilioText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, result: twilioText }), {
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
