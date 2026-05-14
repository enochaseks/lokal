import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/lokal/Navbar";
import { getImageUrl } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rate")({
  component: RatePage,
  validateSearch: z.object({ token: z.string().optional() }).parse,
  head: () => ({ meta: [{ title: "Leave a rating · Lokal" }] }),
});

type RatingTarget = {
  id: string;
  source: "booking" | "order";
  customer_name: string;
  staff_id: string | null;
  staff_name: string | null;
  store_id: string;
  store_name: string;
  rating_completed: boolean;
  order_reference?: string | null;
};

function RatePage() {
  const { token } = Route.useSearch();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewerName, setReviewerName] = useState("");
  const [body, setBody] = useState("");
  const [proofImagePath, setProofImagePath] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    (async () => {
      const bookingResult = await (supabase as any)
        .from("store_bookings")
        .select("id, customer_name, staff_id, staff_name, store_id, rating_completed, stores(name)")
        .eq("rating_token", token)
        .maybeSingle();

      if (bookingResult.data && !bookingResult.error) {
        const data = bookingResult.data;
        setLoading(false);
        setRatingTarget({
          id: data.id,
          source: "booking",
          customer_name: data.customer_name,
          staff_id: data.staff_id,
          staff_name: data.staff_name,
          store_id: data.store_id,
          store_name: data.stores?.name ?? "this store",
          rating_completed: data.rating_completed,
        });
        setReviewerName(data.customer_name ?? "");
        if (data.rating_completed) setDone(true);
        return;
      }

      const orderResult = await (supabase as any)
        .from("orders")
        .select("id, reference, customer_name, store_id, rating_completed, stores(name)")
        .eq("rating_token", token)
        .maybeSingle();

      setLoading(false);
      if (orderResult.error || !orderResult.data) {
        setNotFound(true);
        return;
      }

      const data = orderResult.data;
      setRatingTarget({
        id: data.id,
        source: "order",
        customer_name: data.customer_name,
        staff_id: null,
        staff_name: null,
        store_id: data.store_id,
        store_name: data.stores?.name ?? "this store",
        rating_completed: data.rating_completed,
        order_reference: data.reference ?? null,
      });
      setReviewerName(data.customer_name ?? "");
      if (data.rating_completed) setDone(true);
    })();
  }, [token]);

  const handleProofUpload = async (file: File) => {
    if (!ratingTarget) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file only.");
      return;
    }

    setUploadingProof(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `reviews/${ratingTarget.store_id}/${ratingTarget.source}-${ratingTarget.id}-${Date.now()}.${safeExt}`;
      const { error } = await supabase.storage.from("store-images").upload(path, file, {
        upsert: false,
      });
      if (error) throw error;
      setProofImagePath(path);
      toast.success("Proof photo uploaded.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not upload proof image");
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmit = async () => {
    if (!ratingTarget || rating === 0 || !reviewerName.trim()) return;
    setSubmitting(true);
    try {
      if (ratingTarget.staff_id) {
        const { error } = await (supabase as any).from("staff_reviews").insert({
          store_id: ratingTarget.store_id,
          staff_id: ratingTarget.staff_id,
          staff_name: ratingTarget.staff_name,
          rating,
          reviewer_name: reviewerName.trim(),
          body: body.trim() || null,
          proof_image_url: proofImagePath,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("reviews").insert({
          store_id: ratingTarget.store_id,
          reviewer_name: reviewerName.trim(),
          rating,
          body: body.trim() || null,
          proof_image_url: proofImagePath,
        });
        if (error) throw error;
      }

      await (supabase as any)
        .from(ratingTarget.source === "booking" ? "store_bookings" : "orders")
        .update({ rating_completed: true })
        .eq("id", ratingTarget.id);

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

          {!loading && !notFound && !done && ratingTarget && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {ratingTarget.source === "order" ? "How was your order?" : "How was your visit?"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ratingTarget.source === "order"
                    ? `Rate your order from ${ratingTarget.store_name}${ratingTarget.order_reference ? ` (${ratingTarget.order_reference})` : ""}`
                    : ratingTarget.staff_name
                      ? `Rate your experience with ${ratingTarget.staff_name} at ${ratingTarget.store_name}`
                      : `Rate your experience at ${ratingTarget.store_name}`}
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

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Photo proof (optional)
                </label>
                {proofImagePath && (
                  <img
                    src={getImageUrl(proofImagePath) ?? undefined}
                    alt="Proof preview"
                    className="mt-2 h-28 w-full rounded-lg border border-border object-cover"
                  />
                )}
                <label className="mt-2 block cursor-pointer">
                  <div
                    className={`flex items-center justify-center rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground${uploadingProof ? " opacity-50" : ""}`}
                  >
                    {uploadingProof ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Upload photo
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingProof}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleProofUpload(file);
                    }}
                  />
                </label>
              </div>

              <Button
                className="w-full bg-gradient-primary text-primary-foreground"
                disabled={rating === 0 || !reviewerName.trim() || submitting || uploadingProof}
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
