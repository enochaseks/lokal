import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

function NavigationLoaderVisual() {
  return (
    <div className="lokal-nav-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="lokal-nav-loader-map">
        <span className="lokal-nav-loader-radar" />
        <span className="lokal-nav-loader-pulse" />
        <MapPin className="lokal-nav-loader-pin" />
        <span className="lokal-nav-loader-blip lokal-nav-loader-blip-a" />
        <span className="lokal-nav-loader-blip lokal-nav-loader-blip-b" />
        <span className="lokal-nav-loader-blip lokal-nav-loader-blip-c" />
      </div>
    </div>
  );
}

export function NavigationLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <NavigationLoaderVisual />
    </div>
  );
}

export function NavigationLoadingOverlay() {
  const status = useRouterState({
    select: (state) => state.status,
  });

  const isPending = status === "pending";
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPending) {
      if (!visible) {
        setVisible(true);
        startedAtRef.current = Date.now();
      }
      return;
    }

    if (!visible) return;

    const minVisibleMs = 320;
    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : minVisibleMs;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    const timeout = window.setTimeout(() => {
      setVisible(false);
      startedAtRef.current = null;
    }, remaining);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isPending, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-background/45 backdrop-blur-[2px]">
      <NavigationLoaderVisual />
    </div>
  );
}