import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link, redirect, useRouter } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Store as StoreIcon, MapPin, Landmark, Eye, EyeOff, Pencil, Trash2, Loader2, ShoppingBag, Check, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { LIVE_CATEGORIES } from "@/data/stores";

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
type Category = (typeof CATEGORIES)[number];

type StoreRow = {
  id: string; name: string; category: string; origin: string | null;
  description: string | null; address: string | null; city: string | null;
  postcode: string | null; hours: string | null; phone: string | null;
  image_url: string | null; published: boolean;
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

function EditStoreDialog({ store, onClose, onSaved }: {
  store: StoreRow;
  onClose: () => void;
  onSaved: (updated: StoreRow) => void;
}) {
  const [form, setForm] = useState<{ name: string; category: Category; origin: string; description: string; address: string; city: string; postcode: string; hours: string; phone: string; image_url: string; bank_name: string; bank_account_name: string; bank_account_number: string; bank_sort_code: string }>({
    name: store.name,
    category: (CATEGORIES.includes(store.category as Category) ? (store.category as Category) : "Groceries"),
    origin: store.origin ?? "", description: store.description ?? "",
    address: store.address ?? "", city: store.city ?? "", postcode: store.postcode ?? "",
    hours: store.hours ?? "", phone: store.phone ?? "", image_url: store.image_url ?? "",
    bank_name: store.bank_name ?? "", bank_account_name: store.bank_account_name ?? "",
    bank_account_number: store.bank_account_number ?? "", bank_sort_code: store.bank_sort_code ?? "",
  });
  const [products, setProducts] = useState<Array<{ id?: string; name: string; price: string; unit: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("store_products").select("id,name,price,unit").eq("store_id", store.id).order("position")
      .then(({ data }) => {
        setProducts((data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: String(p.price), unit: p.unit ?? "" })));
        setLoadingProducts(false);
      });
  }, [store.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${store.id}/cover.${ext}`;
      const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("store-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
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
      const { error: storeErr } = await supabase.from("stores").update({
        name: form.name.trim(), category: form.category,
        origin: n(form.origin), description: n(form.description),
        address: n(form.address), city: n(form.city), postcode: n(form.postcode),
        hours: n(form.hours), phone: n(form.phone), image_url: n(form.image_url),
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

      onSaved({ ...store, ...form, origin: n(form.origin), description: n(form.description), address: n(form.address), city: n(form.city), postcode: n(form.postcode), hours: n(form.hours), phone: n(form.phone), image_url: n(form.image_url), bank_name: n(form.bank_name), bank_account_name: n(form.bank_account_name), bank_account_number: n(form.bank_account_number), bank_sort_code: n(form.bank_sort_code) });
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
              <div><Label>Origin</Label><Input value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} placeholder="🇬🇭 Ghanaian" maxLength={60} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={500} rows={3} className="mt-1" /></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cover photo</Label>
            {form.image_url && <div className="h-28 w-full overflow-hidden rounded-lg bg-secondary"><img src={form.image_url} alt="" className="h-full w-full object-cover" /></div>}
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <div className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${uploading ? " opacity-50" : ""}`}>
                  {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : "Upload photo"}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="or paste URL" className="flex-[2]" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location &amp; contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} maxLength={200} className="mt-1" /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} maxLength={60} className="mt-1" /></div>
              <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))} maxLength={20} className="mt-1" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={40} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Order alerts sent by email and SMS to this number.</p></div>
              <div><Label>Opening hours</Label><Input value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="Mon–Sat 9am–8pm" maxLength={80} className="mt-1" /></div>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Products</p>
              <Button size="sm" variant="outline" onClick={() => setProducts((p) => [...p, { name: "", price: "", unit: "" }])}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
            </div>
            {loadingProducts ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="space-y-2">
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder="Product name" value={p.name} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} maxLength={80} />
                    <Input className="col-span-3 font-mono" placeholder="£0.00" value={p.price} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} />
                    <Input className="col-span-3" placeholder="unit" value={p.unit} onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))} maxLength={20} />
                    <button onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  const [tab, setTab] = useState<"stores" | "orders" | "messages">("stores");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<StoreRow | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: storesData, error } = await supabase.from("stores").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) { toast.error(error.message); setBusy(false); return; }
      const rows = (storesData as StoreRow[]) ?? [];
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
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    })();
  }, [user]);

  const togglePublish = async (s: StoreRow) => {
    const { error } = await supabase.from("stores").update({ published: !s.published }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, published: !s.published } : x)));
    toast.success(s.published ? "Store hidden" : "Store published");
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
  const unreadMessages = messages.filter((m) => m.direction === "inbound").length;
  const storesWithoutPhone = stores.filter((s) => !s.phone);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
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

        <div className="mt-8 flex gap-1 rounded-xl bg-secondary p-1 w-fit">
          <button
            onClick={() => setTab("stores")}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "stores" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Stores
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "orders" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
              className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === "messages" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Messages
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </button>
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
                      <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
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
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => togglePublish(s)}>
                        {s.published ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Publish</>}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setEditingStore(s)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/">View</Link>
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

      </main>

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
                    const waLink = `https://wa.me/${conv.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${conv.customerName}, thanks for messaging ${storeName} on Lokal! 👋`)}`;
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
                              <a href={waLink} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700">
                                Reply on WhatsApp
                              </a>
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
      <Toaster position="bottom-center" />
    </div>
  );
}
