import { Users, Heart, TrendingUp } from "lucide-react";

const benefits = [
  {
    icon: Heart,
    title: "Support your community",
    description:
      "Keep money circulating within African and Caribbean communities. Shop at independent businesses that understand your culture.",
  },
  {
    icon: Users,
    title: "Direct relationships",
    description:
      "No algorithms, no data brokers. Connect directly with merchants and build real relationships based on trust.",
  },
  {
    icon: TrendingUp,
    title: "Help businesses thrive",
    description:
      "By shopping on Lokal, you're helping independent stores access customers without expensive franchises or corporate middlemen.",
  },
];

export function WhyLokal() {
  return (
    <section className="border-y border-border/60 py-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Why Lokal
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl text-balance">
            Helping African & Caribbean businesses{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              thrive digitally.
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            The corner shop, the auntie's kitchen, the seamstress on the high street — they're too
            important to disappear.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="text-center">
                <Icon className="h-5 w-5 text-primary mx-auto mb-3" />
                <h3 className="font-display text-base font-bold">{benefit.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
