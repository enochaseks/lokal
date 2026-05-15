import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoImage from "@/assets/logo.png";
import xIcon from "@/assets/X_icon.svg.png";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s) => ({
    redirect: (s.redirect as string) || "/",
    mode: (s.mode as string) || "",
  }),
  head: () => ({ meta: [{ title: "Sign in · Lokal" }] }),
});

function getAuthSiteOrigin() {
  const configuredOrigin = (import.meta.env.VITE_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (configuredOrigin) return configuredOrigin;

  if (typeof window === "undefined") return "https://lokalshops.co.uk";

  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  return isLocalHost ? window.location.origin : "https://lokalshops.co.uk";
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect, mode } = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const authSiteOrigin = getAuthSiteOrigin();

  // Pre-fill saved email if remember me was used before
  useEffect(() => {
    const saved = localStorage.getItem("lokal:saved-email");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const getFriendlyAuthError = (message: string, mode: "signin" | "signup") => {
    const normalized = message.toLowerCase();
    if (mode === "signin") {
      if (
        normalized.includes("invalid login credentials") ||
        normalized.includes("invalid_credentials")
      ) {
        return "Incorrect email or password. Please try again.";
      }
      if (normalized.includes("email not confirmed")) {
        return "Please confirm your email before signing in.";
      }
      if (normalized.includes("too many requests")) {
        return "Too many sign-in attempts. Please wait a moment and try again.";
      }
      return "Could not sign in. Please check your details and try again.";
    }
    return message || "Could not create account. Please try again.";
  };

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active || !session) return;

      if (redirect !== "/") {
        navigate({ to: redirect as any });
        return;
      }

      const { data: storeRow } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", session.user.id)
        .maybeSingle();

      navigate({ to: storeRow ? "/merchant" : "/" });
    });

    return () => {
      active = false;
    };
  }, [navigate, redirect]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      const e1 = emailSchema.safeParse(email);
      const p1 = passwordSchema.safeParse(password);
      if (!e1.success) throw new Error(e1.error.issues[0].message);
      if (!p1.success) throw new Error(p1.error.issues[0].message);

      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email: e1.data,
          password: p1.data,
          options: {
            emailRedirectTo: authSiteOrigin + "/auth/callback",
            data: { display_name: name.trim() || undefined },
          },
        });
        if (error) throw error;
        setEmailSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: e1.data,
          password: p1.data,
        });
        if (error) throw error;
        if (rememberMe) localStorage.setItem("lokal:saved-email", e1.data);
        else localStorage.removeItem("lokal:saved-email");
        toast.success("Welcome back");
        navigate({ to: redirect === "/" ? "/merchant" : redirect });
      }
    } catch (err: any) {
      const msg = getFriendlyAuthError(String(err?.message ?? ""), tab);
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    try {
      const parsed = emailSchema.safeParse(forgotEmail || email);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: authSiteOrigin + "/auth/callback?type=recovery",
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast.error(err.message ?? "Could not send reset email. Please try again.");
    } finally {
      setForgotBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const p1 = passwordSchema.safeParse(newPassword);
    if (!p1.success) { toast.error(p1.error.issues[0].message); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1.data });
      if (error) throw error;
      toast.success("Password updated! Signing you in…");
      setTimeout(() => navigate({ to: "/merchant" }), 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Could not update password");
    } finally {
      setResetBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const callbackUrl =
        redirect && redirect !== "/"
          ? `${authSiteOrigin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
          : `${authSiteOrigin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch {
      toast.error("Could not sign in with Google");
    } finally {
      setBusy(false);
    }
  };

  const handleX = async () => {
    setBusy(true);
    try {
      const callbackUrl =
        redirect && redirect !== "/"
          ? `${authSiteOrigin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
          : `${authSiteOrigin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "x",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch {
      toast.error("Could not sign in with X");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <img
            src={logoImage}
            alt="Lokal logo"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {mode === "reset" ? (
          /* ── Update password (after clicking reset email link) ── */
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card">
            <h2 className="font-display text-2xl font-bold">Set a new password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
            <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Repeat your new password"
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                disabled={resetBusy}
                className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                size="lg"
              >
                {resetBusy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </div>
        ) : forgotSent ? (
          /* ── Forgot password email sent ── */
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a password reset link to <strong className="text-foreground">{forgotEmail || email}</strong>.
            </p>
            <button
              onClick={() => { setForgotSent(false); setForgotMode(false); }}
              className="mt-6 text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : forgotMode ? (
          /* ── Forgot password form ── */
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card">
            <button onClick={() => setForgotMode(false)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-display text-2xl font-bold">Reset your password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail || email}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="mt-1"
                  placeholder="you@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={forgotBusy}
                className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                size="lg"
              >
                {forgotBusy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </div>
        ) : emailSent ? (
          /* ── Sign-up email confirmation ── */
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
              Click it to activate your account, then come back to sign in.
            </p>
            <button
              onClick={() => {
                setEmailSent(false);
                setTab("signin");
              }}
              className="mt-6 text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          /* ── Main sign in / sign up form ── */
          <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-card">
            <h1 className="font-display text-2xl font-bold">Welcome to Lokal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to shop, or to list your store.
            </p>

            <Tabs
              value={tab}
              onValueChange={(v) => { setTab(v as "signin" | "signup"); setAuthError(null); }}
              className="mt-6"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <form onSubmit={handleEmailAuth} className="mt-5 space-y-4">
                {authError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {authError}
                  </div>
                )}
                <TabsContent value="signup" className="space-y-4 mt-0">
                  <div>
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ama Boateng"
                      maxLength={100}
                      className="mt-1"
                    />
                  </div>
                </TabsContent>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                    required
                    minLength={8}
                    className="mt-1"
                  />
                </div>

                {/* Remember me + Forgot password — sign-in tab only */}
                <TabsContent value="signin" className="mt-0">
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(!!v)}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setAuthError(null); }}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </TabsContent>

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                  size="lg"
                >
                  {tab === "signup" ? "Create account" : "Sign in"}
                </Button>
              </form>
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleGoogle}
              disabled={busy}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full mt-3"
              size="lg"
              onClick={handleX}
              disabled={busy}
            >
              <img src={xIcon} alt="X" className="h-4 w-4" />
              Continue with X
            </Button>

          </div>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {tab === "signup" ? (
            <>
              By signing up, you agree with our{" "}
              <Link to="/privacy" className="underline-offset-2 hover:underline">
                privacy policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="underline-offset-2 hover:underline">
                terms of service
              </Link>
              .
            </>
          ) : (
            <>
              By continuing you agree to Lokal's{" "}
              <Link to="/terms" className="underline-offset-2 hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline-offset-2 hover:underline">
                privacy policy
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}
