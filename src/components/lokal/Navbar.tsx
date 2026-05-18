import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Navigation, Store, Heart, User, ShieldCheck, Sprout } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useLocation } from "@/hooks/use-location";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImage from "@/assets/logo.png";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { city, loading, refreshLocation } = useLocation();
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [hasNewFollowingPosts, setHasNewFollowingPosts] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setStoreName(null);
      setStoreId(null);
      return;
    }

    void supabase
      .from("stores")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setStoreName(data[0].name);
          setStoreId(data[0].id);
        } else {
          setStoreName(null);
          setStoreId(null);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      setHasNewFollowingPosts(false);
      return;
    }

    const readAndCheck = async () => {
      const lastSeenRaw = window.localStorage.getItem(`lokal:following:lastSeen:${user.id}`);
      const lastSeenIso =
        lastSeenRaw && !Number.isNaN(Date.parse(lastSeenRaw))
          ? new Date(lastSeenRaw).toISOString()
          : null;

      const { data: follows } = await (supabase as any)
        .from("store_follows")
        .select("store_id")
        .eq("user_id", user.id);

      const storeIds = (follows ?? []).map((f: any) => f.store_id) as string[];
      if (storeIds.length === 0) {
        setHasNewFollowingPosts(false);
        return;
      }

      let query = (supabase as any)
        .from("store_posts")
        .select("id, created_at")
        .in("store_id", storeIds)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastSeenIso) query = query.gt("created_at", lastSeenIso);

      const { data: latest } = await query;
      setHasNewFollowingPosts((latest ?? []).length > 0);
    };

    void readAndCheck();
  }, [user?.id]);

  const markFollowingSeen = () => {
    if (!user?.id || typeof window === "undefined") return;
    window.localStorage.setItem(`lokal:following:lastSeen:${user.id}`, new Date().toISOString());
    setHasNewFollowingPosts(false);
  };

  const initials = (user?.user_metadata?.display_name || user?.email || "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="Lokal logo"
            className="h-9 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/#stores"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Stores
          </a>
          <a
            href="/#how"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <Link
            to="/help"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Help
          </Link>
          {user && (
            <Link
              to="/following"
              onClick={markFollowingSeen}
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Following
              {hasNewFollowingPosts && (
                <span
                  className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-primary"
                  aria-label="New following updates"
                />
              )}
            </Link>
          )}
          {storeId && (
            <Link
              to="/merchant"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              My store
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              void refreshLocation();
            }}
            disabled={loading}
            title={loading ? "Detecting location" : city ? `Location: ${city}` : "Use current location"}
            aria-label={loading ? "Detecting location" : "Use current location"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/80" />
            ) : (
              <Navigation className="h-4 w-4 text-muted-foreground/80" />
            )}
          </Button>

          {!user ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({ to: "/list-store", search: () => ({ category: undefined }) })
                }
              >
                List your store
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() =>
                  navigate({ to: "/auth", search: () => ({ redirect: "/", mode: "" }) })
                }
              >
                Sign in
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Open account menu"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary sm:hidden"
                  >
                    <User className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() =>
                      navigate({ to: "/auth", search: () => ({ redirect: "/", mode: "" }) })
                    }
                  >
                    <User className="mr-2 h-4 w-4" /> Sign in
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {storeName || user.user_metadata?.display_name || "Lokal user"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/customer/dashboard" })}>
                  <User className="mr-2 h-4 w-4" /> My profile
                </DropdownMenuItem>
                {!storeId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({ to: "/list-store", search: () => ({ category: undefined }) })
                      }
                    >
                      <Store className="mr-2 h-4 w-4" /> List your store
                    </DropdownMenuItem>
                  </>
                )}
                {storeId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/merchant" })}>
                      <Store className="mr-2 h-4 w-4" /> My store dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: `/store/${storeId}` })}>
                      <Store className="mr-2 h-4 w-4" /> Show store
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    markFollowingSeen();
                    navigate({ to: "/following" });
                  }}
                >
                  <Heart className="mr-2 h-4 w-4" /> Following
                  {hasNewFollowingPosts && (
                    <span className="ml-auto h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = "/farmers-market";
                  }}
                >
                  <Sprout className="mr-2 h-4 w-4" /> Farmers Market
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Soon
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/help" })}>
                  <Store className="mr-2 h-4 w-4" /> Help Center
                </DropdownMenuItem>
                {isAdminEmail(user?.email) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Admin Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
