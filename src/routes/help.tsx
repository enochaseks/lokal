import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Instagram, MessageCircleHeart } from "lucide-react";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Help Center · Lokal" }] }),
});

function HelpCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
        {icon}
      </div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <MessageCircleHeart className="h-3.5 w-3.5" />
            Help Center
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">Need help reaching us?</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            If you need support with an order, your store listing, or anything on Lokal, contact us directly by email or Instagram.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <HelpCard
            icon={<Mail className="h-5 w-5" />}
            title="Email support"
            description="Best for account help, order issues, store edits, or anything that needs a detailed reply."
          >
            <a
              href="mailto:helplokal@gmail.com"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-warm transition-opacity hover:opacity-95"
            >
              helplokal@gmail.com
            </a>
          </HelpCard>

          <HelpCard
            icon={<Instagram className="h-5 w-5" />}
            title="Instagram"
            description="Best for quick questions and social contact. Message us or tag us and we'll point you in the right direction."
          >
            <a
              href="https://instagram.com/lokaladmin"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              @lokaladmin
            </a>
          </HelpCard>
        </div>

        <div className="mt-10 rounded-2xl border border-border/60 bg-secondary/40 p-6 text-sm leading-relaxed text-muted-foreground">
          For privacy or legal questions, you can also review our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
        </div>
      </main>
      <Footer />
    </div>
  );
}