import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Calendar, ShoppingBag, Settings, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/customer/dashboard")({
  component: CustomerDashboardPage,
  head: () => ({ meta: [{ title: "My dashboard · Lokal" }] }),
});

type BookingWithStore = {
  id: string;
  store_id: string;
  store_name: string;
  store_category: string | null;
  service: string | null;
  slot_start: string;
  status: string;
  staff_name: string | null;
};

type OrderWithStore = {
  reference: string;
  store_id: string;
  store_name: string;
  store_category: string | null;
  total_gbp: string;
  status: string;
  created_at: string;
  items: Array<{ qty: number; name: string; unit?: string }>;
};

type MostVisitedStore = {
  id: string;
  name: string;
  category: string | null;
  visits: number;
};

function CustomerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<BookingWithStore[]>([]);
  const [orders, setOrders] = useState<OrderWithStore[]>([]);
  const [mostVisitedStores, setMostVisitedStores] = useState<MostVisitedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStore, setHasStore] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const storedProfile = localStorage.getItem("lokal_customer_profile");
      if (!storedProfile) {
        navigate({ to: "/customer/profile" });
        return;
      }

      const profile = JSON.parse(storedProfile);
      setProfile(profile);
      const customerId = profile?.id as string | undefined;
      const customerPhone = (profile?.phone as string | undefined)?.trim();

      // Check if user has a store (if logged in)
      if (user?.id) {
        const { data: userStore } = await (supabase as any)
          .from("stores")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        setHasStore(!!userStore);
      }

      try {
        // Load bookings by both customer_id and phone, then merge.
        const [bookingsByIdRes, bookingsByPhoneRes] = await Promise.all([
          customerId
            ? (supabase as any)
                .from("store_bookings")
                .select(
                  "id, store_id, service, slot_start, status, staff_name, stores(name,category)",
                )
                .eq("customer_id", customerId)
                .order("slot_start", { ascending: true })
                .limit(40)
            : Promise.resolve({ data: [], error: null }),
          customerPhone
            ? (supabase as any)
                .from("store_bookings")
                .select(
                  "id, store_id, service, slot_start, status, staff_name, stores(name,category)",
                )
                .eq("customer_phone", customerPhone)
                .order("slot_start", { ascending: true })
                .limit(40)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const bookingsErr = bookingsByIdRes.error ?? bookingsByPhoneRes.error;
        if (bookingsErr) throw bookingsErr;

        const bookingsMap = new Map<string, any>();
        [...(bookingsByIdRes.data ?? []), ...(bookingsByPhoneRes.data ?? [])].forEach((b: any) => {
          if (b?.id) bookingsMap.set(b.id, b);
        });
        const bookingsData = Array.from(bookingsMap.values())
          .sort((a: any, b: any) => String(a.slot_start).localeCompare(String(b.slot_start)))
          .slice(0, 20);

        setBookings(
          bookingsData?.map((b: any) => ({
            id: b.id,
            store_id: b.store_id,
            store_name: b.stores?.name ?? "—",
            store_category: b.stores?.category ?? null,
            service: b.service,
            slot_start: b.slot_start,
            status: b.status,
            staff_name: b.staff_name,
          })) ?? [],
        );

        // Load orders by both customer_id and phone, then merge.
        const [ordersByIdRes, ordersByPhoneRes] = await Promise.all([
          customerId
            ? (supabase as any)
                .from("orders")
                .select(
                  "reference, store_id, total_gbp, status, created_at, items, stores(name,category)",
                )
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })
                .limit(40)
            : Promise.resolve({ data: [], error: null }),
          customerPhone
            ? (supabase as any)
                .from("orders")
                .select(
                  "reference, store_id, total_gbp, status, created_at, items, stores(name,category)",
                )
                .eq("customer_phone", customerPhone)
                .order("created_at", { ascending: false })
                .limit(40)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const ordersErr = ordersByIdRes.error ?? ordersByPhoneRes.error;
        if (ordersErr) throw ordersErr;

        const ordersMap = new Map<string, any>();
        [...(ordersByIdRes.data ?? []), ...(ordersByPhoneRes.data ?? [])].forEach((o: any) => {
          if (o?.reference) ordersMap.set(o.reference, o);
        });
        const ordersData = Array.from(ordersMap.values())
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, 20);

        setOrders(
          ordersData?.map((o: any) => ({
            reference: o.reference,
            store_id: o.store_id,
            store_name: o.stores?.name ?? "—",
            store_category: o.stores?.category ?? null,
            total_gbp: o.total_gbp,
            status: o.status,
            created_at: o.created_at,
            items: o.items ?? [],
          })) ?? [],
        );

        const counts = new Map<string, MostVisitedStore>();
        (bookingsData ?? []).forEach((b: any) => {
          const id = b.store_id as string | null;
          const name = b.stores?.name as string | undefined;
          if (!id || !name) return;
          const prev = counts.get(id);
          if (prev) {
            prev.visits += 1;
          } else {
            counts.set(id, { id, name, category: b.stores?.category ?? null, visits: 1 });
          }
        });
        (ordersData ?? []).forEach((o: any) => {
          const id = o.store_id as string | null;
          const name = o.stores?.name as string | undefined;
          if (!id || !name) return;
          const prev = counts.get(id);
          if (prev) {
            prev.visits += 1;
          } else {
            counts.set(id, { id, name, category: o.stores?.category ?? null, visits: 1 });
          }
        });
        setMostVisitedStores(
          Array.from(counts.values())
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 3),
        );
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, user?.id]);

  const logout = () => {
    localStorage.removeItem("lokal_customer_id");
    localStorage.removeItem("lokal_customer_profile");
    navigate({ to: "/" });
    toast.success("Logged out");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const upcomingBookings = bookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed",
  );
  const pastBookings = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");
  const activeOrders = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const pastOrders = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-800" },
    confirmed: { bg: "bg-green-100", text: "text-green-800" },
    completed: { bg: "bg-blue-100", text: "text-blue-800" },
    cancelled: { bg: "bg-red-100", text: "text-red-800" },
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Hello, {profile?.name || "there"}!</h1>
            <p className="mt-1 text-muted-foreground">Manage your bookings and orders</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/customer/profile" })}
              className="gap-2"
            >
              <Settings className="h-4 w-4" /> Profile
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              className="text-red-600 hover:bg-red-50 gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        {/* Most Visited Stores */}
        {mostVisitedStores.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Store className="h-5 w-5" /> Most visited stores
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mostVisitedStores.map((s) => (
                <button
                  key={`visited-${s.id}`}
                  onClick={() => navigate({ to: `/store/${s.id}` })}
                  className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 text-left hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category ?? "Store"}</p>
                  <p className="text-xs text-primary mt-2 font-medium">
                    {s.visits} visit{s.visits === 1 ? "" : "s"} →
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create a Store CTA */}
        {!hasStore && user && (
          <div className="mb-8 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Store className="h-5 w-5" /> Ready to become a merchant?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start selling or booking services on Lokal. List your store in just a few minutes.
                </p>
              </div>
              <Button
                onClick={() => navigate({ to: "/list-store" })}
                className="shrink-0 bg-gradient-primary hover:opacity-95"
              >
                Create store
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming Bookings */}
        <div className="mb-8">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Upcoming bookings ({upcomingBookings.length})
          </h2>
          {upcomingBookings.length > 0 ? (
            <div className="space-y-3">
              {upcomingBookings.map((b) => {
                const slotDate = new Date(b.slot_start);
                const badge = STATUS_BADGE[b.status] || STATUS_BADGE.pending;
                return (
                  <div key={b.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{b.store_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {slotDate.toLocaleDateString("en-GB", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          at{" "}
                          {slotDate.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {b.service && <p className="text-sm mt-1">{b.service}</p>}
                        {b.staff_name && (
                          <p className="text-xs text-muted-foreground">with {b.staff_name}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}
                      >
                        {b.status === "confirmed" ? "✓" : "⏳"} {b.status}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => navigate({ to: "/booking" })}
                    >
                      Manage booking
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-secondary bg-secondary/30 p-6 text-center">
              <p className="text-muted-foreground">
                No upcoming bookings. Browse stores and book now!
              </p>
              <Button
                className="mt-4 bg-gradient-primary hover:opacity-95"
                onClick={() => navigate({ to: "/" })}
              >
                Browse stores
              </Button>
            </div>
          )}
        </div>

        {/* Active Orders */}
        <div className="mb-8">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Active orders ({activeOrders.length})
          </h2>
          {activeOrders.length > 0 ? (
            <div className="space-y-3">
              {activeOrders.map((o) => (
                <div key={o.reference} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-mono font-semibold text-primary">{o.reference}</p>
                      <p className="text-sm text-muted-foreground">{o.store_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(o.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold">
                        £{Number(o.total_gbp).toFixed(2)}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[o.status]?.bg} ${STATUS_BADGE[o.status]?.text}`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {o.items.map((item, i) => (
                      <span key={i} className="rounded-md bg-secondary px-2 py-1 text-xs">
                        {item.qty}× {item.name}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => navigate({ to: "/order" })}
                  >
                    Track order
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-secondary bg-secondary/30 p-6 text-center">
              <p className="text-muted-foreground">No active orders. Start shopping!</p>
              <Button
                className="mt-4 bg-gradient-primary hover:opacity-95"
                onClick={() => navigate({ to: "/" })}
              >
                Browse stores
              </Button>
            </div>
          )}
        </div>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-bold mb-4">
              Past bookings ({pastBookings.length})
            </h2>
            <div className="space-y-2">
              {pastBookings.map((b) => {
                const slotDate = new Date(b.slot_start);
                const badge = STATUS_BADGE[b.status] || STATUS_BADGE.completed;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-secondary bg-secondary/30 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{b.store_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {slotDate.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                      >
                        {b.status}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: `/store/${b.store_id}` })}
                      >
                        Rebook
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past Orders */}
        {pastOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-bold mb-4">
              Past orders ({pastOrders.length})
            </h2>
            <div className="space-y-2">
              {pastOrders.map((o) => (
                <div
                  key={o.reference}
                  className="flex items-center justify-between rounded-lg border border-secondary bg-secondary/30 p-3"
                >
                  <div>
                    <p className="text-sm font-mono font-semibold text-primary">{o.reference}</p>
                    <p className="text-xs text-muted-foreground">{o.store_name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[o.status]?.bg} ${STATUS_BADGE[o.status]?.text}`}
                  >
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
