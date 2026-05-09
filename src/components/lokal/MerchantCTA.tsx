import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

export function MerchantCTA() {
  return (
    <section className="bg-amber-50 dark:bg-amber-950/20">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Early access</span>

          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight text-balance">
            Own an African or Caribbean business?
          </h2>

          <p className="mt-4 text-amber-900/80 dark:text-amber-100/80 max-w-xl mx-auto">
            Join Lokal <strong>free during early access</strong>. List your products, manage orders, and reach customers directly — no marketplace fees eating into your profits.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link to="/list-store">
              <Button
                size="lg"
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => trackEvent("merchant_cta_click", { placement: "merchant_section", target: "list-store" })}
              >
                List Your Store <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how" className="text-sm font-semibold text-amber-900 dark:text-amber-100 hover:underline">
              Learn how it works
            </a>
          </div>

          <div className="flex items-center justify-center gap-10 mt-10 pt-8 border-t border-amber-200/60 dark:border-amber-800/40">
            <div className="text-center">
              <div className="text-xl font-bold text-amber-900 dark:text-amber-100">$0</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Setup fee</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-900 dark:text-amber-100">Direct</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Customer payments</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-900 dark:text-amber-100">You</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Keep everything</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
