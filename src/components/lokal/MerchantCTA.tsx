import { Link } from "@tanstack/react-router";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MerchantCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute -bottom-8 right-1/4 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000" />
      </div>
      
      <div className="relative container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-white/60 dark:bg-black/40 px-4 py-2 mb-4 backdrop-blur-sm">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">Limited early access</span>
          </div>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-balance mb-4">
            Own an African or Caribbean business?
          </h2>
          
          <p className="text-lg text-amber-900/80 dark:text-amber-100/80 max-w-xl mx-auto mb-8">
            Join Lokal <strong>free during early access</strong>. List your products, manage orders, and reach customers directly — no marketplace fees eating into your profits.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/list-store">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg">
                List Your Store <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how" className="text-sm font-semibold text-amber-900 dark:text-amber-100 hover:underline">
              Learn how it works
            </a>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-amber-200/40 dark:border-amber-800/40">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">$0</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">Setup fee</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">Direct</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">Customer payments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">You</div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">Keep everything</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
