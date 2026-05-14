import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/lokal/Navbar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rate")({
  component: RatePage,
  validateSearch: z.object({ token: z.string().optional() }).parse,
  head: () => ({ meta: [{ title: "Leave a rating · Lokal" }] }),
});

type BookingInfo = {
  id: string;
  customer_name: string;
  staff_id: string | null;
  staff_name: string | null;
  store_id: string;
  store_name: string;
  rating_completed: boolean;
};

function RatePage() {
  const { token } = Route.useSearch();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewerName, setReviewerName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    (supabase as any)
      .from("store_bookings")
      .select("id, customer_name, staff_id, staff_name, store_id, rating_completed, stores(name)")
      .eq("rating_token", token)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        setLoading(false);
        if (error || !data) {
          setNotFound(true);
          return;
        }
        setBooking({
          id: data.id,
          customer_name: data.customer_name,
          staff_id: data.staff_id,
          staff_name: data.staff_name,
          store_id: data.store_id,
          store_name: data.stores?.name ?? "this store",
          rating_completed: data.rating_completed,
        });
        setReviewerName(data.customer_name ?? "");
        if (data.rating_completed) setDone(true);
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!booking || rating === 0 || !reviewerName.trim()) return;
    setSubmitting(true);
    try {
      if (booking.staff_id) {
        const { error } = await (supabase as any).from("staff_reviews").insert({
          store_id: booking.store_id,
          staff_id: booking.staff_id,
          staff_name: booking.staff_name,
          rating,
          reviewer_name: reviewerName.trim(),
          body: body.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("reviews").insert({
          store_id: booking.store_id,
          reviewer_name: reviewerName.trim(),
          rating,
          body: body.trim() || null,
        });
        if (error) throw error;
      }

      await (supabase as any)
        .from("store_bookings")
        .update({ rating_completed: true })
        .eq("id", booking.id);

      setDone(true);
      toast.success("Thanks for your rating!");
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

          {!loading && notFound && (
            <div className="text-center">
              <p className="text-lg font-semibold">Rating link not found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This link may have expired or already been used.
              </p>
            </div>
          )}

          {!loading && done && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <p className="text-xl font-semibold">Thanks for your rating!</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your feedback helps other customers on Lokal.
              </p>
            </div>
          )}

          {!loading && !notFound && !done && booking && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold">How was your visit?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {booking.staff_name
                    ? `Rate your experience with ${booking.staff_name} at ${booking.store_name}`
                    : `Rate your experience at ${booking.store_name}`}
                </p>
              </div>

              {/* Star picker */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="p-0.5"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        n <= (hover || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 self-center text-sm font-medium text-muted-foreground">
                    {labels[rating]}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Your name *</label>
                <Input
                  className="mt-1"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Comment (optional)
                </label>
                <Textarea
                  className="mt-1 resize-none"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Anything you'd like to share?"
                />
              </div>

              <Button
                className="w-full bg-gradient-primary text-primary-foreground"
                disabled={rating === 0 || !reviewerName.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Submit rating"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
