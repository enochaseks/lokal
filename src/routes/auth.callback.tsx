import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let isDone = false;

    // Respect a ?redirect= param passed through from the auth page
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect") || "/";

    const finish = () => {
      if (isDone) return;
      isDone = true;
      const dest = redirectTo === "/" ? "/merchant" : redirectTo;
      navigate({ to: dest as any });
    };

    // Exchange the token from the URL (email confirmation & OAuth), then route using current session.
    void supabase.auth.exchangeCodeForSession(window.location.search)
      .catch(() => {
        // Ignore when no code is present (e.g. magic-link flow already exchanged).
      })
      .finally(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) finish();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        finish();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Confirming your account…</p>
      </div>
    </div>
  );
}
