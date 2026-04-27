import { Star, MapPin } from "lucide-react";
import type { Store } from "@/data/stores";

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
        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium backdrop-blur">
          {store.origin}
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
          <Star className="h-3 w-3 fill-primary text-primary" />
          {store.rating}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl font-bold leading-tight">{store.name}</h3>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {store.category}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{store.description}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{store.distance} away</span>
          <span>{store.reviews} reviews</span>
        </div>
      </div>
    </button>
  );
}
