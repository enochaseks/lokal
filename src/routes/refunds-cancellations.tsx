import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

export const Route = createFileRoute("/refunds-cancellations")({
  component: RefundsAndCancellationsPage,
  head: () => ({ meta: [{ title: "Refund & Cancellation · Lokal" }] }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function RefundsAndCancellationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold">Refund & Cancellation</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
        </div>

        <div className="space-y-10">
          <Section title="How Refunds Work on Lokal">
            <p>
              Lokal is a marketplace platform. Payments are made directly to the merchant by bank
              transfer. Because Lokal does not hold customer funds, Lokal does not issue refunds.
            </p>
            <p>
              Any refund request must be resolved directly between the customer and the merchant
              according to the policy shown on that merchant&apos;s store profile.
            </p>
          </Section>

          <Section title="How Cancellations Work">
            <p>
              Booking or order cancellations are governed by each merchant&apos;s own cancellation
              policy. Customers should review these terms before placing an order or requesting a
              booking.
            </p>
            <p>
              For services/bookings on Lokal, online customer cancellation is available up to 12
              hours before the appointment start time. Within 12 hours, online cancellation is
              closed and customers should contact the merchant directly.
            </p>
            <p>
              For product orders, customers can cancel online while the order is still in
              <strong> pending transfer</strong> status. Once payment has been marked received or
              the order has moved to preparation/ready/completed, cancellation requests must be
              handled directly with the merchant under that store&apos;s policy.
            </p>
            <p>
              If a cancellation dispute arises, the customer and merchant must resolve it directly.
              Lokal can provide platform support in good faith but cannot enforce a payout or
              refund.
            </p>
          </Section>

          <Section title="Cancellation Policy Checklist">
            <p>
              Before confirming an order or booking, customers should check each store&apos;s profile
              for:
            </p>
            <p>
              1) Cancellation deadlines
              <br />
              2) Whether deposits are refundable
              <br />
              3) No-show rules
              <br />
              4) Reschedule terms
            </p>
          </Section>

          <Section title="Merchant Responsibility">
            <p>
              Merchants are responsible for clearly publishing their refund and cancellation terms
              and for handling customer requests fairly and in line with applicable law.
            </p>
          </Section>

          <Section title="Need Support?">
            <p>
              If you need help contacting the other party, reach us via the{" "}
              <Link to="/help" className="text-primary hover:underline">
                Help Center
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
