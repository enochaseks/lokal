import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isBodyContactService } from "@/lib/utils";

type Store = {
  id: string;
  name: string;
  category?: string;
  subcategory?: string | null;
  minimum_age?: number | null;
  tattoo_portfolio_url?: string | null;
  tattoo_license_url?: string | null;
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
  const isBodyArtsArtistStore = isBodyContactService(store.category, store.subcategory);
  const bodyArtsLabel = store.subcategory || "Body Arts artist";
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
    tattooMinimumAge: store.minimum_age ?? 18,
    tattooPortfolioUrl: store.tattoo_portfolio_url ?? "",
    tattooLicenseUrl: store.tattoo_license_url ?? "",
    tattooAgeRestrictionAcknowledged: false,
  });

  const formatSubmitReason = () => {
    const pieces = [
      formData.submissionReason.trim(),
      formData.verificationMethod === "manual_review" && formData.manualReviewDetails.trim()
        ? `Manual review details:\n${formData.manualReviewDetails.trim()}`
        : null,
      formData.supportingLinks.trim()
        ? `Supporting links: ${formData.supportingLinks.trim()}`
        : null,
      isBodyArtsArtistStore
        ? `${bodyArtsLabel} verification details:\nMinimum age: ${formData.tattooMinimumAge}\nPortfolio: ${formData.tattooPortfolioUrl.trim() || "Not provided"}\nLicence/ID: ${formData.tattooLicenseUrl.trim() || "Not provided"}\nAge restriction acknowledged: ${formData.tattooAgeRestrictionAcknowledged ? "Yes" : "No"}`
        : null,
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

    if (
      formData.verificationMethod === "registration_number" &&
      !formData.businessRegistrationNumber.trim()
    ) {
      toast.error(
        "Please enter your business registration number or choose another verification route.",
      );
      return;
    }

    if (formData.verificationMethod === "online_presence" && !formData.onlinePresenceUrl.trim()) {
      toast.error(
        "Please add your website, Instagram, TikTok, Etsy, or other online storefront link.",
      );
      return;
    }

    if (
      formData.verificationMethod === "manual_review" &&
      formData.submissionReason.trim().length < 30
    ) {
      toast.error("Tell us more about your business so we can manually review it safely.");
      return;
    }

    if (
      formData.verificationMethod === "manual_review" &&
      formData.manualReviewDetails.trim().length < 80
    ) {
      toast.error(
        "Manual review needs a more detailed explanation, please add at least 80 characters.",
      );
      return;
    }

    if (isBodyArtsArtistStore) {
      if (!formData.tattooPortfolioUrl.trim()) {
        toast.error(`${bodyArtsLabel} portfolio URL is required for artist verification.`);
        return;
      }
      if (!formData.tattooLicenseUrl.trim()) {
        toast.error(`${bodyArtsLabel} licence/ID URL is required for artist verification.`);
        return;
      }
      if (formData.tattooMinimumAge < 18) {
        toast.error(`${bodyArtsLabel} minimum age must be 18 or older.`);
        return;
      }
      if (!formData.tattooAgeRestrictionAcknowledged) {
        toast.error(
          "Please confirm your services enforce the age restriction and in-person ID checks.",
        );
        return;
      }
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const ownerId = authData.user?.id;
      if (!ownerId) throw new Error("You must be signed in to submit verification.");

      const { error } = await supabase.from("store_verification_requests").insert({
        store_id: store.id,
        owner_id: ownerId,
        business_name: formData.businessName,
        verification_method: formData.verificationMethod,
        business_registration_number: formData.businessRegistrationNumber,
        online_presence_url: formData.onlinePresenceUrl || null,
        manual_review_details: formData.manualReviewDetails || null,
        supporting_links: formData.supportingLinks || null,
        is_tattoo_verification: isBodyArtsArtistStore,
        tattoo_minimum_age: isBodyArtsArtistStore ? formData.tattooMinimumAge : null,
        tattoo_portfolio_url: isBodyArtsArtistStore ? formData.tattooPortfolioUrl || null : null,
        tattoo_license_url: isBodyArtsArtistStore ? formData.tattooLicenseUrl || null : null,
        tattoo_age_restriction_acknowledged: isBodyArtsArtistStore
          ? formData.tattooAgeRestrictionAcknowledged
          : null,
        owner_name: formData.ownerName,
        submission_reason: formatSubmitReason(),
      });

      const submitReason = formatSubmitReason();

      if (error) {
        const message = String((error as { message?: string }).message ?? error);
        // Only fallback for legacy schema mismatch (missing columns), never for constraint/validation errors.
        const fallbackNeeded =
          /column .* does not exist|could not find the .* column|schema cache|unknown column|pgrst/i.test(
            message,
          );
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

      void supabase.functions
        .invoke("send-verification-alert", {
          body: {
            store_id: store.id,
            store_name: store.name,
            business_name: formData.businessName,
            owner_name: formData.ownerName,
            verification_method: formData.verificationMethod,
            submission_reason: submitReason,
            requester_email: authData.user?.email ?? null,
            is_tattoo_verification: isBodyArtsArtistStore,
            tattoo_minimum_age: isBodyArtsArtistStore ? formData.tattooMinimumAge : null,
            tattoo_portfolio_url: isBodyArtsArtistStore
              ? formData.tattooPortfolioUrl || null
              : null,
            tattoo_license_url: isBodyArtsArtistStore ? formData.tattooLicenseUrl || null : null,
            tattoo_age_restriction_acknowledged: isBodyArtsArtistStore
              ? formData.tattooAgeRestrictionAcknowledged
              : null,
          },
        })
        .then(({ error: fnError }) => {
          if (fnError) {
            console.error("send-verification-alert failed", fnError.message);
          }
        });

      toast.success(
        "✅ Verification request submitted! Our team will review it within 2-3 business days.",
      );
      setFormData({
        businessName: store.name,
        verificationMethod: "online_presence",
        businessRegistrationNumber: "",
        onlinePresenceUrl: "",
        ownerName: "",
        submissionReason: "",
        manualReviewDetails: "",
        supportingLinks: "",
        tattooMinimumAge: store.minimum_age ?? 18,
        tattooPortfolioUrl: store.tattoo_portfolio_url ?? "",
        tattooLicenseUrl: store.tattoo_license_url ?? "",
        tattooAgeRestrictionAcknowledged: false,
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
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="Your business name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Owner Name *</Label>
            <Input
              id="ownerName"
              value={formData.ownerName}
              onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          {isBodyArtsArtistStore && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                {bodyArtsLabel} verification requirements
              </p>
              <div className="space-y-2">
                <Label htmlFor="tattooMinimumAge">Minimum age restriction *</Label>
                <Input
                  id="tattooMinimumAge"
                  type="number"
                  min={18}
                  max={99}
                  value={formData.tattooMinimumAge}
                  onChange={(e) =>
                    setFormData({ ...formData, tattooMinimumAge: Number(e.target.value || 18) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tattooPortfolioUrl">Portfolio URL *</Label>
                <Input
                  id="tattooPortfolioUrl"
                  value={formData.tattooPortfolioUrl}
                  onChange={(e) => setFormData({ ...formData, tattooPortfolioUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tattooLicenseUrl">Licence / ID URL *</Label>
                <Input
                  id="tattooLicenseUrl"
                  value={formData.tattooLicenseUrl}
                  onChange={(e) => setFormData({ ...formData, tattooLicenseUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={formData.tattooAgeRestrictionAcknowledged}
                  onChange={(e) =>
                    setFormData({ ...formData, tattooAgeRestrictionAcknowledged: e.target.checked })
                  }
                />
                <span>
                  I confirm these services are restricted to eligible adults and in-person ID checks
                  are enforced.
                </span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="verificationMethod">
              {isBodyArtsArtistStore
                ? "Body Arts Artist Verification Route *"
                : "Business Type / Verification Route *"}
            </Label>
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
              {isBodyArtsArtistStore
                ? "For Body Arts services, your portfolio, licence/ID evidence, and 18+ policy are mandatory for artist verification."
                : "Registered business is strongest. Online verified needs a live storefront or profile. Manual review is the highest-risk route and is checked more strictly."}
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
              <p className="text-xs text-muted-foreground">Required for registered businesses.</p>
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
                Required for online verification. Add a website, Instagram, TikTok, Etsy, or similar
                storefront.
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
              onChange={(e) => setFormData({ ...formData, submissionReason: e.target.value })}
              placeholder="Tell us about your business, years in operation, customer reviews, social proof, shipping history, etc."
              className="h-24"
            />
            <p className="text-xs text-muted-foreground">
              Manual review needs extra detail. The more evidence you give, the safer the approval.
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/30 dark:text-blue-300">
            💡 Verified stores display a trust badge on their profile. Our team reviews applications
            within 2-3 business days.
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
