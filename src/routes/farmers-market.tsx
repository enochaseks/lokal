import { createFileRoute } from "@tanstack/react-router";
import { Lock, Sprout, Globe2 } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";

export const Route = createFileRoute("/farmers-market")({
  component: FarmersMarketPage,
  head: () => ({ meta: [{ title: "Farmers Market · Coming soon · Lokal" }] }),
});

function FarmersMarketPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-card md:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" />
            Farmers Market is locked for now
          </div>

          <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-5xl">
            Farmers Market
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            A global marketplace for African and Caribbean farmers, producers, and manufacturers.
            Customers will be able to browse by country, request made-to-order products, and buy
            with seller-managed shipping lanes.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                <Globe2 className="h-4 w-4" />
              </div>
              <p className="font-semibold">Cross-country discovery</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse manufacturers and farmers across Africa and the Caribbean.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                <Sprout className="h-4 w-4" />
              </div>
              <p className="font-semibold">Made-to-order and products</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sellers can offer ready products or custom manufacturing/farming requests.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background">
                <Lock className="h-4 w-4" />
              </div>
              <p className="font-semibold">Seller-managed shipping</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Each seller configures carriers, delivery countries, and rates.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
