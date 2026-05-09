import { Users, Heart, TrendingUp } from "lucide-react";

const benefits = [
  {
    icon: Heart,
    title: "Support your community",
    description: "Keep money circulating within African and Caribbean communities. Shop at independent businesses that understand your culture.",
  },
  {
    icon: Users,
    title: "Direct relationships",
    description: "No algorithms, no data brokers. Connect directly with merchants and build real relationships based on trust.",
  },
  {
    icon: TrendingUp,
    title: "Help businesses thrive",
    description: "By shopping on Lokal, you're helping independent stores access customers without expensive franchises or corporate middlemen.",
  },
];

export function WhyLokal() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Why Lokal</span>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl text-balance">
            Helping African & Caribbean businesses <span className="bg-gradient-primary bg-clip-text text-transparent">thrive digitally.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            The corner shop, the auntie's kitchen, the seamstress on the high street — they're too important to disappear.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-primary/10 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-bold">{benefit.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 max-w-2xl mx-auto rounded-2xl border border-border/60 bg-card p-8 text-center">
          <p className="text-muted-foreground italic">
            "Lokal exists because every diaspora family deserves to find and support their community without friction. We're building infrastructure for independence, not extraction."
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">— The Lokal team</p>
        </div>
      </div>
    </section>
  );
}
