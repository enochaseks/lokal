import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarSearch, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/booking")({
  component: BookingLookupPage,
  head: () => ({ meta: [{ title: "My booking · Lokal" }] }),
});

type BookingResult = {
  id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service: string | null;
  staff_name: string | null;
  slot_start: string;
  slot_end: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: string }> = {
  pending: { label: "Pending confirmation", colour: "bg-amber-100 text-amber-800 border-amber-200", icon: "⏳" },
  confirmed: { label: "Confirmed", colour: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
  cancelled: { label: "Cancelled", colour: "bg-red-100 text-red-800 border-red-200", icon: "❌" },
  completed: { label: "Completed", colour: "bg-blue-100 text-blue-800 border-blue-200", icon: "🎉" },
};

function prettySlot(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return `${date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })} at ${timePart.slice(0, 5)}`;
}

function normaliseBookingReference(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^BK-/i.test(trimmed)) return trimmed.replace(/^BK-/i, "").trim().toLowerCase();
  return trimmed.toLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isShortHexRef(value: string): boolean {
  return /^[0-9a-f]{8}$/i.test(value);
}

function BookingLookupPage() {
  const [bookingId, setBookingId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
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

  const lookup = async () => {
    const cleanRef = normaliseBookingReference(bookingId);
    const cleanPhone = phone.trim().replace(/\s/g, "");
    if (!cleanRef || !cleanPhone) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let data: any = null;
      let err: any = null;

      if (isUuid(cleanRef)) {
        const res = await (supabase as any)
          .from("store_bookings")
          .select("id, store_id, customer_name, customer_phone, customer_email, service, staff_name, slot_start, slot_end, status, note, stores(name)")
          .eq("id", cleanRef)
          .maybeSingle();
        data = res.data;
        err = res.error;
      } else if (isShortHexRef(cleanRef)) {
        const phoneSuffix = cleanPhone.replace(/\D/g, "").slice(-9);
        const res = await (supabase as any)
          .from("store_bookings")
          .select("id, store_id, customer_name, customer_phone, customer_email, service, staff_name, slot_start, slot_end, status, note, stores(name)")
          .ilike("customer_phone", `%${phoneSuffix}%`)
          .order("created_at", { ascending: false })
          .limit(20);
        err = res.error;
        data = (res.data ?? []).find((b: any) => String(b.id).toLowerCase().startsWith(cleanRef)) ?? null;
      } else {
        setError("Invalid booking reference format. Use the full UUID or BK- reference from your email.");
        return;
      }

      if (err) throw err;
      if (!data) {
        setError("No booking found with those details. Check the ID and try again.");
        return;
      }

      // Verify phone matches (last 9 digits to be lenient with country codes)
      const storedDigits = data.customer_phone.replace(/\D/g, "").slice(-9);
      const inputDigits = cleanPhone.replace(/\D/g, "").slice(-9);
      if (storedDigits !== inputDigits) {
        setError("Phone number does not match this booking.");
        return;
      }

      setResult({
        id: data.id,
        store_id: data.store_id,
        store_name: data.stores?.name ?? "—",
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        service: data.service,
        staff_name: data.staff_name,
        slot_start: data.slot_start,
        slot_end: data.slot_end,
        status: data.status,
        note: data.note,
      });
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async () => {
    if (!result || result.status === "cancelled" || result.status === "completed") return;
    setCancelling(true);
    try {
      const { error: err } = await (supabase as any)
        .from("store_bookings")
        .update({ status: "cancelled" })
        .eq("id", result.id);

      if (err) throw err;

      // Fire cancellation email if customer has email
      if (result.customer_email) {
        void supabase.functions.invoke("send-booking-cancelled", {
          body: {
            booking_id: result.id,
            store_id: result.store_id,
            store_name: result.store_name,
            customer_name: result.customer_name,
            customer_email: result.customer_email,
            customer_phone: result.customer_phone,
            service: result.service,
            staff_name: result.staff_name,
            slot_start: result.slot_start,
            cancelled_by: "customer",
          },
        });
      }

      setResult((prev) => prev ? { ...prev, status: "cancelled" } : null);
      toast.success("Booking cancelled. We've sent a confirmation to your email if provided.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = result && result.status !== "cancelled" && result.status !== "completed";
  const statusCfg = result ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.pending) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-lg px-4 py-20">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarSearch className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">My booking</h1>
          <p className="mt-2 text-muted-foreground">Enter your booking ID (from your confirmation email) and phone number to view or cancel.</p>
        </div>

        <div className="mt-8 space-y-3">
          <Input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value.trim())}
            placeholder="Booking reference (e.g. BK-a1b2c3d4-... or full UUID)"
            className="font-mono text-sm"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Phone number used when booking"
            type="tel"
          />
          <Button
            onClick={lookup}
            disabled={!bookingId.trim() || !phone.trim() || loading}
            className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find booking"}
          </Button>
          {!isLoggedIn && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              💡 <a href="/customer/profile" className="font-semibold text-primary hover:underline">Create a profile</a> to save addresses and get order alerts
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {result && statusCfg && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-bold">{result.store_name}</p>
                  <p className="text-sm text-muted-foreground">{result.customer_name}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusCfg.colour}`}>
                  {statusCfg.icon} {statusCfg.label}
                </span>
              </div>

              <div className="rounded-lg bg-secondary px-4 py-3 text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">{prettySlot(result.slot_start)}</span>
                </div>
                {result.service && (
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">Service:</span> {result.service}
                  </div>
                )}
                {result.staff_name && (
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">Team member:</span> {result.staff_name}
                  </div>
                )}
                {result.note && (
                  <div className="text-muted-foreground italic">"{result.note}"</div>
                )}
              </div>

              {canCancel && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50 border-red-200"
                    onClick={cancelBooking}
                    disabled={cancelling}
                  >
                    {cancelling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</> : "Cancel this booking"}
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    This will notify the merchant and send a confirmation to your email if provided.
                  </p>
                </div>
              )}

              {result.status === "cancelled" && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <XCircle className="h-4 w-4 shrink-0" />
                  This booking has been cancelled.
                </div>
              )}

              {result.status === "completed" && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Appointment completed. Thank you for visiting!
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
