import { BadgeCheck } from "lucide-react";
import { AlertTriangle } from "lucide-react";

export function VerificationBadge({
  verificationTier,
  verificationReason,
  showUnverified,
}: {
  verificationTier?: "verified" | "online_verified" | "unsecured_verified" | null;
  verificationReason?: string | null;
  showUnverified?: boolean;
}) {
  if (!verificationTier && !showUnverified) return null;

  if (!verificationTier && showUnverified) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
        title={verificationReason || "Unverified store. Buy at your own risk."}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>Unverified</span>
      </div>
    );
  }

  const label =
    verificationTier === "online_verified"
      ? "Online verified"
      : verificationTier === "unsecured_verified"
        ? "Unsecured verified"
        : "Verified";

  const toneClass =
    verificationTier === "verified"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : verificationTier === "online_verified"
        ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneClass}`}
      title={verificationReason || "Verified store"}
    >
      <BadgeCheck className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
