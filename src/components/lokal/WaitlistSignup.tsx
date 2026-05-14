import { useState } from "react";
import { Mail, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitlistSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waitlist-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to join waitlist");
      }

      setStatus("success");
      setMessage("You're on the list! We'll keep you updated.");
      setEmail("");

      setTimeout(() => setStatus("idle"), 5000);
    } catch (error) {
      console.error("Waitlist signup error:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-6 md:p-8">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold">Stay updated</h3>
          <p className="text-sm text-muted-foreground">
            Get notified about launches, new merchants, and early access perks.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="gap-2 whitespace-nowrap"
        >
          {status === "loading" ? (
            <>Loading...</>
          ) : status === "success" ? (
            <>
              <Check className="h-4 w-4" /> Joined
            </>
          ) : (
            <>Join</>
          )}
        </Button>
      </form>

      {status === "error" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}

      {status === "success" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}
    </div>
  );
}
