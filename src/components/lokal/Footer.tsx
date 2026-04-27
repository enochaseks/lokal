export function Footer() {
  return (
    <footer id="merchants" className="border-t border-border/60 bg-card">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-warm">
              <span className="font-display text-lg font-bold text-primary-foreground">L</span>
            </div>
            <span className="font-display text-2xl font-bold">Lokal</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A home for African and Caribbean stores. Built so the corner shop, the auntie's kitchen and the seamstress on the high street can be found, loved, and paid — directly.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#stores" className="hover:text-foreground">Browse stores</a></li>
            <li><a href="#how" className="hover:text-foreground">How it works</a></li>
            <li><a href="#" className="hover:text-foreground">Cities</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">For merchants</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground">List your store</a></li>
            <li><a href="#" className="hover:text-foreground">Bank transfer setup</a></li>
            <li><a href="#" className="hover:text-foreground">Merchant guide</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Lokal · Made with warmth for the diaspora
      </div>
    </footer>
  );
}
