import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";
import { useLocation } from "@/hooks/use-location";

type HeroProps = {
  onSearch?: (query: string) => void;
};

export function Hero({ onSearch }: HeroProps) {
  const { city, loading } = useLocation();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    onSearch?.(query || city || "");
    document.getElementById("stores")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="container relative mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">

          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl">
            Find African &amp; Caribbean stores
            <span className="block bg-gradient-primary bg-clip-text text-transparent">near you.</span>
          </h1>

          <p className="mt-5 max-w-sm text-base text-muted-foreground">
            Groceries, beauty, barbers &amp; more — order direct, pay by bank transfer.
          </p>

          {/* Search — the main character */}
          <div className="mt-10 w-full rounded-2xl border border-border/60 bg-card p-2 shadow-card">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 px-3">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <Input
                  placeholder={loading ? "Detecting location…" : city ? `Stores near ${city}` : "Postcode or city"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="h-12 border-0 px-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
              <Button
                size="lg"
                className="h-12 shrink-0 gap-2 rounded-xl bg-gradient-primary px-6 text-base font-semibold text-primary-foreground shadow-warm hover:opacity-95"
                onClick={handleSearch}
              >
                <Search className="h-4 w-4" />
                Find stores
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Direct</strong> messaging</span>
            <span><strong className="text-foreground">Bank transfer</strong> — no card fees</span>
            <span><strong className="text-foreground">Free</strong> to list your store</span>
          </div>
        </div>
      </div>
    </section>
  );
}
