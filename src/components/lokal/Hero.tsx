import heroImg from "@/assets/hero-market.jpg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="container relative mx-auto grid gap-12 px-4 py-16 md:grid-cols-2 md:py-24 lg:py-32">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            African & Caribbean marketplace
          </span>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
            Taste of home,
            <span className="block bg-gradient-primary bg-clip-text text-transparent">just around the corner.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-muted-foreground text-balance">
            Discover African and Caribbean stores near you — groceries, kitchens, beauty and fashion. Reserve with the merchant, pay by simple bank transfer.
          </p>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-card sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 px-2">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <Input
                placeholder="Enter your postcode or city"
                className="h-11 border-0 px-0 text-base shadow-none focus-visible:ring-0"
                defaultValue="E8 2NP, London"
              />
            </div>
            <Button size="lg" className="h-12 gap-2 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95">
              <Search className="h-4 w-4" />
              Find stores
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div><strong className="text-foreground">240+</strong> verified merchants</div>
            <div><strong className="text-foreground">12</strong> cities</div>
            <div><strong className="text-foreground">4.9★</strong> average rating</div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-primary opacity-30 blur-3xl" aria-hidden />
          <img
            src={heroImg}
            alt="Vibrant African and Caribbean market with fresh produce and woven baskets"
            width={1536}
            height={1024}
            className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-warm md:aspect-[5/6]"
          />
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card md:block">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">🌶️</div>
              <div>
                <div className="text-xs text-muted-foreground">Today's pick</div>
                <div className="text-sm font-semibold">Scotch bonnet · £3 / 250g</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
