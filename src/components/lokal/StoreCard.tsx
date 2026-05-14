import { useState } from "react";
import { MapPin, Star } from "lucide-react";
import type { Store } from "@/data/stores";
import { VerificationBadge } from "./VerificationBadge";
import { buildInstagramUrl, buildTikTokUrl, isBodyContactService } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function StoreCard({ store, onClick }: { store: Store; onClick: () => void }) {
  const isClosed = store.is_open_now === false;
  const isBodyContact = isBodyContactService(store.category, store.subcategory);
  const tattooPortfolioUrl = store.tattoo_portfolio_url?.trim() || null;
  const artistPortfolioUrl =
    store.websiteUrl?.trim() ||
    (store.instagramHandle ? buildInstagramUrl(store.instagramHandle) : null) ||
    (store.tiktokHandle ? buildTikTokUrl(store.tiktokHandle) : null);
  const isArtistService = ["Barbers", "Hair & Beauty", "Body Arts & Crafts"].includes(store.category);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("Portfolio preview");

  const isLikelyImage = (url: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url);

  const openPortfolio = (event: React.MouseEvent<HTMLSpanElement>, url: string, title: string) => {
    event.stopPropagation();
    setPreviewUrl(url);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };

  return (
    <>
      <button
        onClick={onClick}
        className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-warm${isClosed ? " opacity-70 saturate-75" : ""}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={store.image}
            alt={store.name}
            loading="lazy"
            width={800}
            height={600}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <div className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium backdrop-blur">
              {store.origin}
            </div>
            <VerificationBadge
              verificationTier={store.verification_tier ?? (store.is_verified ? "verified" : null)}
              verificationReason={store.verification_reason ?? "Unverified store. Buy at your own risk."}
              showUnverified
              isTattooArtistVerified={Boolean(store.is_verified_tattoo_artist && isBodyContact)}
            />
          </div>
          {/* Portfolio overlay buttons */}
          <div className="absolute bottom-3 right-3 flex flex-wrap items-center justify-end gap-2">
              {isBodyContact && tattooPortfolioUrl && (
              <span
                onClick={(event) => {
                  event.stopPropagation();
                    openPortfolio(event, tattooPortfolioUrl, `${store.subcategory} Portfolio`);
                }}
                className="flex items-center gap-1 rounded-full border border-indigo-300/80 bg-indigo-600/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur hover:bg-indigo-700 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    openPortfolio(event as unknown as React.MouseEvent<HTMLSpanElement>, tattooPortfolioUrl, `${store.subcategory} Portfolio`);
                  }
                }}
              >
                🖼️
              </span>
            )}
            {!isBodyContact && isArtistService && artistPortfolioUrl && (
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  openPortfolio(event, artistPortfolioUrl, "Artist Portfolio");
                }}
                className="flex items-center gap-1 rounded-full border border-fuchsia-300/80 bg-fuchsia-600/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur hover:bg-fuchsia-700 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    openPortfolio(event as unknown as React.MouseEvent<HTMLSpanElement>, artistPortfolioUrl, "Artist Portfolio");
                  }
                }}
              >
                🖼️
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl font-bold leading-tight">{store.name}</h3>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                {store.category}
              </span>
              {store.subcategory && (
                <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {store.subcategory}
                </span>
              )}
            </div>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{store.description}</p>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-[10px] sm:text-[11px]">
            {store.is_open_now === true && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🟢 Open</span>
            )}
            {store.is_open_now === false && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">⚫ Closed</span>
            )}
            {isBodyContact && (store.minimum_age ?? 0) >= 18 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">18+</span>
            )}
            {isBodyContact && store.tattoo_license_url && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">📜</span>
            )}
            {store.category === "Groceries" && store.subcategory === "Meat & Fish" && store.health_safety_certificate_status === "approved" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✅</span>
            )}
            {store.location_type === "salon" && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🏠</span>
            )}
            {store.location_type === "travel" && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🚗</span>
            )}
            {store.location_type === "remote" && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">💻</span>
            )}
            {store.location_type === "remote_and_travel" && (
              <>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🏠</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🚗</span>
              </>
            )}
            {!store.location_type && (
              <>
                {(store.fulfillment === "collection" || store.fulfillment === "both") && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🏪</span>
                )}
                {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">🚚</span>
                )}
                {store.fulfillment === "pay_at_store" && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">💰</span>
                )}
              </>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{[store.address, store.city, store.postcode].filter(Boolean).join(", ") || "Location on request"}</span>
            {store.reviews > 0 && (
              <span className="ml-2 flex shrink-0 items-center gap-0.5 font-medium text-amber-500">
                <Star className="h-3 w-3 fill-amber-500" />{store.rating} <span className="text-muted-foreground">({store.reviews})</span>
              </span>
            )}
          </div>
        </div>
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>Preview this artist portfolio inside Lokal.</DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <div className="mt-2">
              {isLikelyImage(previewUrl) ? (
                <img src={previewUrl} alt={previewTitle} className="max-h-[65vh] w-full rounded-lg border border-border object-contain" />
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewTitle}
                  className="h-[65vh] w-full rounded-lg border border-border"
                  loading="lazy"
                />
              )}
              <p className="mt-2 text-xs text-muted-foreground">If this site blocks embedded previews, use the merchant social or website links from the store details page.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
