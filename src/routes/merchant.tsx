import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link, redirect, useRouter } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, normalizeImagePath, normalizeInstagramHandle, normalizeTikTokHandle, normalizeWebsiteUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Store as StoreIcon, MapPin, Landmark, Eye, EyeOff, Pencil, Trash2, Loader2, ShoppingBag, Check, MessageSquare, Phone, Rss, Image as ImageIcon, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { LIVE_CATEGORIES, LIVE_ORIGINS, BOOKABLE_CATEGORIES } from "@/data/stores";

const isBookable = (cat: string) => (BOOKABLE_CATEGORIES as readonly string[]).includes(cat);

function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Could not load your stores</h1>
        <p className="mt-2 text-sm text-muted-foreground">{import.meta.env.DEV ? error.message : "Something went wrong. Please try again."}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/merchant")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth", search: { redirect: "/merchant" } });
  },
  errorComponent: RouteError,
  component: MerchantPage,
  head: () => ({ meta: [{ title: "My store · Lokal" }] }),
});

const CATEGORIES = LIVE_CATEGORIES;
const ORIGINS = LIVE_ORIGINS;
type Category = (typeof CATEGORIES)[number];
type Origin = (typeof ORIGINS)[number];

type StoreRow = {
  id: string; owner_id: string; name: string; category: string; origin: string | null;
  description: string | null; address: string | null; city: string | null;
  postcode: string | null; hours: string | null; phone: string | null;
  instagram_handle: string | null; tiktok_handle: string | null; website_url: string | null;
  image_url: string | null; published: boolean; fulfillment: string;
  bank_name: string | null; bank_account_name: string | null;
  bank_account_number: string | null; bank_sort_code: string | null;
};

type OrderRow = {
  id: string; reference: string; customer_name: string; customer_phone: string; customer_email: string | null;
  note: string | null; items: Array<{ name: string; price: number; qty: number; unit?: string }>;
  total_gbp: number; status: string; created_at: string; store_id: string;
};

type MessageRow = {
  id: string; store_id: string; customer_name: string; customer_phone: string;
  body: string; direction: "inbound" | "outbound"; created_at: string;
};

type AvailabilityRow = {
  id: string; store_id: string; day_of_week: number;
  start_time: string; end_time: string; slot_duration_mins: number; max_bookings_per_slot: number;
};

type BookingRow = {
  id: string; store_id: string; customer_name: string; customer_phone: string;
  customer_email: string | null; service: string | null;
  slot_start: string; slot_end: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string | null; created_at: string;
};

type PostRow = {
  id: string; store_id: string; body: string; image_url: string | null; created_at: string;
};

type DayDraft = {
  day: number; active: boolean; start_time: string; end_time: string; slot_duration_mins: number; max_bookings_per_slot: number;
};

function toWhatsAppNumber(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Keep only digits, but preserve leading "+" semantics.
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+")) return digits;
  if (trimmed.startsWith("00")) return digits.slice(2);

  // Backward compatibility for legacy local UK mobile numbers entered as 07...
  if (/^07\d{9}$/.test(digits)) return `44${digits.slice(1)}`;

  // Ambiguous local numbers (leading 0) should include country code.
  if (digits.startsWith("0")) return "";

  // Accept international numbers entered without leading "+".
  if (digits.length < 8 || digits.length > 15) return "";

  // Already in international format without "+".
  return digits;
}

function EditStoreDialog({ store, onClose, onSaved }: {
  store: StoreRow;
  onClose: () => void;
  onSaved: (updated: StoreRow) => void;
}) {
  const [form, setForm] = useState<{ name: string; category: Category; origin: Origin; description: string; address: string; city: string; postcode: string; hours: string; phone: string; instagram_handle: string; tiktok_handle: string; website_url: string; fulfillment: string; image_url: string; bank_name: string; bank_account_name: string; bank_account_number: string; bank_sort_code: string }>({
    name: store.name,
    category: (CATEGORIES.includes(store.category as Category) ? (store.category as Category) : "Groceries"),
    origin: (ORIGINS.includes((store.origin ?? "") as Origin) ? (store.origin as Origin) : ORIGINS[0]), description: store.description ?? "",
    address: store.address ?? "", city: store.city ?? "", postcode: store.postcode ?? "",
    hours: store.hours ?? "", phone: store.phone ?? "", instagram_handle: store.instagram_handle ?? "", tiktok_handle: store.tiktok_handle ?? "", website_url: store.website_url ?? "", fulfillment: store.fulfillment ?? "collection", image_url: normalizeImagePath(store.image_url) ?? "",
    bank_name: store.bank_name ?? "", bank_account_name: store.bank_account_name ?? "",
    bank_account_number: store.bank_account_number ?? "", bank_sort_code: store.bank_sort_code ?? "",
  });
  const [products, setProducts] = useState<Array<{ id?: string; name: string; price: string; unit: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [editAvail, setEditAvail] = useState<DayDraft[]>([0,1,2,3,4,5,6].map((day) => ({ day, active: false, start_time: "09:00", end_time: "18:00", slot_duration_mins: 30, max_bookings_per_slot: 1 })));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("store_products").select("id,name,price,unit").eq("store_id", store.id).order("position")
      .then(({ data }) => {
        setProducts((data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: String(p.price), unit: p.unit ?? "" })));
        setLoadingProducts(false);
      });
    if (isBookable(store.category)) {
      (supabase as any).from("store_availability").select("*").eq("store_id", store.id)
        .then((result: any) => {
          const data: any[] | null = result.data;
          if (data && data.length > 0) {
            setEditAvail([0,1,2,3,4,5,6].map((day) => {
              const row = (data as any[]).find((r) => r.day_of_week === day);
              if (row) return { day, active: true, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5), slot_duration_mins: row.slot_duration_mins, max_bookings_per_slot: row.max_bookings_per_slot ?? 1 };
              return { day, active: false, start_time: "09:00", end_time: "18:00", slot_duration_mins: 30, max_bookings_per_slot: 1 };
            }));
          }
        });
    }
  }, [store.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${store.owner_id}/${store.id}/cover.${ext}`;
      const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, image_url: path }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const n = (v: string) => v.trim() || null;

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Store name is required"); return; }
    setSaving(true);
    try {
      const instagramHandle = normalizeInstagramHandle(form.instagram_handle);
      const tiktokHandle = normalizeTikTokHandle(form.tiktok_handle);
      const websiteUrl = normalizeWebsiteUrl(form.website_url);

      const { error: storeErr } = await (supabase as any).from("stores").update({
        name: form.name.trim(), category: form.category,
        origin: form.origin, description: n(form.description),
        address: n(form.address), city: n(form.city), postcode: n(form.postcode),
        hours: n(form.hours), phone: n(form.phone), fulfillment: form.fulfillment, image_url: n(form.image_url),
        instagram_handle: instagramHandle, tiktok_handle: tiktokHandle, website_url: websiteUrl,
        bank_name: n(form.bank_name), bank_account_name: n(form.bank_account_name),
        bank_account_number: n(form.bank_account_number), bank_sort_code: n(form.bank_sort_code),
      }).eq("id", store.id);
      if (storeErr) throw storeErr;

      const validProducts = products.filter((p) => p.name.trim() && p.price.trim());
      await supabase.from("store_products").delete().eq("store_id", store.id);
      if (validProducts.length > 0) {
        const { error: prodErr } = await supabase.from("store_products").insert(
          validProducts.map((p, i) => ({ store_id: store.id, name: p.name.trim().slice(0, 80), price: Number(p.price), unit: p.unit.trim() || null, position: i }))
        );
        if (prodErr) throw prodErr;
      }

      if (isBookable(form.category)) {
        await (supabase as any).from("store_availability").delete().eq("store_id", store.id);
        const activeDays = editAvail.filter((d) => d.active);
        if (activeDays.length > 0) {
          const { error: availErr } = await (supabase as any).from("store_availability").insert(
            activeDays.map((d) => ({ store_id: store.id, day_of_week: d.day, start_time: d.start_time, end_time: d.end_time, slot_duration_mins: d.slot_duration_mins, max_bookings_per_slot: d.max_bookings_per_slot }))
          );
          if (availErr) throw availErr;
        }
      }

      onSaved({ ...store, ...form, origin: form.origin, description: n(form.description), address: n(form.address), city: n(form.city), postcode: n(form.postcode), hours: n(form.hours), phone: n(form.phone), instagram_handle: instagramHandle, tiktok_handle: tiktokHandle, website_url: websiteUrl, fulfillment: form.fulfillment, image_url: n(form.image_url), bank_name: n(form.bank_name), bank_account_name: n(form.bank_account_name), bank_account_number: n(form.bank_account_number), bank_sort_code: n(form.bank_sort_code) });
      toast.success("Store updated");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {store.name}</DialogTitle></DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store info</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Store name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80} className="mt-1" /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Origin</Label>
                <Select value={form.origin} onValueChange={(v) => setForm((f) => ({ ...f, origin: v as Origin }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={500} rows={3} className="mt-1" /></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cover photo</Label>
            {form.image_url && <div className="h-28 w-full overflow-hidden rounded-lg bg-secondary"><img src={getImageUrl(form.image_url) || ""} alt="" className="h-full w-full object-cover" /></div>}
            <label className="cursor-pointer">
              <div className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${uploading ? " opacity-50" : ""}`}>
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : "Upload photo"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location &amp; contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} maxLength={200} className="mt-1" /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} maxLength={60} className="mt-1" /></div>
              <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} maxLength={20} className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={40} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Order alerts sent by email and SMS to this number. Use international format (e.g. +1, +44, +234).</p></div>
              <div><Label>Opening hours</Label><Input value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="Mon–Sat 9am–8pm" maxLength={80} className="mt-1" /></div>
              <div><Label>Instagram</Label><Input value={form.instagram_handle} onChange={(e) => setForm((f) => ({ ...f, instagram_handle: e.target.value }))} placeholder="Handle or profile URL" maxLength={80} className="mt-1" /></div>
              <div><Label>TikTok</Label><Input value={form.tiktok_handle} onChange={(e) => setForm((f) => ({ ...f, tiktok_handle: e.target.value }))} placeholder="Handle or profile URL" maxLength={80} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label>Website</Label><Input value={form.website_url} onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://..." maxLength={200} className="mt-1" /></div>
              <div className="sm:col-span-2">
                <Label>Fulfilment</Label>
                <Select value={form.fulfillment} onValueChange={(v) => setForm((f) => ({ ...f, fulfillment: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collection">🏪 Collection only</SelectItem>
                    <SelectItem value="delivery">🚚 Delivery only</SelectItem>
                    <SelectItem value="both">🏪🚚 Collection &amp; Delivery</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Let customers know how they can receive their order. You arrange this directly with the customer.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Bank name</Label><Input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} maxLength={60} className="mt-1" /></div>
              <div><Label>Account name</Label><Input value={form.bank_account_name} onChange={(e) => setForm((f) => ({ ...f, bank_account_name: e.target.value }))} maxLength={80} className="mt-1" /></div>
              <div><Label>Account number</Label><Input value={form.bank_account_number} onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" maxLength={20} className="mt-1 font-mono" /></div>
              <div><Label>Sort code</Label><Input value={form.bank_sort_code} onChange={(e) => setForm((f) => ({ ...f, bank_sort_code: e.target.value }))} maxLength={10} className="mt-1 font-mono" /></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isBookable(form.category) ? "Services" : "Products"}</p>
              <Button size="sm" variant="outline" onClick={() => setProducts((p) => [...p, { name: "", price: "", unit: "" }])}><Plus className="mr-1 h-3.5 w-3.5" />{isBookable(form.category) ? "Add service" : "Add"}</Button>
            </div>
            {loadingProducts ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="space-y-2">
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder={isBookable(form.category) ? "Service name" : "Product name"} value={p.name} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} maxLength={80} />
                    <Input className="col-span-3 font-mono" placeholder="£0.00" value={p.price} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} />
                    <Input className="col-span-3" placeholder="unit" value={p.unit} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))} maxLength={20} />
                    <button onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isBookable(form.category) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking schedule</p>
              <div className="space-y-2">
                {editAvail.map((d, i) => (
                  <div key={d.day} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={d.active} onChange={(e) => setEditAvail((s) => s.map((x, idx) => idx === i ? { ...x, active: e.target.checked } : x))} className="h-4 w-4 accent-primary" />
                      <span className="w-10 text-sm font-medium">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.day]}</span>
                      {d.active && (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Input type="time" value={d.start_time} onChange={(e) => setEditAvail((s) => s.map((x, idx) => idx === i ? { ...x, start_time: e.target.value } : x))} className="h-8 text-xs w-28" />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input type="time" value={d.end_time} onChange={(e) => setEditAvail((s) => s.map((x, idx) => idx === i ? { ...x, end_time: e.target.value } : x))} className="h-8 text-xs w-28" />
                          <Select value={String(d.slot_duration_mins)} onValueChange={(v) => setEditAvail((s) => s.map((x, idx) => idx === i ? { ...x, slot_duration_mins: Number(v) } : x))}>
                            <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Max</span>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={d.max_bookings_per_slot}
                              onChange={(e) => setEditAvail((s) => s.map((x, idx) => idx === i ? { ...x, max_bookings_per_slot: Math.max(1, Number(e.target.value)) } : x))}
                              className="h-8 text-xs w-14 font-mono"
                            />
                            <span className="text-xs text-muted-foreground">clients</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MerchantPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const db = supabase as unknown as { from: (table: string) => any };
  const [tab, setTab] = useState<"stores" | "orders" | "messages" | "bookings" | "posts">("stores");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [seenInboundMessageIds, setSeenInboundMessageIds] = useState<Set<string>>(new Set());
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [storeAvailability, setStoreAvailability] = useState<AvailabilityRow[]>([]);
  const [editingAvailStoreId, setEditingAvailStoreId] = useState<string | null>(null);
  const [availDraft, setAvailDraft] = useState<DayDraft[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postDraftStoreId, setPostDraftStoreId] = useState<string | null>(null);
  const [postDraftBody, setPostDraftBody] = useState("");
  const [postDraftImage, setPostDraftImage] = useState("");
  const [postDraftUploading, setPostDraftUploading] = useState(false);
  const [postDraftSaving, setPostDraftSaving] = useState(false);
  const [sharedStoreId, setSharedStoreId] = useState<string | null>(null);

  const handleShareStore = (storeId: string) => {
    const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
    const shareUrl = `${domain}/store/${storeId}`;
    navigator.clipboard.writeText(shareUrl);
    setSharedStoreId(storeId);
    toast.success("Share link copied!");
    setTimeout(() => setSharedStoreId(null), 2000);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: storesData, error } = await supabase.from("stores").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) { toast.error(error.message); setBusy(false); return; }
      const rows = (storesData as unknown as StoreRow[]) ?? [];
      setStores(rows);
      setBusy(false);

      if (rows.length === 0) return;
      const storeIds = rows.map((s) => s.id);

      const { data: ordersData } = await db.from("orders").select("*").in("store_id", storeIds).order("created_at", { ascending: false }).limit(100);
      setOrders(((ordersData ?? []) as unknown) as OrderRow[]);

      // Load messages (graceful if table not yet migrated)
      try {
          const { data: msgsData } = await db.from("messages").select("*").in("store_id", storeIds).order("created_at", { ascending: false }).limit(200);
        setMessages((msgsData ?? []) as MessageRow[]);
      } catch { /* messages table not yet created */ }

      // Load posts
      try {
        const { data: postsData } = await db.from("store_posts").select("*").in("store_id", storeIds).order("created_at", { ascending: false }).limit(200);
        setPosts((postsData ?? []) as PostRow[]);
      } catch { /* posts table may not exist yet */ }

      // Load bookings and availability for Barbers/Beauty stores
      const bookableIds = rows.filter((s) => isBookable(s.category)).map((s) => s.id);
      if (bookableIds.length > 0) {
        try {
          const [{ data: availData }, { data: bookingsData }] = await Promise.all([
            db.from("store_availability").select("*").in("store_id", bookableIds),
            db.from("store_bookings").select("*").in("store_id", bookableIds)
              .gte("slot_start", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19))
              .order("slot_start", { ascending: true }).limit(200),
          ]);
          setStoreAvailability((availData ?? []) as AvailabilityRow[]);
          setBookings((bookingsData ?? []) as BookingRow[]);
        } catch { /* bookings tables not yet created */ }
      }

      // Real-time subscriptions
      const channel = supabase
        .channel("merchant-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `store_id=in.(${storeIds.join(",")})` }, (payload) => {
          setOrders((prev) => [payload.new as OrderRow, ...prev]);
          toast("New order received!", { description: `${(payload.new as OrderRow).reference} — £${Number((payload.new as OrderRow).total_gbp).toFixed(2)}` });
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=in.(${storeIds.join(",")})` }, (payload) => {
          setOrders((prev) => prev.map((o) => o.id === (payload.new as OrderRow).id ? payload.new as OrderRow : o));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `store_id=in.(${storeIds.join(",")})` }, (payload) => {
          setMessages((prev) => [payload.new as MessageRow, ...prev]);
          toast("💬 New message!", { description: `From ${(payload.new as MessageRow).customer_name}` });
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "store_bookings", filter: `store_id=in.(${storeIds.join(",")})` }, (payload) => {
          setBookings((prev) => [...prev, payload.new as BookingRow].sort((a, b) => a.slot_start.localeCompare(b.slot_start)));
          toast("📅 New booking request!", { description: `${(payload.new as BookingRow).customer_name} — ${(payload.new as BookingRow).slot_start.slice(0, 16).replace("T", " ")}` });
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    })();
  }, [user]);

  useEffect(() => {
    if (tab !== "messages") return;
    setSeenInboundMessageIds((prev) => {
      const next = new Set(prev);
      for (const m of messages) {
        if (m.direction === "inbound") next.add(m.id);
      }
      return next;
    });
  }, [tab, messages]);

  const togglePublish = async (s: StoreRow) => {
    const { error } = await supabase.from("stores").update({ published: !s.published }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, published: !s.published } : x)));
    toast.success(s.published ? "Store hidden" : "Store published");
  };

  const deleteStore = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
      setStores((prev) => prev.filter((x) => x.id !== id));
      setOrders((prev) => prev.filter((o) => o.store_id !== id));
      toast.success("Store deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Could not delete store");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await db.from("orders").update({ status }).eq("id", orderId);
    if (error) return toast.error(error.message);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    const labels: Record<string, string> = {
      transfer_received: "Marked as transfer received",
      ready: "Order marked ready",
      completed: "Order completed",
      cancelled: "Order cancelled",
    };
    toast.success(labels[status] ?? "Order updated");

    if (status === "ready") {
      const order = orders.find((o) => o.id === orderId);
      const store = stores.find((s) => s.id === order?.store_id);
      if ((order?.customer_email || order?.customer_phone) && store) {
        void supabase.functions.invoke("send-order-ready", {
          body: {
            reference: order.reference,
            store_name: store.name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            customer_name: order.customer_name,
          },
        });
      }
    }
  };

  const markOrderPaid = (id: string) => updateOrderStatus(id, "transfer_received");
  const cancelOrder = (id: string) => updateOrderStatus(id, "cancelled");

  const pendingCount = orders.filter((o) => ["pending_transfer", "transfer_received"].includes(o.status)).length;
  const unreadMessages = messages.filter((m) => m.direction === "inbound" && !seenInboundMessageIds.has(m.id)).length;
  const storesWithoutPhone = stores.filter((s) => !s.phone);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-12">

        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold">Merchant dashboard</h1>
            <p className="mt-1 text-muted-foreground">Manage your stores and incoming orders.</p>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95 gap-2" onClick={() => navigate({ to: "/list-store" })}>
            <Plus className="h-4 w-4" /> Add a store
          </Button>
        </div>

        {/* Tabs */}
        {/* WhatsApp nudge banner */}
        {storesWithoutPhone.length > 0 && (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <Phone className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-amber-800 font-medium">{storesWithoutPhone.length} store{storesWithoutPhone.length > 1 ? "s" : ""} missing a phone number — WhatsApp alerts won't work until you add one.</span>
            <button onClick={() => setEditingStore(storesWithoutPhone[0])} className="ml-auto shrink-0 text-amber-700 underline text-xs font-semibold">Fix now →</button>
          </div>
        )}

        <div className="mt-8 overflow-x-auto pb-1">
          <div className="flex w-max min-w-full gap-1 rounded-xl bg-secondary p-1">
            <button
              onClick={() => setTab("stores")}
              className={`whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "stores" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Stores
            </button>
            <button
              onClick={() => setTab("orders")}
              className={`relative whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "orders" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Orders
              {pendingCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("messages")}
              className={`relative whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "messages" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Messages
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("bookings")}
              className={`relative whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "bookings" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Bookings
              {bookings.filter((b) => b.status === "pending").length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {bookings.filter((b) => b.status === "pending").length > 9 ? "9+" : bookings.filter((b) => b.status === "pending").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("posts")}
              className={`whitespace-nowrap rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "posts" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Posts
            </button>
          </div>
        </div>

        {/* Stores tab */}
        {tab === "stores" && (
          busy ? (
            <div className="mt-12 text-center text-muted-foreground">Loading your stores…</div>
          ) : stores.length === 0 ? (
            <div className="mt-8 rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <StoreIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">No stores yet</h2>
              <p className="mt-1 text-muted-foreground">List your first store to start receiving orders.</p>
              <Button className="mt-5 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={() => navigate({ to: "/list-store" })}>
                List a store
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {stores.map((s) => (
                <div key={s.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <div className="relative aspect-[5/2] bg-secondary">
                    {s.image_url ? (
                      <img src={getImageUrl(s.image_url) || ""} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground"><StoreIcon className="h-8 w-8" /></div>
                    )}
                    <div className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${s.published ? "bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {s.published ? "Live" : "Hidden"}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl font-bold">{s.name}</h3>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium">{s.category}</span>
                    </div>
                    {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {s.address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{s.address}{s.city ? `, ${s.city}` : ""}</div>}
                      {s.bank_name && <div className="flex items-center gap-1.5"><Landmark className="h-3 w-3" />{s.bank_name} ····{(s.bank_account_number || "").slice(-4)}</div>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="min-w-[6.5rem] flex-1 gap-1.5" onClick={() => togglePublish(s)}>
                        {s.published ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Publish</>}
                      </Button>
                      <Button size="sm" variant="outline" className="min-w-[6.5rem] flex-1 gap-1.5" onClick={() => setEditingStore(s)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="min-w-[5.5rem] flex-1" asChild>
                        <Link to="/">View</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="min-w-[5.5rem] flex-1 gap-1.5" onClick={() => handleShareStore(s.id)} title="Copy shareable link">
                        {sharedStoreId === s.id ? <><Check className="h-3 w-3" /> Done</> : <><Share2 className="h-3 w-3" /> Share</>}
                      </Button>
                      <Button size="sm" variant="outline" className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDeleteId(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Orders for this store */}
                    {orders.filter((o) => o.store_id === s.id && ["pending_transfer", "transfer_received"].includes(o.status)).length > 0 && (
                      <button onClick={() => setTab("orders")} className="mt-3 w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-left text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                        <ShoppingBag className="inline h-3.5 w-3.5 mr-1.5" />
                        {orders.filter((o) => o.store_id === s.id && ["pending_transfer", "transfer_received"].includes(o.status)).length} active order(s) — view dashboard →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="mt-8">
            {orders.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold">No orders yet</h2>
                <p className="mt-1 text-muted-foreground">When shoppers place orders, they'll appear here instantly.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Filter row */}
                <div className="flex gap-2 text-xs font-medium flex-wrap">
                  {["all", "pending_transfer", "transfer_received", "ready", "completed", "cancelled"].map((f) => {
                    const labels: Record<string, string> = { all: "All", pending_transfer: "Awaiting transfer", transfer_received: "Transfer received", ready: "Ready", completed: "Done", cancelled: "Cancelled" };
                    const count = f === "all" ? orders.length : orders.filter((o) => o.status === f).length;
                    return (
                      <span key={f} className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">
                        {labels[f]} {count > 0 && <span className="ml-1 font-bold text-foreground">{count}</span>}
                      </span>
                    );
                  })}
                </div>

                {orders.map((o) => {
                  const storeName = stores.find((s) => s.id === o.store_id)?.name ?? "—";
                  const statusMeta: Record<string, { label: string; color: string }> = {
                    pending_transfer: { label: "Awaiting transfer", color: "bg-amber-100 text-amber-800" },
                    transfer_received: { label: "Transfer received", color: "bg-blue-100 text-blue-700" },
                    payment_received: { label: "Transfer received", color: "bg-blue-100 text-blue-700" },
                    ready: { label: "Ready", color: "bg-green-100 text-green-700" },
                    completed: { label: "Done", color: "bg-secondary text-muted-foreground" },
                    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
                  };
                  const sm = statusMeta[o.status] ?? statusMeta.pending_transfer;
                  const isActive = ["pending_transfer", "transfer_received", "payment_received"].includes(o.status);
                  return (
                    <div key={o.id} className={`rounded-xl border bg-card p-4 transition-colors ${isActive ? "border-amber-200 bg-amber-50/30" : "border-border"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-primary">{o.reference}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sm.color}`}>
                              {sm.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{storeName}</span>
                          </div>

                          {/* Customer */}
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-sm">{o.customer_name}</span>
                            <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                              📞 {o.customer_phone}
                            </a>
                          </div>

                          {o.note && <p className="mt-1 text-xs italic text-muted-foreground">"{o.note}"</p>}

                          {/* Items */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {o.items.map((it, i) => (
                              <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                                {it.qty}× {it.name}{it.unit ? ` (${it.unit})` : ""} — £{(it.price * it.qty).toFixed(2)}
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>

                        {/* Amount + actions */}
                        <div className="flex flex-col items-end gap-2">
                          <div className="font-display text-2xl font-bold">£{Number(o.total_gbp).toFixed(2)}</div>
                          <div className="flex gap-2 flex-wrap">
                            {["pending_transfer"].includes(o.status) && (
                              <>
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => cancelOrder(o.id)}>Cancel</Button>
                                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => markOrderPaid(o.id)}>
                                  <Check className="mr-1.5 h-3.5 w-3.5" />Transfer received
                                </Button>
                              </>
                            )}
                            {["transfer_received", "payment_received"].includes(o.status) && (
                              <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => updateOrderStatus(o.id, "ready")}>
                                <Check className="mr-1.5 h-3.5 w-3.5" />Mark ready
                              </Button>
                            )}
                            {o.status === "ready" && (
                              <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, "completed")}>
                                <Check className="mr-1.5 h-3.5 w-3.5" />Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages tab */}
        {tab === "messages" && (
          <div className="mt-8 space-y-5">

            {/* WhatsApp Setup Card */}
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">WhatsApp order alerts</h3>
                  <p className="text-xs text-muted-foreground">Alerts fire to your store phone number when orders or messages arrive.</p>
                </div>
              </div>
              <div className="space-y-2">
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stores yet.</p>
                ) : stores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-sm">
                    <span className="font-medium truncate mr-3">{s.name}</span>
                    {s.phone ? (
                      <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold shrink-0">
                        <Check className="h-3.5 w-3.5" /> {s.phone}
                      </span>
                    ) : (
                      <button onClick={() => setEditingStore(s)} className="shrink-0 text-xs font-semibold text-amber-600 hover:underline">
                        ⚠ Set number →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Conversations */}
            {messages.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold">No messages yet</h2>
                <p className="mt-1 text-muted-foreground">When customers message your stores, they'll appear here in real time.</p>
              </div>
            ) : (() => {
              const convMap: Record<string, { storeId: string; customerName: string; customerPhone: string; msgs: MessageRow[]; lastAt: string }> = {};
              messages.forEach((m) => {
                const k = `${m.store_id}::${m.customer_phone}`;
                if (!convMap[k]) convMap[k] = { storeId: m.store_id, customerName: m.customer_name, customerPhone: m.customer_phone, msgs: [], lastAt: m.created_at };
                convMap[k].msgs.push(m);
                if (m.created_at > convMap[k].lastAt) convMap[k].lastAt = m.created_at;
              });
              const convs = Object.entries(convMap).sort(([, a], [, b]) => b.lastAt.localeCompare(a.lastAt));
              return (
                <div className="space-y-2">
                  {convs.map(([key, conv]) => {
                    const storeName = stores.find((s) => s.id === conv.storeId)?.name ?? "—";
                    const waDigits = toWhatsAppNumber(conv.customerPhone);
                    const waLink = waDigits
                      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${conv.customerName}, thanks for messaging ${storeName} on Lokal! 👋`)}`
                      : null;
                    const isExpanded = expandedConv === key;
                    const thread = [...conv.msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
                    return (
                      <div key={key} className="overflow-hidden rounded-xl border border-border bg-card">
                        <button
                          onClick={() => setExpandedConv(isExpanded ? null : key)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                              {conv.customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm">{conv.customerName}</div>
                              <div className="truncate text-xs text-muted-foreground">{thread[thread.length - 1]?.body}</div>
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">{storeName}</span>
                            <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border px-4 pb-4 pt-3">
                            <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
                              {thread.map((m) => (
                                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                    {m.body}
                                    <div className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                      {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <a href={`tel:${conv.customerPhone}`} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary">
                                📞 Call
                              </a>
                              <a href={waLink ?? "#"} target="_blank" rel="noopener noreferrer" aria-disabled={!waLink} onClick={(e) => { if (!waLink) e.preventDefault(); }} className={`rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors ${waLink ? "bg-green-600 hover:bg-green-700" : "cursor-not-allowed bg-green-400/70"}`}>
                                Reply on WhatsApp
                              </a>
                              {!waLink && <span className="text-[10px] text-amber-600">Customer phone missing country code</span>}
                              <span className="ml-auto text-xs text-muted-foreground">{conv.customerPhone}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        )}

        {/* Bookings tab */}
        {tab === "bookings" && (
          <div className="mt-8">
            {(() => {
              const bookableStores = stores.filter((s) => isBookable(s.category));
              if (bookableStores.length === 0) {
                return (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl">✂️</div>
                    <h2 className="mt-4 font-display text-2xl font-bold">No bookable stores</h2>
                    <p className="mt-1 text-muted-foreground">Add a Barbers or Hair &amp; Beauty store to enable appointment booking.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {bookableStores.map((s) => {
                    const storeBookings = bookings.filter((b) => b.store_id === s.id);
                    const now = new Date().toISOString().slice(0, 19);
                    const upcomingBookings = storeBookings.filter((b) => b.status !== "cancelled" && b.slot_start >= now);
                    const pendingCount = storeBookings.filter((b) => b.status === "pending").length;
                    const storeAvail = storeAvailability.filter((a) => a.store_id === s.id);
                    const isEditingAvail = editingAvailStoreId === s.id;
                    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                    return (
                      <div key={s.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-4">
                          <div>
                            <h3 className="font-display text-xl font-bold">{s.name}</h3>
                            <p className="text-sm text-muted-foreground">{s.category}</p>
                          </div>
                          {pendingCount > 0 && (
                            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                              {pendingCount} pending
                            </span>
                          )}
                        </div>

                        <div className="space-y-5 p-5">
                          {/* Schedule editor */}
                          <div>
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking schedule</p>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => {
                                  if (isEditingAvail) {
                                    setEditingAvailStoreId(null);
                                  } else {
                                    const draft: DayDraft[] = [0, 1, 2, 3, 4, 5, 6].map((day) => {
                                      const ex = storeAvail.find((a) => a.day_of_week === day);
                                      return { day, active: !!ex, start_time: ex?.start_time.slice(0, 5) ?? "09:00", end_time: ex?.end_time.slice(0, 5) ?? "18:00", slot_duration_mins: ex?.slot_duration_mins ?? 30, max_bookings_per_slot: ex?.max_bookings_per_slot ?? 1 };
                                    });
                                    setAvailDraft(draft);
                                    setEditingAvailStoreId(s.id);
                                  }
                                }}
                              >
                                {isEditingAvail ? "Cancel" : storeAvail.length === 0 ? "Set schedule" : "Edit schedule"}
                              </Button>
                            </div>

                            {isEditingAvail ? (
                              <div className="space-y-2">
                                {availDraft.map((dayRow, i) => (
                                  <div key={dayRow.day} className={`grid grid-cols-12 items-center gap-2 rounded-lg px-3 py-2 transition-opacity ${dayRow.active ? "bg-secondary/60" : "opacity-50 bg-secondary/20"}`}>
                                    <div className="col-span-2 flex items-center gap-2">
                                      <input type="checkbox" checked={dayRow.active} onChange={(e) => setAvailDraft((prev) => prev.map((d, idx) => idx === i ? { ...d, active: e.target.checked } : d))} className="h-4 w-4 accent-primary" />
                                      <span className="text-xs font-semibold">{DAY_LABELS[dayRow.day]}</span>
                                    </div>
                                    <div className="col-span-4">
                                      <Input type="time" value={dayRow.start_time} disabled={!dayRow.active} onChange={(e) => setAvailDraft((prev) => prev.map((d, idx) => idx === i ? { ...d, start_time: e.target.value } : d))} className="h-8 text-xs" />
                                    </div>
                                    <div className="col-span-4 flex items-center gap-1">
                                      <span className="shrink-0 text-xs text-muted-foreground">to</span>
                                      <Input type="time" value={dayRow.end_time} disabled={!dayRow.active} onChange={(e) => setAvailDraft((prev) => prev.map((d, idx) => idx === i ? { ...d, end_time: e.target.value } : d))} className="h-8 text-xs" />
                                    </div>
                                    <div className="col-span-2">
                                      <Select value={String(dayRow.slot_duration_mins)} disabled={!dayRow.active} onValueChange={(v) => setAvailDraft((prev) => prev.map((d, idx) => idx === i ? { ...d, slot_duration_mins: Number(v) } : d))}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="15">15m</SelectItem>
                                          <SelectItem value="30">30m</SelectItem>
                                          <SelectItem value="45">45m</SelectItem>
                                          <SelectItem value="60">60m</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={20}
                                        disabled={!dayRow.active}
                                        value={dayRow.max_bookings_per_slot}
                                        onChange={(e) => setAvailDraft((prev) => prev.map((d, idx) => idx === i ? { ...d, max_bookings_per_slot: Math.max(1, Number(e.target.value)) } : d))}
                                        className="h-8 text-xs w-12 font-mono"
                                      />
                                      <span className="shrink-0 text-xs text-muted-foreground">max</span>
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  className="mt-2 w-full bg-gradient-primary text-primary-foreground"
                                  onClick={async () => {
                                    try {
                                      await db.from("store_availability").delete().eq("store_id", s.id);
                                      const activeDays = availDraft.filter((d) => d.active);
                                      if (activeDays.length > 0) {
                                        const { error } = await db.from("store_availability").insert(
                                          activeDays.map((d) => ({ store_id: s.id, day_of_week: d.day, start_time: d.start_time, end_time: d.end_time, slot_duration_mins: d.slot_duration_mins, max_bookings_per_slot: d.max_bookings_per_slot }))
                                        );
                                        if (error) throw error;
                                      }
                                      setStoreAvailability((prev) => [
                                        ...prev.filter((a) => a.store_id !== s.id),
                                        ...activeDays.map((d, idx) => ({ id: `new-${idx}`, store_id: s.id, day_of_week: d.day, start_time: d.start_time + ":00", end_time: d.end_time + ":00", slot_duration_mins: d.slot_duration_mins, max_bookings_per_slot: d.max_bookings_per_slot })),
                                      ]);
                                      setEditingAvailStoreId(null);
                                      toast.success("Schedule saved");
                                    } catch (e: any) { toast.error(e.message ?? "Could not save schedule"); }
                                  }}
                                >
                                  Save schedule
                                </Button>
                              </div>
                            ) : storeAvail.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No schedule set yet. Customers won't be able to book until you add one.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {storeAvail.sort((a, b) => a.day_of_week - b.day_of_week).map((a) => (
                                  <span key={a.id} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                                    {DAY_LABELS[a.day_of_week]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)} ({a.slot_duration_mins}m slots)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Bookings list */}
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming bookings</p>
                            {upcomingBookings.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No upcoming bookings yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {upcomingBookings.map((b) => {
                                  const statusMeta: Record<string, { label: string; color: string }> = {
                                    pending: { label: "Pending", color: "bg-amber-100 text-amber-800" },
                                    confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700" },
                                    completed: { label: "Done", color: "bg-secondary text-muted-foreground" },
                                  };
                                  const sm = statusMeta[b.status] ?? statusMeta.pending;
                                  const [datePart, timePart] = b.slot_start.split("T");
                                  const [yr, mo, dy] = datePart.split("-").map(Number);
                                  const prettyDate = new Date(yr, mo - 1, dy).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                                  return (
                                    <div key={b.id} className={`flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors ${b.status === "pending" ? "border-amber-200 bg-amber-50/30" : "border-border"}`}>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-semibold text-sm">{prettyDate} at {timePart.slice(0, 5)}</span>
                                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sm.color}`}>{sm.label}</span>
                                        </div>
                                        <div className="mt-1 font-medium text-sm">{b.customer_name}</div>
                                        {b.service && <div className="text-xs text-muted-foreground">{b.service}</div>}
                                        {b.note && <div className="mt-1 text-xs italic text-muted-foreground">"{b.note}"</div>}
                                        <a href={`tel:${b.customer_phone}`} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                                          📞 {b.customer_phone}
                                        </a>
                                      </div>
                                      <div className="flex shrink-0 gap-2">
                                        {b.status === "pending" && (
                                          <>
                                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={async () => {
                                              await db.from("store_bookings").update({ status: "cancelled" }).eq("id", b.id);
                                              setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "cancelled" } : x));
                                              toast.success("Booking cancelled");
                                            }}>Cancel</Button>
                                            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={async () => {
                                              await db.from("store_bookings").update({ status: "confirmed" }).eq("id", b.id);
                                              setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "confirmed" } : x));
                                              toast.success("Booking confirmed");
                                            }}>
                                              <Check className="mr-1.5 h-3.5 w-3.5" />Confirm
                                            </Button>
                                          </>
                                        )}
                                        {b.status === "confirmed" && (
                                          <Button size="sm" variant="outline" onClick={async () => {
                                            await db.from("store_bookings").update({ status: "completed" }).eq("id", b.id);
                                            setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "completed" } : x));
                                            toast.success("Booking marked complete");
                                          }}>
                                            <Check className="mr-1.5 h-3.5 w-3.5" />Mark done
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      {/* Posts tab */}
        {tab === "posts" && (
          <div className="mt-8 space-y-6">
            {stores.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Rss className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold">No stores yet</h2>
                <p className="mt-1 text-muted-foreground">Add a store first to start posting updates.</p>
              </div>
            ) : (
              <>
                {/* New post form */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">New update</p>
                  <div className="space-y-3">
                    {stores.length > 1 && (
                      <div>
                        <Label>Store</Label>
                        <Select value={postDraftStoreId ?? stores[0].id} onValueChange={setPostDraftStoreId}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Update</Label>
                      <Textarea
                        className="mt-1"
                        rows={3}
                        maxLength={1000}
                        placeholder="New stock just arrived! Fresh plantain, egusi, and crayfish in store today 🥭"
                        value={postDraftBody}
                        onChange={(e) => setPostDraftBody(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground text-right">{postDraftBody.length}/1000</p>
                    </div>
                    <div>
                      <Label>Photo (optional)</Label>
                      {postDraftImage && (
                        <div className="mt-1 relative w-40 h-28 rounded-lg overflow-hidden bg-secondary">
                          <img src={getImageUrl(postDraftImage) || ""} alt="" className="h-full w-full object-cover" />
                          <button onClick={() => setPostDraftImage("")} className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-xs hover:bg-background">✕</button>
                        </div>
                      )}
                      <label className="mt-1 cursor-pointer block">
                        <div className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${postDraftUploading ? " opacity-50" : ""}`}>
                          {postDraftUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><ImageIcon className="mr-2 h-4 w-4" />Upload photo</>}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={postDraftUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            setPostDraftUploading(true);
                            try {
                              const storeId = postDraftStoreId ?? stores[0].id;
                              const ext = file.name.split(".").pop();
                              const path = `${user.id}/${storeId}/post-${Date.now()}.${ext}`;
                              const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: false });
                              if (error) throw error;
                              setPostDraftImage(path);
                              toast.success("Photo uploaded");
                            } catch (err: any) {
                              toast.error(err.message ?? "Upload failed");
                            } finally {
                              setPostDraftUploading(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <Button
                      disabled={!postDraftBody.trim() || postDraftSaving}
                      className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                      onClick={async () => {
                        if (!postDraftBody.trim()) return;
                        setPostDraftSaving(true);
                        const storeId = postDraftStoreId ?? stores[0].id;
                        try {
                          const { data, error } = await db.from("store_posts").insert({
                            store_id: storeId,
                            body: postDraftBody.trim(),
                            image_url: postDraftImage || null,
                          }).select("*").single();
                          if (error) throw error;
                          setPosts((prev) => [data as PostRow, ...prev]);
                          setPostDraftBody("");
                          setPostDraftImage("");
                          toast.success("Update posted!");
                        } catch (e: any) {
                          toast.error(e.message ?? "Could not post update");
                        } finally {
                          setPostDraftSaving(false);
                        }
                      }}
                    >
                      {postDraftSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting…</> : "Post update"}
                    </Button>
                  </div>
                </div>

                {/* Existing posts */}
                {posts.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
                    <Rss className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">No updates yet. Post your first update above.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => {
                      const storeName = stores.find((s) => s.id === post.store_id)?.name ?? "—";
                      return (
                        <div key={post.id} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-primary">{storeName}</span>
                                <span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                              {post.image_url && (
                                <div className="mt-3 overflow-hidden rounded-lg max-h-60 bg-secondary">
                                  <img src={getImageUrl(post.image_url) || ""} alt="" className="h-full w-full object-cover" />
                                </div>
                              )}
                            </div>
                            <button
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                const { error } = await db.from("store_posts").delete().eq("id", post.id);
                                if (error) { toast.error(error.message); return; }
                                setPosts((prev) => prev.filter((p) => p.id !== post.id));
                                toast.success("Post deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      {editingStore && (
        <EditStoreDialog
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onSaved={(updated) => {
            setStores((prev) => prev.map((s) => s.id === updated.id ? updated : s));
            setEditingStore(null);
          }}
        />
      )}

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <Dialog open onOpenChange={(o) => { if (!o && !deleting) setConfirmDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete store?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <strong>{stores.find((s) => s.id === confirmDeleteId)?.name}</strong> and all its products. Orders will remain in your records. This cannot be undone.
            </p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteStore(confirmDeleteId)} disabled={deleting}>
                {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : "Delete store"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}
