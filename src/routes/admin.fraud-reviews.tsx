import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, XCircle, Ban, Clock, ChevronDown, Filter } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type FraudReview = {
  id: string;
  risk_score_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  risk_score: number;
  fraud_flags: string[];
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  assigned_to: string | null;
  assigned_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_email?: string;
  store_name?: string;
};

function FraudReviewDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<FraudReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!loading && (!user || !isAdminEmail(user.email))) {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  // Load fraud reviews
  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) return;
    loadReviews();
  }, [user, filterStatus]);

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      let query = (supabase as any)
        .from("fraud_review_queue")
        .select(
          `
          id,
          risk_score_id,
          entity_type,
          entity_id,
          user_id,
          risk_score,
          fraud_flags,
          reason,
          status,
          assigned_to,
          assigned_at,
          reviewed_at,
          created_at
        `,
        )
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with user email and store name
      if (data && data.length > 0) {
        const userIds = Array.from(new Set((data as any[]).map((r) => r.user_id).filter(Boolean)));
        const storeIds = Array.from(
          new Set((data as any[]).map((r) => r.entity_id).filter(Boolean)),
        );

        const [usersResult, storesResult] = await Promise.all([
          userIds.length > 0
            ? (supabase as any).from("auth.users").select("id, email").in("id", userIds)
            : Promise.resolve({ data: [] }),
          storeIds.length > 0
            ? (supabase as any).from("stores").select("id, name").in("id", storeIds)
            : Promise.resolve({ data: [] }),
        ]);

        const userEmailById = (usersResult.data || []).reduce(
          (acc: any, u: any) => ({ ...acc, [u.id]: u.email }),
          {},
        );
        const storeNameById = (storesResult.data || []).reduce(
          (acc: any, s: any) => ({ ...acc, [s.id]: s.name }),
          {},
        );

        const enrichedReviews: FraudReview[] = (data as any[]).map((r) => ({
          ...r,
          user_email: userEmailById[r.user_id],
          store_name: storeNameById[r.entity_id],
        }));

        setReviews(enrichedReviews);
      } else {
        setReviews([]);
      }
    } catch (err: any) {
      toast.error("Failed to load fraud reviews");
      console.error(err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleReviewAction = async (reviewId: string, action: "approve" | "reject" | "block") => {
    setActionLoading(reviewId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fraud-review-action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            review_id: reviewId,
            action,
            admin_id: user?.id,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to process review action");
      }

      toast.success(
        action === "approve"
          ? "Store approved"
          : action === "reject"
            ? "Store rejected"
            : "User blocked",
      );
      loadReviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to process action");
    } finally {
      setActionLoading(null);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return "text-green-600";
    if (score < 60) return "text-amber-600";
    return "text-red-600";
  };

  const getRiskBgColor = (score: number) => {
    if (score < 30) return "bg-green-50";
    if (score < 60) return "bg-amber-50";
    return "bg-red-50";
  };

  const formatFlagName = (flag: string) => {
    return flag.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading || reviewsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Fraud Review Queue</h1>
          <p className="text-muted-foreground">
            Review flagged stores and accounts for suspicious activity
          </p>
        </div>

        {/* Filter */}
        <div className="mb-6 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-lg border border-border bg-secondary/30 p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
              <p className="text-lg font-semibold">No reviews to display</p>
              <p className="text-sm text-muted-foreground mt-1">
                All flagged stores have been reviewed
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className={`rounded-lg border ${getRiskBgColor(review.risk_score)} border-border p-4 transition-all`}
              >
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {review.status === "pending" && <Clock className="h-5 w-5 text-amber-600" />}
                      {review.status === "approved" && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {review.status === "rejected" && <XCircle className="h-5 w-5 text-red-600" />}
                      <div>
                        <h3 className="font-semibold">{review.store_name}</h3>
                        <p className="text-sm text-muted-foreground">{review.user_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-semibold ${getRiskColor(review.risk_score)}`}>
                        Risk Score: {review.risk_score}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                      <span className="capitalize px-2 py-1 bg-background rounded text-xs font-medium">
                        {review.status}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedId === review.id ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {/* Expanded Details */}
                {expandedId === review.id && (
                  <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
                    {/* Fraud Flags */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Fraud Flags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {review.fraud_flags.map((flag) => (
                          <span
                            key={flag}
                            className="text-xs bg-background/60 px-2 py-1 rounded border border-border"
                          >
                            {formatFlagName(flag)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Risk Breakdown */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="rounded bg-background/40 p-2">
                        <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                        <p className={`font-semibold ${getRiskColor(review.risk_score)}`}>
                          {review.risk_score}/100
                        </p>
                      </div>
                      <div className="rounded bg-background/40 p-2">
                        <p className="text-xs text-muted-foreground mb-1">Entity Type</p>
                        <p className="font-semibold capitalize">{review.entity_type}</p>
                      </div>
                      <div className="rounded bg-background/40 p-2">
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <p className="font-semibold capitalize">{review.status}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {review.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleReviewAction(review.id, "approve")}
                          disabled={actionLoading === review.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleReviewAction(review.id, "reject")}
                          disabled={actionLoading === review.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReviewAction(review.id, "block")}
                          disabled={actionLoading === review.id}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Block User
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/fraud-reviews")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw new Error("Not authenticated");
    }
  },
  component: FraudReviewDashboard,
});
