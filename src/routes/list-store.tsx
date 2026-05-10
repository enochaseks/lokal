import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Store as StoreIcon, Landmark, Package, Calendar, Check, ArrowLeft, Loader2 } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { LIVE_CATEGORIES, LIVE_ORIGINS, REGIONS, REGION_ADDRESS, DEFAULT_AREA, REGION_BANK, DEFAULT_BANK, isStoreBookable, getCategorySubcategories, isValidStoreSubcategory } from "@/data/stores";
import type { Region, SellingMode } from "@/data/stores";
import { getImageUrl, normalizeInstagramHandle, normalizeTikTokHandle, normalizeWebsiteUrl } from "@/lib/utils";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
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


function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Could not load the form</h1>
        <p className="mt-2 text-sm text-muted-foreground">{import.meta.env.DEV ? error.message : "Something went wrong. Please try again."}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/list-store")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth", search: { redirect: "/list-store" } });
  },
  errorComponent: RouteError,
  component: ListStorePage,
  head: () => ({
    meta: [
      { title: "List your store · Lokal" },
      { name: "description", content: "List your African or Caribbean store on Lokal in three quick steps." },
    ],
  }),
});

const CATEGORIES = LIVE_CATEGORIES;
const ORIGINS = LIVE_ORIGINS;

function isValidImageReference(value: string) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return /^[^\s/]+(?:\/[^\s/]+)+$/.test(value);
  }
}

const storeSchema = z.object({
  name: z.string().trim().min(2, "Store name is too short").max(80),
  category: z.enum(CATEGORIES),
  subcategory: z.string().trim().max(60).optional(),
  origin: z.enum(ORIGINS, { message: "Please select an African/Caribbean origin" }),
  description: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(60).optional(),
  postcode: z.string().trim().max(20).optional(),
  hours: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  fulfillment: z.enum(["collection", "delivery", "both", "pay_at_store"]).default("collection"),
  image_url: z.string().trim().max(500).refine(isValidImageReference, "Must be a valid URL").optional().or(z.literal("")),
  instagram_handle: z.string().trim().max(80).optional(),
  tiktok_handle: z.string().trim().max(80).optional(),
  website_url: z.string().trim().max(200).refine((value) => !value || !!normalizeWebsiteUrl(value), "Must be a valid website").optional(),
  accepts_refunds: z.boolean().default(false),
  refund_policy: z.string().trim().max(1000).optional(),
  cancellation_policy: z.string().trim().max(1000).optional(),
}).refine((value) => isValidStoreSubcategory(value.category, value.subcategory), {
  message: "Please choose a valid subcategory for this category",
  path: ["subcategory"],
});

const bankSchema = z.object({
  bank_name: z.string().trim().min(2).max(60),
  bank_account_name: z.string().trim().min(2).max(80),
  bank_account_number: z.string().trim().regex(/^[0-9]{6,20}$/, "Digits only"),
  bank_sort_code: z.string().trim().max(10).optional(),
});

type Product = { name: string; price: string; unit: string; deposit: string; image_url: string };
type DayDraft = { day: number; active: boolean; start_time: string; end_time: string; slot_duration_mins: number; max_bookings_per_slot: number };
type StaffDraft = { name: string; phone: string };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "store";
}

function ListStorePage() {
  const { user, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [region, setRegion] = useState<Region>("GB");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("GB");

  const [store, setStore] = useState({
    name: "", category: "Groceries" as (typeof CATEGORIES)[number], origin: ORIGINS[0] as (typeof ORIGINS)[number],
    subcategory: "",
    description: "", address: "", city: "", postcode: "",
    hours: "", phone: "", fulfillment: "collection" as "collection" | "delivery" | "both" | "pay_at_store", image_url: "",
    instagram_handle: "", tiktok_handle: "", website_url: "", location_type: "salon" as "salon" | "remote" | "travel" | "remote_and_travel",
    accepts_refunds: false, refund_policy: "", cancellation_policy: "",
    selling_mode: "products" as SellingMode,
  });
  const [bank, setBank] = useState({ bank_name: "", bank_account_name: "", bank_account_number: "", bank_sort_code: "" });
  const [products, setProducts] = useState<Product[]>([{ name: "", price: "", unit: "", deposit: "", image_url: "" }]);
  const [schedule, setSchedule] = useState<DayDraft[]>([0,1,2,3,4,5,6].map((day) => ({ day, active: false, start_time: "09:00", end_time: "18:00", slot_duration_mins: 30, max_bookings_per_slot: 1 })));
  const [staff, setStaff] = useState<StaffDraft[]>([]);
  const isServiceStore = isStoreBookable(store.category, store.selling_mode);
  const requiresFixedAddress = !isServiceStore || store.location_type === "salon";

  useEffect(() => {
    // route guard handled by beforeLoad
  }, []);

  useEffect(() => {
    trackEvent("merchant_onboarding_visit", { page: "list-store" });
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: true });
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

  const addProduct = () => setProducts((p) => [...p, { name: "", price: "", unit: "", deposit: "", image_url: "" }]);
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, key: keyof Product, value: string) =>
    setProducts((p) => p.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const uploadProductImage = async (i: number, file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/products/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: true });
    if (error) { toast.error("Photo upload failed"); return; }
    updateProduct(i, "image_url", path);
  };

  const validateStep1 = () => {
    const r = storeSchema.safeParse(store);
    if (!r.success) { toast.error(r.error.issues[0].message); return false; }
    return true;
  };
  const validateStep2 = () => {
    const r = bankSchema.safeParse(bank);
    if (!r.success) { toast.error(r.error.issues[0].message); return false; }
    return true;
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
    if (!user) return;
    const isBarber = isServiceStore;
    const validProducts = products.filter((p) => p.name.trim() && p.price.trim());
    if (validProducts.length === 0) { toast.error(`Add at least one ${isBarber ? "service" : "product"} before going live`); return; }

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
      const toNullable = (value?: string) => {
        const trimmed = (value ?? "").trim();
        return trimmed ? trimmed : null;
      };
      const payload = {
        ...parsedStore,
        ...bankSchema.parse(bank),
        owner_id: user.id,
        slug,
        region,
        currency: REGIONS[region].currency,
        phone: normalizePhoneForAlerts(store.phone, phoneCountry) ?? parsedStore.phone ?? null,
        image_url: store.image_url || null,
        instagram_handle: normalizeInstagramHandle(store.instagram_handle),
        tiktok_handle: normalizeTikTokHandle(store.tiktok_handle),
        website_url: normalizeWebsiteUrl(store.website_url),
        fulfillment: isServiceStore && store.location_type === "travel" ? "pay_at_store" : parsedStore.fulfillment,
        address: requiresFixedAddress ? toNullable(parsedStore.address) : null,
        city: requiresFixedAddress ? toNullable(parsedStore.city) : null,
        postcode: requiresFixedAddress ? toNullable(parsedStore.postcode) : null,
        published: true,
        location_type: isServiceStore ? store.location_type : null,
        selling_mode: store.category === "Clothes & Fashion" ? store.selling_mode : null,
        subcategory: parsedStore.subcategory?.trim() ? parsedStore.subcategory.trim() : null,
      };

      const { data: newStore, error: storeErr } = await (supabase as any)
        .from("stores").insert(payload).select("id").single();
      if (storeErr) throw storeErr;

      // Run fraud detection check
      try {
        const fraudCheckResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fraud-check`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.id,
              email: user.email,
              display_name: user.user_metadata?.display_name || "",
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
          }
        );
        
        if (fraudCheckResponse.ok) {
          const fraudResult = await fraudCheckResponse.json();
          if (fraudResult.risk_level === "high") {
            toast.warning("Your account is under review", {
              description: "We've flagged some details for security review. An admin will approve your store soon.",
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
        const { error: prodErr } = await (supabase as any).from("store_products").insert(productRows);
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

      if (isBarber) {
        const activeDays = schedule.filter((d) => d.active);
        if (activeDays.length > 0) {
          const { error: availErr } = await (supabase as any).from("store_availability").insert(
            activeDays.map((d) => ({ store_id: newStore.id, day_of_week: d.day, start_time: d.start_time, end_time: d.end_time, slot_duration_mins: d.slot_duration_mins, max_bookings_per_slot: d.max_bookings_per_slot }))
          );
          if (availErr) throw availErr;
        }
      }

      // Promote to merchant role
      await supabase.from("user_roles").insert({ user_id: user.id, role: "merchant" });
      await refreshRoles();

      trackEvent("merchant_onboarding_success", {
        store_id: newStore.id,
        store_category: store.category,
        listing_count: validProducts.length,
      });

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "lokal:new-store-onboarding",
          JSON.stringify({ storeId: newStore.id, createdAt: Date.now() })
        );
      }

      toast.success("Your store is live!", { description: "Shoppers can now find and order from you." });
      navigate({ to: "/merchant" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save your store");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <button onClick={() => navigate({ to: "/" })} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Lokal
        </button>

        <h1 className="font-display text-4xl font-bold md:text-5xl">List your store on Lokal</h1>
        <p className="mt-2 text-muted-foreground">Three quick steps. Free to list. Customers pay you directly by bank transfer.</p>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-2">
          {[
            { n: 1, label: "About your store", icon: StoreIcon },
            { n: 2, label: "Bank details", icon: Landmark },
            { n: 3, label: isServiceStore ? "Schedule" : "Products", icon: isServiceStore ? Calendar : Package },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                step >= s.n ? "bg-gradient-primary text-primary-foreground shadow-warm" : "bg-secondary text-muted-foreground"
              }`}>
                {step > s.n ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span className={`hidden text-sm font-medium sm:inline ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < 2 && <div className={`h-px flex-1 ${step > s.n ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-bold">Tell us about your store</h2>

              <div>
                <Label>Store name *</Label>
                <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} placeholder="Mama Adwoa's Pantry" maxLength={80} className="mt-1" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={store.category}
                    onValueChange={(v) => setStore((prev) => {
                      const nextCategory = v as (typeof CATEGORIES)[number];
                      const nextMode: SellingMode = nextCategory === "Clothes & Fashion"
                        ? prev.selling_mode
                        : (isStoreBookable(nextCategory) ? "services" : "products");
                      const nextSubcategory = getCategorySubcategories(nextCategory).includes(prev.subcategory) ? prev.subcategory : "";
                      return { ...prev, category: nextCategory, subcategory: nextSubcategory, selling_mode: nextMode };
                    })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Origin *</Label>
                  <Select value={store.origin} onValueChange={(v) => setStore({ ...store, origin: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {getCategorySubcategories(store.category).length > 0 && (
                <div>
                  <Label>Subcategory</Label>
                  <Select value={store.subcategory || "none"} onValueChange={(v) => setStore((s) => ({ ...s, subcategory: v === "none" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select a subcategory" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General</SelectItem>
                      {getCategorySubcategories(store.category).map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {store.category === "Clothes & Fashion" && (
                <div>
                  <Label>How do you want to sell?</Label>
                  <Select value={store.selling_mode} onValueChange={(v) => setStore((s) => ({ ...s, selling_mode: v as SellingMode }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="products">Product store (ready-made items)</SelectItem>
                      <SelectItem value="services">Service store (custom-made / made-to-order)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">Choose products for ready stock, or services for custom manufacturing and bookings.</p>
                </div>
              )}

              <div>
                <Label>Fulfilment</Label>
                {isServiceStore && store.location_type === "travel" ? (
                  <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    🏦 Bank Transfer Only (auto for travel services)
                  </div>
                ) : (
                  <>
                    <Select value={store.fulfillment} onValueChange={(v) => setStore({ ...store, fulfillment: v as any })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collection">🏪 Collection only</SelectItem>
                        <SelectItem value="delivery">🚚 Delivery only</SelectItem>
                        <SelectItem value="both">🏪🚚 Collection &amp; Delivery</SelectItem>
                        <SelectItem value="pay_at_store">💰 Pay at store</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">How will customers receive their order? You arrange this directly with them.</p>
                  </>
                )}
              </div>

              {isServiceStore && (
                <div>
                  <Label>Where do you offer services?</Label>
                  <Select value={store.location_type} onValueChange={(v) => setStore((prev) => ({ ...prev, location_type: v as any, fulfillment: v === "travel" ? "pay_at_store" : prev.fulfillment }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salon">🏠 At my salon / premises</SelectItem>
                      <SelectItem value="travel">🚗 We travel to you</SelectItem>
                    </SelectContent>
                  </Select>
                  {store.location_type === "travel" && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700">🏦 Bank Transfer Only is shown to customers for travel bookings.</p>
                  )}
                </div>
              )}

              <div>
                <Label>Description</Label>
                <Textarea value={store.description} onChange={(e) => setStore({ ...store, description: e.target.value })} placeholder="What makes your store special?" maxLength={500} className="mt-1" rows={3} />
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
                      <Label className="text-xs text-muted-foreground">Do you accept refunds?</Label>
                      <Select value={store.accepts_refunds ? "yes" : "no"} onValueChange={(v) => setStore({ ...store, accepts_refunds: v === "yes" })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes, refunds may be accepted</SelectItem>
                          <SelectItem value="no">No refunds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Refund policy details (shown to customers)</Label>
                      <Textarea value={store.refund_policy} onChange={(e) => setStore({ ...store, refund_policy: e.target.value })} placeholder="Example: Full refund if cancelled 24+ hours before appointment." maxLength={1000} className="mt-1" rows={3} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cancellation policy details (shown to customers)</Label>
                      <Textarea value={store.cancellation_policy} onChange={(e) => setStore({ ...store, cancellation_policy: e.target.value })} placeholder="Example: Deposit is non-refundable for no-shows." maxLength={1000} className="mt-1" rows={3} />
                    </div>
                  </div>

                  <div>
                    <Label>Cover photo</Label>
                    {store.image_url && (
                      <div className="mt-1 h-32 w-full overflow-hidden rounded-lg bg-secondary">
                        <img src={getImageUrl(store.image_url) ?? store.image_url} alt="preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="mt-1 flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <div className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${uploading ? " opacity-50" : ""}`}>
                          {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : store.image_url ? "Replace photo" : "Upload photo"}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                      </label>
                      {!store.image_url && (
                        <Input value={store.image_url} onChange={(e) => setStore({ ...store, image_url: e.target.value })} placeholder="or paste URL" className="flex-[2]" />
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Country *</Label>
                  <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIONS).map(([code, info]) => (
                        <SelectItem key={code} value={code}>{info.name} — {info.symbol} {info.currency}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {requiresFixedAddress ? (
                  <>
                    <div className="sm:col-span-2">
                      <Label>Address</Label>
                      <Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} maxLength={200} className="mt-1" />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input value={store.city} onChange={(e) => setStore({ ...store, city: e.target.value })} maxLength={60} className="mt-1" />
                    </div>
                    <div>
                      <Label>{(REGION_ADDRESS[region] ?? DEFAULT_AREA).areaLabel}</Label>
                      <Input value={store.postcode} onChange={(e) => setStore({ ...store, postcode: e.target.value })} placeholder={(REGION_ADDRESS[region] ?? DEFAULT_AREA).areaPlaceholder} maxLength={40} className="mt-1" />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Service location is set to We travel to you, so no fixed customer-facing address will be shown.
                  </div>
                )}
                <div>
                  <Label>Phone</Label>
                  <div className="mt-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5 sm:col-span-4">
                      <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as CountryCode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-7 sm:col-span-8">
                      <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} placeholder="Local number" maxLength={40} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">You'll receive order alerts by email and SMS to this number.</p>
                </div>
              </div>

              {showOptionalFields && (
                <>
                  <div>
                    <Label>Opening hours</Label>
                    <Input value={store.hours} onChange={(e) => setStore({ ...store, hours: e.target.value })} placeholder="Mon–Sat · 9am – 8pm" maxLength={80} className="mt-1" />
                  </div>

                  <div className="space-y-3">
                    <Label>Social links</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Input value={store.instagram_handle} onChange={(e) => setStore({ ...store, instagram_handle: e.target.value })} placeholder="Instagram handle or profile URL" maxLength={80} className="mt-1" />
                      </div>
                      <div>
                        <Input value={store.tiktok_handle} onChange={(e) => setStore({ ...store, tiktok_handle: e.target.value })} placeholder="TikTok handle or profile URL" maxLength={80} className="mt-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <Input value={store.website_url} onChange={(e) => setStore({ ...store, website_url: e.target.value })} placeholder="Website URL" maxLength={200} className="mt-1" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">These appear as secondary links in your store profile, below Lokal's order, booking, and message actions.</p>
                  </div>
                </>
              )}

              <Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={handleStep1Continue}>
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
                    <p className="mt-1 text-sm text-muted-foreground">Customers send payment directly to this account. Lokal never holds your money.</p>
                  </div>
                  <div className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium">
                    {REGIONS[region].symbol} {REGIONS[region].currency}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                <strong>Tip:</strong> use a dedicated business account if you can. Each order has a unique reference (e.g. <span className="font-mono">LKL-X7K2P</span>) so payments are easy to match.
              </div>

              <div>
                <Label>Bank name *</Label>
                <Input value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).bankPlaceholder} maxLength={60} className="mt-1" />
              </div>
              <div>
                <Label>Account name *</Label>
                <Input value={bank.bank_account_name} onChange={(e) => setBank({ ...bank, bank_account_name: e.target.value })} placeholder="Business Name Ltd" maxLength={80} className="mt-1" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Account number *</Label>
                  <Input value={bank.bank_account_number} onChange={(e) => setBank({ ...bank, bank_account_number: e.target.value.replace(/\D/g, "") })} placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).accountPlaceholder} inputMode="numeric" maxLength={20} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label>{(REGION_BANK[region] ?? DEFAULT_BANK).routingLabel}</Label>
                  <Input value={bank.bank_sort_code} onChange={(e) => setBank({ ...bank, bank_sort_code: e.target.value })} placeholder={(REGION_BANK[region] ?? DEFAULT_BANK).routingPlaceholder} maxLength={30} className="mt-1 font-mono" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</Button>
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
                    <p className="mt-1 text-sm text-muted-foreground">Add the services you offer, then set your weekly availability.</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Services</p>
                    <div className="space-y-3">
                      {products.map((p, i) => (
                    <div key={i} className="space-y-1">
                          <div className="grid grid-cols-12 gap-2">
                            <Input className="col-span-6" placeholder="Service name" value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} maxLength={80} />
                            <Input className="col-span-3 font-mono" placeholder="Price" inputMode="decimal" value={p.price} onChange={(e) => updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))} />
                            <Input className="col-span-2" placeholder="e.g. 30 min" value={p.unit} onChange={(e) => updateProduct(i, "unit", e.target.value)} maxLength={20} />
                            <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground" onClick={() => removeProduct(i)} disabled={products.length === 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pl-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">Deposit £</span>
                              <Input className="h-7 w-28 text-xs font-mono" placeholder="0.00 (optional)" inputMode="decimal" value={p.deposit} onChange={(e) => updateProduct(i, "deposit", e.target.value.replace(/[^0-9.]/g, ""))} />
                            </div>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                              {p.image_url
                                ? <span className="text-primary">✓ Photo added</span>
                                : <><span className="text-base">📷</span> Add photo</>}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProductImage(i, f); }} />
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Weekly schedule</p>
                    <div className="space-y-2">
                      {schedule.map((d, i) => (
                        <div key={d.day} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={d.active}
                              onChange={(e) => setSchedule((s) => s.map((x, idx) => idx === i ? { ...x, active: e.target.checked } : x))}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="w-10 text-sm font-medium">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.day]}</span>
                            {d.active && (
                              <div className="flex flex-1 flex-wrap items-center gap-2">
                                <Input
                                  type="time"
                                  value={d.start_time}
                                  onChange={(e) => setSchedule((s) => s.map((x, idx) => idx === i ? { ...x, start_time: e.target.value } : x))}
                                  className="w-28"
                                />
                                <span className="text-sm text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={d.end_time}
                                  onChange={(e) => setSchedule((s) => s.map((x, idx) => idx === i ? { ...x, end_time: e.target.value } : x))}
                                  className="w-28"
                                />
                                <Select
                                  value={String(d.slot_duration_mins)}
                                  onValueChange={(v) => setSchedule((s) => s.map((x, idx) => idx === i ? { ...x, slot_duration_mins: Number(v) } : x))}
                                >
                                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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
                                    onChange={(e) => setSchedule((s) => s.map((x, idx) => idx === i ? { ...x, max_bookings_per_slot: Math.max(1, Number(e.target.value)) } : x))}
                                    className="w-16 font-mono"
                                  />
                                  <span className="text-sm text-muted-foreground">clients/slot</span>
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
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team members</p>
                      <Button size="sm" variant="outline" onClick={() => setStaff((s) => [...s, { name: "", phone: "" }])} className="gap-1">
                        <Plus className="h-3 w-3" /> Add member
                      </Button>
                    </div>
                    {staff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Optional — add team members to allow per-staff bookings.</p>
                    ) : (
                      <div className="space-y-2">
                        {staff.map((m, i) => (
                          <div key={i} className="flex gap-2">
                            <Input placeholder="Name" value={m.name} onChange={(e) => setStaff((s) => s.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} maxLength={60} className="flex-1" />
                            <Input placeholder="Phone (optional)" value={m.phone} onChange={(e) => setStaff((s) => s.map((x, idx) => idx === i ? { ...x, phone: e.target.value } : x))} maxLength={40} className="flex-1" />
                            <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" onClick={() => setStaff((s) => s.filter((_, idx) => idx !== i))}>
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
                    <p className="mt-1 text-sm text-muted-foreground">Add a few popular items to start — you can edit anytime.</p>
                  </div>

                  <div className="space-y-3">
                    {products.map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="grid grid-cols-12 gap-2">
                          <Input className="col-span-6" placeholder="Product name" value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} maxLength={80} />
                          <Input className="col-span-3 font-mono" placeholder="Price" inputMode="decimal" value={p.price} onChange={(e) => updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))} />
                          <Input className="col-span-2" placeholder="Unit" value={p.unit} onChange={(e) => updateProduct(i, "unit", e.target.value)} maxLength={20} />
                          <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground" onClick={() => removeProduct(i)} disabled={products.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <label className="flex cursor-pointer items-center gap-1.5 pl-1 text-xs text-muted-foreground hover:text-foreground">
                          {p.image_url
                            ? <span className="text-primary">✓ Photo added</span>
                            : <><span className="text-base">📷</span> Add photo</>}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProductImage(i, f); }} />
                        </label>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addProduct} className="gap-1">
                      <Plus className="h-3 w-3" /> Add product
                    </Button>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button size="lg" className="flex-[2] bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Publishing..." : "Publish my store"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}
