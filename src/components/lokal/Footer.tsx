import { Link } from "@tanstack/react-router";
import logoImage from "@/assets/logo.jpg";

export function Footer() {
  return (
    <footer id="merchants" className="border-t border-border/60 bg-card">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Lokal logo" className="h-9 w-9 rounded-xl object-cover shadow-warm" />
            <span className="font-display text-2xl font-bold">Lokal</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A home for African and Caribbean stores. Built so the corner shop, the auntie's kitchen and the seamstress on the high street can be found, loved, and paid — directly.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="/#stores" className="hover:text-foreground">Browse stores</a></li>
            <li><a href="/#how" className="hover:text-foreground">How it works</a></li>
            <li><Link to="/help" className="hover:text-foreground">Help Center</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">For merchants</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/list-store" className="hover:text-foreground">List your store</Link></li>
            <li><Link to="/merchant" className="hover:text-foreground">Merchant dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Lokal · Made with warmth for the diaspora
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
        <span className="mx-2">·</span>
        <Link to="/help" className="hover:text-foreground">Help Center</Link>
      </div>
    </footer>
  );
}
