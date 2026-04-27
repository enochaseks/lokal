import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, MapPin, Clock, Phone, Landmark, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Store } from "@/data/stores";

export function StoreDialog({ store, open, onOpenChange }: { store: Store | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<"browse" | "arrange" | "transfer">("browse");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [reference] = useState(() => "LKL-" + Math.random().toString(36).slice(2, 7).toUpperCase());
  const [copied, setCopied] = useState<string | null>(null);

  if (!store) return null;

  const items = store.products.map((p) => ({ ...p, qty: qty[p.name] ?? 0 }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasItems = total > 0;

  const reset = () => {
    setStep("browse");
    setQty({});
    setName("");
    setPhone("");
    setNote("");
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <div className="relative h-56 overflow-hidden rounded-t-lg">
          <img src={store.image} alt={store.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.origin}</span>
              <span className="rounded-full bg-background/90 px-2.5 py-1 font-medium backdrop-blur">{store.category}</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-3xl">{store.name}</DialogTitle>
            <DialogDescription className="text-base">{store.description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-4">
            <div className="flex items-center gap-2"><Star className="h-4 w-4 fill-primary text-primary" /><span><strong>{store.rating}</strong> · {store.reviews}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span>{store.distance}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="truncate">{store.hours}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="truncate">{store.phone}</span></div>
          </div>

          {step === "browse" && (
            <>
              <h4 className="mt-6 font-display text-xl font-bold">Available products</h4>
              <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                {store.products.map((p) => {
                  const q = qty[p.name] ?? 0;
                  return (
                    <div key={p.name} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-muted-foreground">£{p.price.toFixed(2)}{p.unit ? ` / ${p.unit}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: Math.max(0, q - 1) })}>−</Button>
                        <span className="w-6 text-center font-semibold">{q}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty({ ...qty, [p.name]: q + 1 })}>+</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="font-display text-2xl font-bold">£{total.toFixed(2)}</div>
                </div>
                <Button
                  size="lg"
                  disabled={!hasItems}
                  onClick={() => setStep("arrange")}
                  className="bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                >
                  Arrange order →
                </Button>
              </div>
            </>
          )}

          {step === "arrange" && (
            <>
              <button onClick={() => setStep("browse")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back to products
              </button>
              <h4 className="mt-2 font-display text-xl font-bold">Your details</h4>
              <p className="text-sm text-muted-foreground">The merchant will message you to confirm pickup or local delivery.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama Boateng" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 ..." className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Note for merchant (optional)</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pickup tomorrow around 5pm?" className="mt-1" />
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm">
                <div className="mb-2 font-semibold">Order summary</div>
                {items.filter((i) => i.qty > 0).map((i) => (
                  <div key={i.name} className="flex justify-between text-muted-foreground">
                    <span>{i.qty} × {i.name}</span>
                    <span>£{(i.price * i.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span><span>£{total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                disabled={!name || !phone}
                onClick={() => setStep("transfer")}
              >
                Continue to bank transfer
              </Button>
            </>
          )}

          {step === "transfer" && (
            <>
              <button onClick={() => setStep("arrange")} className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <div className="mt-3 rounded-2xl border-2 border-primary/30 bg-gradient-soft p-6 shadow-card">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <Landmark className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Bank transfer only</span>
                </div>
                <h4 className="font-display text-2xl font-bold">Send £{total.toFixed(2)} to {store.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lokal connects you directly with the merchant — no card fees, no middleman. Use the reference below so they can match your order instantly.
                </p>

                <div className="mt-5 space-y-2">
                  {[
                    { label: "Bank", value: store.bank.name },
                    { label: "Account name", value: store.bank.accountName },
                    { label: "Account number", value: store.bank.accountNumber },
                    ...(store.bank.sortCode ? [{ label: "Sort code", value: store.bank.sortCode }] : []),
                    { label: "Reference", value: reference },
                    { label: "Amount", value: `£${total.toFixed(2)}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg bg-card px-4 py-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                        <div className="font-mono font-semibold">{row.value}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copy(row.label, row.value)} className="gap-1.5">
                        {copied === row.label ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                        {copied === row.label ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="mt-5 w-full bg-gradient-primary text-primary-foreground shadow-warm hover:opacity-95"
                onClick={() => {
                  toast.success("Order sent to merchant", { description: `${store.name} will confirm your transfer shortly.` });
                  onOpenChange(false);
                  setTimeout(reset, 200);
                }}
              >
                I've made the transfer
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
