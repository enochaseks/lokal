import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, PackageSearch, CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/order")({
  component: OrderLookupPage,
  head: () => ({ meta: [{ title: "Track your order · Lokal" }] }),
});

type OrderResult = {
  id: string;
  reference: string;
  store_id: string;
  status: string;
  store_name: string;
  fulfillment_method?: "collection" | "delivery" | null;
  items_subtotal_gbp?: number | null;
  delivery_fee_gbp?: number | null;
  total_gbp: number;
  created_at: string;
  items: Array<{ name: string; qty: number; price: number; unit?: string }>;
};

const STATUS_STEPS = [
  {
    key: "pending_transfer",
    label: "Order placed",
    icon: Clock,
    description:
      "Your order has been received. Please send your bank transfer using the reference.",
  },
  {
    key: "transfer_received",
    label: "Transfer received",
    icon: CheckCircle2,
    description: "The merchant has confirmed your payment. Your order is being prepared.",
  },
  {
    key: "ready",
    label: "Ready",
    icon: Truck,
    description: "Your order is ready for pickup or delivery — the merchant will contact you.",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    description: "Order complete. Thank you for using Lokal!",
  },
];

// payment_received is a legacy alias for transfer_received
function normaliseStatus(s: string) {
  return s === "payment_received" ? "transfer_received" : s;
}

function StatusTimeline({ status }: { status: string }) {
  const norm = normaliseStatus(status);
  if (norm === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        <XCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Order cancelled</p>
          <p className="text-xs text-red-600 mt-0.5">
            This order was cancelled. Please contact the store if you have questions.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === norm);

  return (
    <div className="space-y-3">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div
            key={step.key}
            className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
              active
                ? "border-primary/30 bg-primary/5"
                : done
                  ? "border-green-200 bg-green-50/60"
                  : "border-border bg-card opacity-40"
            }`}
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p
                className={`font-semibold text-sm ${active ? "text-primary" : done ? "text-green-700" : "text-muted-foreground"}`}
              >
                {step.label}
              </p>
              {(active || done) && (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderLookupPage() {
  const [tab, setTab] = useState<"reference" | "phone">("reference");
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [phoneResults, setPhoneResults] = useState<OrderResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Load customer profile on mount
  useEffect(() => {
    const profile = localStorage.getItem("lokal_customer_profile");
    if (profile) {
      const parsed = JSON.parse(profile);
      setPhone(parsed.phone);
      setIsLoggedIn(true);
    }
  }, []);

  const canCancelOrder = (status: string) => status === "pending_transfer";

  const cancelOrder = async (orderId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to cancel orders");
      return;
    }

    setCancellingId(orderId);
    try {
      const order = result?.id === orderId ? result : phoneResults.find((o) => o.id === orderId);
      const { error } = await (supabase as any)
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending_transfer");
      if (error) throw error;

      setResult((prev) => (prev && prev.id === orderId ? { ...prev, status: "cancelled" } : prev));
      setPhoneResults((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)));

      if (order) {
        const profileRaw = localStorage.getItem("lokal_customer_profile");
        const profile = profileRaw ? JSON.parse(profileRaw) : null;
        void supabase.functions.invoke("send-order-cancelled", {
          body: {
            order_id: order.id,
            reference: order.reference,
            store_id: order.store_id,
            store_name: order.store_name,
            customer_name: profile?.name ?? "Customer",
            customer_phone: profile?.phone ?? null,
            customer_email: profile?.email ?? null,
            total_gbp: Number(order.total_gbp),
            fulfillment_method: order.fulfillment_method ?? "collection",
            delivery_fee_gbp: Number(order.delivery_fee_gbp ?? 0),
          },
        });
      }

      toast.success("Order cancelled");
    } catch (e: any) {
      toast.error(e.message ?? "Could not cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  const lookup = async () => {
    const cleaned = ref.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from("orders")
        .select("id, reference, store_id, status, fulfillment_method, items_subtotal_gbp, delivery_fee_gbp, total_gbp, created_at, items, stores(name)")
        .eq("reference", cleaned)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        setError("No order found with that reference. Check the reference and try again.");
        return;
      }
      setResult({
        id: data.id,
        reference: data.reference,
        store_id: data.store_id,
        status: data.status,
        store_name: data.stores?.name ?? "—",
        fulfillment_method: data.fulfillment_method ?? "collection",
        items_subtotal_gbp: data.items_subtotal_gbp != null ? Number(data.items_subtotal_gbp) : null,
        delivery_fee_gbp: data.delivery_fee_gbp != null ? Number(data.delivery_fee_gbp) : null,
        total_gbp: data.total_gbp,
        created_at: data.created_at,
        items: data.items ?? [],
      });
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const lookupByPhone = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;
    setLoading(true);
    setError(null);
    setPhoneResults([]);
    try {
      const { data, error: err } = await (supabase as any)
        .from("orders")
        .select("id, reference, store_id, status, fulfillment_method, items_subtotal_gbp, delivery_fee_gbp, total_gbp, created_at, items, stores(name)")
        .ilike("customer_phone", `%${cleanPhone.replace(/\D/g, "").slice(-9)}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (err) throw err;
      if (!data || data.length === 0) {
        setError("No orders found for that phone number.");
        return;
      }
      setPhoneResults(
        data.map((d: any) => ({
          id: d.id,
          reference: d.reference,
          store_id: d.store_id,
          status: d.status,
          store_name: d.stores?.name ?? "—",
          fulfillment_method: d.fulfillment_method ?? "collection",
          items_subtotal_gbp: d.items_subtotal_gbp != null ? Number(d.items_subtotal_gbp) : null,
          delivery_fee_gbp: d.delivery_fee_gbp != null ? Number(d.delivery_fee_gbp) : null,
          total_gbp: d.total_gbp,
          created_at: d.created_at,
          items: d.items ?? [],
        })),
      );
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-lg px-4 py-20">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageSearch className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Track your order</h1>
          <p className="mt-2 text-muted-foreground">
            Look up by order reference or see all orders for your phone number.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex rounded-xl bg-secondary p-1 gap-1">
          <button
            onClick={() => {
              setTab("reference");
              setError(null);
              setResult(null);
              setPhoneResults([]);
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "reference" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            By reference
          </button>
          <button
            onClick={() => {
              setTab("phone");
              setError(null);
              setResult(null);
              setPhoneResults([]);
            }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "phone" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            My orders
          </button>
        </div>

        {isLoggedIn && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            👋{" "}
            <a href="/customer/dashboard" className="font-semibold text-primary hover:underline">
              Go to dashboard
            </a>{" "}
            to see all your orders and bookings
          </p>
        )}

        {tab === "reference" ? (
          <div className="mt-4 flex gap-2">
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="LKL-XXXXXX"
              className="font-mono text-base tracking-wider"
              maxLength={12}
            />
            <Button
              onClick={lookup}
              disabled={!ref.trim() || loading}
              className="shrink-0 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupByPhone()}
              placeholder="Your phone number"
              type="tel"
            />
            <Button
              onClick={lookupByPhone}
              disabled={!phone.trim() || loading}
              className="shrink-0 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-lg font-bold text-primary">{result.reference}</p>
                  <p className="text-sm text-muted-foreground">{result.store_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(result.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold">
                    £{Number(result.total_gbp).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.fulfillment_method === "delivery" ? "Delivery" : "Collection"}
                  </p>
                </div>
              </div>
              {(result.items_subtotal_gbp != null || result.delivery_fee_gbp != null) && (
                <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>£{Number(result.items_subtotal_gbp ?? result.total_gbp).toFixed(2)}</span>
                  </div>
                  {Number(result.delivery_fee_gbp ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Delivery fee</span>
                      <span>£{Number(result.delivery_fee_gbp).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.items.map((it, i) => (
                  <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {it.qty}× {it.name}
                    {it.unit ? ` (${it.unit})` : ""}
                  </span>
                ))}
              </div>
            </div>
            <StatusTimeline status={result.status} />
            {canCancelOrder(result.status) && (
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => cancelOrder(result.id)}
                disabled={cancellingId === result.id}
              >
                {cancellingId === result.id ? "Cancelling..." : "Cancel order"}
              </Button>
            )}
          </div>
        )}

        {phoneResults.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-semibold text-muted-foreground">
              {phoneResults.length} order{phoneResults.length !== 1 ? "s" : ""} found
            </p>
            {phoneResults.map((o) => (
              <div
                key={o.reference}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-primary">{o.reference}</p>
                    <p className="text-sm text-muted-foreground">{o.store_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="font-display text-xl font-bold shrink-0">
                    £{Number(o.total_gbp).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-md bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground inline-block">
                  {o.fulfillment_method === "delivery" ? "Delivery" : "Collection"}
                </div>
                {(o.items_subtotal_gbp != null || o.delivery_fee_gbp != null) && (
                  <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span>£{Number(o.items_subtotal_gbp ?? o.total_gbp).toFixed(2)}</span>
                    </div>
                    {Number(o.delivery_fee_gbp ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Delivery fee</span>
                        <span>£{Number(o.delivery_fee_gbp).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {o.items.map((it, i) => (
                    <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {it.qty}× {it.name}
                    </span>
                  ))}
                </div>
                <StatusTimeline status={o.status} />
                {canCancelOrder(o.status) && (
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => cancelOrder(o.id)}
                    disabled={cancellingId === o.id}
                  >
                    {cancellingId === o.id ? "Cancelling..." : "Cancel order"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
