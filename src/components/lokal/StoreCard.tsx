import { MapPin, Star } from "lucide-react";
import type { Store } from "@/data/stores";
import { VerificationBadge } from "./VerificationBadge";

export function StoreCard({ store, onClick }: { store: Store; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-warm"
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
          />
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
        <div className="mt-auto flex items-center gap-1.5 pt-2 text-[11px]">
          {store.category === "Groceries" && store.subcategory === "Meat & Fish" && store.health_safety_certificate_status === "approved" && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✅ Health &amp; Safety Passed</span>
          )}
          {store.location_type === "salon" && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🏠 At premises</span>
          )}
          {store.location_type === "travel" && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🚗 Travels to you</span>
          )}
          {store.location_type === "remote" && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">💻 Remote</span>
          )}
          {store.location_type === "remote_and_travel" && (
            <>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">🏠 At premises</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🚗 Travels to you</span>
            </>
          )}
          {!store.location_type && (
            <>
              {(store.fulfillment === "collection" || store.fulfillment === "both") && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🏪 Collection</span>
              )}
              {(store.fulfillment === "delivery" || store.fulfillment === "both") && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">🚚 Delivery</span>
              )}
              {store.fulfillment === "pay_at_store" && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">💰 Pay at store</span>
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
  );
}
