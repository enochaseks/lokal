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
import { LIVE_CATEGORIES, LIVE_ORIGINS, BOOKABLE_CATEGORIES } from "@/data/stores";
import { getImageUrl } from "@/lib/utils";

const isBookable = (cat: string) => (BOOKABLE_CATEGORIES as readonly string[]).includes(cat);

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
  origin: z.enum(ORIGINS, { message: "Please select an African/Caribbean origin" }),
  description: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(60).optional(),
  postcode: z.string().trim().max(20).optional(),
  hours: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  fulfillment: z.enum(["collection", "delivery", "both"]).default("collection"),
  image_url: z.string().trim().max(500).refine(isValidImageReference, "Must be a valid URL").optional().or(z.literal("")),
});

const bankSchema = z.object({
  bank_name: z.string().trim().min(2).max(60),
  bank_account_name: z.string().trim().min(2).max(80),
  bank_account_number: z.string().trim().regex(/^[0-9]{6,20}$/, "Digits only"),
  bank_sort_code: z.string().trim().max(10).optional(),
});

type Product = { name: string; price: string; unit: string };
type DayDraft = { day: number; active: boolean; start_time: string; end_time: string; slot_duration_mins: number };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "store";
}

function ListStorePage() {
  const { user, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [store, setStore] = useState({
    name: "", category: "Groceries" as (typeof CATEGORIES)[number], origin: ORIGINS[0] as (typeof ORIGINS)[number],
    description: "", address: "", city: "", postcode: "",
    hours: "", phone: "", fulfillment: "collection" as "collection" | "delivery" | "both", image_url: "",
  });
  const [bank, setBank] = useState({ bank_name: "", bank_account_name: "", bank_account_number: "", bank_sort_code: "" });
  const [products, setProducts] = useState<Product[]>([{ name: "", price: "", unit: "" }]);
  const [schedule, setSchedule] = useState<DayDraft[]>([0,1,2,3,4,5,6].map((day) => ({ day, active: false, start_time: "09:00", end_time: "18:00", slot_duration_mins: 30 })));

  useEffect(() => {
    // route guard handled by beforeLoad
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

  const addProduct = () => setProducts((p) => [...p, { name: "", price: "", unit: "" }]);
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, key: keyof Product, value: string) =>
    setProducts((p) => p.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

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

  const handleSubmit = async () => {
    if (!user) return;
    const isBarber = isBookable(store.category);
    const validProducts = products.filter((p) => p.name.trim() && p.price.trim());
    if (!isBarber && validProducts.length === 0) { toast.error("Add at least one product"); return; }

    setSubmitting(true);
    try {
      const slug = `${slugify(store.name)}-${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        ...storeSchema.parse(store),
        ...bankSchema.parse(bank),
        owner_id: user.id,
        slug,
        image_url: store.image_url || null,
        published: true,
      };

      const { data: newStore, error: storeErr } = await supabase
        .from("stores").insert(payload).select("id").single();
      if (storeErr) throw storeErr;

      if (validProducts.length > 0) {
        const productRows = validProducts.map((p, i) => ({
          store_id: newStore.id,
          name: p.name.trim().slice(0, 80),
          price: Number(p.price),
          unit: p.unit.trim() || null,
          position: i,
        }));
        const { error: prodErr } = await supabase.from("store_products").insert(productRows);
        if (prodErr) throw prodErr;
      }

      if (isBarber) {
        const activeDays = schedule.filter((d) => d.active);
        if (activeDays.length > 0) {
          const { error: availErr } = await supabase.from("store_availability").insert(
            activeDays.map((d) => ({ store_id: newStore.id, day_of_week: d.day, start_time: d.start_time, end_time: d.end_time, slot_duration_mins: d.slot_duration_mins }))
          );
          if (availErr) throw availErr;
        }
      }

      // Promote to merchant role
      await supabase.from("user_roles").insert({ user_id: user.id, role: "merchant" });
      await refreshRoles();

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
            { n: 3, label: isBookable(store.category) ? "Schedule" : "Products", icon: isBookable(store.category) ? Calendar : Package },
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
                  <Select value={store.category} onValueChange={(v) => setStore({ ...store, category: v as any })}>
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

              <div>
                <Label>Fulfilment</Label>
                <Select value={store.fulfillment} onValueChange={(v) => setStore({ ...store, fulfillment: v as any })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collection">🏪 Collection only</SelectItem>
                    <SelectItem value="delivery">🚚 Delivery only</SelectItem>
                    <SelectItem value="both">🏪🚚 Collection &amp; Delivery</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">How will customers receive their order? You arrange this directly with them.</p>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={store.description} onChange={(e) => setStore({ ...store, description: e.target.value })} placeholder="What makes your store special?" maxLength={500} className="mt-1" rows={3} />
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Address</Label>
                  <Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} maxLength={200} className="mt-1" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={store.city} onChange={(e) => setStore({ ...store, city: e.target.value })} maxLength={60} className="mt-1" />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input value={store.postcode} onChange={(e) => setStore({ ...store, postcode: e.target.value })} maxLength={20} className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} maxLength={40} className="mt-1" />
                  <p className="mt-1.5 text-xs text-muted-foreground">You'll receive order alerts by email and SMS to the phone number on your store.</p>
                </div>
              </div>

              <div>
                <Label>Opening hours</Label>
                <Input value={store.hours} onChange={(e) => setStore({ ...store, hours: e.target.value })} placeholder="Mon–Sat · 9am – 8pm" maxLength={80} className="mt-1" />
              </div>

              <Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={() => { if (validateStep1()) setStep(2); }}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold">Where should customers pay?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Customers send payment directly to this account. Lokal never holds your money.</p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                <strong>Tip:</strong> use a dedicated business account if you can. Each order has a unique reference (e.g. <span className="font-mono">LKL-X7K2P</span>) so payments are easy to match.
              </div>

              <div>
                <Label>Bank name *</Label>
                <Input value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} placeholder="Barclays" maxLength={60} className="mt-1" />
              </div>
              <div>
                <Label>Account name *</Label>
                <Input value={bank.bank_account_name} onChange={(e) => setBank({ ...bank, bank_account_name: e.target.value })} placeholder="Adwoa Mensah Ltd" maxLength={80} className="mt-1" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Account number *</Label>
                  <Input value={bank.bank_account_number} onChange={(e) => setBank({ ...bank, bank_account_number: e.target.value.replace(/\D/g, "") })} placeholder="20451887" inputMode="numeric" maxLength={20} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label>Sort code</Label>
                  <Input value={bank.bank_sort_code} onChange={(e) => setBank({ ...bank, bank_sort_code: e.target.value })} placeholder="20-00-00" maxLength={10} className="mt-1 font-mono" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" className="flex-[2] bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={() => { if (validateStep2()) setStep(3); }}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {isBookable(store.category) ? (
                <>
                  <div>
                    <h2 className="font-display text-2xl font-bold">Services &amp; schedule</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Add the services you offer, then set your weekly availability.</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Services</p>
                    <div className="space-y-3">
                      {products.map((p, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2">
                          <Input className="col-span-6" placeholder="Service name" value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} maxLength={80} />
                          <Input className="col-span-3 font-mono" placeholder="Price" inputMode="decimal" value={p.price} onChange={(e) => updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))} />
                          <Input className="col-span-2" placeholder="Unit" value={p.unit} onChange={(e) => updateProduct(i, "unit", e.target.value)} maxLength={20} />
                          <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground" onClick={() => removeProduct(i)} disabled={products.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
                      <div key={i} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-6" placeholder="Product name" value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} maxLength={80} />
                        <Input className="col-span-3 font-mono" placeholder="Price" inputMode="decimal" value={p.price} onChange={(e) => updateProduct(i, "price", e.target.value.replace(/[^0-9.]/g, ""))} />
                        <Input className="col-span-2" placeholder="Unit" value={p.unit} onChange={(e) => updateProduct(i, "unit", e.target.value)} maxLength={20} />
                        <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground" onClick={() => removeProduct(i)} disabled={products.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
