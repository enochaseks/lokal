import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Globe, Copy, Check, Loader2, Star, ShieldAlert, FileCheck2, Images, Download } from "lucide-react";
import whatsappLogo from "@/assets/WhatsApp_icon.png";
import facebookLogo from "@/assets/Facebook_Logo_2023.png";
import xLogo from "@/assets/X_icon.svg.png";
import instagramLogo from "@/assets/Instagram_logo_2016.svg.png";
import { Navbar } from "@/components/lokal/Navbar";

import { VerificationBadge } from "@/components/lokal/VerificationBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGION_BANK, DEFAULT_BANK, REGIONS, isStoreBookable, DEFAULT_STORE_SECTION_ORDER } from "@/data/stores";
import type { StoreButtonStyle, StoreFontPreset, StoreSectionKey } from "@/data/stores";
import type { Region, SellingMode } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import {
  buildInstagramUrl,
  buildTikTokUrl,
  getImageUrl,
  isDisplayableImagePath,
  isBodyContactService,
  normalizeWebsiteUrl,
  resolveRenderableImageUrl,
} from "@/lib/utils";
import { downloadStoreShareCard } from "../lib/store-share-card.ts";
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
  if (
    digits.startsWith(countryCode) &&
    digits.length >= countryCode.length + 6 &&
    digits.length <= 15
  )
    return `+${digits}`;
  const localDigits = digits.replace(/^0+/, "");
  if (!localDigits) return null;
  if (localDigits.length < 6 || localDigits.length > 14) return null;
  return `+${countryCode}${localDigits}`;
}

function getStoredCustomerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lokal_customer_profile");
    if (!raw) return localStorage.getItem("lokal_customer_id");
    const parsed = JSON.parse(raw) as { id?: string | null };
    return parsed?.id ?? localStorage.getItem("lokal_customer_id");
  } catch {
    return localStorage.getItem("lokal_customer_id");
  }
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
  subcategory?: string | null;
  minimum_age?: number | null;
  tattoo_portfolio_url?: string | null;
  tattoo_license_url?: string | null;
  is_verified_tattoo_artist?: boolean | null;
  barber_license_url?: string | null;
  beauty_license_url?: string | null;
  hair_beauty_license_url?: string | null;
  food_business_license_url?: string | null;
  food_business_license_status?: "pending" | "approved" | "rejected" | null;
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
  logo_url?: string | null;
  banner_image_url?: string | null;
  brand_primary_color?: string | null;
  brand_accent_color?: string | null;
  button_style?: StoreButtonStyle | null;
  font_preset?: StoreFontPreset | null;
  page_background_theme?: "cream" | "primary_tint" | "accent_tint" | "gradient" | null;
  show_reviews?: boolean | null;
  show_hours?: boolean | null;
  show_socials?: boolean | null;
  show_featured_products?: boolean | null;
  section_order?: StoreSectionKey[] | null;
  fulfillment: string;
  delivery_fee_gbp?: number | null;
  location_type?: "salon" | "remote" | "travel" | "remote_and_travel" | null;
  selling_mode?: SellingMode | null;
  published: boolean;
  store_products: ProductRow[] | null;
  store_availability: AvailabilityRow[] | null;
  store_staff: StaffRow[] | null;
  staff_reviews: Array<{ staff_id: string; rating: number }> | null;
  proof_reviews:
    | Array<{
        id: string;
        source: "reviews" | "staff_reviews";
        reviewer_name: string;
        rating: number;
        body: string | null;
        created_at: string;
        proof_image_url: string | null;
        staff_name?: string | null;
      }>
    | null;
  deposit_amount?: number | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  region: string | null;
  accepts_refunds?: boolean | null;
  refund_policy?: string | null;
  cancellation_policy?: string | null;
  is_verified?: boolean | null;
  verified_at?: string | null;
  verification_reason?: string | null;
  verification_tier?: "verified" | "online_verified" | null;
  timezone?: string | null;
};

const isBookable = (category: string, sellingMode?: string | null) =>
  isStoreBookable(category, sellingMode);

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

const DAY_TO_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function parseClockTime(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\./g, "");
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const period = match[3];
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  const hour24 = (hour12 % 12) + (period === "pm" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseHoursText(
  hours: string | null | undefined,
): Array<{ day_of_week: number; start_time: string; end_time: string }> {
  if (!hours) return [];
  const normalized = hours.toLowerCase().trim();
  if (!normalized || normalized.includes("request")) return [];
  const timeTokens = normalized.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/g) ?? [];
  if (timeTokens.length < 2) return [];
  const startTime = parseClockTime(timeTokens[0]!);
  const endTime = parseClockTime(timeTokens[1]!);
  if (!startTime || !endTime) return [];
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const daySegmentRaw = hours.split("·")[0]?.trim() ?? hours.trim();
  const daySegment = daySegmentRaw.toLowerCase();
  if (
    daySegment.includes("daily") ||
    daySegment.includes("every day") ||
    daySegment.includes("everyday")
  ) {
    return allDays.map((day) => ({ day_of_week: day, start_time: startTime, end_time: endTime }));
  }
  const segments = daySegment
    .replace(/[–—]/g, "-")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const resolvedDays = new Set<number>();
  for (const segment of segments) {
    if (segment.includes("-")) {
      const [fromRaw, toRaw] = segment.split("-").map((p) => p.trim().slice(0, 3));
      const from = DAY_TO_INDEX[fromRaw];
      const to = DAY_TO_INDEX[toRaw];
      if (from == null || to == null) continue;
      if (from <= to) {
        for (let day = from; day <= to; day += 1) resolvedDays.add(day);
      } else {
        for (let day = from; day <= 6; day += 1) resolvedDays.add(day);
        for (let day = 0; day <= to; day += 1) resolvedDays.add(day);
      }
    } else {
      const key = segment.slice(0, 3);
      const day = DAY_TO_INDEX[key];
      if (day != null) resolvedDays.add(day);
    }
  }
  const days = resolvedDays.size > 0 ? Array.from(resolvedDays) : allDays;
  return days.map((day) => ({ day_of_week: day, start_time: startTime, end_time: endTime }));
}

function isStoreOpenNow(
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }> | null | undefined,
  hoursText?: string | null,
  timezone?: string | null,
): boolean | null {
  const windows =
    availability && availability.length > 0 ? availability : parseHoursText(hoursText);
  if (!windows || windows.length === 0) return null;
  const now = new Date();
  let today = now.getDay();
  let nowMins = now.getHours() * 60 + now.getMinutes();
  if (timezone?.trim()) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const weekday = parts.find((p) => p.type === "weekday")?.value;
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      today = WEEKDAY_TO_INDEX[weekday ?? ""] ?? today;
      nowMins = hour * 60 + minute;
    } catch {
      // fall back to local time
    }
  }
  const prevDay = (today + 6) % 7;
  for (const row of windows) {
    const start = timeToMinutes(row.start_time);
    const end = timeToMinutes(row.end_time);
    if (start === end) {
      if (row.day_of_week === today) return true;
      continue;
    }
    const overnight = end < start;
    if (!overnight && row.day_of_week === today && nowMins >= start && nowMins < end) return true;
    if (overnight) {
      if (row.day_of_week === today && nowMins >= start) return true;
      if (row.day_of_week === prevDay && nowMins < end) return true;
    }
  }
  return false;
}

function getDayOfWeekInTimezone(dateStr: string, timezone?: string | null): number {
  try {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
    if (!timezone?.trim()) return date.getDay();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return dayMap[weekday ?? ""] ?? date.getDay();
  } catch {
    const [y, mo, d] = dateStr.split("-").map(Number);
    return new Date(y, mo - 1, d).getDay();
  }
}

function getTodayDateInTimezone(timezone?: string | null): string {
  const now = new Date();
  if (!timezone?.trim()) {
    return now.toISOString().split("T")[0];
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return now.toISOString().split("T")[0];
  }
}

function makeRef() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return (
    "LKL-" +
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
      .slice(0, 6)
  );
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

function getButtonRadius(buttonStyle?: StoreButtonStyle | null): string {
  switch (buttonStyle) {
    case "square":
      return "rounded-md";
    case "rounded":
      return "rounded-xl";
    default:
      return "rounded-full";
  }
}

function getStoreThemeStyle(store: StoreDetails): CSSProperties {
  const fontPreset = store.font_preset ?? "display";
  const pageBackgroundTheme = store.page_background_theme ?? "cream";
  const primary = store.brand_primary_color || "#b42318";
  const accent = store.brand_accent_color || "#f97316";
  const headingFont =
    fontPreset === "sans"
      ? "var(--font-sans)"
      : fontPreset === "mono"
        ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
        : fontPreset === "script"
          ? "var(--font-script)"
          : fontPreset === "rounded"
            ? "var(--font-rounded)"
            : "var(--font-display)";
  const backgroundStyle =
    pageBackgroundTheme === "primary_tint"
      ? `color-mix(in oklch, ${primary} 7%, var(--background))`
      : pageBackgroundTheme === "accent_tint"
        ? `color-mix(in oklch, ${accent} 7%, var(--background))`
        : pageBackgroundTheme === "gradient"
          ? `linear-gradient(135deg, color-mix(in oklch, ${primary} 12%, var(--background)) 0%, color-mix(in oklch, ${accent} 12%, var(--background)) 100%)`
          : undefined;
  return {
    ["--store-heading-font" as any]: headingFont,
    ["--store-body-font" as any]: "var(--font-sans)",
    background: backgroundStyle,
  };
}

function getSectionOrder(store: StoreDetails): StoreSectionKey[] {
  const allowed: StoreSectionKey[] = ["featured_products", "hours", "socials", "reviews"];
  const current = store.section_order?.filter((section): section is StoreSectionKey =>
    allowed.includes(section as StoreSectionKey),
  );
  const base = (current?.length ? current : DEFAULT_STORE_SECTION_ORDER).filter((section) =>
    allowed.includes(section),
  );
  return [...base, ...allowed.filter((section) => !base.includes(section))];
}

export const Route = createFileRoute("/store/$id")({
  component: StoreDetail,
  head: (props) => {
    const store = props.loaderData as StoreDetails | undefined;
    const domain =
      typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
    const shareUrl = `${domain}/store/${props.params.id}`;

    return {
      meta: store
        ? [
            { title: `${store.name} · Lokal` },
            { name: "description", content: store.description || `Visit ${store.name} on Lokal` },
            { property: "og:title", content: store.name },
            {
              property: "og:description",
              content: store.description || `${store.category} on Lokal`,
            },
            { property: "og:type", content: "business.business" },
            { property: "og:url", content: shareUrl },
            ...(store.image_url
              ? [{ property: "og:image", content: getImageUrl(store.image_url) || "" }]
              : []),
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:title", content: store.name },
            {
              name: "twitter:description",
              content: store.description || `${store.category} on Lokal`,
            },
          ]
        : [],
    };
  },
  loader: async ({ params }) => {
    const { data, error } = await (supabase as any)
      .from("stores")
      .select(
        "*, store_products(name,price,unit,position,deposit,image_url), store_availability(day_of_week,start_time,end_time,slot_duration_mins,max_bookings_per_slot), store_staff(id,name,phone,active,position,daily_capacity,available_days)",
      )
      .eq("id", params.id)
      .limit(1);

    if (error) {
      throw new Error(`Error loading store: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("Store not found");
    }

    const { data: approvedVerification } = await (supabase as any)
      .from("store_verification_requests")
      .select("verification_method")
      .eq("store_id", params.id)
      .eq("status", "approved")
      .limit(1);

    const hasApprovedVerification = (approvedVerification ?? []).length > 0;
    const verificationMethod = approvedVerification?.[0]?.verification_method as
      | "registration_number"
      | "online_presence"
      | undefined;
    const verificationTier =
      verificationMethod === "registration_number"
        ? "verified"
        : verificationMethod === "online_presence"
          ? "online_verified"
          : null;

    const [{ data: rd }, { data: publicReviews }, { data: staffProofReviews }] = await Promise.all([
      (supabase as any).from("staff_reviews").select("staff_id, rating").eq("store_id", params.id),
      (supabase as any)
        .from("reviews")
        .select("id, reviewer_name, rating, body, created_at, proof_image_url")
        .eq("store_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("staff_reviews")
        .select("id, reviewer_name, staff_name, rating, body, created_at, proof_image_url")
        .eq("store_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const proofReviews = [
      ...((publicReviews ?? []) as Array<{
        id: string;
        reviewer_name: string;
        rating: number;
        body: string | null;
        created_at: string;
        proof_image_url: string | null;
      }>).map((r) => ({ ...r, source: "reviews" as const })),
      ...((staffProofReviews ?? []) as Array<{
        id: string;
        reviewer_name: string;
        staff_name?: string | null;
        rating: number;
        body: string | null;
        created_at: string;
        proof_image_url: string | null;
      }>).map((r) => ({ ...r, source: "staff_reviews" as const })),
    ]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 12);

    return {
      ...data[0],
      is_verified: Boolean(data[0].is_verified && hasApprovedVerification && verificationTier),
      verified_at: hasApprovedVerification ? data[0].verified_at : null,
      verification_reason: hasApprovedVerification ? data[0].verification_reason : null,
      verification_tier: verificationTier,
      staff_reviews: rd ?? [],
      proof_reviews: proofReviews,
    } as unknown as StoreDetails;
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This store is either not available or has been removed.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
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
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [reference, setReference] = useState(() => makeRef());
  const [storePublished, setStorePublished] = useState(store.published);
  const [revealBankDetails, setRevealBankDetails] = useState(false);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderPhoneCountry, setOrderPhoneCountry] = useState<CountryCode>("GB");
  const [orderNote, setOrderNote] = useState("");
  const [orderFulfillment, setOrderFulfillment] = useState<"collection" | "delivery">(
    store.fulfillment === "delivery" ? "delivery" : "collection",
  );
  const [placingOrder, setPlacingOrder] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [previewUnsupported, setPreviewUnsupported] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string | null>>({});

  const [bookService, setBookService] = useState("");
  const [bookStaffId, setBookStaffId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookPhoneCountry, setBookPhoneCountry] = useState<CountryCode>("GB");
  const [bookNote, setBookNote] = useState("");
  const [bookAgeConfirmed, setBookAgeConfirmed] = useState(false);
  const [bookIdCommitment, setBookIdCommitment] = useState(false);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingDepositDue, setBookingDepositDue] = useState<{
    amount: number;
    service: string | null;
  } | null>(null);

  // Email for post-appointment rating link
  const [bookEmail, setBookEmail] = useState("");
  const [staffBookingCounts, setStaffBookingCounts] = useState<Record<string, number>>({});

  const domain =
    typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
  const shareUrl = `${domain}/store/${store.id}`;
  const shareText = `Check out ${store.name} on Lokal!`;
  const storePrimaryColor = store.brand_primary_color || "#b42318";
  const storeAccentColor = store.brand_accent_color || "#f97316";
  const storeButtonRadius = getButtonRadius(store.button_style);
  const visibleSectionOrder = getSectionOrder(store);
  const bannerImageUrl = store.banner_image_url || store.image_url;
  const showFeaturedProducts = store.show_featured_products !== false;
  const showHours = store.show_hours !== false;
  const showSocials = store.show_socials !== false;
  const showReviews = store.show_reviews !== false;
  const primaryButtonStyle = { background: storePrimaryColor, color: "#fff" };
  const websiteHref = normalizeWebsiteUrl(store.website_url);
  const instagramHref = buildInstagramUrl(store.instagram_handle);
  const tiktokHref = buildTikTokUrl(store.tiktok_handle);
  const currencySymbol = REGIONS[store.region as Region]?.symbol ?? "£";
  const customerId = getStoredCustomerId();
  const products = useMemo(
    () => [...(store.store_products ?? [])].sort((a, b) => a.position - b.position),
    [store.store_products],
  );
  const availableDays = [...(store.store_availability ?? [])].sort(
    (a, b) => a.day_of_week - b.day_of_week,
  );
  const staffMembers = [...(store.store_staff ?? [])]
    .filter((m) => m.active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const selectedStaff = staffMembers.find((m) => m.id === bookStaffId) ?? null;
  const isBodyContactStore = isBodyContactService(store.category, store.subcategory);
  const ageRestrictedMinimum = (() => {
    if (typeof store.minimum_age === "number" && store.minimum_age >= 18) return store.minimum_age;
    if (["Barbers", "Hair & Beauty", "Body Arts & Crafts"].includes(store.category)) return 18;
    return null;
  })();
  const requiresAgeVerification =
    isBookable(store.category, store.selling_mode) && ageRestrictedMinimum != null;
  const isTravelServiceStore =
    isBookable(store.category, store.selling_mode) &&
    (store.location_type === "travel" || store.location_type === "remote_and_travel");

  const staffRatingMap = (() => {
    const sums: Record<string, { total: number; count: number }> = {};
    (store.staff_reviews ?? []).forEach((r) => {
      if (!sums[r.staff_id]) sums[r.staff_id] = { total: 0, count: 0 };
      sums[r.staff_id].total += r.rating;
      sums[r.staff_id].count += 1;
    });
    const map: Record<string, { avg: number; count: number }> = {};
    Object.keys(sums).forEach((k) => {
      map[k] = { avg: sums[k].total / sums[k].count, count: sums[k].count };
    });
    return map;
  })();

  const proofReviewsWithImages = (store.proof_reviews ?? []).filter((r) => !!r.proof_image_url);
  const recentRatings = store.proof_reviews ?? [];

  useEffect(() => {
    const imagePaths = Array.from(
      new Set(products.map((product) => product.image_url).filter(Boolean) as string[]),
    );
    if (imagePaths.length === 0) return;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        imagePaths.map(async (imagePath) => [imagePath, await resolveRenderableImageUrl(imagePath)] as const),
      );
      if (!cancelled) {
        setResolvedImageUrls((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [products]);

  const openImagePreview = async (path: string | null | undefined, alt: string) => {
    const directUrl = getImageUrl(path);
    if (!directUrl) return;

    setPreviewUnsupported(false);
    setPreviewLoading(true);

    if (path && resolvedImageUrls[path]) {
      setPreviewImage({ src: resolvedImageUrls[path] as string, alt });
      setPreviewLoading(false);
      return;
    }

    if (isDisplayableImagePath(path)) {
      setPreviewImage({ src: directUrl, alt });
      setPreviewLoading(false);
      return;
    }

    setPreviewImage(null);

    try {
      const resolvedUrl = await resolveRenderableImageUrl(path);
      if (resolvedUrl) {
        setPreviewImage({ src: resolvedUrl, alt });
      } else {
        setPreviewUnsupported(true);
        setPreviewImage({ src: directUrl, alt });
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeImagePreview = (open: boolean) => {
    if (!open) {
      setPreviewImage(null);
      setPreviewUnsupported(false);
    }
  };

  const renderPreviewableImage = (
    imagePath: string | null | undefined,
    alt: string,
    imageClassName: string,
    buttonClassName = "",
  ) => {
    const imageSrc =
      (imagePath ? resolvedImageUrls[imagePath] : null) ?? getImageUrl(imagePath ?? "") ?? "";
    if (!imageSrc) return null;

    return (
      <button
        type="button"
        onClick={() => void openImagePreview(imagePath, alt)}
        className={`shrink-0 overflow-hidden rounded-md transition-opacity hover:opacity-90 ${buttonClassName}`.trim()}
        title="Tap to expand"
      >
        <img src={imageSrc} alt={alt} className={imageClassName} />
      </button>
    );
  };

  const sectionBlocks = {
    featured_products:
      showFeaturedProducts && products.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Featured products</h2>
            <span className="text-xs text-muted-foreground">Picked by the merchant</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 3).map((p) => (
              <div key={p.name} className="overflow-hidden rounded-xl border border-border bg-card">
                {renderPreviewableImage(
                  p.image_url,
                  p.name,
                  "h-36 w-full object-cover",
                  "w-full rounded-none",
                )}
                <div className="p-4">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currencySymbol}
                    {p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null,
    hours: (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold">
          {isTravelServiceStore ? "Service details" : "Visit us"}
        </h2>

        {isTravelServiceStore ? (
          <div className="flex gap-3">
            <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">We travel to you</p>
              <p className="text-sm text-muted-foreground">
                No fixed customer-facing address is shown.
              </p>
            </div>
          </div>
        ) : (
          store.address && (
            <div className="flex gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">{store.address}</p>
                {store.city && (
                  <p className="text-sm text-muted-foreground">
                    {store.city}
                    {store.postcode ? `, ${store.postcode}` : ""}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        {showHours && store.hours && (
          <div className="flex gap-3">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Opening hours</p>
                {(() => {
                  const open = isStoreOpenNow(store.store_availability, store.hours, store.timezone);
                  if (open === true)
                    return (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        🟢 Open
                      </span>
                    );
                  if (open === false)
                    return (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        ⚫ Closed
                      </span>
                    );
                  return null;
                })()}
              </div>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Fulfilment
            </p>
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
              {store.fulfillment === "pay_at_store" && (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                  💰 Pay at store
                </span>
              )}
            </div>
          </div>
        )}
        {isBookable(store.category, store.selling_mode) && (store as any).location_type && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Service location
            </p>
            <div className="flex flex-wrap gap-2">
              {store.location_type === "salon" && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  🏠 At store / premises
                </span>
              )}
              {(store.location_type === "travel" || store.location_type === "remote_and_travel") && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  🚗 We travel to you
                </span>
              )}
              {(store.location_type === "remote" || store.location_type === "remote_and_travel") && (
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  💻 Remote / online
                </span>
              )}
              {store.location_type === "salon" && store.fulfillment === "pay_at_store" && (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                  💰 Pay at store
                </span>
              )}
              {(store.location_type === "travel" || store.location_type === "remote_and_travel") && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  🏦 Bank transfer only
                </span>
              )}
            </div>
          </div>
        )}

        {(store.refund_policy ||
          store.cancellation_policy ||
          typeof store.accepts_refunds === "boolean") && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Refunds & cancellation
            </p>
            <p className="text-sm font-medium">
              Refunds: {store.accepts_refunds ? "Accepted (subject to merchant policy)" : "Not accepted"}
            </p>
            {store.refund_policy && (
              <p className="mt-1 text-sm text-muted-foreground">{store.refund_policy}</p>
            )}
            {store.cancellation_policy && (
              <p className="mt-1 text-sm text-muted-foreground">{store.cancellation_policy}</p>
            )}
          </div>
        )}
      </div>
    ),
    socials: null,
    reviews:
      showReviews && (recentRatings.length > 0 || proofReviewsWithImages.length > 0) ? (
        <div className="space-y-8">
          {recentRatings.length > 0 && (
            <section id="customer-ratings" className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Customer ratings</h2>
                <span className="text-xs text-muted-foreground">Recent verified experiences</span>
              </div>
              <div className="space-y-4">
                {recentRatings.map((review) => (
                  <article key={`rating-${review.source}-${review.id}`} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{review.reviewer_name}</p>
                        {review.staff_name && (
                          <p className="text-xs text-muted-foreground">with {review.staff_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">★ {review.rating.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {review.body && (
                      <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{review.body}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {proofReviewsWithImages.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Recent customer proof photos</h2>
                <span className="text-xs text-muted-foreground">Reported images are moderated</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {proofReviewsWithImages.map((review) => {
                  const imageUrl = getImageUrl(review.proof_image_url) || "";
                  const reportSubject = encodeURIComponent(`Report review proof image (${review.id})`);
                  const reportBody = encodeURIComponent(
                    `Store: ${store.name}\nStore ID: ${store.id}\nReview ID: ${review.id}\nSource: ${review.source}\nReason: `,
                  );

                  return (
                    <article key={`${review.source}-${review.id}`} className="overflow-hidden rounded-xl border border-border">
                      <img
                        src={imageUrl}
                        alt={`Proof shared by ${review.reviewer_name}`}
                        className="h-44 w-full object-cover"
                      />
                      <div className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{review.reviewer_name}</p>
                          <span className="text-xs text-muted-foreground">★ {review.rating.toFixed(1)}</span>
                        </div>
                        {review.staff_name && (
                          <p className="text-xs text-muted-foreground">for {review.staff_name}</p>
                        )}
                        {review.body && <p className="line-clamp-3 text-xs text-muted-foreground">{review.body}</p>}
                        <a
                          href={`mailto:helplokal@gmail.com?subject=${reportSubject}&body=${reportBody}`}
                          className="inline-flex text-xs font-medium text-primary hover:underline"
                        >
                          Report image
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : null,
  };

  const cartItems = products.map((p) => ({ ...p, qty: qty[p.name] ?? 0 })).filter((p) => p.qty > 0);
  const orderSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const orderDeliveryFee =
    orderFulfillment === "delivery" ? Math.max(0, Number(store.delivery_fee_gbp ?? 0)) : 0;
  const orderTotal = orderSubtotal + orderDeliveryFee;

  const selectedDayAvailability = (() => {
    if (!bookDate) return null;
    const day = getDayOfWeekInTimezone(bookDate, store?.timezone);
    return availableDays.find((a) => a.day_of_week === day) ?? null;
  })();
  const selectedDayOfWeek = selectedDayAvailability?.day_of_week ?? null;
  const availableStaffMembers =
    selectedDayOfWeek == null
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
  const today = getTodayDateInTimezone(store?.timezone);
  const isToday = bookDate === today;
  const currentTimeInTz = (() => {
    try {
      if (!store?.timezone?.trim()) {
        return { hour: now.getHours(), minute: now.getMinutes() };
      }
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: store.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
      return { hour, minute };
    } catch {
      return { hour: now.getHours(), minute: now.getMinutes() };
    }
  })();
  const currentHour = currentTimeInTz.hour;
  const currentMinute = currentTimeInTz.minute;

  // Mark slots as disabled if full or in the past
  const slotStatus = freeSlots.reduce(
    (acc, slot) => {
      const isFull =
        (slotCounts[slot] ?? 0) >= (selectedDayAvailability?.max_bookings_per_slot ?? 1);
      const isPast =
        isToday &&
        slot < `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
      acc[slot] = { disabled: isFull || isPast, reason: isFull ? "full" : isPast ? "past" : "" };
      return acc;
    },
    {} as Record<string, { disabled: boolean; reason: string }>,
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

  const copyShareUrl = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      }
    } catch {
      // Fall through to the legacy copy path below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    const copiedOk = await copyShareUrl();
    if (!copiedOk) {
      toast.error("Could not copy link", { description: shareUrl });
      return;
    }

    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Check out ${store.name} on Lokal - ${shareUrl}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleShareInstagram = async () => {
    const copiedOk = await copyShareUrl();
    if (!copiedOk) {
      toast.error("Could not copy link", { description: shareUrl });
      return;
    }

    toast("Copy the link and share it in your Instagram Story or Direct Message", { icon: "ℹ️" });
  };

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400",
    );
  };

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      "_blank",
      "width=550,height=420",
    );
  };

  const handleDownloadStoreCard = async () => {
    setDownloadingCard(true);
    try {
      const downloaded = await downloadStoreShareCard({
        storeName: store.name,
        description: store.description,
        category: store.category,
        origin: store.origin,
        imageUrl: getImageUrl(bannerImageUrl),
        logoUrl: getImageUrl(store.logo_url),
        primaryColor: storePrimaryColor,
        accentColor: storeAccentColor,
        shareUrl,
      });
      if (!downloaded) {
        toast.error("Could not create store card");
        return;
      }
      toast.success("Store card downloaded");
    } catch {
      toast.error("Could not create store card");
    } finally {
      setDownloadingCard(false);
    }
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
      toast.error(
        `Too many orders. Please wait ${rateCheck.waitMins} min${rateCheck.waitMins !== 1 ? "s" : ""} before trying again.`,
      );
      return;
    }

    const normalizedOrderPhone =
      normalizePhoneForAlerts(customerPhone, orderPhoneCountry) ?? customerPhone.trim();

    // Re-check store is still published before submitting
    setPlacingOrder(true);
    try {
      const { data: publishedCheck } = await (supabase as any)
        .from("stores")
        .select("published")
        .eq("id", store.id)
        .single();
      if (!publishedCheck?.published) {
        setStorePublished(false);
        toast.error("This store is currently unavailable. Your order was not placed.");
        setPlacingOrder(false);
        return;
      }
      const { error } = await (supabase as any).from("orders").insert({
        store_id: store.id,
        customer_id: customerId,
        reference,
        customer_name: customerName.trim(),
        customer_phone: normalizedOrderPhone,
        customer_email: customerEmail.trim() || null,
        note: orderNote.trim() || null,
        items: cartItems.map((item) => ({
          name: item.name,
          price: item.price,
          qty: item.qty,
          unit: item.unit ?? undefined,
        })),
        items_subtotal_gbp: orderSubtotal,
        delivery_fee_gbp: orderDeliveryFee,
        fulfillment_method: orderFulfillment,
        total_gbp: orderTotal,
        status: "pending_transfer",
      });
      if (error) throw error;

      // Keep shared-link orders on the same merchant notification path as the landing flow.
      void supabase.functions
        .invoke("send-whatsapp-alert", {
          body: {
            reference,
            total_gbp: orderTotal,
            currency_symbol: currencySymbol,
            customer_name: customerName.trim(),
            store_name: store.name,
            store_id: store.id,
            items: cartItems.map((item) => ({
              name: item.name,
              qty: item.qty,
              unit: item.unit,
            })),
          },
        })
        .then(({ error: fnError }) => {
          if (fnError) {
            console.error("send-order-alert failed", fnError.message);
          }
        });

      toast.success("Order placed", {
        description: `Reference ${reference}. The merchant will confirm next steps.`,
        duration: 8000,
      });
      setRevealBankDetails(true);

      setQty({});
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setOrderNote("");
      setOrderFulfillment(store.fulfillment === "delivery" ? "delivery" : "collection");
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
      toast.error("Enter phone in international format", {
        description: "Choose a country and enter your local mobile number.",
      });
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
    if (requiresAgeVerification && !bookAgeConfirmed) {
      toast.error(`Please confirm you meet the ${ageRestrictedMinimum}+ age requirement.`);
      return;
    }
    if (requiresAgeVerification && !bookIdCommitment) {
      toast.error("Please confirm you'll present valid ID at your appointment.");
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
      const { data: bookingRow, error } = await (supabase as any)
        .from("store_bookings")
        .insert({
          store_id: store.id,
          customer_id: customerId,
          customer_name: bookName.trim(),
          customer_phone: normalizedBookPhone,
          customer_email: bookEmail.trim() || null,
          service: bookService || null,
          age_restricted: requiresAgeVerification,
          minimum_age_required: ageRestrictedMinimum,
          customer_age_confirmed: requiresAgeVerification ? bookAgeConfirmed : false,
          customer_id_commitment: requiresAgeVerification ? bookIdCommitment : false,
          staff_id: selectedStaff?.id ?? null,
          staff_name: selectedStaff?.name ?? null,
          staff_phone: selectedStaff?.phone ?? null,
          slot_start: `${bookDate}T${bookTime}:00`,
          slot_end: slotEnd,
          status: "pending",
          note: bookNote.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Send confirmation to customer (fire-and-forget)
      if (bookEmail.trim()) {
        void supabase.functions.invoke("send-booking-customer-confirmation", {
          body: {
            booking_id: bookingRow?.id ?? null,
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
          age_restricted: requiresAgeVerification,
          minimum_age_required: ageRestrictedMinimum,
        },
      });

      toast.success("Booking request sent", {
        description: isTravelServiceStore
          ? `${store.name} will confirm your appointment soon and share bank transfer payment details.`
          : `${store.name} will confirm your appointment soon.`,
        duration: 8000,
      });

      const serviceDeposit = bookService
        ? store.store_products?.find((p) => p.name === bookService)?.deposit
        : undefined;
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
      setBookAgeConfirmed(false);
      setBookIdCommitment(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not request booking");
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" style={getStoreThemeStyle(store)}>
      <Navbar />

      <main className="flex-1 py-8" data-section-order={visibleSectionOrder.join(",")}>
        <div className="container mx-auto max-w-3xl px-4">
          {/* Store closed banner */}
          {!storePublished && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <span className="text-lg">🔒</span>
              <div>
                <p className="font-semibold text-destructive">This store is currently closed</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The merchant has temporarily hidden this store. Ordering and booking are disabled.
                </p>
              </div>
            </div>
          )}
          {bannerImageUrl && (
            <div className={`relative${store.logo_url ? " mb-14" : " mb-8"}`}>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <img
                  src={getImageUrl(bannerImageUrl) || ""}
                  alt={`${store.name} banner`}
                  className="h-64 w-full object-cover sm:h-96"
                />
              </div>
              {store.logo_url && (
                <div className="absolute -bottom-8 left-1/2 z-10 h-16 w-16 -translate-x-1/2 overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm sm:h-20 sm:w-20">
                  <img
                    src={getImageUrl(store.logo_url) || ""}
                    alt={`${store.name} logo`}
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
              )}
            </div>
          )}
          {/* Header with share buttons */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold">{store.name}</h1>
              {store.description && (
                <p className="mt-2 text-lg text-muted-foreground">{store.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: `${storePrimaryColor}18`, color: storePrimaryColor }}
                >
                  {store.category}
                </span>
                {store.origin && (
                  <span
                    className="rounded-full px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: `${storeAccentColor}18`, color: storeAccentColor }}
                  >
                    {store.origin}
                  </span>
                )}
                <VerificationBadge
                  verificationTier={store.verification_tier}
                  verificationReason={
                    store.verification_reason ?? "Unverified store. Buy at your own risk."
                  }
                  showUnverified
                  isTattooArtistVerified={Boolean(
                    store.is_verified_tattoo_artist && isBodyContactStore,
                  )}
                />
                {isBodyContactStore && (store.minimum_age ?? 0) >= 18 && (
                  <span
                    title="18+ only"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> 18+
                  </span>
                )}
                {isBodyContactStore && store.tattoo_license_url && (
                  <a
                    href={store.tattoo_license_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View artist licence / ID"
                    className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800 hover:opacity-80 dark:bg-teal-900/40 dark:text-teal-300"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Licence
                  </a>
                )}
                {isBodyContactStore && store.tattoo_portfolio_url && (
                  <a
                    href={store.tattoo_portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View portfolio"
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:opacity-80 dark:bg-indigo-900/40 dark:text-indigo-300"
                  >
                    <Images className="h-3.5 w-3.5" /> Portfolio
                  </a>
                )}
                {store.category === "Groceries" && store.food_business_license_url && (
                  <a
                    href={store.food_business_license_url}
                    target="_blank"
                    rel="noreferrer"
                    title={`Food business licence - Status: ${store.food_business_license_status || "pending"}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      store.food_business_license_status === "approved"
                        ? "bg-green-100 text-green-800 hover:opacity-80 dark:bg-green-900/40 dark:text-green-300"
                        : store.food_business_license_status === "rejected"
                          ? "bg-red-100 text-red-800 hover:opacity-80 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-800 hover:opacity-80 dark:bg-yellow-900/40 dark:text-yellow-300"
                    }`}
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    {store.food_business_license_status === "approved"
                      ? "Licence"
                      : store.food_business_license_status === "rejected"
                        ? "Rejected"
                        : "Pending"}
                  </a>
                )}
                {store.category === "Barbers" && store.barber_license_url && (
                  <a
                    href={store.barber_license_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View barber licence"
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 hover:opacity-80 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Certified
                  </a>
                )}
                {store.category === "Beauty Store" && store.beauty_license_url && (
                  <a
                    href={store.beauty_license_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View beauty licence"
                    className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-800 hover:opacity-80 dark:bg-pink-900/40 dark:text-pink-300"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Certified
                  </a>
                )}
                {store.category === "Hair & Beauty" && store.hair_beauty_license_url && (
                  <a
                    href={store.hair_beauty_license_url}
                    target="_blank"
                    rel="noreferrer"
                    title="View hair & beauty licence"
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 hover:opacity-80 dark:bg-purple-900/40 dark:text-purple-300"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Certified
                  </a>
                )}
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-col gap-2 sm:min-w-48">
              <Button
                onClick={handleCopyLink}
                className={`gap-2 ${storeButtonRadius} shadow-warm hover:opacity-95`}
                style={primaryButtonStyle}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadStoreCard}
                disabled={downloadingCard}
                className={`gap-2 ${storeButtonRadius}`}
              >
                {downloadingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloadingCard ? "Preparing card..." : "Download store card"}
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

          {visibleSectionOrder.map((sectionKey) => sectionBlocks[sectionKey]).filter(Boolean)}

          {/* Buy / book section */}
          <div className="mb-8 rounded-2xl border border-border bg-card p-6">
            {isBookable(store.category, store.selling_mode) ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Book with this store</h2>
                {bookingDepositDue && (
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                    <p className="font-semibold text-amber-900">✅ Booking request sent!</p>
                    {(() => {
                      const isTravelService =
                        isBookable(store.category, store.selling_mode) &&
                        (store.location_type === "travel" ||
                          store.location_type === "remote_and_travel");
                      const isPayAtStoreService =
                        isBookable(store.category, store.selling_mode) &&
                        store.location_type === "salon" &&
                        store.fulfillment === "pay_at_store";

                      return (
                        <p className="mt-1 text-sm text-amber-800">
                          To confirm your appointment, send a deposit of{" "}
                          <strong>
                            {currencySymbol}
                            {bookingDepositDue.amount.toFixed(2)}
                          </strong>
                          {bookingDepositDue.service ? ` for ${bookingDepositDue.service}` : ""}
                          {isPayAtStoreService
                            ? " by bank transfer. Remaining payment is made at the store/premises."
                            : isTravelService
                              ? " by bank transfer."
                              : " to:"}
                        </p>
                      );
                    })()}
                    <div className="mt-3 space-y-1 text-sm font-mono text-amber-900">
                      <div>
                        <span className="text-amber-600">Bank: </span>
                        {store.bank_name ?? "—"}
                      </div>
                      <div>
                        <span className="text-amber-600">Name: </span>
                        {store.bank_account_name ?? "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600">Account: </span>
                        <span>
                          {revealBankDetails
                            ? (store.bank_account_number ?? "—")
                            : `****${(store.bank_account_number ?? "").slice(-4) || "——"}`}
                        </span>
                        {!revealBankDetails && (
                          <button
                            onClick={() => setRevealBankDetails(true)}
                            className="text-xs text-amber-700 underline"
                          >
                            Reveal
                          </button>
                        )}
                      </div>
                      {store.bank_sort_code && (
                        <div>
                          <span className="text-amber-600">
                            {(REGION_BANK[store.region as Region] ?? DEFAULT_BANK).routingLabel}
                            :{" "}
                          </span>
                          {store.bank_sort_code}
                        </div>
                      )}
                    </div>
                    <button
                      className="mt-3 text-sm text-amber-800 underline"
                      onClick={() => setBookingDepositDue(null)}
                    >
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
                            {renderPreviewableImage(
                              p.image_url,
                              p.name,
                              "h-9 w-9 rounded-md object-cover",
                            )}
                            {p.name}
                          </span>
                          <span className="font-semibold">
                            {currencySymbol}
                            {p.price.toFixed(2)}
                            {p.unit ? ` / ${p.unit}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableDays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Online booking is not enabled yet. Use phone or social links above.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {products.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Service</p>
                        <Select value={bookService} onValueChange={setBookService}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a service" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.name} value={p.name}>
                                {p.name} - {currencySymbol}
                                {p.price.toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {staffMembers.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Team member *
                        </p>
                        <select
                          value={bookStaffId}
                          onChange={(e) => setBookStaffId(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Choose who you want to book with</option>
                          {availableStaffMembers.map((m) => {
                            const r = staffRatingMap[m.id];
                            const atCapacity =
                              !!bookDate &&
                              m.daily_capacity != null &&
                              (staffBookingCounts[m.id] ?? 0) >= m.daily_capacity;
                            const dayLabel =
                              Array.isArray(m.available_days) && m.available_days.length > 0
                                ? m.available_days
                                    .slice()
                                    .sort((a, b) => a - b)
                                    .map((d) => DAY_LABELS[d])
                                    .join(",")
                                : "All days";
                            return (
                              <option key={m.id} value={m.id} disabled={atCapacity}>
                                {m.name}
                                {r ? ` - ${r.avg.toFixed(1)} (${r.count} review${r.count !== 1 ? "s" : ""})` : ""}
                                {` - ${dayLabel}`}
                                {atCapacity ? " - Full on selected day" : ""}
                              </option>
                            );
                          })}
                        </select>
                        {bookDate && availableStaffMembers.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600">
                            No team members are available on this day. Pick another date.
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Date *</p>
                      <Input
                        type="date"
                        value={bookDate}
                        min={(() => {
                          const today = getTodayDateInTimezone(store?.timezone);
                          const [y, m, d] = today.split("-").map(Number);
                          const nextDay = new Date(y, m - 1, d + 1);
                          return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
                        })()}
                        max={(() => {
                          const today = getTodayDateInTimezone(store?.timezone);
                          const [y, m, d] = today.split("-").map(Number);
                          const maxDay = new Date(y, m - 1, d + 28);
                          return `${maxDay.getFullYear()}-${String(maxDay.getMonth() + 1).padStart(2, "0")}-${String(maxDay.getDate()).padStart(2, "0")}`;
                        })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setBookDate("");
                            return;
                          }
                          const day = getDayOfWeekInTimezone(val, store?.timezone);
                          if (!availableDays.some((a) => a.day_of_week === day)) {
                            toast.error("No availability on this day");
                            return;
                          }
                          setBookDate(val);
                        }}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Booking days: {availableDays.map((a) => `${DAY_LABELS[a.day_of_week]} ${a.start_time.slice(0, 5)}-${a.end_time.slice(0, 5)}`).join(", ")}
                      </p>
                    </div>
                    {bookDate && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Time slot *
                        </p>
                        {loadingSlots ? (
                          <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading slots...
                          </div>
                        ) : (
                          (() => {
                            const availableSlots = freeSlots.filter((s) => !slotStatus[s]?.disabled);
                            if (availableSlots.length === 0)
                              return (
                                <p className="mt-1 text-sm text-amber-600">
                                  No available slots on this day - try another date.
                                </p>
                              );
                            return (
                              <Select value={bookTime} onValueChange={setBookTime}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pick a time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {freeSlots.map((slot) => {
                                    const status = slotStatus[slot];
                                    return (
                                      <SelectItem key={slot} value={slot} disabled={status.disabled}>
                                        {slot}
                                        {status.disabled && status.reason === "full" ? " (Full)" : ""}
                                        {status.disabled && status.reason === "past" ? " (Passed)" : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          })()
                        )}
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Your name *</p>
                      <Input
                        value={bookName}
                        onChange={(e) => setBookName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Phone *</p>
                      <div className="mt-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5 sm:col-span-4">
                          <Select
                            value={bookPhoneCountry}
                            onValueChange={(v) => setBookPhoneCountry(v as CountryCode)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRY_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-7 sm:col-span-8">
                          <Input
                            value={bookPhone}
                            onChange={(e) => setBookPhone(e.target.value)}
                            placeholder="Local number"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Email (optional - confirmations and fallback updates)
                      </p>
                      <Input
                        value={bookEmail}
                        onChange={(e) => setBookEmail(e.target.value)}
                        placeholder="you@example.com"
                        type="email"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        If WhatsApp/SMS cannot be delivered, we'll use this email when provided.
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Note (optional)
                      </p>
                      <Textarea
                        value={bookNote}
                        onChange={(e) => setBookNote(e.target.value)}
                        rows={2}
                        placeholder="Anything the merchant should know?"
                      />
                    </div>
                    {requiresAgeVerification && (
                      <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="font-medium">Age and ID confirmation required</p>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={bookAgeConfirmed}
                            onChange={(e) => setBookAgeConfirmed(e.target.checked)}
                          />
                          <span>
                            I confirm I meet the minimum age requirement ({ageRestrictedMinimum}+).
                          </span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={bookIdCommitment}
                            onChange={(e) => setBookIdCommitment(e.target.checked)}
                          />
                          <span>
                            I will present a valid government-issued ID before service starts.
                          </span>
                        </label>
                      </div>
                    )}
                    {(() => {
                      const serviceDeposit = bookService
                        ? store.store_products?.find((p) => p.name === bookService)?.deposit
                        : undefined;
                      const depositAmount = serviceDeposit ?? store.deposit_amount;
                      return depositAmount ? (
                        <div className="sm:col-span-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                          💳 A deposit of{" "}
                          <strong>
                            {currencySymbol}
                            {Number(depositAmount).toFixed(2)}
                          </strong>{" "}
                          is required to confirm this appointment. Please send it to:
                          <div className="mt-2 space-y-1 text-xs font-mono">
                            <div>
                              <span className="text-amber-600">Bank: </span>
                              {store.bank_name ?? "—"}
                            </div>
                            <div>
                              <span className="text-amber-600">Name: </span>
                              {store.bank_account_name ?? "—"}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-600">Account: </span>
                              <span>
                                {revealBankDetails
                                  ? (store.bank_account_number ?? "—")
                                  : `****${(store.bank_account_number ?? "").slice(-4) || "——"}`}
                              </span>
                              {!revealBankDetails && (
                                <button
                                  onClick={() => setRevealBankDetails(true)}
                                  className="text-amber-700 underline"
                                >
                                  Reveal
                                </button>
                              )}
                            </div>
                            {store.bank_sort_code && (
                              <div>
                                <span className="text-amber-600">
                                  {
                                    (REGION_BANK[store.region as Region] ?? DEFAULT_BANK)
                                      .routingLabel
                                  }
                                  :{" "}
                                </span>
                                {store.bank_sort_code}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    <div className="sm:col-span-2">
                      <Button
                        onClick={handleBook}
                        disabled={
                          submittingBooking ||
                          !bookDate ||
                          !bookTime ||
                          !bookName.trim() ||
                          !bookPhone.trim() ||
                          (staffMembers.length > 0 &&
                            (!bookStaffId || (!!bookDate && availableStaffMembers.length === 0))) ||
                          (requiresAgeVerification && (!bookAgeConfirmed || !bookIdCommitment)) ||
                          !storePublished
                        }
                        className={`w-full ${storeButtonRadius} shadow-warm hover:opacity-95`}
                        style={primaryButtonStyle}
                      >
                        {submittingBooking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Request booking"
                        )}
                      </Button>
                      {!storePublished && (
                        <p className="mt-2 text-xs text-center text-destructive">
                          This store is currently closed.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Buy from this store</h2>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No products listed yet. Use phone or social links above to enquire.
                  </p>
                ) : (
                  <>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {products.map((p) => {
                        const count = qty[p.name] ?? 0;
                        return (
                          <div key={p.name} className="flex items-center justify-between gap-4 p-3">
                            <div className="flex items-center gap-3">
                              {renderPreviewableImage(
                                p.image_url,
                                p.name,
                                "h-12 w-12 rounded-md object-cover",
                              )}
                              <div>
                                <p className="text-sm font-medium">{p.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {currencySymbol}
                                  {p.price.toFixed(2)}
                                  {p.unit ? ` / ${p.unit}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setQty((prev) => ({ ...prev, [p.name]: Math.max(0, count - 1) }))
                                }
                              >
                                -
                              </Button>
                              <span className="w-6 text-center text-sm font-semibold">{count}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setQty((prev) => ({ ...prev, [p.name]: count + 1 }))}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Your name *
                        </p>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Phone *</p>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-5 sm:col-span-4">
                            <Select
                              value={orderPhoneCountry}
                              onValueChange={(v) => setOrderPhoneCountry(v as CountryCode)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COUNTRY_OPTIONS.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-7 sm:col-span-8">
                            <Input
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="Local number"
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Use a WhatsApp-enabled mobile number for faster updates.
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Email (optional — fallback updates)
                        </p>
                        <Input
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="you@example.com"
                          type="email"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Order note (optional)
                        </p>
                        <Textarea
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          rows={2}
                          placeholder="Any substitutions or notes?"
                        />
                      </div>
                      {(store.fulfillment === "both" || store.fulfillment === "delivery") && (
                        <div className="sm:col-span-2">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Fulfilment
                          </p>
                          {store.fulfillment === "both" ? (
                            <Select
                              value={orderFulfillment}
                              onValueChange={(value) =>
                                setOrderFulfillment(value as "collection" | "delivery")
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="collection">🏪 Collection</SelectItem>
                                <SelectItem value="delivery">
                                  🚚 Delivery ({currencySymbol}
                                  {Number(store.delivery_fee_gbp ?? 0).toFixed(2)} fee)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                              🚚 Delivery (fee: {currencySymbol}
                              {Number(store.delivery_fee_gbp ?? 0).toFixed(2)})
                            </div>
                          )}
                        </div>
                      )}
                      <div className="sm:col-span-2 rounded-md bg-secondary px-3 py-2 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Subtotal</span>
                            <span className="font-medium">
                              {currencySymbol}
                              {orderSubtotal.toFixed(2)}
                            </span>
                          </div>
                          {orderFulfillment === "delivery" && (
                            <div className="flex items-center justify-between">
                              <span>Delivery fee</span>
                              <span className="font-medium">
                                {currencySymbol}
                                {orderDeliveryFee.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t border-border pt-1">
                            <span>Total</span>
                            <span className="font-semibold">
                              {currencySymbol}
                              {orderTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {revealBankDetails && store.bank_account_name && (
                        <div className="sm:col-span-2 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm">
                          <p className="font-semibold text-green-800 mb-2">
                            ✅ Order placed — please send your transfer to:
                          </p>
                          <div className="space-y-1 font-mono text-green-900">
                            <div>
                              <span className="text-green-600">Bank: </span>
                              {store.bank_name ?? "—"}
                            </div>
                            <div>
                              <span className="text-green-600">Name: </span>
                              {store.bank_account_name}
                            </div>
                            <div>
                              <span className="text-green-600">Account: </span>
                              {store.bank_account_number}
                            </div>
                            {store.bank_sort_code && (
                              <div>
                                <span className="text-green-600">
                                  {
                                    (REGION_BANK[store.region as Region] ?? DEFAULT_BANK)
                                      .routingLabel
                                  }
                                  :{" "}
                                </span>
                                {store.bank_sort_code}
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-green-700">
                            Use reference <span className="font-mono font-bold">{reference}</span>{" "}
                            as the payment reference.
                          </p>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Button
                          onClick={handlePlaceOrder}
                          disabled={
                            placingOrder ||
                            cartItems.length === 0 ||
                            !customerName.trim() ||
                            !customerPhone.trim() ||
                            !storePublished
                          }
                          className={`w-full ${storeButtonRadius} shadow-warm hover:opacity-95`}
                          style={primaryButtonStyle}
                        >
                          {placingOrder ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `Place order (${reference})`
                          )}
                        </Button>
                        {!storePublished && (
                          <p className="mt-2 text-xs text-center text-destructive">
                            This store is currently closed.
                          </p>
                        )}
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
              <h2 className="text-xl font-bold">
                {isTravelServiceStore ? "Service details" : "Visit us"}
              </h2>

              {isTravelServiceStore ? (
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">We travel to you</p>
                    <p className="text-sm text-muted-foreground">
                      No fixed customer-facing address is shown.
                    </p>
                  </div>
                </div>
              ) : (
                store.address && (
                  <div className="flex gap-3">
                    <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{store.address}</p>
                      {store.city && (
                        <p className="text-sm text-muted-foreground">
                          {store.city}
                          {store.postcode ? `, ${store.postcode}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}

              {showHours && store.hours && (
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Opening hours</p>
                      {(() => {
                        const open = isStoreOpenNow(store.store_availability, store.hours, store.timezone);
                        if (open === true)
                          return (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              🟢 Open
                            </span>
                          );
                        if (open === false)
                          return (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              ⚫ Closed
                            </span>
                          );
                        return null;
                      })()}
                    </div>
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Fulfilment
                  </p>
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
                    {store.fulfillment === "pay_at_store" && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                        💰 Pay at store
                      </span>
                    )}
                  </div>
                </div>
              )}
              {isBookable(store.category, store.selling_mode) && (store as any).location_type && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Service location
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {store.location_type === "salon" && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        🏠 At store / premises
                      </span>
                    )}
                    {(store.location_type === "travel" ||
                      store.location_type === "remote_and_travel") && (
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        🚗 We travel to you
                      </span>
                    )}
                    {(store.location_type === "remote" ||
                      store.location_type === "remote_and_travel") && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        💻 Remote / online
                      </span>
                    )}
                    {store.location_type === "salon" && store.fulfillment === "pay_at_store" && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                        💰 Pay at store
                      </span>
                    )}
                    {(store.location_type === "travel" ||
                      store.location_type === "remote_and_travel") && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        🏦 Bank transfer only
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(store.refund_policy ||
                store.cancellation_policy ||
                typeof store.accepts_refunds === "boolean") && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Refunds & cancellation
                  </p>
                  <p className="text-sm font-medium">
                    Refunds:{" "}
                    {store.accepts_refunds
                      ? "Accepted (subject to merchant policy)"
                      : "Not accepted"}
                  </p>
                  {store.refund_policy && (
                    <p className="mt-1 text-sm text-muted-foreground">{store.refund_policy}</p>
                  )}
                  {store.cancellation_policy && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {store.cancellation_policy}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Social links */}
            {showSocials && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <h2 className="text-xl font-bold">Connect</h2>

                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
                  >
                    <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <p className="truncate text-sm text-primary hover:underline">{websiteHref}</p>
                    </div>
                  </a>
                )}

                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
                  >
                    <span className="mt-0.5 text-xl">📷</span>
                    <div>
                      <p className="text-sm font-medium">Instagram</p>
                      <p className="truncate text-sm text-primary hover:underline">Open profile</p>
                    </div>
                  </a>
                )}

                {tiktokHref && (
                  <a
                    href={tiktokHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
                  >
                    <span className="mt-0.5 text-xl">🎵</span>
                    <div>
                      <p className="text-sm font-medium">TikTok</p>
                      <p className="truncate text-sm text-primary hover:underline">Open profile</p>
                    </div>
                  </a>
                )}

                {!websiteHref && !instagramHref && !tiktokHref && (
                  <p className="text-sm text-muted-foreground">No social links available yet.</p>
                )}
              </div>
            )}

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

      <Dialog open={Boolean(previewImage)} onOpenChange={closeImagePreview}>
        <DialogContent className="max-w-4xl overflow-hidden p-0 sm:max-h-[90vh]">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>{previewImage?.alt ?? "Image preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[75vh] items-center justify-center bg-black/95 p-4">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preview...
              </div>
            ) : previewImage && !previewUnsupported ? (
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                className="max-h-[70vh] w-auto max-w-full object-contain"
                onError={() => setPreviewUnsupported(true)}
              />
            ) : (
              <div className="space-y-3 px-4 py-10 text-center text-white">
                <p className="text-sm text-white/80">
                  This browser cannot render that image format in-app.
                </p>
                {previewImage && (
                  <a
                    href={previewImage.src}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Open original file
                  </a>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
