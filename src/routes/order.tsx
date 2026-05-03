import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, PackageSearch, CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/order")({
  component: OrderLookupPage,
  head: () => ({ meta: [{ title: "Track your order · Lokal" }] }),
});

type OrderResult = {
  reference: string;
  status: string;
  store_name: string;
  total_gbp: number;
  created_at: string;
  items: Array<{ name: string; qty: number; price: number; unit?: string }>;
};

const STATUS_STEPS = [
  { key: "pending_transfer", label: "Order placed", icon: Clock, description: "Your order has been received. Please send your bank transfer using the reference." },
  { key: "transfer_received", label: "Transfer received", icon: CheckCircle2, description: "The merchant has confirmed your payment. Your order is being prepared." },
  { key: "ready", label: "Ready", icon: Truck, description: "Your order is ready for pickup or delivery — the merchant will contact you." },
  { key: "completed", label: "Completed", icon: CheckCircle2, description: "Order complete. Thank you for using Lokal!" },
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
          <p className="text-xs text-red-600 mt-0.5">This order was cancelled. Please contact the store if you have questions.</p>
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
          <div key={step.key} className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
            active ? "border-primary/30 bg-primary/5" :
            done ? "border-green-200 bg-green-50/60" :
            "border-border bg-card opacity-40"
          }`}>
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              active ? "bg-primary text-primary-foreground" :
              done ? "bg-green-500 text-white" :
              "bg-secondary text-muted-foreground"
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className={`font-semibold text-sm ${active ? "text-primary" : done ? "text-green-700" : "text-muted-foreground"}`}>
                {step.label}
              </p>
              {(active || done) && <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderLookupPage() {
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const cleaned = ref.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from("orders")
        .select("reference, status, total_gbp, created_at, items, stores(name)")
        .eq("reference", cleaned)
        .maybeSingle();
      if (err) throw err;
      if (!data) { setError("No order found with that reference. Check the reference and try again."); return; }
      setResult({
        reference: data.reference,
        status: data.status,
        store_name: data.stores?.name ?? "—",
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-lg px-4 py-20">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageSearch className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Track your order</h1>
          <p className="mt-2 text-muted-foreground">Enter your order reference to see the latest status.</p>
        </div>

        <div className="mt-8 flex gap-2">
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="LKL-XXXXXX"
            className="font-mono text-base tracking-wider"
            maxLength={12}
          />
          <Button onClick={lookup} disabled={!ref.trim() || loading} className="shrink-0 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-lg font-bold text-primary">{result.reference}</p>
                  <p className="text-sm text-muted-foreground">{result.store_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(result.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold">£{Number(result.total_gbp).toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.items.map((it, i) => (
                  <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {it.qty}× {it.name}{it.unit ? ` (${it.unit})` : ""}
                  </span>
                ))}
              </div>
            </div>

            <StatusTimeline status={result.status} />
          </div>
        )}
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
