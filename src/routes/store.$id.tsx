import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Globe, Copy, Check, Loader2 } from "lucide-react";
import whatsappLogo from "@/assets/WhatsApp_icon.png";
import facebookLogo from "@/assets/Facebook_Logo_2023.png";
import xLogo from "@/assets/X_icon.svg.png";
import instagramLogo from "@/assets/Instagram_logo_2016.svg.png";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BOOKABLE_CATEGORIES } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import { buildInstagramUrl, buildTikTokUrl, getImageUrl, normalizeWebsiteUrl } from "@/lib/utils";
import { toast } from "sonner";

type ProductRow = {
  name: string;
  price: number;
  unit: string | null;
  position: number;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_bookings_per_slot: number;
};

type StoreDetails = {
  id: string;
  name: string;
  category: string;
  origin: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  hours: string | null;
  phone: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  website_url: string | null;
  image_url: string | null;
  fulfillment: string;
  published: boolean;
  store_products: ProductRow[] | null;
  store_availability: AvailabilityRow[] | null;
};

const isBookable = (category: string) => (BOOKABLE_CATEGORIES as readonly string[]).includes(category);

function makeRef() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return "LKL-" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 6);
}

function generateTimeSlots(startTime: string, endTime: string, durationMins: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  while (minutes + durationMins <= endMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    minutes += durationMins;
  }
  return slots;
}

export const Route = createFileRoute("/store/$id")({
  component: StoreDetail,
  head: (props) => {
    const store = (props.loaderData as StoreDetails | undefined);
    const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
    const shareUrl = `${domain}/store/${props.params.id}`;
    
    return {
      meta: store ? [
        { title: `${store.name} · Lokal` },
        { name: "description", content: store.description || `Visit ${store.name} on Lokal` },
        { property: "og:title", content: store.name },
        { property: "og:description", content: store.description || `${store.category} on Lokal` },
        { property: "og:type", content: "business.business" },
        { property: "og:url", content: shareUrl },
        ...(store.image_url ? [{ property: "og:image", content: getImageUrl(store.image_url) || "" }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: store.name },
        { name: "twitter:description", content: store.description || `${store.category} on Lokal` },
      ] : [],
    };
  },
  loader: async ({ params }) => {
    const { data, error } = await (supabase as any)
      .from("stores")
      .select("*, store_products(name,price,unit,position), store_availability(day_of_week,start_time,end_time,slot_duration_mins,max_bookings_per_slot)")
      .eq("id", params.id)
      .limit(1);

    if (error) {
      throw new Error(`Error loading store: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("Store not found");
    }

    return data[0] as unknown as StoreDetails;
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This store is either not available or has been removed.</p>
          <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Browse stores
          </a>
        </div>
      </div>
    </div>
  ),
});

function StoreDetail() {
  const store = Route.useLoaderData() as StoreDetails;
  const [copied, setCopied] = useState(false);
  const [reference, setReference] = useState(() => makeRef());

  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [bookService, setBookService] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookNote, setBookNote] = useState("");
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
  const shareUrl = `${domain}/store/${store.id}`;
  const shareText = `Check out ${store.name} on Lokal!`;
  const websiteHref = normalizeWebsiteUrl(store.website_url);
  const instagramHref = buildInstagramUrl(store.instagram_handle);
  const tiktokHref = buildTikTokUrl(store.tiktok_handle);
  const products = [...(store.store_products ?? [])].sort((a, b) => a.position - b.position);
  const availableDays = [...(store.store_availability ?? [])].sort((a, b) => a.day_of_week - b.day_of_week);

  const cartItems = products
    .map((p) => ({ ...p, qty: qty[p.name] ?? 0 }))
    .filter((p) => p.qty > 0);
  const orderTotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  const selectedDayAvailability = (() => {
    if (!bookDate) return null;
    const [y, m, d] = bookDate.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return availableDays.find((a) => a.day_of_week === day) ?? null;
  })();

  const freeSlots = selectedDayAvailability
    ? generateTimeSlots(
        selectedDayAvailability.start_time.slice(0, 5),
        selectedDayAvailability.end_time.slice(0, 5),
        selectedDayAvailability.slot_duration_mins,
      ).filter((slot) => (slotCounts[slot] ?? 0) < (selectedDayAvailability.max_bookings_per_slot ?? 1))
    : [];

  useEffect(() => {
    if (!bookDate) {
      setSlotCounts({});
      setBookTime("");
      return;
    }

    setLoadingSlots(true);
    (supabase as any)
      .from("store_bookings")
      .select("slot_start")
      .eq("store_id", store.id)
      .neq("status", "cancelled")
      .gte("slot_start", `${bookDate}T00:00:00`)
      .lte("slot_start", `${bookDate}T23:59:59`)
      .then(({ data }: { data: Array<{ slot_start: string }> | null }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r) => {
          const time = r.slot_start.slice(11, 16);
          counts[time] = (counts[time] ?? 0) + 1;
        });
        setSlotCounts(counts);
        setBookTime("");
        setLoadingSlots(false);
      })
      .catch(() => {
        setSlotCounts({});
        setLoadingSlots(false);
      });
  }, [bookDate, store.id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Check out ${store.name} on Lokal - ${shareUrl}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleShareInstagram = () => {
    toast("Copy the link and share it in your Instagram Story or Direct Message", { icon: "ℹ️" });
    navigator.clipboard.writeText(shareUrl);
  };

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      "_blank",
      "width=550,height=420"
    );
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    setPlacingOrder(true);
    try {
      const { error } = await (supabase as any).from("orders").insert({
        store_id: store.id,
        reference,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: null,
        note: orderNote.trim() || null,
        items: cartItems.map((item) => ({ name: item.name, price: item.price, qty: item.qty, unit: item.unit ?? undefined })),
        total_gbp: orderTotal,
        status: "pending_transfer",
      });
      if (error) throw error;

      toast.success("Order placed", {
        description: `Reference ${reference}. The merchant will confirm next steps.`,
        duration: 8000,
      });

      setQty({});
      setCustomerName("");
      setCustomerPhone("");
      setOrderNote("");
      setReference(makeRef());
    } catch (e: any) {
      toast.error(e.message ?? "Could not place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleBook = async () => {
    if (!bookDate || !bookTime || !bookName.trim() || !bookPhone.trim()) {
      toast.error("Please fill in all required booking fields");
      return;
    }
    if (!selectedDayAvailability) {
      toast.error("No availability on this day");
      return;
    }

    const duration = selectedDayAvailability.slot_duration_mins;
    const [th, tm] = bookTime.split(":").map(Number);
    const endMins = th * 60 + tm + duration;
    const slotEnd = `${bookDate}T${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}:00`;

    setSubmittingBooking(true);
    try {
      const { error } = await (supabase as any).from("store_bookings").insert({
        store_id: store.id,
        customer_name: bookName.trim(),
        customer_phone: bookPhone.trim(),
        service: bookService || null,
        slot_start: `${bookDate}T${bookTime}:00`,
        slot_end: slotEnd,
        status: "pending",
        note: bookNote.trim() || null,
      });
      if (error) throw error;

      toast.success("Booking request sent", {
        description: `${store.name} will confirm your appointment soon.`,
        duration: 8000,
      });

      setBookService("");
      setBookDate("");
      setBookTime("");
      setBookName("");
      setBookPhone("");
      setBookNote("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not request booking");
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Store image */}
          {store.image_url && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              <img
                src={getImageUrl(store.image_url) || ""}
                alt={store.name}
                className="h-64 w-full object-cover sm:h-96"
              />
            </div>
          )}

          {/* Header with share buttons */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold">{store.name}</h1>
              {store.description && <p className="mt-2 text-lg text-muted-foreground">{store.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{store.category}</span>
                {store.origin && <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{store.origin}</span>}
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-col gap-2 sm:min-w-48">
              <Button
                onClick={handleCopyLink}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <img src={whatsappLogo} alt="WhatsApp" className="h-5 w-5" /> WhatsApp
                </button>
                <button
                  onClick={handleShareFacebook}
                  className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <img src={facebookLogo} alt="Facebook" className="h-5 w-5" /> Facebook
                </button>
                <button
                  onClick={handleShareTwitter}
                  className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <img src={xLogo} alt="X" className="h-5 w-5" /> X
                </button>
                <button
                  onClick={handleShareInstagram}
                  className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  <img src={instagramLogo} alt="Instagram" className="h-5 w-5" /> Instagram
                </button>
              </div>
            </div>
          </div>

          {/* Buy / book section */}
          <div className="mb-8 rounded-2xl border border-border bg-card p-6">
            {isBookable(store.category) ? (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold">Book with this store</h2>
                {products.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Services</p>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {products.map((p) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <span>{p.name}</span>
                          <span className="font-semibold">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableDays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Online booking is not enabled yet. Use phone or social links above.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Service</p>
                      <Input
                        value={bookService}
                        onChange={(e) => setBookService(e.target.value)}
                        placeholder="Haircut, line-up, braids..."
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Date *</p>
                      <Input
                        type="date"
                        value={bookDate}
                        min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()}
                        max={(() => { const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().split("T")[0]; })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setBookDate("");
                            return;
                          }
                          const [yr, mo, dy] = val.split("-").map(Number);
                          const day = new Date(yr, mo - 1, dy).getDay();
                          if (!availableDays.some((a) => a.day_of_week === day)) {
                            toast.error("No availability on this day");
                            return;
                          }
                          setBookDate(val);
                        }}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Time *</p>
                      {loadingSlots ? (
                        <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading slots...
                        </div>
                      ) : (
                        <select
                          value={bookTime}
                          onChange={(e) => setBookTime(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Choose a slot</option>
                          {freeSlots.map((slot) => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Your name *</p>
                      <Input value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Phone *</p>
                      <Input value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} placeholder="+44..." />
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Note (optional)</p>
                      <Textarea value={bookNote} onChange={(e) => setBookNote(e.target.value)} rows={2} placeholder="Anything the merchant should know?" />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        onClick={handleBook}
                        disabled={submittingBooking || !bookDate || !bookTime || !bookName.trim() || !bookPhone.trim()}
                        className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                      >
                        {submittingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request booking"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold">Buy from this store</h2>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products listed yet. Use phone or social links above to enquire.</p>
                ) : (
                  <>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {products.map((p) => {
                        const count = qty[p.name] ?? 0;
                        return (
                          <div key={p.name} className="flex items-center justify-between gap-4 p-3">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-sm text-muted-foreground">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => setQty((prev) => ({ ...prev, [p.name]: Math.max(0, count - 1) }))}>-</Button>
                              <span className="w-6 text-center text-sm font-semibold">{count}</span>
                              <Button variant="outline" size="sm" onClick={() => setQty((prev) => ({ ...prev, [p.name]: count + 1 }))}>+</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Your name *</p>
                        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your full name" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Phone *</p>
                        <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+44..." />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Order note (optional)</p>
                        <Textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} rows={2} placeholder="Any substitutions or notes?" />
                      </div>
                      <div className="sm:col-span-2 rounded-md bg-secondary px-3 py-2 text-sm">
                        Total: <span className="font-semibold">£{orderTotal.toFixed(2)}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          onClick={handlePlaceOrder}
                          disabled={placingOrder || cartItems.length === 0 || !customerName.trim() || !customerPhone.trim()}
                          className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                        >
                          {placingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place order (${reference})`}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Store info grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact & Location */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold">Visit us</h2>
              
              {store.address && (
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{store.address}</p>
                    {store.city && <p className="text-sm text-muted-foreground">{store.city}{store.postcode ? `, ${store.postcode}` : ""}</p>}
                  </div>
                </div>
              )}

              {store.hours && (
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Opening hours</p>
                    <p className="text-sm text-muted-foreground">{store.hours}</p>
                  </div>
                </div>
              )}

              {store.phone && (
                <div className="flex gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <a href={`tel:${store.phone}`} className="text-sm text-primary hover:underline">
                      {store.phone}
                    </a>
                  </div>
                </div>
              )}

              {store.fulfillment && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fulfilment</p>
                  <div className="flex flex-wrap gap-2">
                    {(store.fulfillment === "collection" || store.fulfillment === "both") && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        🏪 Collection
                      </span>
                    )}
                    {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        🚚 Delivery
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Social links */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold">Connect</h2>

              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <Globe className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <p className="text-sm text-primary hover:underline truncate">{websiteHref}</p>
                  </div>
                </a>
              )}

              {instagramHref && (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <span className="text-xl mt-0.5">📷</span>
                  <div>
                    <p className="text-sm font-medium">Instagram</p>
                    <p className="text-sm text-primary hover:underline truncate">Open profile</p>
                  </div>
                </a>
              )}

              {tiktokHref && (
                <a
                  href={tiktokHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <span className="text-xl mt-0.5">🎵</span>
                  <div>
                    <p className="text-sm font-medium">TikTok</p>
                    <p className="text-sm text-primary hover:underline truncate">Open profile</p>
                  </div>
                </a>
              )}

              {!websiteHref && !instagramHref && !tiktokHref && (
                <p className="text-sm text-muted-foreground">No social links available yet.</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse more stores
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
