import { useEffect, useState } from "react";
import { BadgeCheck, Check, X, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type VerificationRequest = {
  id: string;
  store_id: string;
  store_name: string;
  owner_name: string;
  business_name: string;
  verification_method?: "registration_number" | "online_presence" | "manual_review";
  online_presence_url?: string | null;
  business_registration_number?: string;
  manual_review_details?: string | null;
  supporting_links?: string | null;
  submission_reason?: string;
  submitted_at: string;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
};

export function StoreVerificationAdmin({
  requests,
}: {
  requests: VerificationRequest[];
}) {
  const [localRequests, setLocalRequests] = useState<VerificationRequest[]>(requests);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );

  useEffect(() => {
    setLocalRequests(requests);
  }, [requests]);

  const filtered = localRequests.filter(
    (r) => filter === "all" || r.status === filter
  );

  const handleApprove = async (request: VerificationRequest) => {
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("process-verification-request", {
        body: {
          request_id: request.id,
          action: "approve",
          admin_notes: adminNotes,
        },
      });

      if (error) throw error;

      setLocalRequests((prev) => prev.map((item) =>
        item.id === request.id
          ? { ...item, status: "approved", admin_notes: adminNotes || null }
          : item
      ));

      toast.success(`✅ ${request.store_name} verified and approved!`);
      setSelectedId(null);
      setAdminNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async (request: VerificationRequest) => {
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("process-verification-request", {
        body: {
          request_id: request.id,
          action: "reject",
          admin_notes: adminNotes,
        },
      });

      if (error) throw error;

      setLocalRequests((prev) => prev.map((item) =>
        item.id === request.id
          ? { ...item, status: "rejected", admin_notes: adminNotes }
          : item
      ));

      toast.success(`❌ Application rejected and notes saved`);
      setSelectedId(null);
      setAdminNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="capitalize"
          >
            {f}
            {f !== "all" && (
              <span className="ml-2 text-xs">
                {requests.filter((r) => r.status === f).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Store Name</th>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No {filter !== "all" ? filter : ""} verification requests
                  </td>
                </tr>
              ) : (
                filtered.map((request) => (
                  <tr key={request.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{request.store_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {request.owner_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          request.status === "approved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : request.status === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {request.status === "approved" && (
                          <Check className="h-3 w-3" />
                        )}
                        {request.status === "rejected" && (
                          <X className="h-3 w-3" />
                        )}
                        {request.status === "pending" && (
                          <Eye className="h-3 w-3" />
                        )}
                        <span className="capitalize">{request.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(request.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        onClick={() => {
                          setSelectedId(request.id);
                          setAdminNotes(request.admin_notes || "");
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg bg-card p-6 shadow-lg">
            {(() => {
              const request = localRequests.find((r) => r.id === selectedId);
              if (!request) return null;

              return (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">Review Request</h2>

                  <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
                    <p>
                      <span className="font-medium">Store:</span> {request.store_name}
                    </p>
                    <p>
                      <span className="font-medium">Owner:</span>{" "}
                      {request.owner_name}
                    </p>
                    <p>
                      <span className="font-medium">Business Name:</span>{" "}
                      {request.business_name}
                    </p>
                    {request.verification_method && (
                      <p>
                        <span className="font-medium">Verification Route:</span>{" "}
                        {request.verification_method === "registration_number"
                          ? "Registered business"
                          : request.verification_method === "online_presence"
                            ? "Online business / social storefront"
                            : "Manual review"}
                      </p>
                    )}
                    {request.verification_method === "manual_review" && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                        Manual review is the highest-risk route. Check more carefully for identity proof, consistent contact details, reviews, and external presence before approving.
                      </div>
                    )}
                    {request.business_registration_number && (
                      <p>
                        <span className="font-medium">Registration:</span>{" "}
                        {request.business_registration_number}
                      </p>
                    )}
                    {request.online_presence_url && (
                      <p>
                        <span className="font-medium">Online Presence:</span>{" "}
                        <a href={request.online_presence_url} target="_blank" rel="noreferrer" className="underline">
                          {request.online_presence_url}
                        </a>
                      </p>
                    )}
                    {request.manual_review_details && (
                      <div>
                        <p className="font-medium mb-1">Manual Review Details:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {request.manual_review_details}
                        </p>
                      </div>
                    )}
                    {request.supporting_links && (
                      <p>
                        <span className="font-medium">Supporting Links:</span>{" "}
                        {request.supporting_links}
                      </p>
                    )}
                    {request.submission_reason && (
                      <div>
                        <p className="font-medium mb-1">Reason:</p>
                        <p className="text-sm text-muted-foreground">
                          {request.submission_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Notes</label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Enter review notes..."
                      className="h-20"
                    />
                  </div>

                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(request)}
                        disabled={updating}
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {updating && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(request)}
                        disabled={updating}
                        variant="destructive"
                        className="flex-1 gap-2"
                      >
                        {updating && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Reject
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      setSelectedId(null);
                      setAdminNotes("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Total requests: {filtered.length} of {requests.length}
      </div>
    </div>
  );
}
