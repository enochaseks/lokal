import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, LogOut, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";

import { StoreVerificationAdmin } from "@/components/admin/StoreVerificationAdmin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/admin";

type ReviewNotification = {
  id: string;
  title: string;
  body: string | null;
  store_id: string;
  recipient_role: "admin" | "merchant";
  is_read: boolean;
  created_at: string;
  stores?: { name: string } | null;
};

type VerificationRequest = {
  id: string;
  store_id: string;
  store_name: string;
  store_category?: string | null;
  store_subcategory?: string | null;
  owner_name: string;
  business_name: string;
  verification_method?: "registration_number" | "online_presence" | "manual_review";
  online_presence_url?: string | null;
  business_registration_number?: string;
  manual_review_details?: string | null;
  supporting_links?: string | null;
  is_tattoo_verification?: boolean | null;
  tattoo_minimum_age?: number | null;
  tattoo_portfolio_url?: string | null;
  tattoo_license_url?: string | null;
  tattoo_age_restriction_acknowledged?: boolean | null;
  submission_reason?: string;
  submitted_at: string;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
};

type FraudQueueItem = {
  id: string;
  entity_id: string;
  risk_score: number;
  fraud_flags: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
  stores?: { name: string } | null;
};

function AdminDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [fraudQueue, setFraudQueue] = useState<FraudQueueItem[]>([]);
  const [fraudQueueLoading, setFraudQueueLoading] = useState(true);

  // Check admin access
  useEffect(() => {
    if (!loading && (!user || !isAdminEmail(user.email))) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  // Load all verification requests
  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) return;

    async function enrichRequestsWithStoreMeta(items: VerificationRequest[]) {
      if (!items.length) return items;
      const storeIds = Array.from(new Set(items.map((r) => r.store_id).filter(Boolean)));
      if (!storeIds.length) return items;

      const { data: storesData } = await (supabase as any)
        .from("stores")
        .select("id,name,category,subcategory")
        .in("id", storeIds);

      const storeMetaById: Record<string, { name: string; category: string | null; subcategory: string | null }> = {};
      for (const row of (storesData ?? []) as Array<{ id: string; name: string; category: string | null; subcategory: string | null }>) {
        storeMetaById[row.id] = {
          name: row.name,
          category: row.category ?? null,
          subcategory: row.subcategory ?? null,
        };
      }

      return items.map((req) => ({
        ...req,
        store_name: req.store_name || storeMetaById[req.store_id]?.name || "Unknown Store",
        store_category: req.store_category ?? storeMetaById[req.store_id]?.category ?? null,
        store_subcategory: req.store_subcategory ?? storeMetaById[req.store_id]?.subcategory ?? null,
      }));
    }

    async function loadRequests() {
      setRequestsLoading(true);
      setNotificationsLoading(true);
      setFraudQueueLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-admin-verification-feed");
        if (!error) {
          const payload = (data ?? {}) as {
            requests?: VerificationRequest[];
            notifications?: ReviewNotification[];
          };

          const enriched = await enrichRequestsWithStoreMeta(payload.requests ?? []);
          setRequests(enriched);
          setNotifications(payload.notifications ?? []);
          return;
        }

        const [{ data: reqData, error: reqError }, { data: notifData, error: notifError }, { data: fraudData, error: fraudErr }] = await Promise.all([
          (supabase as any)
            .from("store_verification_requests")
            .select("id, store_id, status, business_name, owner_name, verification_method, online_presence_url, business_registration_number, manual_review_details, supporting_links, is_tattoo_verification, tattoo_minimum_age, tattoo_portfolio_url, tattoo_license_url, tattoo_age_restriction_acknowledged, submission_reason, submitted_at, admin_notes")
            .order("submitted_at", { ascending: false }),
          (supabase as any)
            .from("review_notifications")
            .select("id, title, body, store_id, recipient_role, is_read, created_at")
            .eq("recipient_role", "admin")
            .order("created_at", { ascending: false })
            .limit(10),
          (supabase as any)
            .from("fraud_review_queue")
            .select("id, entity_id, risk_score, fraud_flags, status, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        if (reqError) throw reqError;

        const storeIds = Array.from(new Set((reqData ?? []).map((r: any) => r.store_id).filter(Boolean)));
        let storeMetaById: Record<string, { name: string; category: string | null; subcategory: string | null }> = {};
        if (storeIds.length > 0) {
          const { data: storesData } = await (supabase as any)
            .from("stores")
            .select("id,name,category,subcategory")
            .in("id", storeIds);
          for (const row of (storesData ?? []) as Array<{ id: string; name: string; category: string | null; subcategory: string | null }>) {
            storeMetaById[row.id] = {
              name: row.name,
              category: row.category ?? null,
              subcategory: row.subcategory ?? null,
            };
          }
        }

        setRequests(((reqData ?? []) as any[]).map((req) => ({
          id: req.id,
          store_id: req.store_id,
          store_name: storeMetaById[req.store_id]?.name ?? "Unknown Store",
          store_category: storeMetaById[req.store_id]?.category ?? null,
          store_subcategory: storeMetaById[req.store_id]?.subcategory ?? null,
          owner_name: req.owner_name,
          business_name: req.business_name,
          verification_method: req.verification_method,
          online_presence_url: req.online_presence_url,
          business_registration_number: req.business_registration_number,
          manual_review_details: req.manual_review_details,
          supporting_links: req.supporting_links,
          is_tattoo_verification: req.is_tattoo_verification,
          tattoo_minimum_age: req.tattoo_minimum_age,
          tattoo_portfolio_url: req.tattoo_portfolio_url,
          tattoo_license_url: req.tattoo_license_url,
          tattoo_age_restriction_acknowledged: req.tattoo_age_restriction_acknowledged,
          submission_reason: req.submission_reason,
          submitted_at: req.submitted_at,
          status: req.status,
          admin_notes: req.admin_notes,
        })));

        if (notifError) {
          setNotifications([]);
        } else {
          setNotifications(((notifData ?? []) as any[]).map((row) => ({
            id: row.id,
            title: row.title,
            body: row.body,
            store_id: row.store_id,
            recipient_role: row.recipient_role,
            is_read: row.is_read,
            created_at: row.created_at,
            stores: { name: storeMetaById[row.store_id]?.name ?? "Unknown store" },
          })));
        }

        if (fraudErr) {
          setFraudQueue([]);
        } else {
          const fraudStoreIds = Array.from(new Set(((fraudData ?? []) as any[]).map((row) => row.entity_id).filter(Boolean)));
          let fraudStoreNameById: Record<string, string> = {};

          if (fraudStoreIds.length > 0) {
            const { data: fraudStores } = await (supabase as any)
              .from("stores")
              .select("id,name")
              .in("id", fraudStoreIds);

            for (const row of (fraudStores ?? []) as Array<{ id: string; name: string }>) {
              fraudStoreNameById[row.id] = row.name;
            }
          }

          setFraudQueue(((fraudData ?? []) as any[]).map((row) => ({
            id: row.id,
            entity_id: row.entity_id,
            risk_score: row.risk_score,
            fraud_flags: row.fraud_flags ?? [],
            status: row.status,
            created_at: row.created_at,
            stores: { name: fraudStoreNameById[row.entity_id] ?? "Unknown store" },
          })));
        }
      } catch (err) {
        console.error("Failed to load admin feed:", err);
        setRequests([]);
        setNotifications([]);
        setFraudQueue([]);
      } finally {
        setRequestsLoading(false);
        setNotificationsLoading(false);
        setFraudQueueLoading(false);
      }
    }

    loadRequests();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have permission to access the admin dashboard.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 py-8">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">Review fraud queue and store verification requests</p>
              </div>
            </div>
            <Button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              variant="outline"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          {/* Admin Info */}
          <div className="mb-8 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Logged in as: <span className="font-medium text-foreground">{user.email}</span>
            </p>
          </div>

          {/* Fraud Review Queue */}
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-2xl font-bold">Fraud Review Queue</h2>
            {fraudQueueLoading ? (
              <div className="text-sm text-muted-foreground">Loading fraud queue...</div>
            ) : fraudQueue.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                No pending fraud reviews.
              </div>
            ) : (
              <div className="space-y-3">
                {fraudQueue.map((item) => (
                  <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.stores?.name ?? "Unknown store"}</p>
                        <p className="text-sm text-muted-foreground">
                          Risk score: {item.risk_score} · {new Date(item.created_at).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Flags: {item.fraud_flags.join(", ") || "none"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Notifications */}
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold mb-4">Review Notifications</h2>
            {notificationsLoading ? (
              <div className="text-sm text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground">No review notifications yet.</div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`rounded-lg border p-4 ${notification.is_read ? "border-border bg-background" : "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.stores?.name ?? "Unknown store"} · {new Date(notification.created_at).toLocaleString()}
                        </p>
                        {notification.body && (
                          <p className="mt-2 text-sm">{notification.body}</p>
                        )}
                      </div>
                      {!notification.is_read && (
                        <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-semibold text-white">New</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Store Verification Management */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold mb-6">Store Verification Requests</h2>
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading requests...</div>
              </div>
            ) : (
              <StoreVerificationAdmin requests={requests} />
            )}
          </div>
        </div>
      </main>

    </div>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard · Lokal" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
