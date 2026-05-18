import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

import { StoreDialog } from "@/components/lokal/StoreDialog";
import { PostMedia } from "@/components/lokal/PostMedia";
import { PostReactions } from "@/components/lokal/PostReactions";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, normalizeImagePath } from "@/lib/utils";
import { type Store, LIVE_CATEGORIES } from "@/data/stores";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Heart } from "lucide-react";
import storePlaceholder from "@/assets/store-grocery.jpg";

const FOLLOWING_LAST_SEEN_PREFIX = "lokal:following:lastSeen:";
const FOLLOWING_SEEN_EVENT = "lokal:following:seen";

function markFollowingFeedSeen(userId: string, seenAt?: string): void {
  if (typeof window === "undefined") return;
  const timestamp = seenAt ?? new Date().toISOString();
  window.localStorage.setItem(`${FOLLOWING_LAST_SEEN_PREFIX}${userId}`, timestamp);
  window.dispatchEvent(
    new CustomEvent<{ userId: string; seenAt: string }>(FOLLOWING_SEEN_EVENT, {
      detail: { userId, seenAt: timestamp },
    }),
  );
}

type FollowRow = {
  store_id: string;
  created_at: string;
};

type PostRow = {
  id: string;
  store_id: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
};

export const Route = createFileRoute("/following")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth", search: { redirect: "/following" } });
  },
  component: FollowingPage,
  head: () => ({
    meta: [{ title: "Following · Lokal" }],
  }),
});

function FollowingPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Store | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: followRows } = await (supabase as any)
        .from("store_follows")
        .select("store_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const follows = (followRows ?? []) as FollowRow[];
      const ids = follows.map((f) => f.store_id);
      setFollowedStoreIds(ids);

      if (ids.length === 0) {
        setStores([]);
        setPosts([]);
        markFollowingFeedSeen(userId);
        setLoading(false);
        return;
      }

      const [{ data: storeRows }, { data: postRows }] = await Promise.all([
        supabase
          .from("stores")
          .select(
            "id,name,category,origin,description,address,city,postcode,hours,phone,image_url,instagram_handle,tiktok_handle,website_url,fulfillment,delivery_fee_gbp,location_type,accepts_refunds,refund_policy,cancellation_policy,bank_name,bank_account_name,bank_account_number,bank_sort_code,store_products(name,price,unit,position,image_url)",
          )
          .in("id", ids)
          .eq("published", true),
        (supabase as any)
          .from("store_posts")
          .select("id, store_id, body, image_url, video_url, created_at")
          .in("store_id", ids)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      const mappedStores: Store[] = (storeRows ?? []).flatMap((row: any) => {
        if (!LIVE_CATEGORIES.includes(row.category)) return [];
        return [
          {
            id: row.id,
            name: row.name,
            category: row.category as Store["category"],
            origin: row.origin || "🌍 Local",
            rating: 0,
            reviews: 0,
            distance: "—",
            city: row.city || undefined,
            postcode: row.postcode || undefined,
            address: [row.address, row.city].filter(Boolean).join(", ") || "Address on request",
            hours: row.hours || "Hours on request",
            phone: row.phone || "—",
            fulfillment:
              (row.fulfillment as "collection" | "delivery" | "both" | "pay_at_store") ||
              "collection",
            delivery_fee_gbp: row.delivery_fee_gbp != null ? Number(row.delivery_fee_gbp) : 0,
            location_type: (row.location_type as Store["location_type"]) ?? null,
            accepts_refunds: !!row.accepts_refunds,
            refund_policy: row.refund_policy || undefined,
            cancellation_policy: row.cancellation_policy || undefined,
            image: getImageUrl(row.image_url) || storePlaceholder,
            description: row.description || "A new Lokal merchant.",
            instagramHandle: row.instagram_handle || undefined,
            tiktokHandle: row.tiktok_handle || undefined,
            websiteUrl: row.website_url || undefined,
            bank: {
              name: row.bank_name || "—",
              accountName: row.bank_account_name || "—",
              accountNumber: row.bank_account_number || "—",
              sortCode: row.bank_sort_code || undefined,
            },
            products: (row.store_products ?? [])
              .sort((a: any, b: any) => a.position - b.position)
              .map((p: any) => ({
                name: p.name,
                price: Number(p.price),
                unit: p.unit ?? undefined,
                image_url: normalizeImagePath(p.image_url) ?? p.image_url ?? null,
              })),
          },
        ];
      });

      const byId = new Map(mappedStores.map((s) => [s.id, s]));
      const orderedStores = ids.map((id) => byId.get(id)).filter(Boolean) as Store[];

      setStores(orderedStores);
      setPosts((postRows ?? []) as PostRow[]);

      const latestPostCreatedAt =
        ((postRows ?? []) as PostRow[])
          .map((post) => post.created_at)
          .filter(Boolean)
          .sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;
      markFollowingFeedSeen(userId, latestPostCreatedAt ?? undefined);

      setLoading(false);
    })();
  }, []);

  const storesById = useMemo(() => {
    return new Map(stores.map((s) => [s.id, s]));
  }, [stores]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Your feed
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold">Following on Lokal</h1>
            <p className="mt-2 text-muted-foreground">
              See updates from stores you follow in one place.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            {followedStoreIds.length} followed store{followedStoreIds.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : followedStoreIds.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
            <Heart className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <h2 className="mt-3 font-display text-2xl font-bold">
              You are not following any stores yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Follow stores to get their latest updates here.
            </p>
            <Button
              className="mt-5 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
              asChild
            >
              <a href="/#stores">Browse stores</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Following
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                    onClick={() => {
                      setSelected(store);
                      setOpen(true);
                    }}
                  >
                    <img
                      src={store.image}
                      alt={store.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{store.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{store.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Latest updates
              </h2>
              {posts.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No updates yet from the stores you follow.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post) => {
                    const store = storesById.get(post.store_id);
                    const storeName = store?.name ?? "Store";
                    return (
                      <div
                        key={post.id}
                        className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/30"
                        onClick={() => {
                          if (!store) return;
                          setSelected(store);
                          setOpen(true);
                        }}
                      >
                        {post.video_url ? (
                          <PostMedia
                            url={post.video_url}
                            kind="video"
                            className="aspect-[5/3]"
                            mediaClassName="h-full w-full"
                          />
                        ) : post.image_url ? (
                          <PostMedia
                            url={post.image_url}
                            kind="image"
                            className="aspect-[5/3]"
                            mediaClassName="h-full w-full"
                            alt={post.body.slice(0, 120)}
                          />
                        ) : null}
                        <div className="p-4">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary">{storeName}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.created_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                          <p className="line-clamp-4 whitespace-pre-wrap text-sm">{post.body}</p>
                          <PostReactions postId={post.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <StoreDialog store={selected} open={open} onOpenChange={setOpen} />
      <Toaster position="bottom-center" />
    </div>
  );
}
