import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Store as StoreIcon, MapPin, Landmark, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/merchant")({
  component: MerchantPage,
  head: () => ({ meta: [{ title: "My store · Lokal" }] }),
});

type StoreRow = {
  id: string; name: string; category: string; origin: string | null;
  description: string | null; address: string | null; city: string | null;
  image_url: string | null; published: boolean;
  bank_name: string | null; bank_account_number: string | null;
};

function MerchantPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/merchant" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("stores").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setStores((data as StoreRow[]) ?? []);
        setBusy(false);
      });
  }, [user]);

  const togglePublish = async (s: StoreRow) => {
    const { error } = await supabase.from("stores").update({ published: !s.published }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, published: !s.published } : x)));
    toast.success(s.published ? "Store hidden" : "Store published");
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold">My stores</h1>
            <p className="mt-1 text-muted-foreground">Manage your listings on Lokal.</p>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95 gap-2" onClick={() => navigate({ to: "/list-store" })}>
            <Plus className="h-4 w-4" /> Add a store
          </Button>
        </div>

        {busy ? (
          <div className="mt-12 text-center text-muted-foreground">Loading your stores…</div>
        ) : stores.length === 0 ? (
          <div className="mt-12 rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
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
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <StoreIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${
                    s.published ? "bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
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
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <Link to="/">View on Lokal</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-xl border border-dashed border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground">Coming next:</strong> order inbox, shopper messages, and "mark payment received".
        </div>
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}
