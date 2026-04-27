import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MapPin, LogOut, Store, User as UserIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
  const { user, isMerchant, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.user_metadata?.display_name || user?.email || "?")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-warm">
            <span className="font-display text-lg font-bold text-primary-foreground">L</span>
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">Lokal</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/" hash="stores" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Stores</Link>
          <a href="/#how" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How it works</a>
          {isMerchant && (
            <Link to="/merchant" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">My store</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
            <MapPin className="h-4 w-4" />
            London
          </Button>

          {!user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>Sign in</Button>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95" onClick={() => navigate({ to: "/list-store" })}>
                List your store
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.user_metadata?.display_name || "Lokal user"}</span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isMerchant ? (
                  <DropdownMenuItem onClick={() => navigate({ to: "/merchant" })}>
                    <Store className="mr-2 h-4 w-4" /> My store
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate({ to: "/list-store" })}>
                    <Store className="mr-2 h-4 w-4" /> List your store
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile (soon)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
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
