import { Store as StoreType } from "@/data/stores";
import { Globe, Store, BarChart3 } from "lucide-react";

interface PlatformMetricsProps {
  stores: StoreType[];
}

export function PlatformMetrics({ stores }: PlatformMetricsProps) {
  // Calculate real metrics from store data
  const uniqueCities = new Set(stores.map((s) => s.city).filter(Boolean)).size;
  const uniqueCategories = new Set(stores.map((s) => s.category)).size;
  const totalStores = stores.length;

  return (
    <section className="bg-gradient-to-b from-primary/5 via-transparent to-transparent py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-3 gap-4 md:gap-8">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="font-display text-2xl md:text-3xl font-bold">{uniqueCities}+</div>
            <div className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
              Cities launching
            </div>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="font-display text-2xl md:text-3xl font-bold">{totalStores}+</div>
            <div className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
              Businesses onboarding
            </div>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="font-display text-2xl md:text-3xl font-bold">{uniqueCategories}+</div>
            <div className="text-xs md:text-sm text-muted-foreground font-medium mt-1">
              Categories supported
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
