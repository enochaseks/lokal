import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Store as StoreIcon,
  Landmark,
  Package,
  Calendar,
  Check,
  ArrowLeft,
  Loader2,
  UserCheck,
  Mail,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Navbar } from "@/components/lokal/Navbar";
import { NavigationLoadingScreen } from "@/components/lokal/NavigationLoadingOverlay";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import {
  LIVE_CATEGORIES,
  LIVE_ORIGINS,
  REGIONS,
  REGION_ADDRESS,
  DEFAULT_AREA,
  REGION_BANK,
  DEFAULT_BANK,
  isStoreBookable,
  getCategorySubcategories,
  isValidStoreSubcategory,
} from "@/data/stores";
import type { Region, SellingMode } from "@/data/stores";
import {
  getImageUrl,
  isBodyContactService,
  normalizeInstagramHandle,
  normalizeTikTokHandle,
  normalizeWebsiteUrl,
} from "@/lib/utils";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import xIcon from "@/assets/X_icon.svg.png";

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

function getDetectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isValidIanaTimezone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Could not load the form</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {import.meta.env.DEV ? error.message : "Something went wrong. Please try again."}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/list-store")({
  validateSearch: (s) => ({
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  errorComponent: RouteError,
  component: ListStorePage,
  head: () => ({
    meta: [
      { title: "Get More Local Customers — List Your African Shop Free on Lokal" },
      {
        name: "description",
        content:
          "Own an African or Caribbean shop, barber or beauty store? List free on Lokal and start getting local customers online — no website needed, no fees.",
      },
      { property: "og:title", content: "Get More Local Customers — List Your African Shop Free on Lokal" },
      {
        property: "og:description",
        content:
          "Join Lokal free and get your African or Caribbean shop found by nearby customers. Take direct orders in minutes — no website, no setup fees.",
      },
    ],
  }),
});

const CATEGORIES = LIVE_CATEGORIES;
const ORIGINS = LIVE_ORIGINS;
const PAY_AT_STORE_ONLY_CATEGORIES = new Set(["Barbers", "Hair & Beauty", "Body Arts & Crafts"]);

function isValidImageReference(value: string) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return /^[^\s/]+(?:\/[^\s/]+)+$/.test(value);
  }
}

const isBodyArtsArtistStore = (category: string, subcategory?: string | null) =>
  isBodyContactService(category, subcategory);

const isGroceryStore = (category: string) => category === "Groceries";

const storeSchema = z
  .object({
    name: z.string().trim().min(2, "Store name is too short").max(80),
    category: z.enum(CATEGORIES),
    selling_mode: z.enum(["products", "services"]).optional(),
    subcategory: z.string().trim().max(60).optional(),
    minimum_age: z.number().int().min(18).max(99).optional().nullable(),
    tattoo_portfolio_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid portfolio URL")
      .optional()
      .or(z.literal("")),
    tattoo_license_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid licence URL")
      .optional()
      .or(z.literal("")),
    barber_license_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid licence URL")
      .optional()
      .or(z.literal("")),
    beauty_license_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid licence URL")
      .optional()
      .or(z.literal("")),
    hair_beauty_license_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid licence URL")
      .optional()
      .or(z.literal("")),
    food_business_license_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid licence URL")
      .optional()
      .or(z.literal("")),
    health_safety_certificate_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid certificate URL")
      .optional()
      .or(z.literal("")),
    origin: z.enum(ORIGINS, { message: "Please select an African/Caribbean origin" }),
    description: z.string().trim().max(500).optional(),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(60).optional(),
    timezone: z
      .string()
      .trim()
      .min(1, "Timezone is required")
      .refine(isValidIanaTimezone, "Enter a valid IANA timezone (e.g. Africa/Lagos)"),
    postcode: z.string().trim().max(20).optional(),
    hours: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    merchant_sms_alerts: z.boolean().default(true),
    merchant_email_alerts: z.boolean().default(true),
    fulfillment: z.enum(["collection", "delivery", "both", "pay_at_store"]).default("collection"),
    delivery_fee_gbp: z.number().min(0).max(9999).default(0),
    image_url: z
      .string()
      .trim()
      .max(500)
      .refine(isValidImageReference, "Must be a valid URL")
      .optional()
      .or(z.literal("")),
    instagram_handle: z.string().trim().max(80).optional(),
    tiktok_handle: z.string().trim().max(80).optional(),
    website_url: z
      .string()
      .trim()
      .max(200)
      .refine((value) => !value || !!normalizeWebsiteUrl(value), "Must be a valid website")
      .optional(),
    accepts_refunds: z.boolean().default(false),
    refund_policy: z.string().trim().max(1000).optional(),
    cancellation_policy: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => isValidStoreSubcategory(value.category, value.subcategory, value.selling_mode),
    {
      message: "Please choose a valid subcategory for this category",
      path: ["subcategory"],
    },
  )
  .refine(
    (value) => {
      const requiresCertificate =
        value.category === "Groceries" && value.subcategory === "Meat & Fish";
      if (!requiresCertificate) return true;
      return !!value.health_safety_certificate_url?.trim();
    },
    {
      message: "Health and safety certificate is required for Meat & Fish",
      path: ["health_safety_certificate_url"],
    },
  )
  .refine(
    (value) => {
      if (!isBodyArtsArtistStore(value.category, value.subcategory)) return true;
      return !!value.tattoo_portfolio_url?.trim();
    },
    {
      message: "Artist portfolio URL is required for Body Arts touch services",
      path: ["tattoo_portfolio_url"],
    },
  )
  .refine(
    (value) => {
      if (!isBodyArtsArtistStore(value.category, value.subcategory)) return true;
      return !!value.tattoo_license_url?.trim();
    },
    {
      message: "Artist licence/ID URL is required for Body Arts touch services",
      path: ["tattoo_license_url"],
    },
  )
  .refine(
    (value) => {
      if (!isGroceryStore(value.category)) return true;
      return !!value.food_business_license_url?.trim();
    },
    {
      message: "Food business licence URL is required for grocery stores",
      path: ["food_business_license_url"],
    },
  )
  .refine(
    (value) => {
      if (!isBodyArtsArtistStore(value.category, value.subcategory)) return true;
      return (value.minimum_age ?? 0) >= 18;
    },
    {
      message: "Body Arts touch services must enforce a minimum age of at least 18",
      path: ["minimum_age"],
    },
  )
  .refine(
    (value) => {
      if (value.category !== "Body Arts & Crafts") return true;
      return !!value.city?.trim();
    },
    {
      message:
        "City is required so customers can discover nearby Body Arts & Crafts services first",
      path: ["city"],
    },
  );

const bankSchema = z.object({
  bank_name: z.string().trim().min(2).max(60),
  bank_account_name: z.string().trim().min(2).max(80),
  bank_account_number: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "Digits only"),
  bank_sort_code: z.string().trim().max(10).optional(),
});

type Product = { name: string; price: string; unit: string; deposit: string; image_url: string };
type DayDraft = {
  day: number;
  active: boolean;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_bookings_per_slot: number;
};
type StaffDraft = { name: string; phone: string };

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "store"
  );
}

function describeDbError(err: any): string {
  const code = String(err?.code ?? "").trim();
  const message = String(err?.message ?? "").trim();
  const details = String(err?.details ?? "").trim();
  const hint = String(err?.hint ?? "").trim();
  return [
    code ? `code=${code}` : "",
    message,
    details ? `details=${details}` : "",
    hint ? `hint=${hint}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function ListStorePage() {
  const { user, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const { category: categoryParam } = Route.useSearch();
  const initialCategory: (typeof CATEGORIES)[number] =
    categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam)
      ? (categoryParam as (typeof CATEGORIES)[number])
      : "Groceries";
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  // Inline auth (step 4)
  const [authTab, setAuthTab] = useState<"signup" | "signin">("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [region, setRegion] = useState<Region>("GB");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("GB");

  const [store, setStore] = useState({
    name: "",
    category: initialCategory,
    origin: ORIGINS[0] as (typeof ORIGINS)[number],
    subcategory: "",
    minimum_age: null as number | null,
    tattoo_portfolio_url: "",
    tattoo_license_url: "",
    barber_license_url: "",
    beauty_license_url: "",
    hair_beauty_license_url: "",
    food_business_license_url: "",
    health_safety_certificate_url: "",
    description: "",
    address: "",
    city: "",
    postcode: "",
    timezone: getDetectedTimezone(),
    hours: "",
    phone: "",
    merchant_sms_alerts: true,
    merchant_email_alerts: true,
    fulfillment: "collection" as "collection" | "delivery" | "both" | "pay_at_store",
    delivery_fee_gbp: 0,
    image_url: "",
    instagram_handle: "",
    tiktok_handle: "",
    website_url: "",
    location_type: "salon" as "salon" | "remote" | "travel" | "remote_and_travel",
    accepts_refunds: false,
    refund_policy: "",
    cancellation_policy: "",
    selling_mode: "products" as SellingMode,
  });
  const [bank, setBank] = useState({
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_sort_code: "",
  });
  const [products, setProducts] = useState<Product[]>([
    { name: "", price: "", unit: "", deposit: "", image_url: "" },
  ]);
  const [schedule, setSchedule] = useState<DayDraft[]>(
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      active: false,
      start_time: "09:00",
      end_time: "18:00",
      slot_duration_mins: 30,
      max_bookings_per_slot: 1,
    })),
  );
  const [staff, setStaff] = useState<StaffDraft[]>([]);
  const isServiceStore = isStoreBookable(store.category, store.selling_mode);
  const forcePayAtStore = PAY_AT_STORE_ONLY_CATEGORIES.has(store.category);
  const requiresFixedAddress = !isServiceStore || store.location_type === "salon";

  useEffect(() => {
    // route guard handled by beforeLoad
  }, []);

  useEffect(() => {
    trackEvent("merchant_onboarding_visit", { page: "list-store" });
  }, []);

  // Restore a draft saved before email confirmation and auto-submit
  const DRAFT_KEY = "lokal:pending-store-draft";
  useEffect(() => {
    if (loading || !user) return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      localStorage.removeItem(DRAFT_KEY);
      setStore((prev) => ({
        ...prev,
        ...draft.store,
        merchant_sms_alerts: draft.store?.merchant_sms_alerts ?? true,
        merchant_email_alerts: draft.store?.merchant_email_alerts ?? true,
      }));
      setBank(draft.bank);
      setProducts(draft.products);
      setSchedule(draft.schedule);
      setStaff(draft.staff ?? []);
      setPendingSubmit(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // Fire submit once state has settled after draft restore
  useEffect(() => {
    if (pendingSubmit && user && !submitting) {
      setPendingSubmit(false);
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubmit, user]);

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ store, bank, products, schedule, staff }),
    );
  }

  function getAuthSiteOrigin() {
    const configured = (import.meta.env.VITE_SITE_URL || "").trim().replace(/\/$/, "");
    if (configured) return configured;
    if (typeof window === "undefined") return "https://lokalshops.co.uk";
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1"
      ? window.location.origin
      : "https://lokalshops.co.uk";
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      toast.error("Create your account first", {
        description: "Complete step 4 to upload photos.",
      });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      // Store relative path, not the full Supabase URL
      setStore((s) => ({ ...s, image_url: path }));
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addProduct = () =>
    setProducts((p) => [...p, { name: "", price: "", unit: "", deposit: "", image_url: "" }]);
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, key: keyof Product, value: string) =>
    setProducts((p) => p.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const uploadProductImage = async (i: number, file: File) => {
    if (!user) {
      toast.error("Create your account first", {
        description: "Complete step 4 to upload photos.",
      });
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/products/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from("store-images")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Photo upload failed");
      return;
    }
    updateProduct(i, "image_url", path);
  };

  const validateStep1 = () => {
    const r = storeSchema.safeParse(store);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return false;
    }
    return true;
  };
  const validateStep2 = () => {
    const r = bankSchema.safeParse(bank);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const validProducts = products.filter((p) => p.name.trim() && p.price.trim());
    if (validProducts.length === 0) {
      toast.error(`Add at least one ${isServiceStore ? "service" : "product"} before continuing`);
      return false;
    }
    return true;
  };

  const handleStep3Continue = () => {
    if (!validateStep3()) return;
    if (user) {
      // Already signed in — submit directly
      handleSubmit();
    } else {
      setStep(4);
    }
  };

  const handleInlineSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      // handleSubmit will fire via the pendingSubmit useEffect once user state updates
      setPendingSubmit(true);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      toast.error(
        msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")
          ? "Incorrect email or password."
          : msg || "Could not sign in.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleInlineSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      saveDraft();
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          emailRedirectTo: `${getAuthSiteOrigin()}/auth/callback?redirect=/list-store`,
          data: { display_name: authName.trim() || undefined },
        },
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (err: any) {
      localStorage.removeItem(DRAFT_KEY);
      const msg = String(err?.message ?? "");
      toast.error(msg || "Could not create account. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleInlineOAuth = async (provider: "google" | "x") => {
    setAuthBusy(true);
    try {
      saveDraft();
      const callbackUrl = `${getAuthSiteOrigin()}/auth/callback?redirect=/list-store`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      toast.error(`Could not continue with ${provider === "google" ? "Google" : "X"}`);
      setAuthBusy(false);
    }
  };

  const handleStep1Continue = () => {
    if (!validateStep1()) return;
    if (!onboardingStarted) {
      trackEventOnce("merchant_onboarding_start", `start:${user?.id ?? "anon"}`, {
        step: 1,
        category: store.category,
      });
      setOnboardingStarted(true);
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error("Please sign in to save your store.");
      return;
    }
    const isBarber = isServiceStore;
    const validProducts = products.filter((p) => p.name.trim() && p.price.trim());
    if (validProducts.length === 0) {
      toast.error(`Add at least one ${isBarber ? "service" : "product"} before submitting`);
      return;
    }

    trackEvent("merchant_onboarding_submit", {
      step: 3,
      store_category: store.category,
      listing_count: validProducts.length,
      is_service_store: isBarber,
    });

    setSubmitting(true);
    try {
      const slug = `${slugify(store.name)}-${Math.random().toString(36).slice(2, 6)}`;
      const parsedStore = storeSchema.parse(store);
      const requiresFoodSafetyApproval =
        parsedStore.category === "Groceries" && parsedStore.subcategory === "Meat & Fish";
      const toNullable = (value?: string) => {
        const trimmed = (value ?? "").trim();
        return trimmed ? trimmed : null;
      };
      const payload = {
        ...parsedStore,
        ...bankSchema.parse(bank),
        owner_id: currentUser.id,
        slug,
        region,
        currency: REGIONS[region].currency,
        phone: normalizePhoneForAlerts(store.phone, phoneCountry) ?? parsedStore.phone ?? null,
        image_url: store.image_url || null,
        instagram_handle: normalizeInstagramHandle(store.instagram_handle),
        tiktok_handle: normalizeTikTokHandle(store.tiktok_handle),
        website_url: normalizeWebsiteUrl(store.website_url),
        fulfillment:
          PAY_AT_STORE_ONLY_CATEGORIES.has(parsedStore.category)
            ? "pay_at_store"
            : parsedStore.fulfillment,
        delivery_fee_gbp:
          parsedStore.fulfillment === "delivery" || parsedStore.fulfillment === "both"
            ? Number(parsedStore.delivery_fee_gbp ?? 0)
            : 0,
        address: requiresFixedAddress ? toNullable(parsedStore.address) : null,
        city: requiresFixedAddress ? toNullable(parsedStore.city) : null,
        timezone: parsedStore.timezone,
        postcode: requiresFixedAddress ? toNullable(parsedStore.postcode) : null,
        location_type: isServiceStore ? store.location_type : null,
        selling_mode: store.category === "Clothes & Fashion" ? store.selling_mode : null,
        subcategory: parsedStore.subcategory?.trim() ? parsedStore.subcategory.trim() : null,
        minimum_age: parsedStore.minimum_age ?? null,
        tattoo_portfolio_url: parsedStore.tattoo_portfolio_url?.trim()
          ? parsedStore.tattoo_portfolio_url.trim()
          : null,
        tattoo_license_url: parsedStore.tattoo_license_url?.trim()
          ? parsedStore.tattoo_license_url.trim()
          : null,
        is_verified_tattoo_artist: false,
        food_business_license_url: parsedStore.food_business_license_url?.trim()
          ? parsedStore.food_business_license_url.trim()
          : null,
        health_safety_certificate_url: parsedStore.health_safety_certificate_url?.trim()
          ? parsedStore.health_safety_certificate_url.trim()
          : null,
        health_safety_certificate_status: requiresFoodSafetyApproval ? "pending" : "not_required",
      };

      let newStore: { id: string } | null = null;
      {
        const { data, error: storeErr } = await (supabase as any)
          .from("stores")
          .insert(payload)
          .select("id")
          .single();

        if (storeErr) {
          const message = String(storeErr?.message ?? "");
          if (
            /published_requires_verified|stores_meat_fish_publish_approval_check/i.test(message)
          ) {
            const fallbackPayload = { ...payload, published: false };
            const { data: retryData, error: retryErr } = await (supabase as any)
              .from("stores")
              .insert(fallbackPayload)
              .select("id")
              .single();
            if (retryErr) throw retryErr;
            newStore = retryData ?? null;
          } else {
            throw storeErr;
          }
        } else {
          newStore = data ?? null;
        }
      }

      if (!newStore?.id) throw new Error("Could not create store");

      // Run fraud detection check
      try {
        const fraudCheckResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fraud-check`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: currentUser.id,
              email: currentUser.email,
              display_name: currentUser.user_metadata?.display_name || "",
              store_name: store.name,
              store_category: store.category,
              phone: normalizePhoneForAlerts(store.phone, phoneCountry) || "",
              metadata: {
                address: store.address,
                description: store.description,
                city: store.city,
                subcategory: store.subcategory || null,
              },
              entity_type: "store",
            }),
          },
        );

        if (fraudCheckResponse.ok) {
          const fraudResult = await fraudCheckResponse.json();
          if (fraudResult.risk_level === "high") {
            toast.warning("Your account is under review", {
              description:
                "We've flagged some details for security review. An admin will approve your store soon.",
            });
          }
        }
      } catch (fraudErr) {
        // Log but don't fail the store creation if fraud check fails
        console.error("Fraud check failed:", fraudErr);
      }

      if (validProducts.length > 0) {
        const productRows = validProducts.map((p, i) => ({
          store_id: newStore.id,
          name: p.name.trim().slice(0, 80),
          price: Number(p.price),
          unit: p.unit.trim() || null,
          deposit: p.deposit.trim() ? Number(p.deposit) : null,
          image_url: p.image_url || null,
          position: i,
        }));
        const { error: prodErr } = await (supabase as any)
          .from("store_products")
          .insert(productRows);
        if (prodErr) throw prodErr;
      }

      if (isBarber) {
        const validStaff = staff.filter((m) => m.name.trim());
        if (validStaff.length > 0) {
          const staffRows = validStaff.map((m, i) => ({
            store_id: newStore.id,
            name: m.name.trim(),
            phone: m.phone.trim() || null,
            active: true,
            position: i,
          }));
          await (supabase as any).from("store_staff").insert(staffRows);
        }
      }

      const activeDays = schedule.filter((d) => d.active);
      if (activeDays.length > 0) {
        const { error: availErr } = await (supabase as any).from("store_availability").insert(
          activeDays.map((d) => ({
            store_id: newStore.id,
            day_of_week: d.day,
            start_time: d.start_time,
            end_time: d.end_time,
            slot_duration_mins: isServiceStore ? d.slot_duration_mins : 60,
            max_bookings_per_slot: isServiceStore ? d.max_bookings_per_slot : 1,
          })),
        );
        if (availErr) throw availErr;
      }

      // Promote to merchant role
      await supabase.from("user_roles").insert({ user_id: currentUser.id, role: "merchant" });
      await refreshRoles();

      trackEvent("merchant_onboarding_success", {
        store_id: newStore.id,
        store_category: store.category,
        listing_count: validProducts.length,
      });

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "lokal:new-store-onboarding",
          JSON.stringify({ storeId: newStore.id, createdAt: Date.now() }),
        );
      }

      if (requiresFoodSafetyApproval) {
        toast.success("Store created and sent for review", {
          description:
            "Your Meat & Fish store now needs verification and certificate approval before it can go live.",
        });
      } else {
        toast.success("Store created", {
          description:
            "Your store is saved. Submit verification from the merchant dashboard to go live.",
        });
      }
      navigate({ to: "/merchant" });
    } catch (e: any) {
      const message = String(e?.message ?? "");
      const diagnostic = describeDbError(e);
      if (diagnostic) console.error("Store onboarding insert failed:", diagnostic, e);
      if (/published_requires_verified/i.test(message)) {
        toast.error("Store saved as draft", {
          description:
            "Your store must be verified before publishing. Submit a verification request in the merchant dashboard.",
        });
      } else if (/stores_fulfillment_check/i.test(message)) {
        toast.error("Fulfilment mode not accepted by database", {
          description: "Apply the pay_at_store fulfillment migration in Supabase, then retry.",
        });
      } else if (/stores_region_check/i.test(message)) {
        toast.error("Selected region is blocked by database", {
          description: "Apply the latest region-constraint migration in Supabase, then retry.",
        });
      } else if (/stores_origin_allowed_check/i.test(message)) {
        toast.error("Selected origin is blocked by database", {
          description: "Apply the latest origin-constraint migration in Supabase, then retry.",
        });
      } else {
        toast.error(diagnostic || "Could not save your store");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <NavigationLoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <button
          onClick={() => navigate({ to: "/" })}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Lokal
        </button>

        <h1 className="font-display text-4xl font-bold md:text-5xl">List your store on Lokal</h1>
        <p className="mt-2 text-muted-foreground">
          {user ? "Three quick steps. Free to list." : "Fill in your store details, then create a free account to go live."} Customers pay you directly by bank transfer.
        </p>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-2">
          {[
            { n: 1, label: "About your store", icon: StoreIcon },
            { n: 2, label: "Bank details", icon: Landmark },
            {
              n: 3,
              label: isServiceStore ? "Schedule" : "Products & hours",
              icon: isServiceStore ? Calendar : Package,
            },
            ...(!user ? [{ n: 4, label: "Create account", icon: UserCheck }] : []),
          ].map((s, i, arr) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  step >= s.n
                    ? "bg-gradient-primary text-primary-foreground shadow-warm"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {step > s.n ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span
                className={`hidden text-sm font-medium sm:inline ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
              {i < arr.length - 1 && (
                <div className={`h-px flex-1 ${step > s.n ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-bold">Tell us about your store</h2>

              <div>
                <Label>Store name *</Label>
                <Input
                  value={store.name}
                  onChange={(e) => setStore({ ...store, name: e.target.value })}
                  placeholder="Mama Adwoa's Pantry"
                  maxLength={80}
                  className="mt-1"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={store.category}
                    onValueChange={(v) =>
                      setStore((prev) => {
                        const nextCategory = v as (typeof CATEGORIES)[number];
                        const nextMode: SellingMode =
                          nextCategory === "Clothes & Fashion"
                            ? prev.selling_mode
                            : isStoreBookable(nextCategory)
                              ? "services"
                              : "products";
                        const nextSubcategory = getCategorySubcategories(
                          nextCategory,
                          nextMode,
                        ).includes(prev.subcategory)
                          ? prev.subcategory
                          : "";
                        const nextCertificate =
                          nextCategory === "Groceries" && nextSubcategory === "Meat & Fish"
                            ? prev.health_safety_certificate_url
                            : "";
                        const keepTattooFields = isBodyArtsArtistStore(
                          nextCategory,
                          nextSubcategory,
                        );
                        const keepGroceryFields = isGroceryStore(nextCategory);
                        return {
                          ...prev,
                          category: nextCategory,
                          fulfillment: PAY_AT_STORE_ONLY_CATEGORIES.has(nextCategory)
                            ? "pay_at_store"
                            : prev.fulfillment,
                          subcategory: nextSubcategory,
                          health_safety_certificate_url: nextCertificate,
                          minimum_age: keepTattooFields ? (prev.minimum_age ?? 18) : null,
                          tattoo_portfolio_url: keepTattooFields ? prev.tattoo_portfolio_url : "",
                          tattoo_license_url: keepTattooFields ? prev.tattoo_license_url : "",
                          barber_license_url: nextCategory === "Barbers" ? prev.barber_license_url : "",
                          beauty_license_url: nextCategory === "Beauty Store" ? prev.beauty_license_url : "",
                          hair_beauty_license_url: nextCategory === "Hair & Beauty" ? prev.hair_beauty_license_url : "",
                          food_business_license_url: keepGroceryFields ? prev.food_business_license_url : "",
                          selling_mode: nextMode,
                        };
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Origin *</Label>
                  <Select
                    value={store.origin}
                    onValueChange={(v) => setStore({ ...store, origin: v as any })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGINS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {getCategorySubcategories(store.category, store.selling_mode).length > 0 && (
                <div>
                  <Label>Subcategory</Label>
                  <Select
                    value={store.subcategory || "none"}
                    onValueChange={(v) =>
                      setStore((s) => {
                        const nextSubcategory = v === "none" ? "" : v;
                        const keepCertificate =
                          s.category === "Groceries" && nextSubcategory === "Meat & Fish";
                        const keepTattooFields = isBodyArtsArtistStore(s.category, nextSubcategory);
                        return {
                          ...s,
                          subcategory: nextSubcategory,
                          health_safety_certificate_url: keepCertificate
                            ? s.health_safety_certificate_url
                            : "",
                          minimum_age: keepTattooFields ? (s.minimum_age ?? 18) : null,
                          tattoo_portfolio_url: keepTattooFields ? s.tattoo_portfolio_url : "",
                          tattoo_license_url: keepTattooFields ? s.tattoo_license_url : "",
                        };
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General</SelectItem>
                      {getCategorySubcategories(store.category, store.selling_mode).map(
                        (subcategory) => (
                          <SelectItem key={subcategory} value={subcategory}>
                            {subcategory}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {store.category === "Groceries" && store.subcategory === "Meat & Fish" && (
                <div>
                  <Label>Health and safety certificate URL *</Label>
                  <Input
                    value={store.health_safety_certificate_url}
                    onChange={(e) =>
                      setStore((s) => ({ ...s, health_safety_certificate_url: e.target.value }))
                    }
                    placeholder="Link to certificate document"
                    maxLength={500}
                    className="mt-1"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Required for Meat &amp; Fish stores. Your store stays hidden until approved.
                  </p>
                </div>
              )}

              {isGroceryStore(store.category) && (
                <div className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-900">
                    Grocery store requirements
                  </p>
                  <p className="text-xs text-green-800">
                    Food business certificates vary by country. Upload your licence, permit, or health certificate to prove you're authorised to sell food.
                  </p>
                  <div>
                    <Label>Food Business Licence/Certificate URL *</Label>
                    <Input
                      value={store.food_business_license_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, food_business_license_url: e.target.value }))
                      }
                      placeholder="Link to your food business licence or health certificate"
                      maxLength={500}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload a document or certificate that proves you're licensed to sell food. This can be a food business registration, health certificate, or similar authority document for your country.
                    </p>
                  </div>
                </div>
              )}

              {store.category === "Barbers" && (
                <div className="space-y-3 rounded-lg border border-blue-300 bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-900">
                    Barber licence (optional)
                  </p>
                  <p className="text-xs text-blue-800">
                    Add your barber licence or certification to build customer trust. This is optional but helps establish credibility.
                  </p>
                  <div>
                    <Label>Barber Licence/Certification URL</Label>
                    <Input
                      value={store.barber_license_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, barber_license_url: e.target.value }))
                      }
                      placeholder="Link to your barber licence or certification"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {store.category === "Beauty Store" && (
                <div className="space-y-3 rounded-lg border border-pink-300 bg-pink-50 p-3">
                  <p className="text-sm font-medium text-pink-900">
                    Beauty licence (optional)
                  </p>
                  <p className="text-xs text-pink-800">
                    Add your beauty licence or certification to build customer trust. This is optional but helps establish credibility.
                  </p>
                  <div>
                    <Label>Beauty Licence/Certification URL</Label>
                    <Input
                      value={store.beauty_license_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, beauty_license_url: e.target.value }))
                      }
                      placeholder="Link to your beauty licence or certification"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {store.category === "Hair & Beauty" && (
                <div className="space-y-3 rounded-lg border border-purple-300 bg-purple-50 p-3">
                  <p className="text-sm font-medium text-purple-900">
                    Hair & Beauty licence (optional)
                  </p>
                  <p className="text-xs text-purple-800">
                    Add your hair & beauty licence or certification to build customer trust. This is optional but helps establish credibility.
                  </p>
                  <div>
                    <Label>Hair & Beauty Licence/Certification URL</Label>
                    <Input
                      value={store.hair_beauty_license_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, hair_beauty_license_url: e.target.value }))
                      }
                      placeholder="Link to your hair & beauty licence or certification"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {isBodyArtsArtistStore(store.category, store.subcategory) && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    {store.subcategory || "Body Arts"} trust requirements
                  </p>
                  <p className="text-xs text-amber-800">
                    Add these so customers and admins can verify you as a legitimate artist.
                  </p>
                  <div>
                    <Label>Minimum age restriction *</Label>
                    <Input
                      type="number"
                      min={18}
                      max={99}
                      value={store.minimum_age ?? 18}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, minimum_age: Number(e.target.value || 18) }))
                      }
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Must be 18+ for tattooing services.
                    </p>
                  </div>
                  <div>
                    <Label>Portfolio URL *</Label>
                    <Input
                      value={store.tattoo_portfolio_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, tattoo_portfolio_url: e.target.value }))
                      }
                      placeholder="Link to your artist portfolio"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Artist licence / ID URL *</Label>
                    <Input
                      value={store.tattoo_license_url}
                      onChange={(e) =>
                        setStore((s) => ({ ...s, tattoo_license_url: e.target.value }))
                      }
                      placeholder="Link to your licence, permit, or ID evidence"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {store.category === "Clothes & Fashion" && (
                <div>
                  <Label>How do you want to sell?</Label>
                  <Select
                    value={store.selling_mode}
                    onValueChange={(v) =>
                      setStore((s) => {
                        const nextMode = v as SellingMode;
                        const nextSubcategory = getCategorySubcategories(
                          "Clothes & Fashion",
                          nextMode,
                        ).includes(s.subcategory)
                          ? s.subcategory
                          : "";
                        return { ...s, selling_mode: nextMode, subcategory: nextSubcategory };
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="products">Product store (ready-made items)</SelectItem>
                      <SelectItem value="services">
                        Service store (custom-made / made-to-order)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Choose products for ready stock, or services for custom manufacturing and
                    bookings.
                  </p>
                </div>
              )}

              <div>
                <Label>Fulfilment</Label>
                {forcePayAtStore ? (
                  <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    💰 Pay at store only (auto for this category)
                  </div>
                ) : (
                  <>
                    <Select
                      value={store.fulfillment}
                      onValueChange={(v) => setStore({ ...store, fulfillment: v as any })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collection">🏪 Collection only</SelectItem>
                        <SelectItem value="delivery">🚚 Delivery only</SelectItem>
                        <SelectItem value="both">🏪🚚 Collection &amp; Delivery</SelectItem>
                        <SelectItem value="pay_at_store">💰 Pay at store</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      How will customers receive their order? You arrange this directly with them.
                    </p>
                  </>
                )}
              </div>

              {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
                <div>
                  <Label>Local delivery fee ({REGIONS[region].currency})</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={store.delivery_fee_gbp}
                    onChange={(e) =>
                      setStore((prev) => ({
                        ...prev,
                        delivery_fee_gbp: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="mt-1"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    This fee is added only when the customer chooses delivery.
                  </p>
                </div>
              )}

              {isServiceStore && (
                <div>
                  <Label>Where do you offer services?</Label>
                  <Select
                    value={store.location_type}
                    onValueChange={(v) =>
                      setStore((prev) => ({
                        ...prev,
                        location_type: v as any,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salon">🏠 At my salon / premises</SelectItem>
                      <SelectItem value="travel">🚗 We travel to you</SelectItem>
                    </SelectContent>
                  </Select>
                  {forcePayAtStore && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700">
                      💰 Pay at store is required for this service category.
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Description</Label>
                <Textarea
                  value={store.description}
                  onChange={(e) => setStore({ ...store, description: e.target.value })}
                  placeholder="What makes your store special?"
                  maxLength={500}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setShowOptionalFields((v) => !v)}
                >
                  {showOptionalFields ? "Hide optional details" : "Add optional details"}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional details help your profile stand out, but you can go live without them.
                </p>
              </div>

              {showOptionalFields && (
                <>
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
                    <Label>Refunds & cancellation policy</Label>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Do you accept refunds?
                      </Label>
                      <Select
                        value={store.accepts_refunds ? "yes" : "no"}
                        onValueChange={(v) => setStore({ ...store, accepts_refunds: v === "yes" })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes, refunds may be accepted</SelectItem>
                          <SelectItem value="no">No refunds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Refund policy details (shown to customers)
                      </Label>
                      <Textarea
                        value={store.refund_policy}
                        onChange={(e) => setStore({ ...store, refund_policy: e.target.value })}
                        placeholder="Example: Full refund if cancelled 24+ hours before appointment."
                        maxLength={1000}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Cancellation policy details (shown to customers)
                      </Label>
                      <Textarea
                        value={store.cancellation_policy}
                        onChange={(e) =>
                          setStore({ ...store, cancellation_policy: e.target.value })
                        }
                        placeholder="Example: Deposit is non-refundable for no-shows."
                        maxLength={1000}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Cover photo</Label>
                    {store.image_url && (
                      <div className="mt-1 h-32 w-full overflow-hidden rounded-lg bg-secondary">
                        <img
                          src={getImageUrl(store.image_url) ?? store.image_url}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="mt-1 flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <div
                          className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${uploading ? " opacity-50" : ""}`}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading…
                            </>
                          ) : store.image_url ? (
                            "Replace photo"
                          ) : (
                            "Upload photo"
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                      {!store.image_url && (
                        <Input
                          value={store.image_url}
                          onChange={(e) => setStore({ ...store, image_url: e.target.value })}
                          placeholder="or paste URL"
                          className="flex-[2]"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Country *</Label>
                  <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIONS).map(([code, info]) => (
                        <SelectItem key={code} value={code}>
                          {info.name} — {info.symbol} {info.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Store timezone *</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={store.timezone}
                      onChange={(e) => setStore({ ...store, timezone: e.target.value })}
                      placeholder="Africa/Lagos"
                      maxLength={80}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStore((s) => ({ ...s, timezone: getDetectedTimezone() }))}
                    >
                      Use mine
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Used to show accurate open/closed status globally. Example: Europe/London,
                    America/Toronto.
                  </p>
                </div>
                {requiresFixedAddress ? (
                  <>
                    <div className="sm:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={store.address}
                        onChange={(e) => setStore({ ...store, address: e.target.value })}
                        maxLength={200}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={store.city}
                        onChange={(e) => setStore({ ...store, city: e.target.value })}
                        maxLength={60}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{(REGION_ADDRESS[region] ?? DEFAULT_AREA).areaLabel}</Label>
                      <Input
                        value={store.postcode}
                        onChange={(e) => setStore({ ...store, postcode: e.target.value })}
                        placeholder={(REGION_ADDRESS[region] ?? DEFAULT_AREA).areaPlaceholder}
                        maxLength={40}
                        className="mt-1"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Service location is set to We travel to you, so no fixed customer-facing address
                    will be shown.
                  </div>
                )}
                <div>
                  <Label>Phone</Label>
                  <div className="mt-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5 sm:col-span-4">
                      <Select
                        value={phoneCountry}
                        onValueChange={(v) => setPhoneCountry(v as CountryCode)}
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
                        value={store.phone}
                        onChange={(e) => setStore({ ...store, phone: e.target.value })}
                        placeholder="Local number"
                        maxLength={40}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Use a WhatsApp-enabled mobile number for faster alerts. If WhatsApp/SMS is
                    unavailable, we'll fall back to email when enabled.
                  </p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={store.merchant_sms_alerts}
                        onChange={(e) =>
                          setStore({ ...store, merchant_sms_alerts: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      Enable SMS order/booking alerts
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={store.merchant_email_alerts}
                        onChange={(e) =>
                          setStore({ ...store, merchant_email_alerts: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      Enable email order/booking alerts
                    </label>
                  </div>
                </div>
              </div>

              {showOptionalFields && (
                <>
                  <div>
                    <Label>Opening hours <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input
                      value={store.hours}
                      onChange={(e) => setStore({ ...store, hours: e.target.value })}
                      placeholder="Mon–Sat · 9am – 8pm"
                      maxLength={80}
                      className="mt-1"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Leave blank if your hours vary, you work by appointment, or you operate online.</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Social links</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Input
                          value={store.instagram_handle}
                          onChange={(e) => setStore({ ...store, instagram_handle: e.target.value })}
                          placeholder="Instagram handle or profile URL"
                          maxLength={80}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Input
                          value={store.tiktok_handle}
                          onChange={(e) => setStore({ ...store, tiktok_handle: e.target.value })}
                          placeholder="TikTok handle or profile URL"
                          maxLength={80}
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          value={store.website_url}
                          onChange={(e) => setStore({ ...store, website_url: e.target.value })}
                          placeholder="Website URL"
                          maxLength={200}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These appear as secondary links in your store profile, below Lokal's order,
                      booking, and message actions.
                    </p>
                  </div>
                </>
              )}

              <Button
                size="lg"
                className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                onClick={handleStep1Continue}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Where should customers pay?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Customers send payment directly to this account. Lokal never holds your money.
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium">
                    {REGIONS[region].symbol} {REGIONS[region].currency}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                <strong>Tip:</strong> use a dedicated business account if you can. Each order has a
                unique reference (e.g. <span className="font-mono">LKL-X7K2P</span>) so payments are
                easy to match.
              </div>

              <div>
                <Label>Bank name *</Label>
                <Input
                  value={bank.bank_name}
                  onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}
                  placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).bankPlaceholder}
                  maxLength={60}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Account name *</Label>
                <Input
                  value={bank.bank_account_name}
                  onChange={(e) => setBank({ ...bank, bank_account_name: e.target.value })}
                  placeholder="Business Name Ltd"
                  maxLength={80}
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Account number *</Label>
                  <Input
                    value={bank.bank_account_number}
                    onChange={(e) =>
                      setBank({ ...bank, bank_account_number: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).accountPlaceholder}
                    inputMode="numeric"
                    maxLength={20}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>{(REGION_BANK[region] ?? DEFAULT_BANK).routingLabel}</Label>
                  <Input
                    value={bank.bank_sort_code}
                    onChange={(e) => setBank({ ...bank, bank_sort_code: e.target.value })}
                    placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).routingPlaceholder}
                    maxLength={30}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-[2] bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                  onClick={() => {
                    if (!validateStep2()) return;
                    trackEvent("merchant_onboarding_step_complete", { step: 2 });
                    setStep(3);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {isServiceStore ? (
                <>
                  <div>
                    <h2 className="font-display text-2xl font-bold">Services &amp; schedule</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add the services you offer, then set your weekly availability.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Services
                    </p>
                    <div className="space-y-3">
                      {products.map((p, i) => (
                        <div key={i} className="space-y-1">
                          <div className="grid grid-cols-12 gap-2">
                            <Input
                              className="col-span-6"
                              placeholder="Service name"
                              value={p.name}
                              onChange={(e) => updateProduct(i, "name", e.target.value)}
                              maxLength={80}
                            />
                            <Input
                              className="col-span-3 font-mono"
                              placeholder="Price"
                              inputMode="decimal"
                              value={p.price}
                              onChange={(e) =>
                                updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))
                              }
                            />
                            <Input
                              className="col-span-2"
                              placeholder="e.g. 30 min"
                              value={p.unit}
                              onChange={(e) => updateProduct(i, "unit", e.target.value)}
                              maxLength={20}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="col-span-1 text-muted-foreground"
                              onClick={() => removeProduct(i)}
                              disabled={products.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pl-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                Deposit £
                              </span>
                              <Input
                                className="h-7 w-28 text-xs font-mono"
                                placeholder="0.00 (optional)"
                                inputMode="decimal"
                                value={p.deposit}
                                onChange={(e) =>
                                  updateProduct(
                                    i,
                                    "deposit",
                                    e.target.value.replace(/[^0-9.]/g, ""),
                                  )
                                }
                              />
                            </div>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                              {p.image_url ? (
                                <span className="text-primary">✓ Photo added</span>
                              ) : (
                                <>
                                  <span className="text-base">📷</span> Add photo
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadProductImage(i, f);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addProduct} className="gap-1">
                        <Plus className="h-3 w-3" /> Add service
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Weekly schedule
                    </p>
                    <div className="space-y-2">
                      {schedule.map((d, i) => (
                        <div key={d.day} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={d.active}
                              onChange={(e) =>
                                setSchedule((s) =>
                                  s.map((x, idx) =>
                                    idx === i ? { ...x, active: e.target.checked } : x,
                                  ),
                                )
                              }
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="w-10 text-sm font-medium">
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.day]}
                            </span>
                            {d.active && (
                              <div className="flex flex-1 flex-wrap items-center gap-2">
                                <Input
                                  type="time"
                                  value={d.start_time}
                                  onChange={(e) =>
                                    setSchedule((s) =>
                                      s.map((x, idx) =>
                                        idx === i ? { ...x, start_time: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="w-28"
                                />
                                <span className="text-sm text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={d.end_time}
                                  onChange={(e) =>
                                    setSchedule((s) =>
                                      s.map((x, idx) =>
                                        idx === i ? { ...x, end_time: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="w-28"
                                />
                                <Select
                                  value={String(d.slot_duration_mins)}
                                  onValueChange={(v) =>
                                    setSchedule((s) =>
                                      s.map((x, idx) =>
                                        idx === i ? { ...x, slot_duration_mins: Number(v) } : x,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="15">15 min</SelectItem>
                                    <SelectItem value="30">30 min</SelectItem>
                                    <SelectItem value="45">45 min</SelectItem>
                                    <SelectItem value="60">60 min</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-muted-foreground">Max</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={d.max_bookings_per_slot}
                                    onChange={(e) =>
                                      setSchedule((s) =>
                                        s.map((x, idx) =>
                                          idx === i
                                            ? {
                                                ...x,
                                                max_bookings_per_slot: Math.max(
                                                  1,
                                                  Number(e.target.value),
                                                ),
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="w-16 font-mono"
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    clients/slot
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Team members
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStaff((s) => [...s, { name: "", phone: "" }])}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add member
                      </Button>
                    </div>
                    {staff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Optional — add team members to allow per-staff bookings.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {staff.map((m, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              placeholder="Name"
                              value={m.name}
                              onChange={(e) =>
                                setStaff((s) =>
                                  s.map((x, idx) =>
                                    idx === i ? { ...x, name: e.target.value } : x,
                                  ),
                                )
                              }
                              maxLength={60}
                              className="flex-1"
                            />
                            <Input
                              placeholder="Phone (optional)"
                              value={m.phone}
                              onChange={(e) =>
                                setStaff((s) =>
                                  s.map((x, idx) =>
                                    idx === i ? { ...x, phone: e.target.value } : x,
                                  ),
                                )
                              }
                              maxLength={40}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground shrink-0"
                              onClick={() => setStaff((s) => s.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="font-display text-2xl font-bold">Add your products</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a few popular items to start — you can edit anytime.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {products.map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="grid grid-cols-12 gap-2">
                          <Input
                            className="col-span-6"
                            placeholder="Product name"
                            value={p.name}
                            onChange={(e) => updateProduct(i, "name", e.target.value)}
                            maxLength={80}
                          />
                          <Input
                            className="col-span-3 font-mono"
                            placeholder="Price"
                            inputMode="decimal"
                            value={p.price}
                            onChange={(e) =>
                              updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))
                            }
                          />
                          <Input
                            className="col-span-2"
                            placeholder="Unit"
                            value={p.unit}
                            onChange={(e) => updateProduct(i, "unit", e.target.value)}
                            maxLength={20}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="col-span-1 text-muted-foreground"
                            onClick={() => removeProduct(i)}
                            disabled={products.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <label className="flex cursor-pointer items-center gap-1.5 pl-1 text-xs text-muted-foreground hover:text-foreground">
                          {p.image_url ? (
                            <span className="text-primary">✓ Photo added</span>
                          ) : (
                            <>
                              <span className="text-base">📷</span> Add photo
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadProductImage(i, f);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addProduct} className="gap-1">
                      <Plus className="h-3 w-3" /> Add product
                    </Button>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Business hours
                    </p>
                    <div className="space-y-2">
                      {schedule.map((d, i) => (
                        <div key={d.day} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={d.active}
                              onChange={(e) =>
                                setSchedule((s) =>
                                  s.map((x, idx) =>
                                    idx === i ? { ...x, active: e.target.checked } : x,
                                  ),
                                )
                              }
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="w-10 text-sm font-medium">
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.day]}
                            </span>
                            {d.active && (
                              <div className="flex flex-1 flex-wrap items-center gap-2">
                                <Input
                                  type="time"
                                  value={d.start_time}
                                  onChange={(e) =>
                                    setSchedule((s) =>
                                      s.map((x, idx) =>
                                        idx === i ? { ...x, start_time: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="w-28"
                                />
                                <span className="text-sm text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={d.end_time}
                                  onChange={(e) =>
                                    setSchedule((s) =>
                                      s.map((x, idx) =>
                                        idx === i ? { ...x, end_time: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="w-28"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Night shifts are supported. Example: 22:00 to 02:00.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-[2] bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                  onClick={handleStep3Continue}
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : user
                      ? "Save and continue"
                      : "Continue to Create Account →"}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Almost there</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a free account to publish your store.
                  </p>
                </div>
              </div>

              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "signup" | "signin")}>
                <TabsList className="w-full">
                  <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
                  <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
                </TabsList>

                <TabsContent value="signup" className="mt-4">
                  {emailSent ? (
                    <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
                      <Mail className="mx-auto mb-3 h-8 w-8 text-primary" />
                      <p className="font-semibold">Check your email</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        We've sent a confirmation link to <strong>{authEmail}</strong>.
                        Click it to confirm and your store will be saved automatically.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleInlineSignUp} className="space-y-3">
                      <div>
                        <Label>Your name</Label>
                        <Input
                          className="mt-1"
                          placeholder="Ada Osei"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          maxLength={60}
                        />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          className="mt-1"
                          type="email"
                          placeholder="you@example.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>Password *</Label>
                        <Input
                          className="mt-1"
                          type="password"
                          placeholder="At least 8 characters"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          minLength={8}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                        disabled={authBusy}
                      >
                        {authBusy ? "Creating account…" : "Create account & list store"}
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="signin" className="mt-4">
                  <form onSubmit={handleInlineSignIn} className="space-y-3">
                    <div>
                      <Label>Email *</Label>
                      <Input
                        className="mt-1"
                        type="email"
                        placeholder="you@example.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Password *</Label>
                      <Input
                        className="mt-1"
                        type="password"
                        placeholder="Your password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                      disabled={authBusy || submitting}
                    >
                      {authBusy || submitting ? "Signing in…" : "Sign in & list store"}
                    </Button>
                  </form>
                </TabsContent>

                <div className="mt-5">
                  <div className="my-3 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    or
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={() => void handleInlineOAuth("google")}
                    disabled={authBusy || submitting}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full"
                    size="lg"
                    onClick={() => void handleInlineOAuth("x")}
                    disabled={authBusy || submitting}
                  >
                    <img src={xIcon} alt="X" className="h-4 w-4" />
                    Continue with X
                  </Button>
                </div>
              </Tabs>

              <Button variant="outline" size="sm" className="w-full" onClick={() => setStep(3)}>
                ← Back to products
              </Button>
            </div>
          )}
        </div>
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}
