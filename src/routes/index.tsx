import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLocation } from "@/hooks/use-location";
import { Navbar } from "@/components/lokal/Navbar";
import { Hero } from "@/components/lokal/Hero";
import { HowItWorks } from "@/components/lokal/HowItWorks";
import { Footer } from "@/components/lokal/Footer";
import { WhyLokal } from "@/components/lokal/WhyLokal";
import { MerchantCTA } from "@/components/lokal/MerchantCTA";
import { BadgeCheck } from "lucide-react";
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
  const { city, loading: locationLoading } = useLocation();
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [cityManuallySet, setCityManuallySet] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);
  const [cityInputValue, setCityInputValue] = useState("");
  const [showMoreSections, setShowMoreSections] = useState(false);

  // Following feed
  type PostRow = { id: string; store_id: string; body: string; image_url: string | null; created_at: string };
  const [followedPosts, setFollowedPosts] = useState<PostRow[]>([]);
  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [showFeed, setShowFeed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;
      const { data: follows } = await (supabase as any).from("store_follows").select("store_id").eq("user_id", uid);
      const ids: string[] = (follows ?? []).map((f: any) => f.store_id);
      setFollowedStoreIds(ids);
      if (ids.length === 0) return;
      setLoadingFeed(true);
      const { data: posts } = await (supabase as any)
        .from("store_posts")
        .select("id, store_id, body, image_url, created_at")
        .in("store_id", ids)
        .order("created_at", { ascending: false })
        .limit(60);
      setFollowedPosts((posts ?? []) as PostRow[]);
      setLoadingFeed(false);
      if ((posts ?? []).length > 0 || ids.length > 0) setShowFeed(true);
    })();
  }, []);

  useEffect(() => {
    if (city && !cityManuallySet) {
      setLocationFilter(city);
      setCityInputValue(city);
    }
  }, [city, cityManuallySet]);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("stores")
        .select("id,name,category,origin,description,address,city,postcode,hours,phone,image_url,instagram_handle,tiktok_handle,website_url,fulfillment,location_type,selling_mode,region,bank_name,bank_account_name,bank_account_number,bank_sort_code,deposit_amount,accepts_refunds,refund_policy,cancellation_policy,is_verified,verified_at,verification_reason,store_products(name,price,unit,position,image_url)")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (!rows) return;
      const { data: verifications } = await (supabase as any)
        .from("store_verification_requests")
        .select("store_id, verification_method, status")
        .eq("status", "approved")
        .in("store_id", rows.map((row: any) => row.id));

      const tierByStore: Record<string, "verified" | "online_verified" | "unsecured_verified"> = {};
      for (const item of (verifications ?? []) as Array<{ store_id: string; verification_method: string }>) {
        if (tierByStore[item.store_id]) continue;
        tierByStore[item.store_id] =
          item.verification_method === "registration_number"
            ? "verified"
            : item.verification_method === "online_presence"
              ? "online_verified"
              : "unsecured_verified";
      }

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
        postcode: r.postcode || undefined,
        address: [r.address, r.city].filter(Boolean).join(", ") || "Address on request",
        hours: r.hours || "Hours on request",
        phone: r.phone || "—",
        fulfillment: (r.fulfillment as "collection" | "delivery" | "both" | "pay_at_store") || "collection",
        location_type: (r.location_type as Store["location_type"]) ?? null,
        accepts_refunds: !!r.accepts_refunds,
        refund_policy: r.refund_policy || undefined,
        cancellation_policy: r.cancellation_policy || undefined,
        selling_mode: r.selling_mode ?? null,
        image: getImageUrl(r.image_url) || storePlaceholder,
        description: r.description || "A new Lokal merchant.",
        instagramHandle: r.instagram_handle || undefined,
        tiktokHandle: r.tiktok_handle || undefined,
        websiteUrl: r.website_url || undefined,
        region: r.region || undefined,
        bank: {
          name: r.bank_name || "—",
          accountName: r.bank_account_name || "—",
          accountNumber: r.bank_account_number || "—",
          sortCode: r.bank_sort_code || undefined,
        },
        products: (r.store_products ?? [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((p: any) => ({ name: p.name, price: Number(p.price), unit: p.unit ?? undefined, image_url: p.image_url ?? null })),
        deposit_amount: r.deposit_amount ?? undefined,
        is_verified: Boolean(r.is_verified),
        verified_at: r.verified_at ?? null,
        verification_reason: r.verification_reason ?? null,
        verification_tier: tierByStore[r.id] ?? null,
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
      if (!locationFilter) return true;
      if (!s.city) return true; // stores without a city set are shown everywhere
      const lf = locationFilter.toLowerCase();
      const sc = s.city.toLowerCase();
      return sc.includes(lf) || lf.includes(sc);
    })
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {locationFilter ? `Near you · ${locationFilter}` : locationLoading ? "Detecting location…" : "All locations"}
                </span>
                <button
                  onClick={() => setShowCityInput((v) => !v)}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  {showCityInput ? "Cancel" : "Change city"}
                </button>
              </div>
              {showCityInput && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = cityInputValue.trim();
                    setLocationFilter(val || null);
                    setCityManuallySet(true);
                    setShowCityInput(false);
                  }}
                >
                  <input
                    autoFocus
                    value={cityInputValue}
                    onChange={(e) => setCityInputValue(e.target.value)}
                    placeholder="e.g. Birmingham"
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                    Search
                  </button>
                </form>
              )}
              <h2 className="mt-2 font-display text-4xl font-bold md:text-5xl text-balance">
                Browse available stores{locationFilter ? ` in ${locationFilter}` : " near you"}.
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
                        : `No ${active === "All" ? "" : active.toLowerCase() + " "}stores${locationFilter ? ` in ${locationFilter}` : ""} yet`}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      {search
                        ? "Try a different search term or change the category filter."
                        : locationFilter
                        ? "No stores in this area yet — try searching a nearby city using \"Change city\"."
                        : "We're growing — check back soon, or be the first to list your store."}
                    </p>
                    {search && (
                      <div className="mt-4">
                        <button onClick={() => setSearch("")} className="text-sm text-primary hover:underline">
                          Clear search
                        </button>
                      </div>
                    )}
                  </div>
                )
              : filtered.map((s) => (
                  <StoreCard key={s.id} store={s} onClick={() => { setSelected(s); setOpen(true); }} />
                ))}
          </div>
        </section>

        {/* Trust & Verification section */}
        <section className="container mx-auto px-4 py-10">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
            <span>All stores are reviewed and verified by our admin team before going live.</span>
          </div>
        </section>

        <MerchantCTA />

        <section className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-3xl text-center">
            <button
              onClick={() => setShowMoreSections((v) => !v)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {showMoreSections ? "Hide extra sections" : "Show more about Lokal"}
            </button>
          </div>
        </section>

        {showMoreSections && (
          <>
            {/* Following feed — only visible when the user follows ≥1 store */}
            {showFeed && (
              <section className="container mx-auto px-4 py-12">
                <div className="mb-6 flex items-center gap-3">
                  <span className="text-2xl">❤️</span>
                  <div>
                    <h2 className="font-display text-2xl font-bold">Followed on Lokal</h2>
                    <p className="text-sm text-muted-foreground">Latest updates from stores you follow</p>
                  </div>
                </div>

                {loadingFeed ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-4">
                        <div className="h-4 w-1/4 rounded bg-secondary animate-pulse mb-2" />
                        <div className="h-16 w-full rounded bg-secondary animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : followedPosts.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
                    <p className="text-sm text-muted-foreground">The stores you follow haven't posted any updates yet. Check back soon.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {followedPosts.map((post) => {
                      const storeName = liveStores.find((s) => s.id === post.store_id)?.name ?? "Store";
                      const storeObj = liveStores.find((s) => s.id === post.store_id);
                      return (
                        <div
                          key={post.id}
                          className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:border-primary/30 transition-colors"
                          onClick={() => { if (storeObj) { setSelected(storeObj); setOpen(true); } }}
                        >
                          {post.image_url && (
                            <div className="aspect-[5/3] overflow-hidden bg-secondary">
                              <img src={getImageUrl(post.image_url) || ""} alt="" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary">{storeName}</span>
                              <span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                            </div>
                            <p className="text-sm line-clamp-4 whitespace-pre-wrap">{post.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <WhyLokal />
            <HowItWorks />
          </>
        )}
      </main>
      <Footer />

      <StoreDialog store={selected} open={open} onOpenChange={setOpen} />
      <Toaster position="bottom-center" />
    </div>
  );
}
