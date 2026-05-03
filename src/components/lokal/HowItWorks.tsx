import { Search, MessageCircle, Landmark } from "lucide-react";

const steps = [
  { icon: Search, title: "Discover nearby", text: "Browse African & Caribbean stores in your area and filter by the live categories." },
  { icon: MessageCircle, title: "Arrange with merchant", text: "Pick your items and share your details — the merchant confirms pickup or delivery." },
  { icon: Landmark, title: "Pay by bank transfer", text: "No card fees, no middleman. Send the exact amount with your unique reference." },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 bg-gradient-soft py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">How Lokal works</span>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl text-balance">
            Three steps from craving to <span className="bg-gradient-primary bg-clip-text text-transparent">collection.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border/60 bg-card p-7 shadow-card transition-shadow hover:shadow-warm">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-warm">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="absolute right-6 top-6 font-display text-5xl font-bold text-primary/10">0{i + 1}</div>
              <h3 className="font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
