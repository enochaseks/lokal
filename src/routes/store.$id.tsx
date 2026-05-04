import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Globe, Share2, Copy, Check } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl } from "@/lib/utils";
import { toast } from "sonner";

type StoreDetails = {
  id: string;
  name: string;
  category: string;
  origin: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  hours: string | null;
  phone: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  website_url: string | null;
  image_url: string | null;
  fulfillment: string;
  published: boolean;
};

export const Route = createFileRoute("/store/$id")({
  component: StoreDetail,
  head: (props) => {
    const store = (props.loaderData as StoreDetails | undefined);
    const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
    const shareUrl = `${domain}/store/${props.params.id}`;
    
    return {
      meta: store ? [
        { title: `${store.name} · Lokal` },
        { name: "description", content: store.description || `Visit ${store.name} on Lokal` },
        { property: "og:title", content: store.name },
        { property: "og:description", content: store.description || `${store.category} on Lokal` },
        { property: "og:type", content: "business.business" },
        { property: "og:url", content: shareUrl },
        ...(store.image_url ? [{ property: "og:image", content: getImageUrl(store.image_url) || "" }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: store.name },
        { name: "twitter:description", content: store.description || `${store.category} on Lokal` },
      ] : [],
    };
  },
  beforeLoad: async (props) => {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("id", props.params.id)
      .eq("published", true)
      .single();

    if (!data) {
      throw new Error("Store not found");
    }
    return data;
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This store is either not available or has been removed.</p>
          <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Browse stores
          </a>
        </div>
      </div>
    </div>
  ),
});

function StoreDetail() {
  const store = Route.useLoaderData() as StoreDetails;
  const [copied, setCopied] = useState(false);

  const domain = typeof window !== "undefined" ? window.location.origin : "https://lokalshops.co.uk";
  const shareUrl = `${domain}/store/${store.id}`;
  const shareText = `Check out ${store.name} on Lokal!`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Check out ${store.name} on Lokal - ${shareUrl}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleShareInstagram = () => {
    toast("Copy the link and share it in your Instagram Story or Direct Message", { icon: "ℹ️" });
    navigator.clipboard.writeText(shareUrl);
  };

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      "_blank",
      "width=550,height=420"
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Store image */}
          {store.image_url && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              <img
                src={getImageUrl(store.image_url) || ""}
                alt={store.name}
                className="h-64 w-full object-cover sm:h-96"
              />
            </div>
          )}

          {/* Header with share buttons */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold">{store.name}</h1>
              {store.description && <p className="mt-2 text-lg text-muted-foreground">{store.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{store.category}</span>
                {store.origin && <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{store.origin}</span>}
              </div>
            </div>

            {/* Share dropdown */}
            <div className="flex flex-col gap-2 sm:min-w-48">
              <Button
                onClick={handleCopyLink}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">
                  <Share2 className="h-4 w-4" />
                  Share
                </summary>
                <div className="absolute right-4 top-full z-10 mt-2 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
                  <button
                    onClick={handleShareWhatsApp}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span>💚</span> WhatsApp
                  </button>
                  <button
                    onClick={handleShareFacebook}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span>📘</span> Facebook
                  </button>
                  <button
                    onClick={handleShareTwitter}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span>𝕏</span> Twitter
                  </button>
                  <button
                    onClick={handleShareInstagram}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span>📷</span> Instagram
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Store info grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact & Location */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold">Visit us</h2>
              
              {store.address && (
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{store.address}</p>
                    {store.city && <p className="text-sm text-muted-foreground">{store.city}{store.postcode ? `, ${store.postcode}` : ""}</p>}
                  </div>
                </div>
              )}

              {store.hours && (
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Opening hours</p>
                    <p className="text-sm text-muted-foreground">{store.hours}</p>
                  </div>
                </div>
              )}

              {store.phone && (
                <div className="flex gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <a href={`tel:${store.phone}`} className="text-sm text-primary hover:underline">
                      {store.phone}
                    </a>
                  </div>
                </div>
              )}

              {store.fulfillment && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fulfilment</p>
                  <div className="flex flex-wrap gap-2">
                    {(store.fulfillment === "collection" || store.fulfillment === "both") && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        🏪 Collection
                      </span>
                    )}
                    {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        🚚 Delivery
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Social links */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold">Connect</h2>

              {store.website_url && (
                <a
                  href={store.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <Globe className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <p className="text-sm text-primary hover:underline truncate">{store.website_url}</p>
                  </div>
                </a>
              )}

              {store.instagram_handle && (
                <a
                  href={`https://instagram.com/${store.instagram_handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <span className="text-xl mt-0.5">📷</span>
                  <div>
                    <p className="text-sm font-medium">Instagram</p>
                    <p className="text-sm text-primary hover:underline truncate">@{store.instagram_handle.replace(/^@/, "")}</p>
                  </div>
                </a>
              )}

              {store.tiktok_handle && (
                <a
                  href={`https://tiktok.com/@${store.tiktok_handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 rounded-lg hover:bg-secondary p-3 transition-colors"
                >
                  <span className="text-xl mt-0.5">🎵</span>
                  <div>
                    <p className="text-sm font-medium">TikTok</p>
                    <p className="text-sm text-primary hover:underline truncate">@{store.tiktok_handle.replace(/^@/, "")}</p>
                  </div>
                </a>
              )}

              {!store.website_url && !store.instagram_handle && !store.tiktok_handle && (
                <p className="text-sm text-muted-foreground">No social links available yet.</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse more stores
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
