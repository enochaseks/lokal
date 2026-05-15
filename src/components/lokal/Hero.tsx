import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { useLocation } from "@/hooks/use-location";
import { trackEvent } from "@/lib/analytics";

type HeroProps = {
  onSearch?: (query: string) => void;
};

const heroMessages = [
  {
    headingMain: "Own an African or Caribbean business?",
    headingAccent: "Start selling on Lokal.",
    subtext: "Get verified, add your first listings, and start taking direct orders in minutes.",
  },
  {
    headingMain: "Find African & Caribbean stores",
    headingAccent: "near you.",
    subtext: "Groceries, beauty, barbers & more — order direct, pay by bank transfer.",
  },
] as const;

export function Hero({ onSearch }: HeroProps) {
  const { city, loading } = useLocation();
  const [query, setQuery] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageVisible, setMessageVisible] = useState(true);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setMessageVisible(false);
      window.setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % heroMessages.length);
        setMessageVisible(true);
      }, 320);
    }, 4500);

    return () => {
      window.clearInterval(rotate);
    };
  }, []);

  const currentMessage = heroMessages[messageIndex];

  const handleSearch = () => {
    onSearch?.(query || city || "");
    document.getElementById("stores")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="container relative mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div
            className={`mx-auto w-full max-w-4xl transition-opacity duration-300 ${messageVisible ? "opacity-100" : "opacity-0"}`}
          >
            <h1 className="text-center font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance md:text-5xl lg:text-6xl">
              {currentMessage.headingMain}
              <span className="block bg-gradient-primary bg-clip-text text-transparent">
                {currentMessage.headingAccent}
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-sm text-center text-base text-muted-foreground">
              {currentMessage.subtext}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/list-store" search={() => ({ category: undefined })}>
              <Button
                size="lg"
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                onClick={() =>
                  trackEvent("merchant_cta_click", { placement: "hero", target: "list-store" })
                }
              >
                List your store <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          
          </div>

          {/* Keep buyer search available, but secondary to merchant onboarding CTA. */}
          <div className="mt-10 w-full rounded-2xl border border-border/60 bg-card p-2 shadow-card">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 px-3">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <Input
                  placeholder={
                    loading
                      ? "Detecting location…"
                      : city
                        ? `Stores near ${city}`
                        : "Postcode or city"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  className="h-12 border-0 px-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
              <Button
                size="lg"
                className="h-12 shrink-0 gap-2 rounded-xl bg-gradient-primary px-6 text-base font-semibold text-primary-foreground shadow-warm hover:opacity-95"
                onClick={() => {
                  trackEvent("buyer_search_click", { placement: "hero" });
                  handleSearch();
                }}
              >
                <Search className="h-4 w-4" />
                Find stores
              </Button>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Verified local merchants. Direct bank transfer checkout.
          </p>
        </div>
      </div>
    </section>
  );
}
