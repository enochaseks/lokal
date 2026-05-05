import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Globe, Copy, Check, Loader2, Star } from "lucide-react";
import whatsappLogo from "@/assets/WhatsApp_icon.png";
import facebookLogo from "@/assets/Facebook_Logo_2023.png";
import xLogo from "@/assets/X_icon.svg.png";
import instagramLogo from "@/assets/Instagram_logo_2016.svg.png";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGION_BANK, DEFAULT_BANK, isStoreBookable } from "@/data/stores";
import type { Region, SellingMode } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import { buildInstagramUrl, buildTikTokUrl, getImageUrl, normalizeWebsiteUrl } from "@/lib/utils";
import { toast } from "sonner";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRY_OPTIONS = getCountries()
  .map((country) => {
    const code = getCountryCallingCode(country);
    const name = regionNames?.of(country) ?? country;
    return { value: country, label: `${name} (+${code})`, code };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

function normalizePhoneForAlerts(raw: string, country: CountryCode): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const countryCode = getCountryCallingCode(country);
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 6 && digits.length <= 15) return `+${digits}`;
  const localDigits = digits.replace(/^0+/, "");
  if (!localDigits) return null;
  if (localDigits.length < 6 || localDigits.length > 14) return null;
  return `+${countryCode}${localDigits}`;
}

type ProductRow = {
  name: string;
  price: number;
  unit: string | null;
  position: number;
  deposit?: number | null;
  image_url?: string | null;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_bookings_per_slot: number;
};

type StaffRow = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  position: number;
  daily_capacity?: number | null;
  available_days?: number[] | null;
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
  selling_mode?: SellingMode | null;
  published: boolean;
  store_products: ProductRow[] | null;
  store_availability: AvailabilityRow[] | null;
  store_staff: StaffRow[] | null;
  staff_reviews: Array<{ staff_id: string; rating: number }> | null;
  deposit_amount?: number | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  region: string | null;
};

const isBookable = (category: string, sellingMode?: string | null) => isStoreBookable(category, sellingMode);

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
      .select("*, store_products(name,price,unit,position,deposit,image_url), store_availability(day_of_week,start_time,end_time,slot_duration_mins,max_bookings_per_slot), store_staff(id,name,phone,active,position,daily_capacity,available_days)")
      .eq("id", params.id)
      .limit(1);

    if (error) {
      throw new Error(`Error loading store: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("Store not found");
    }

    const { data: rd } = await (supabase as any)
      .from("staff_reviews")
      .select("staff_id, rating")
      .eq("store_id", params.id);

    return { ...data[0], staff_reviews: rd ?? [] } as unknown as StoreDetails;
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

function checkRateLimit(phone: string): { allowed: boolean; waitMins: number } {
  const key = `lokal_orders_${phone.replace(/\D/g, "").slice(-10)}`;
  const raw = localStorage.getItem(key);
  const timestamps: number[] = raw ? JSON.parse(raw) : [];
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= 5) {
    const oldest = Math.min(...recent);
    const waitMins = Math.ceil((oldest + windowMs - now) / 60000);
    return { allowed: false, waitMins };
  }
  recent.push(now);
  localStorage.setItem(key, JSON.stringify(recent));
  return { allowed: true, waitMins: 0 };
}

function StoreDetail() {
  const store = Route.useLoaderData() as StoreDetails;
  const [copied, setCopied] = useState(false);
  const [reference, setReference] = useState(() => makeRef());
  const [storePublished, setStorePublished] = useState(store.published);
  const [revealBankDetails, setRevealBankDetails] = useState(false);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderPhoneCountry, setOrderPhoneCountry] = useState<CountryCode>("GB");
  const [orderNote, setOrderNote] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [bookService, setBookService] = useState("");
  const [bookStaffId, setBookStaffId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookPhoneCountry, setBookPhoneCountry] = useState<CountryCode>("GB");
  const [bookNote, setBookNote] = useState("");
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingDepositDue, setBookingDepositDue] = useState<{ amount: number; service: string | null } | null>(null);

  // Email for post-appointment rating link
  const [bookEmail, setBookEmail] = useState("");
  const [staffBookingCounts, setStaffBookingCounts] = useState<Record<string, number>>({});

  const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
  const shareUrl = `${domain}/store/${store.id}`;
  const shareText = `Check out ${store.name} on Lokal!`;
  const websiteHref = normalizeWebsiteUrl(store.website_url);
  const instagramHref = buildInstagramUrl(store.instagram_handle);
  const tiktokHref = buildTikTokUrl(store.tiktok_handle);
  const products = [...(store.store_products ?? [])].sort((a, b) => a.position - b.position);
  const availableDays = [...(store.store_availability ?? [])].sort((a, b) => a.day_of_week - b.day_of_week);
  const staffMembers = [...(store.store_staff ?? [])]
    .filter((m) => m.active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const selectedStaff = staffMembers.find((m) => m.id === bookStaffId) ?? null;

  const staffRatingMap = (() => {
    const sums: Record<string, { total: number; count: number }> = {};
    (store.staff_reviews ?? []).forEach((r) => {
      if (!sums[r.staff_id]) sums[r.staff_id] = { total: 0, count: 0 };
      sums[r.staff_id].total += r.rating;
      sums[r.staff_id].count += 1;
    });
    const map: Record<string, { avg: number; count: number }> = {};
    Object.keys(sums).forEach((k) => { map[k] = { avg: sums[k].total / sums[k].count, count: sums[k].count }; });
    return map;
  })();

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
  const selectedDayOfWeek = selectedDayAvailability?.day_of_week ?? null;
  const availableStaffMembers = selectedDayOfWeek == null
    ? staffMembers
    : staffMembers.filter((m) => {
        if (!Array.isArray(m.available_days) || m.available_days.length === 0) return true;
        return m.available_days.includes(selectedDayOfWeek);
      });

  const freeSlots = selectedDayAvailability
    ? generateTimeSlots(
        selectedDayAvailability.start_time.slice(0, 5),
        selectedDayAvailability.end_time.slice(0, 5),
        selectedDayAvailability.slot_duration_mins,
      )
    : [];

  // Check if date is today
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const isToday = bookDate === today;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Mark slots as disabled if full or in the past
  const slotStatus = freeSlots.reduce(
    (acc, slot) => {
      const isFull = (slotCounts[slot] ?? 0) >= (selectedDayAvailability?.max_bookings_per_slot ?? 1);
      const isPast = isToday && slot < `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
      acc[slot] = { disabled: isFull || isPast, reason: isFull ? "full" : isPast ? "past" : "" };
      return acc;
    },
    {} as Record<string, { disabled: boolean; reason: string }>
  );

  useEffect(() => {
    if (!bookDate) {
      setSlotCounts({});
      setBookTime("");
      return;
    }

    setLoadingSlots(true);
    (supabase as any)
      .from("store_bookings")
      .select("slot_start, staff_id")
      .eq("store_id", store.id)
      .neq("status", "cancelled")
      .gte("slot_start", `${bookDate}T00:00:00`)
      .lte("slot_start", `${bookDate}T23:59:59`)
      .then(({ data }: { data: Array<{ slot_start: string; staff_id: string | null }> | null }) => {
        const counts: Record<string, number> = {};
        const sCounts: Record<string, number> = {};
        (data ?? []).forEach((r) => {
          const time = r.slot_start.slice(11, 16);
          counts[time] = (counts[time] ?? 0) + 1;
          if (r.staff_id) sCounts[r.staff_id] = (sCounts[r.staff_id] ?? 0) + 1;
        });
        setSlotCounts(counts);
        setStaffBookingCounts(sCounts);
        setBookTime("");
        setLoadingSlots(false);
      })
      .catch(() => {
        setSlotCounts({});
        setStaffBookingCounts({});
        setLoadingSlots(false);
      });
  }, [bookDate, store.id]);

  useEffect(() => {
    if (!bookStaffId) return;
    if (availableStaffMembers.some((m) => m.id === bookStaffId)) return;
    setBookStaffId("");
  }, [bookStaffId, availableStaffMembers]);

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

    // Rate limit: max 5 orders per phone per hour
    const rateCheck = checkRateLimit(customerPhone.trim());
    if (!rateCheck.allowed) {
      toast.error(`Too many orders. Please wait ${rateCheck.waitMins} min${rateCheck.waitMins !== 1 ? "s" : ""} before trying again.`);
      return;
    }

    const normalizedOrderPhone = normalizePhoneForAlerts(customerPhone, orderPhoneCountry) ?? customerPhone.trim();

    // Re-check store is still published before submitting
    setPlacingOrder(true);
    try {
      const { data: publishedCheck } = await (supabase as any).from("stores").select("published").eq("id", store.id).single();
      if (!publishedCheck?.published) {
        setStorePublished(false);
        toast.error("This store is currently unavailable. Your order was not placed.");
        setPlacingOrder(false);
        return;
      }
      const { error } = await (supabase as any).from("orders").insert({
        store_id: store.id,
        reference,
        customer_name: customerName.trim(),
        customer_phone: normalizedOrderPhone,
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
      setRevealBankDetails(true);

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
    const normalizedBookPhone = normalizePhoneForAlerts(bookPhone, bookPhoneCountry);
    if (!normalizedBookPhone) {
      toast.error("Enter phone in international format", { description: "Choose a country and enter your local mobile number." });
      return;
    }
    if (!bookDate || !bookTime || !bookName.trim()) {
      toast.error("Please fill in all required booking fields");
      return;
    }
    if (!selectedDayAvailability) {
      toast.error("No availability on this day");
      return;
    }
    if (staffMembers.length > 0 && !selectedStaff) {
      toast.error("Please choose a team member");
      return;
    }
    if (
      selectedStaff &&
      selectedDayOfWeek != null &&
      Array.isArray(selectedStaff.available_days) &&
      selectedStaff.available_days.length > 0 &&
      !selectedStaff.available_days.includes(selectedDayOfWeek)
    ) {
      toast.error("Selected team member is unavailable on this day");
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
        customer_phone: normalizedBookPhone,
        customer_email: bookEmail.trim() || null,
        service: bookService || null,
        staff_id: selectedStaff?.id ?? null,
        staff_name: selectedStaff?.name ?? null,
        staff_phone: selectedStaff?.phone ?? null,
        slot_start: `${bookDate}T${bookTime}:00`,
        slot_end: slotEnd,
        status: "pending",
        note: bookNote.trim() || null,
      });
      if (error) throw error;

      // Send confirmation to customer (fire-and-forget)
      if (bookEmail.trim()) {
        void supabase.functions.invoke("send-booking-customer-confirmation", {
          body: {
            store_name: store.name,
            customer_name: bookName.trim(),
            customer_email: bookEmail.trim(),
            service: bookService || null,
            staff_name: selectedStaff?.name ?? null,
            slot_start: `${bookDate}T${bookTime}:00`,
            customer_phone: normalizedBookPhone,
          },
        });
      }

      // Notify the merchant (fire-and-forget)
      void supabase.functions.invoke("send-booking-alert", {
        body: {
          store_id: store.id,
          store_name: store.name,
          customer_name: bookName.trim(),
          customer_phone: normalizedBookPhone,
          service: bookService || null,
          staff_name: selectedStaff?.name ?? null,
          staff_phone: selectedStaff?.phone ?? null,
          slot_start: `${bookDate}T${bookTime}:00`,
          note: bookNote.trim() || null,
        },
      });

      toast.success("Booking request sent", {
        description: `${store.name} will confirm your appointment soon.`,
        duration: 8000,
      });

      const serviceDeposit = bookService ? store.store_products?.find((p) => p.name === bookService)?.deposit : undefined;
      const depositAmount = serviceDeposit ?? store.deposit_amount ?? null;
      if (depositAmount) {
        setBookingDepositDue({ amount: Number(depositAmount), service: bookService || null });
      }

      setBookService("");
      setBookStaffId("");
      setBookDate("");
      setBookTime("");
      setBookName("");
      setBookPhone("");
      setBookPhoneCountry("GB");
      setBookNote("");
      setBookEmail("");
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

          {/* Store closed banner */}
          {!storePublished && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <span className="text-lg">🔒</span>
              <div>
                <p className="font-semibold text-destructive">This store is currently closed</p>
                <p className="text-xs text-muted-foreground mt-0.5">The merchant has temporarily hidden this store. Ordering and booking are disabled.</p>
              </div>
            </div>
          )}
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
            {isBookable(store.category, store.selling_mode) ? (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold">Book with this store</h2>
                {bookingDepositDue && (
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                    <p className="font-semibold text-amber-900">✅ Booking request sent!</p>
                    <p className="mt-1 text-sm text-amber-800">
                      To confirm your appointment, send a deposit of <strong>£{bookingDepositDue.amount.toFixed(2)}</strong>
                      {bookingDepositDue.service ? ` for ${bookingDepositDue.service}` : ""} to:
                    </p>
                    <div className="mt-3 space-y-1 text-sm font-mono text-amber-900">
                      <div><span className="text-amber-600">Bank: </span>{store.bank_name ?? "—"}</div>
                      <div><span className="text-amber-600">Name: </span>{store.bank_account_name ?? "—"}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600">Account: </span>
                        <span>{revealBankDetails ? (store.bank_account_number ?? "—") : `****${(store.bank_account_number ?? "").slice(-4) || "——"}`}</span>
                        {!revealBankDetails && <button onClick={() => setRevealBankDetails(true)} className="text-xs text-amber-700 underline">Reveal</button>}
                      </div>
                      {store.bank_sort_code && <div><span className="text-amber-600">{(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}: </span>{store.bank_sort_code}</div>}
                    </div>
                    <button className="mt-3 text-sm text-amber-800 underline" onClick={() => setBookingDepositDue(null)}>
                      Book another appointment
                    </button>
                  </div>
                )}
                {products.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Services</p>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {products.map((p) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {p.image_url && <img src={getImageUrl(p.image_url) || undefined} alt={p.name} className="h-9 w-9 rounded-md object-cover shrink-0" />}
                            {p.name}
                          </span>
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
                    {products.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Service</p>
                        <Select value={bookService} onValueChange={setBookService}>
                          <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.name} value={p.name}>{p.name} — £{p.price.toFixed(2)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {staffMembers.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Team member *</p>
                        <select
                          value={bookStaffId}
                          onChange={(e) => setBookStaffId(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Choose who you want to book with</option>
                          {availableStaffMembers.map((m) => {
                            const r = staffRatingMap[m.id];
                            const atCapacity = !!bookDate && m.daily_capacity != null && (staffBookingCounts[m.id] ?? 0) >= m.daily_capacity;
                            const dayLabel = Array.isArray(m.available_days) && m.available_days.length > 0
                              ? m.available_days.slice().sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(",")
                              : "All days";
                            return (
                              <option key={m.id} value={m.id} disabled={atCapacity}>
                                {m.name}{r ? ` · ★ ${r.avg.toFixed(1)} (${r.count} review${r.count !== 1 ? "s" : ""})` : ""}{` · ${dayLabel}`}{atCapacity ? " · Full on selected day" : ""}
                              </option>
                            );
                          })}
                        </select>
                        {bookDate && availableStaffMembers.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600">No team members are available on this day. Pick another date.</p>
                        )}
                      </div>
                    )}
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        Booking days: {availableDays
                          .map((a) => `${DAY_LABELS[a.day_of_week]} ${a.start_time.slice(0, 5)}-${a.end_time.slice(0, 5)}`)
                          .join(", ")}
                      </p>
                    </div>
                    {bookDate && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Time slot *</p>
                        {loadingSlots ? (
                          <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
                          </div>
                        ) : (() => {
                          const availableSlots = freeSlots.filter((s) => !slotStatus[s]?.disabled);
                          if (availableSlots.length === 0) return <p className="mt-1 text-sm text-amber-600">No available slots on this day — try another date.</p>;
                          return (
                            <Select value={bookTime} onValueChange={setBookTime}>
                              <SelectTrigger><SelectValue placeholder="Pick a time" /></SelectTrigger>
                              <SelectContent>
                                {freeSlots.map((slot) => {
                                  const status = slotStatus[slot];
                                  return (
                                    <SelectItem key={slot} value={slot} disabled={status.disabled}>
                                      {slot}{status.disabled && status.reason === "full" ? " (Full)" : ""}{status.disabled && status.reason === "past" ? " (Passed)" : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Your name *</p>
                      <Input value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Phone *</p>
                      <div className="mt-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5 sm:col-span-4">
                          <Select value={bookPhoneCountry} onValueChange={(v) => setBookPhoneCountry(v as CountryCode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-7 sm:col-span-8">
                          <Input value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} placeholder="Local number" />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Email (optional — for rating reminder)</p>
                      <Input value={bookEmail} onChange={(e) => setBookEmail(e.target.value)} placeholder="you@example.com" type="email" />
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Note (optional)</p>
                      <Textarea value={bookNote} onChange={(e) => setBookNote(e.target.value)} rows={2} placeholder="Anything the merchant should know?" />
                    </div>
                    {(() => {
                        const serviceDeposit = bookService
                          ? store.store_products?.find((p) => p.name === bookService)?.deposit
                          : undefined;
                        const depositAmount = serviceDeposit ?? store.deposit_amount;
                        return depositAmount ? (
                          <div className="sm:col-span-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                            💳 A deposit of <strong>£{Number(depositAmount).toFixed(2)}</strong> is required to confirm this appointment. Please send it to:
                            <div className="mt-2 space-y-1 text-xs font-mono">
                              <div><span className="text-amber-600">Bank: </span>{store.bank_name ?? "—"}</div>
                              <div><span className="text-amber-600">Name: </span>{store.bank_account_name ?? "—"}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-amber-600">Account: </span>
                                <span>{revealBankDetails ? (store.bank_account_number ?? "—") : `****${(store.bank_account_number ?? "").slice(-4) || "——"}`}</span>
                                {!revealBankDetails && <button onClick={() => setRevealBankDetails(true)} className="text-amber-700 underline">Reveal</button>}
                              </div>
                              {store.bank_sort_code && <div><span className="text-amber-600">{(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}: </span>{store.bank_sort_code}</div>}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    <div className="sm:col-span-2">
                      <Button
                        onClick={handleBook}
                        disabled={submittingBooking || !bookDate || !bookTime || !bookName.trim() || !bookPhone.trim() || (staffMembers.length > 0 && (!bookStaffId || (!!bookDate && availableStaffMembers.length === 0))) || !storePublished}
                        className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                      >
                        {submittingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request booking"}
                      </Button>
                      {!storePublished && <p className="mt-2 text-xs text-center text-destructive">This store is currently closed.</p>}
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
                            <div className="flex items-center gap-3">
                              {p.image_url && <img src={getImageUrl(p.image_url) || undefined} alt={p.name} className="h-12 w-12 rounded-md object-cover shrink-0" />}
                              <div>
                                <p className="text-sm font-medium">{p.name}</p>
                                <p className="text-sm text-muted-foreground">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</p>
                              </div>
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
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-5 sm:col-span-4">
                            <Select value={orderPhoneCountry} onValueChange={(v) => setOrderPhoneCountry(v as CountryCode)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-7 sm:col-span-8">
                            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Local number" />
                          </div>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Order note (optional)</p>
                        <Textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} rows={2} placeholder="Any substitutions or notes?" />
                      </div>
                      <div className="sm:col-span-2 rounded-md bg-secondary px-3 py-2 text-sm">
                        Total: <span className="font-semibold">£{orderTotal.toFixed(2)}</span>
                      </div>
                      {revealBankDetails && store.bank_account_name && (
                        <div className="sm:col-span-2 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm">
                          <p className="font-semibold text-green-800 mb-2">✅ Order placed — please send your transfer to:</p>
                          <div className="space-y-1 font-mono text-green-900">
                            <div><span className="text-green-600">Bank: </span>{store.bank_name ?? "—"}</div>
                            <div><span className="text-green-600">Name: </span>{store.bank_account_name}</div>
                            <div><span className="text-green-600">Account: </span>{store.bank_account_number}</div>
                            {store.bank_sort_code && <div><span className="text-green-600">{(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}: </span>{store.bank_sort_code}</div>}
                          </div>
                          <p className="mt-2 text-xs text-green-700">Use reference <span className="font-mono font-bold">{reference}</span> as the payment reference.</p>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Button
                          onClick={handlePlaceOrder}
                          disabled={placingOrder || cartItems.length === 0 || !customerName.trim() || !customerPhone.trim() || !storePublished}
                          className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                        >
                          {placingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place order (${reference})`}
                        </Button>
                        {!storePublished && <p className="mt-2 text-xs text-center text-destructive">This store is currently closed.</p>}
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

              {store.fulfillment && !isBookable(store.category, store.selling_mode) && (
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
              {isBookable(store.category, store.selling_mode) && (store as any).location_type && (store as any).location_type !== "salon" && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Service location</p>
                  <div className="flex flex-wrap gap-2">
                    {((store as any).location_type === "travel" || (store as any).location_type === "remote_and_travel") && (
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🚗 We travel to you</span>
                    )}
                    {((store as any).location_type === "remote" || (store as any).location_type === "remote_and_travel") && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">💻 Remote / online</span>
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
