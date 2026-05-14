import { Search, MessageCircle, Landmark } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Discover nearby",
    text: "Browse African & Caribbean stores in your area and filter by the live categories.",
  },
  {
    icon: MessageCircle,
    title: "Arrange with merchant",
    text: "Pick your items and share your details — the merchant confirms pickup or delivery.",
  },
  {
    icon: Landmark,
    title: "Pay by bank transfer",
    text: "No card fees, no middleman. Send the exact amount with your unique reference.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 py-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            How Lokal works
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl text-balance">
            Three steps from craving to{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">collection.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {steps.map((s) => (
            <div
              key={s.title}
              className="flex flex-col items-center text-center p-6 rounded-2xl border border-border/60 bg-card"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
