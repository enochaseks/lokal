import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Store = {
  id: string;
  name: string;
};

type VerificationMethod = "registration_number" | "online_presence" | "manual_review";

type VerificationRequestDialogProps = {
  store: Store;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function VerificationRequestDialog({
  store,
  open,
  onOpenChange,
  onSuccess,
}: VerificationRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: store.name,
    verificationMethod: "online_presence" as VerificationMethod,
    businessRegistrationNumber: "",
    onlinePresenceUrl: "",
    ownerName: "",
    submissionReason: "",
    manualReviewDetails: "",
    supportingLinks: "",
  });

  const formatSubmitReason = () => {
    const pieces = [
      formData.submissionReason.trim(),
      formData.verificationMethod === "manual_review" && formData.manualReviewDetails.trim()
        ? `Manual review details:\n${formData.manualReviewDetails.trim()}`
        : null,
      formData.supportingLinks.trim() ? `Supporting links: ${formData.supportingLinks.trim()}` : null,
    ].filter(Boolean);

    return pieces.join("\n\n");
  };

  const formatFallbackReason = () => {
    const routeLabel =
      formData.verificationMethod === "registration_number"
        ? "registered business"
        : formData.verificationMethod === "online_presence"
          ? "online business / social storefront"
          : "manual review";

    const details = formatSubmitReason();
    return `[Verification route: ${routeLabel}]${details ? `\n\n${details}` : ""}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.verificationMethod === "registration_number" && !formData.businessRegistrationNumber.trim()) {
      toast.error("Please enter your business registration number or choose another verification route.");
      return;
    }

    if (formData.verificationMethod === "online_presence" && !formData.onlinePresenceUrl.trim()) {
      toast.error("Please add your website, Instagram, TikTok, Etsy, or other online storefront link.");
      return;
    }

    if (formData.verificationMethod === "manual_review" && formData.submissionReason.trim().length < 30) {
      toast.error("Tell us more about your business so we can manually review it safely.");
      return;
    }

    if (formData.verificationMethod === "manual_review" && formData.manualReviewDetails.trim().length < 80) {
      toast.error("Manual review needs a more detailed explanation, please add at least 80 characters.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const ownerId = authData.user?.id;
      if (!ownerId) throw new Error("You must be signed in to submit verification.");

      const { error } = await supabase
        .from("store_verification_requests")
        .insert({
          store_id: store.id,
          owner_id: ownerId,
          business_name: formData.businessName,
          verification_method: formData.verificationMethod,
          business_registration_number: formData.businessRegistrationNumber,
          online_presence_url: formData.onlinePresenceUrl || null,
          manual_review_details: formData.manualReviewDetails || null,
          supporting_links: formData.supportingLinks || null,
          owner_name: formData.ownerName,
          submission_reason: formatSubmitReason(),
        });

      const submitReason = formatSubmitReason();

      if (error) {
        const message = String((error as { message?: string }).message ?? error);
        const fallbackNeeded = /column|constraint|verification_method|online_presence_url|manual_review_details|supporting_links/i.test(message);
        if (fallbackNeeded) {
          const { error: fallbackError } = await supabase
            .from("store_verification_requests")
            .insert({
              store_id: store.id,
              owner_id: ownerId,
              business_name: formData.businessName,
              business_registration_number: formData.businessRegistrationNumber || null,
              owner_name: formData.ownerName,
              submission_reason: formatFallbackReason(),
            });

          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      void supabase.functions.invoke("send-verification-alert", {
        body: {
          store_id: store.id,
          store_name: store.name,
          business_name: formData.businessName,
          owner_name: formData.ownerName,
          verification_method: formData.verificationMethod,
          submission_reason: submitReason,
          requester_email: authData.user?.email ?? null,
        },
      }).then(({ error: fnError }) => {
        if (fnError) {
          console.error("send-verification-alert failed", fnError.message);
        }
      });

      toast.success("✅ Verification request submitted! Our team will review it within 2-3 business days.");
      setFormData({
        businessName: store.name,
        verificationMethod: "online_presence",
        businessRegistrationNumber: "",
        onlinePresenceUrl: "",
        ownerName: "",
        submissionReason: "",
        manualReviewDetails: "",
        supportingLinks: "",
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message?: string }).message)
            : String(err ?? "Failed to submit request");
      toast.error(message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Store Verification</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) =>
                setFormData({ ...formData, businessName: e.target.value })
              }
              placeholder="Your business name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Owner Name *</Label>
            <Input
              id="ownerName"
              value={formData.ownerName}
              onChange={(e) =>
                setFormData({ ...formData, ownerName: e.target.value })
              }
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verificationMethod">Business Type / Verification Route *</Label>
            <Select
              value={formData.verificationMethod}
              onValueChange={(value: VerificationMethod) =>
                setFormData({ ...formData, verificationMethod: value })
              }
            >
              <SelectTrigger id="verificationMethod">
                <SelectValue placeholder="Select verification route" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online_presence">Online business / social storefront</SelectItem>
                <SelectItem value="registration_number">Registered business</SelectItem>
                <SelectItem value="manual_review">Manual review (no formal docs yet)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Registered business is strongest. Online verified needs a live storefront or profile. Manual review is the highest-risk route and is checked more strictly.
            </p>
          </div>

          {formData.verificationMethod === "registration_number" && (
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Business Registration Number *</Label>
              <Input
                id="registrationNumber"
                value={formData.businessRegistrationNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    businessRegistrationNumber: e.target.value,
                  })
                }
                placeholder="e.g., Company registration number"
              />
              <p className="text-xs text-muted-foreground">
                Required for registered businesses.
              </p>
            </div>
          )}

          {formData.verificationMethod === "online_presence" && (
            <div className="space-y-2">
              <Label htmlFor="onlinePresenceUrl">Online Presence URL *</Label>
              <Input
                id="onlinePresenceUrl"
                value={formData.onlinePresenceUrl}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    onlinePresenceUrl: e.target.value,
                  })
                }
                placeholder="e.g., Instagram profile, TikTok page, website, Etsy store"
              />
              <p className="text-xs text-muted-foreground">
                Required for online verification. Add a website, Instagram, TikTok, Etsy, or similar storefront.
              </p>
            </div>
          )}

          {formData.verificationMethod === "manual_review" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="manualReviewDetails">Manual Review Details *</Label>
                <Textarea
                  id="manualReviewDetails"
                  value={formData.manualReviewDetails}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      manualReviewDetails: e.target.value,
                    })
                  }
                  placeholder="Explain what you sell, how you take orders, how long you've been operating, how customers can contact you, and any proof that you are a real business."
                  className="h-28"
                />
                <p className="text-xs text-muted-foreground">
                  Manual review is the riskiest route. Add as much real-world detail as possible.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supportingLinks">Supporting Links or References</Label>
                <Input
                  id="supportingLinks"
                  value={formData.supportingLinks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supportingLinks: e.target.value,
                    })
                  }
                  placeholder="e.g., Instagram, TikTok, WhatsApp catalog, customer reviews, website, references"
                />
                <p className="text-xs text-muted-foreground">
                  Optional, but very helpful for manual review.
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Why should your store be verified?</Label>
            <Textarea
              id="reason"
              value={formData.submissionReason}
              onChange={(e) =>
                setFormData({ ...formData, submissionReason: e.target.value })
              }
              placeholder="Tell us about your business, years in operation, customer reviews, social proof, shipping history, etc."
              className="h-24"
            />
            <p className="text-xs text-muted-foreground">
              Manual review needs extra detail. The more evidence you give, the safer the approval.
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/30 dark:text-blue-300">
            💡 Verified stores display a trust badge on their profile. Our team reviews applications within 2-3 business days.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
