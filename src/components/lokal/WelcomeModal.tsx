import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Sparkles, Store } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { LIVE_CATEGORIES } from "@/data/stores";

const STORAGE_KEY = "lokalWelcomeSeen";

type Step = "welcome" | "business-type";

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [animateOut, setAnimateOut] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Don't show while auth state is still resolving
    if (authLoading) return;
    // Never show to signed-in users
    if (user) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(timer);
  }, [authLoading, user]);

  function dismiss() {
    setAnimateOut(true);
    window.setTimeout(() => {
      setVisible(false);
      setAnimateOut(false);
    }, 280);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  function handleShopLocal() {
    trackEvent("welcome_modal_shop_local");
    dismiss();
  }

  function handleListBusiness() {
    trackEvent("welcome_modal_list_business");
    setStep("business-type");
  }

  function handleBusinessType(type: string) {
    trackEvent("welcome_modal_business_type", { type });
    localStorage.setItem(STORAGE_KEY, "true");
    navigate({ to: "/list-store", search: { category: type } });
  }

  function handleMaybeLater() {
    trackEvent("welcome_modal_maybe_later");
    dismiss();
  }

  if (!visible) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      {/* Panel */}
      <div
        className={[
          "relative w-full max-w-sm rounded-2xl bg-card border border-border/60 shadow-2xl overflow-hidden",
          "transition-all duration-300",
          animateOut
            ? "opacity-0 translate-y-6 scale-95"
            : "opacity-100 translate-y-0 scale-100",
        ].join(" ")}
        style={{
          animation: animateOut ? undefined : "welcomeSlideUp 0.32s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {step === "welcome" && <WelcomeStep onShopLocal={handleShopLocal} onListBusiness={handleListBusiness} onMaybeLater={handleMaybeLater} />}
        {step === "business-type" && <BusinessTypeStep onSelect={handleBusinessType} onBack={() => setStep("welcome")} />}
      </div>

      <style>{`
        @keyframes welcomeSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Welcome Step ─── */
function WelcomeStep({
  onShopLocal,
  onListBusiness,
  onMaybeLater,
}: {
  onShopLocal: () => void;
  onListBusiness: () => void;
  onMaybeLater: () => void;
}) {
  return (
    <div className="p-6 pt-8">
      {/* Icon badge */}
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>

      <h2 className="text-center font-display text-2xl font-bold leading-tight">
        Welcome to Lokal 👋
      </h2>
      <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
        Discover African &amp; Caribbean businesses near you — or grow your own.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          onClick={onShopLocal}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Shop Local
        </button>
        <button
          onClick={onListBusiness}
          className="w-full rounded-xl border border-primary/50 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Store className="h-4 w-4" />
          List My Business
        </button>
        <button
          onClick={onMaybeLater}
          className="w-full rounded-xl py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

/* ─── Business Type Step ─── */
function BusinessTypeStep({
  onSelect,
  onBack,
}: {
  onSelect: (type: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 pt-8">
      <button
        onClick={onBack}
        className="mb-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </button>

      <h2 className="font-display text-xl font-bold leading-tight">
        What type of business are you?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        List your business free today and grow with Lokal.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {LIVE_CATEGORIES.map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.97] transition-all text-left"
          >
            {type}
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Join early and grow with Lokal 🌍
      </p>
    </div>
  );
}
