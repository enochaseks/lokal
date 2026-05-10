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
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
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

  const timeToMinutes = (time: string) => {
    const [h, m] = time.slice(0, 5).split(":").map(Number);
    return (h * 60) + m;
  };

  const DAY_TO_INDEX: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const WEEKDAY_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const parseClockTime = (raw: string): string | null => {
    const cleaned = raw.trim().toLowerCase().replace(/\./g, "");
    const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (!match) return null;
    const hour12 = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    const period = match[3];
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
    const hour24 = (hour12 % 12) + (period === "pm" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const parseHoursText = (hours: string | null | undefined): Array<{ day_of_week: number; start_time: string; end_time: string }> => {
    if (!hours) return [];
    const normalized = hours.toLowerCase().trim();
    if (!normalized || normalized.includes("request")) return [];

    const timeTokens = normalized.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/g) ?? [];
    if (timeTokens.length < 2) return [];
    const startTime = parseClockTime(timeTokens[0]);
    const endTime = parseClockTime(timeTokens[1]);
    if (!startTime || !endTime) return [];

    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const daySegmentRaw = hours.split("·")[0]?.trim() ?? hours.trim();
    const daySegment = daySegmentRaw.toLowerCase();
    if (daySegment.includes("daily") || daySegment.includes("every day") || daySegment.includes("everyday")) {
      return allDays.map((day) => ({ day_of_week: day, start_time: startTime, end_time: endTime }));
    }

    const segments = daySegment
      .replace(/[–—]/g, "-")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const resolvedDays = new Set<number>();
    for (const segment of segments) {
      if (segment.includes("-")) {
        const [fromRaw, toRaw] = segment.split("-").map((p) => p.trim().slice(0, 3));
        const from = DAY_TO_INDEX[fromRaw];
        const to = DAY_TO_INDEX[toRaw];
        if (from == null || to == null) continue;
        if (from <= to) {
          for (let day = from; day <= to; day += 1) resolvedDays.add(day);
        } else {
          for (let day = from; day <= 6; day += 1) resolvedDays.add(day);
          for (let day = 0; day <= to; day += 1) resolvedDays.add(day);
        }
      } else {
        const key = segment.slice(0, 3);
        const day = DAY_TO_INDEX[key];
        if (day != null) resolvedDays.add(day);
      }
    }

    const days = resolvedDays.size > 0 ? Array.from(resolvedDays) : allDays;
    return days.map((day) => ({ day_of_week: day, start_time: startTime, end_time: endTime }));
  };

  const isStoreOpenNow = (
    availability: Array<{ day_of_week: number; start_time: string; end_time: string }> | null | undefined,
    hoursText?: string | null,
    timezone?: string | null,
  ): boolean => {
    const windows = availability && availability.length > 0 ? availability : parseHoursText(hoursText);
    if (!windows || windows.length === 0) return false;
    const now = new Date();
    let today = now.getDay();
    let nowMins = (now.getHours() * 60) + now.getMinutes();
    if (timezone?.trim()) {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const weekday = parts.find((p) => p.type === "weekday")?.value;
        const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
        const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
        today = WEEKDAY_TO_INDEX[weekday ?? ""] ?? today;
        nowMins = (hour * 60) + minute;
      } catch {
        // Fall back to viewer local time if timezone is invalid.
      }
    }
    const prevDay = (today + 6) % 7;

    for (const row of windows) {
      const start = timeToMinutes(row.start_time);
      const end = timeToMinutes(row.end_time);
      if (start === end) {
        if (row.day_of_week === today) return true;
        continue;
      }
      const overnight = end < start;
      if (!overnight && row.day_of_week === today && nowMins >= start && nowMins < end) {
        return true;
      }
      if (overnight) {
        if (row.day_of_week === today && nowMins >= start) return true;
        if (row.day_of_week === prevDay && nowMins < end) return true;
      }
    }
    return false;
  };

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
        .select("id,name,category,subcategory,health_safety_certificate_status,origin,description,address,city,postcode,timezone,hours,phone,image_url,instagram_handle,tiktok_handle,website_url,fulfillment,location_type,selling_mode,region,bank_name,bank_account_name,bank_account_number,bank_sort_code,deposit_amount,accepts_refunds,refund_policy,cancellation_policy,is_verified,verified_at,verification_reason,store_products(name,price,unit,position,image_url),store_availability(day_of_week,start_time,end_time)")
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
        subcategory: r.subcategory ?? null,
        health_safety_certificate_status: r.health_safety_certificate_status ?? null,
        is_open_now: isStoreOpenNow(r.store_availability ?? [], r.hours, r.timezone),
        origin: r.origin || "🌍 Local",
        rating: 0,
        reviews: 0,
        distance: "—",
        city: r.city || undefined,
        postcode: r.postcode || undefined,
        timezone: r.timezone || undefined,
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
    .filter((s) => !activeSubcategory || s.subcategory === activeSubcategory)
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
        s.subcategory?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    });

  const availableSubcategories = active === "All"
    ? []
    : Array.from(new Set(liveStores.filter((s) => s.category === active && !!s.subcategory).map((s) => s.subcategory as string)));

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
                  onClick={() => {
                    setActive(c.name);
                    setActiveSubcategory(null);
                  }}
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

          {availableSubcategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  !activeSubcategory
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                All {active}
              </button>
              {availableSubcategories.map((subcategory) => (
                <button
                  key={subcategory}
                  onClick={() => setActiveSubcategory(subcategory)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    activeSubcategory === subcategory
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {subcategory}
                </button>
              ))}
            </div>
          )}

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
