import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { Hero } from "@/components/lokal/Hero";
import { HowItWorks } from "@/components/lokal/HowItWorks";
import { Footer } from "@/components/lokal/Footer";
import { StoreCard } from "@/components/lokal/StoreCard";
import { StoreDialog } from "@/components/lokal/StoreDialog";
import { stores, categories, type Store } from "@/data/stores";
import { Toaster } from "@/components/ui/sonner";

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

  const filtered = active === "All" ? stores : stores.filter((s) => s.category === active);

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
