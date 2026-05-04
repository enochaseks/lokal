import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLocation } from "@/hooks/use-location";
import { Navbar } from "@/components/lokal/Navbar";
import { Hero } from "@/components/lokal/Hero";
import { HowItWorks } from "@/components/lokal/HowItWorks";
import { Footer } from "@/components/lokal/Footer";
import { StoreCard } from "@/components/lokal/StoreCard";
import { StoreDialog } from "@/components/lokal/StoreDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LIVE_CATEGORIES, categories, type Store } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import storePlaceholder from "@/assets/store-grocery.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lokal — African & Caribbean stores near you" },
      { name: "description", content: "Discover African and Caribbean grocers, beauty stores and barbers nearby. Reserve with the merchant, pay by bank transfer." },
      { property: "og:title", content: "Lokal — African & Caribbean stores near you" },
      { property: "og:description", content: "A marketplace for the diaspora. Find local stores and pay merchants directly by bank transfer." },
    ],
  }),
});

function Index() {
  const [active, setActive] = useState<(typeof categories)[number]["name"]>("All");
  const [selected, setSelected] = useState<Store | null>(null);
  const [open, setOpen] = useState(false);
  const [liveStores, setLiveStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [search, setSearch] = useState("");
  const { city } = useLocation();

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("stores")
        .select("id,name,category,origin,description,address,city,hours,phone,image_url,fulfillment,bank_name,bank_account_name,bank_account_number,bank_sort_code,store_products(name,price,unit,position)")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (!rows) return;
      const mapped: Store[] = rows.flatMap((r: any) => {
        if (!LIVE_CATEGORIES.includes(r.category)) return [];
        return [{
        id: r.id,
        name: r.name,
        category: r.category as Store["category"],
        origin: r.origin || "🌍 Local",
        rating: 0,
        reviews: 0,
        distance: "—",
        city: r.city || undefined,
        address: [r.address, r.city].filter(Boolean).join(", ") || "Address on request",
        hours: r.hours || "Hours on request",
        phone: r.phone || "—",
        fulfillment: (r.fulfillment as "collection" | "delivery" | "both") || "collection",
        image: getImageUrl(r.image_url) || storePlaceholder,
        description: r.description || "A new Lokal merchant.",
        bank: {
          name: r.bank_name || "—",
          accountName: r.bank_account_name || "—",
          accountNumber: r.bank_account_number || "—",
          sortCode: r.bank_sort_code || undefined,
        },
        products: (r.store_products ?? [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((p: any) => ({ name: p.name, price: Number(p.price), unit: p.unit ?? undefined })),
      }];
      });
      setLiveStores(mapped);

      // Fetch real review aggregates and merge in
      if (mapped.length > 0) {
        const ids = mapped.map((m) => m.id);
        const { data: revRows } = await (supabase as any)
          .from("reviews")
          .select("store_id, rating")
          .in("store_id", ids);
        if (revRows) {
          const agg: Record<string, { sum: number; count: number }> = {};
          for (const r of revRows) {
            if (!agg[r.store_id]) agg[r.store_id] = { sum: 0, count: 0 };
            agg[r.store_id].sum += r.rating;
            agg[r.store_id].count += 1;
          }
          setLiveStores(mapped.map((s) => {
            const a = agg[s.id];
            return a ? { ...s, rating: Math.round((a.sum / a.count) * 10) / 10, reviews: a.count } : s;
          }));
        }
      }

      setLoadingStores(false);
    })();
  }, []);

  const filtered = liveStores
    .filter((s) => active === "All" || s.category === active)
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero onSearch={setSearch} />

        <section id="stores" className="container mx-auto px-4 py-20">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">{city ? `Near you · ${city}` : "Near you"}</span>
              <h2 className="mt-2 font-display text-4xl font-bold md:text-5xl text-balance">
                Browse available stores near you.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setActive(c.name)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    active === c.name
                      ? "border-transparent bg-gradient-primary text-primary-foreground shadow-warm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span className="mr-1.5">{c.emoji}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loadingStores
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                    <Skeleton className="aspect-[5/3] w-full" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))
              : filtered.length === 0
              ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-4xl mb-4">🏪</div>
                    <h3 className="font-display text-xl font-semibold">
                      {search
                        ? `No stores found for "${search}"`
                        : `No ${active === "All" ? "" : active.toLowerCase() + " "}stores available yet`}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      {search
                        ? "Try a different search term or browse all stores."
                        : "We're growing — check back soon, or be the first to list your store."}
                    </p>
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="mt-4 text-sm text-primary hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )
              : filtered.map((s) => (
                  <StoreCard key={s.id} store={s} onClick={() => { setSelected(s); setOpen(true); }} />
                ))}
          </div>
        </section>

        <HowItWorks />
      </main>
      <Footer />

      <StoreDialog store={selected} open={open} onOpenChange={setOpen} />
      <Toaster position="bottom-center" />
    </div>
  );
}
