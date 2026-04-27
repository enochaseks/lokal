import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-warm">
            <span className="font-display text-lg font-bold text-primary-foreground">L</span>
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">Lokal</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#stores" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Stores</a>
          <a href="#how" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How it works</a>
          <a href="#merchants" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">For merchants</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
            <MapPin className="h-4 w-4" />
            London
          </Button>
          <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95">
            List your store
          </Button>
        </div>
      </div>
    </header>
  );
}
