import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { Hero } from "@/components/lokal/Hero";
import { HowItWorks } from "@/components/lokal/HowItWorks";
import { Footer } from "@/components/lokal/Footer";
import { StoreCard } from "@/components/lokal/StoreCard";
import { StoreDialog } from "@/components/lokal/StoreDialog";
import { stores as seedStores, categories, type Store } from "@/data/stores";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import storePlaceholder from "@/assets/store-grocery.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lokal — African & Caribbean stores near you" },
      { name: "description", content: "Discover African and Caribbean grocers, kitchens, beauty and fashion stores nearby. Reserve with the merchant, pay by bank transfer." },
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

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("stores")
        .select("id,name,category,origin,description,address,city,hours,phone,image_url,bank_name,bank_account_name,bank_account_number,bank_sort_code,store_products(name,price,unit,position)")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (!rows) return;
      const mapped: Store[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        category: (["Groceries", "Restaurants", "Beauty", "Fashion"].includes(r.category) ? r.category : "Groceries") as Store["category"],
        origin: r.origin || "🌍 Local",
        rating: 5.0,
        reviews: 0,
        distance: "—",
        address: [r.address, r.city].filter(Boolean).join(", ") || "Address on request",
        hours: r.hours || "Hours on request",
        phone: r.phone || "—",
        image: r.image_url || storePlaceholder,
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
      }));
      setLiveStores(mapped);
    })();
  }, []);

  const allStores = [...liveStores, ...seedStores];
  const filtered = active === "All" ? allStores : allStores.filter((s) => s.category === active);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />

        <section id="stores" className="container mx-auto px-4 py-20">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Near you · London</span>
              <h2 className="mt-2 font-display text-4xl font-bold md:text-5xl text-balance">
                Stores from across the diaspora.
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
            {filtered.map((s) => (
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
