import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Phone, Landmark, Copy, Check, ArrowLeft, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import type { Store } from "@/data/stores";

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRY_OPTIONS = getCountries()
  .map((country) => {
    const code = getCountryCallingCode(country);
    const name = regionNames?.of(country) ?? country;
    return {
      value: country,
      label: `${name} (+${code})`,
      code,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

function makeRef() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return "LKL-" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 6);
}

function normalizePhoneForAlerts(raw: string, country: CountryCode): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const countryCode = getCountryCallingCode(country);

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;

  // If user pasted an international number but forgot "+", accept as-is.
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 6 && digits.length <= 15) {
    return `+${digits}`;
  }

  const localDigits = digits.replace(/^0+/, "");
  if (!localDigits) return null;
  if (localDigits.length < 6 || localDigits.length > 14) return null;
  return `+${countryCode}${localDigits}`;
}

export function StoreDialog({ store, open, onOpenChange }: { store: Store | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<"browse" | "arrange" | "transfer">("browse");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState<CountryCode>("GB");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(() => makeRef());
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [msgName, setMsgName] = useState("");
  const [msgPhone, setMsgPhone] = useState("");
  const [msgCountryCode, setMsgCountryCode] = useState<CountryCode>("GB");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Reviews
  type ReviewRow = { id: string; reviewer_name: string; rating: number; body: string | null; created_at: string };
  const [storeReviews, setStoreReviews] = useState<ReviewRow[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewName, setReviewName] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!open || !store) return;
    (supabase as any)
      .from("reviews")
      .select("id, reviewer_name, rating, body, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: ReviewRow[] | null }) => {
        setStoreReviews(data ?? []);
      });
  }, [open, store?.id]);

  if (!store) return null;


  const items = store.products.map((p) => ({ ...p, qty: qty[p.name] ?? 0 }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasItems = total > 0;

  const reset = () => {
    setStep("browse");
    setQty({});
    setName("");
    setPhone("");
    setPhoneCountryCode("GB");
    setEmail("");
    setNote("");
    setReference(makeRef());
    setShowMsgForm(false);
    setMsgName(""); setMsgPhone(""); setMsgCountryCode("GB"); setMsgBody("");
    setShowReviewForm(false);
    setReviewRating(0); setReviewName(""); setReviewBody("");
  };

  const handleConfirmTransfer = async () => {
    const normalizedPhone = normalizePhoneForAlerts(phone, phoneCountryCode);
    if (!normalizedPhone) {
      toast.error("Enter phone in international format", {
        description: "Choose a country and enter your local mobile number.",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("orders").insert({
        store_id: store.id,
        reference,
        customer_name: name.trim(),
        customer_phone: normalizedPhone,
        customer_email: email.trim() || null,
        note: note.trim() || null,
        items: items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, price: i.price, qty: i.qty, unit: i.unit })),
        total_gbp: total,
        status: "pending_transfer",
      });
      if (error) throw error;

      // Fire-and-forget email alert to merchant.
      void supabase.functions.invoke("send-whatsapp-alert", {
        body: {
          reference,
          total_gbp: total,
          customer_name: name.trim(),
          store_name: store.name,
          store_id: store.id,
          items: items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("send-order-alert failed", fnError.message);
        }
      });

      toast.success("Order placed!", {
        description: `Track it at lokalshops.co.uk/order using reference ${reference}`,
        duration: 8000,
      });
      onOpenChange(false);
      setTimeout(reset, 200);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save your order");
    } finally {
      setSaving(false);
    }
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSendMsg = async () => {
    const normalizedMsgPhone = normalizePhoneForAlerts(msgPhone, msgCountryCode);
    if (!normalizedMsgPhone) {
      toast.error("Enter phone in international format", {
        description: "Choose a country and enter your local mobile number.",
      });
      return;
    }

    setSendingMsg(true);
    try {
      const { error } = await (supabase as any).from("messages").insert({
        store_id: store.id,
        customer_name: msgName.trim(),
        customer_phone: normalizedMsgPhone,
        body: msgBody.trim(),
        direction: "inbound",
      });
      if (error) throw error;
      toast.success("Enquiry sent!", { description: `${store.name} will reply to you on WhatsApp or by phone.` });
      setShowMsgForm(false);
      setMsgName(""); setMsgPhone(""); setMsgBody("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not send message");
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const { error, data } = await (supabase as any).from("reviews").insert({
        store_id: store.id,
        reviewer_name: reviewName.trim(),
        rating: reviewRating,
        body: reviewBody.trim() || null,
      }).select("id, reviewer_name, rating, body, created_at").single();
      if (error) throw error;
      setStoreReviews([data, ...storeReviews]);

      // Fire-and-forget merchant email alert for the new review.
      void supabase.functions.invoke("send-review-alert", {
        body: {
          store_id: store.id,
          store_name: store.name,
          reviewer_name: reviewName.trim(),
          rating: reviewRating,
          body: reviewBody.trim() || null,
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("send-review-alert failed", fnError.message);
        }
      });

      setShowReviewForm(false);
      setReviewRating(0); setReviewName(""); setReviewBody("");
      toast.success("Review submitted — thanks!");
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <div className="relative h-56 overflow-hidden rounded-t-lg">
          <img src={store.image} alt={store.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.origin}</span>
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.category}</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-3xl">{store.name}</DialogTitle>
            <DialogDescription className="text-base">{store.description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{store.city || store.address || "Location on request"}</span></div>
            <div className="flex items-start gap-2 rounded-lg bg-background/70 px-3 py-2 text-foreground shadow-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0" /><span className="font-medium leading-5">{store.hours}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="truncate">{store.phone}</span></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(store.fulfillment === "collection" || store.fulfillment === "both") && (
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🏪 Collection available</span>
            )}
            {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">🚚 Delivery available</span>
            )}
          </div>

          {step === "browse" && (
            <>
              <h4 className="mt-6 font-display text-xl font-bold">Available products</h4>
              <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                {store.products.map((p) => {
                  const q = qty[p.name] ?? 0;
                  return (
                    <div key={p.name} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-muted-foreground">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: Math.max(0, q - 1) })}>−</Button>
                        <span className="w-6 text-center font-semibold">{q}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: q + 1 })}>+</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Message store */}
              <div className="mt-5">
                {!showMsgForm ? (
                  <button
                    onClick={() => setShowMsgForm(true)}
                    className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    💬 Have a question? Send {store.name} an enquiry
                  </button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                    <p className="text-sm font-semibold">Send an enquiry to {store.name}</p>
                    <p className="text-xs text-muted-foreground">They'll reply to you on WhatsApp or by phone.</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Your name</label>
                      <Input value={msgName} onChange={(e) => setMsgName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Your WhatsApp / phone</label>
                      <div className="mt-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5 sm:col-span-4">
                          <Select value={msgCountryCode} onValueChange={(v) => setMsgCountryCode(v as CountryCode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-7 sm:col-span-8">
                          <Input value={msgPhone} onChange={(e) => setMsgPhone(e.target.value)} placeholder="Local number" />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Pick your country, then enter your local number. You can also paste full international format (+...).</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Message</label>
                      <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Do you have plantain available today?" rows={3} className="mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowMsgForm(false)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={!msgName.trim() || !msgPhone.trim() || !msgBody.trim() || sendingMsg}
                        onClick={handleSendMsg}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send enquiry"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

          {/* Reviews section */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-bold">
                {storeReviews.length > 0
                  ? `Reviews (${storeReviews.length})`
                  : "No reviews yet"}
              </h4>
              {!showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Write a review
                </button>
              )}
            </div>

            {showReviewForm && (
              <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">Your review for {store.name}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setReviewHover(n)}
                      onMouseLeave={() => setReviewHover(0)}
                      onClick={() => setReviewRating(n)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          n <= (reviewHover || reviewRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="ml-2 self-center text-sm text-muted-foreground">
                      {["", "Poor", "Fair", "Good", "Very good", "Excellent"][reviewRating]}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Your name</label>
                  <Input value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comment (optional)</label>
                  <Textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Great selection and fast response..." rows={3} className="mt-1" maxLength={500} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewName(""); setReviewBody(""); }}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!reviewName.trim() || reviewRating === 0 || submittingReview}
                    onClick={handleSubmitReview}
                  >
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
                  </Button>
                </div>
              </div>
            )}

            {storeReviews.length > 0 && (
              <div className="mt-3 space-y-3">
                {storeReviews.map((rv) => (
                  <div key={rv.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{rv.reviewer_name}</span>
                      <span className="flex items-center gap-0.5 text-amber-500 text-xs">
                        {Array.from({ length: rv.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400" />
                        ))}
                      </span>
                    </div>
                    {rv.body && <p className="mt-1 text-sm text-muted-foreground">{rv.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground/60">{new Date(rv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

              <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="font-display text-2xl font-bold">£{total.toFixed(2)}</div>
                </div>
                <Button
                  size="lg"
                  disabled={!hasItems}
                  onClick={() => setStep("arrange")}
                  className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                >
                  Arrange order →
                </Button>
              </div>
            </>
          )}

          {step === "arrange" && (
            <>
              <button onClick={() => setStep("browse")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back to products
              </button>
              <h4 className="mt-2 font-display text-xl font-bold">Your details</h4>
              <p className="text-sm text-muted-foreground">The merchant will message you to confirm pickup or local delivery.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <div className="mt-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5 sm:col-span-4">
                      <Select value={phoneCountryCode} onValueChange={(v) => setPhoneCountryCode(v as CountryCode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-7 sm:col-span-8">
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Local number" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email <span className="text-muted-foreground font-normal">(for order updates)</span></label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Note for merchant (optional)</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pickup tomorrow around 5pm?" className="mt-1" />
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm">
                <div className="mb-2 font-semibold">Order summary</div>
                {items.filter((i) => i.qty > 0).map((i) => (
                  <div key={i.name} className="flex justify-between text-muted-foreground">
                    <span>{i.qty} × {i.name}</span>
                    <span>£{(i.price * i.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span><span>£{total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                disabled={!name || !phone || !email}
                onClick={() => setStep("transfer")}
              >
                Continue to bank transfer
              </Button>
            </>
          )}

          {step === "transfer" && (
            <>
              <button onClick={() => setStep("arrange")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <div className="mt-3 rounded-2xl border-2 border-primary/30 bg-gradient-soft p-6 shadow-card">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <Landmark className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Bank transfer only</span>
                </div>
                <h4 className="font-display text-2xl font-bold">Send £{total.toFixed(2)} to {store.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lokal connects you directly with the merchant — no card fees, no middleman. Use the reference below so they can match your order instantly.
                </p>

                <div className="mt-5 space-y-2">
                  {[
                    { label: "Bank", value: store.bank.name },
                    { label: "Account name", value: store.bank.accountName },
                    { label: "Account number", value: store.bank.accountNumber },
                    ...(store.bank.sortCode ? [{ label: "Sort code", value: store.bank.sortCode }] : []),
                    { label: "Reference", value: reference },
                    { label: "Amount", value: `£${total.toFixed(2)}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg bg-card px-4 py-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                        <div className="font-mono font-semibold">{row.value}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copy(row.label, row.value)} className="gap-1.5">
                        {copied === row.label ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                        {copied === row.label ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                disabled={saving}
                onClick={handleConfirmTransfer}
              >
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming…</> : "I've made the transfer"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                After sending, track your order at{" "}
                <a href={`/order?ref=${reference}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
                  lokalshops.co.uk/order
                </a>{" "}
                using reference <span className="font-mono font-bold">{reference}</span>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
