import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({ meta: [{ title: "Terms of Service · Lokal" }] }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
        </div>

        <div className="space-y-10">
          <Section title="1. About Lokal">
            <p>
              These Terms govern your use of{" "}
              <strong className="text-foreground">lokalshops.co.uk</strong> ("Lokal", "we", "us").
              Lokal is a marketplace platform that connects customers with independent African and
              Caribbean stores. By using the platform you agree to these Terms.
            </p>
            <p>
              Lokal acts as a <strong className="text-foreground">technology platform only</strong>.
              We are not a party to any transaction between a customer and a merchant. The contract
              for goods or services is formed directly between the customer and the merchant.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old to use Lokal. By using the platform you confirm that
              you meet this requirement.
            </p>
          </Section>

          <Section title="3. Customer terms">
            <p>When placing an order through Lokal you agree that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You will only use the reservation system to make genuine enquiries and orders.
              </li>
              <li>
                Payment is made directly to the merchant by bank transfer. Lokal does not handle or
                hold your money.
              </li>
              <li>
                Orders are reservations — the merchant will confirm availability and provide payment
                details.
              </li>
              <li>
                Refunds and cancellation outcomes are set by the merchant's policy and must be
                resolved directly with the merchant.
              </li>
              <li>
                Disputes about goods, quality, or fulfilment are between you and the merchant. Lokal
                will assist in good faith but is not liable for merchant actions.
              </li>
              <li>
                You provide accurate contact information (name, phone, email) so the merchant can
                reach you.
              </li>
            </ul>
          </Section>

          <Section title="4. Merchant terms">
            <p>By listing a store on Lokal you agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate information about your store, products, and pricing.</li>
              <li>Honour orders that you accept and keep your store listing up to date.</li>
              <li>
                Comply with all applicable UK laws including consumer protection, food safety (if
                applicable), and anti-money-laundering regulations.
              </li>
              <li>Not list counterfeit, prohibited, or illegal goods.</li>
              <li>
                Ensure your bank details are correct — Lokal is not responsible for misdirected
                payments caused by incorrect details.
              </li>
              <li>Notify Lokal if you cease trading so your listing can be removed promptly.</li>
            </ul>
            <p>
              Lokal reserves the right to remove any store listing at its discretion, including for
              violations of these Terms or customer complaints.
            </p>
          </Section>

          <Section title="5. Payments">
            <p>
              All payments are made directly between customers and merchants via bank transfer.
              Lokal does not process, hold, or facilitate any monetary transactions. Lokal accepts
              no responsibility for failed, incorrect, or disputed bank transfers.
            </p>
            <p>
              Lokal does not decide or process refunds and cannot reverse transfers. Refund and
              cancellation requests must be handled directly with the merchant according to the
              merchant's stated policy.
            </p>
            <p>
              Listing on Lokal is currently <strong className="text-foreground">free</strong>. We
              reserve the right to introduce fees in future with reasonable notice to merchants.
            </p>
          </Section>

          <Section title="6. Verification and badges">
            <p>
              Lokal offers optional store verification. Merchants may submit verification requests
              using one of three methods: business registration documents, online presence proof, or
              manual submission. Our admin team reviews submissions and approves or rejects based on
              available evidence.
            </p>
            <p>Verified stores display blue verification badges:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">Verified</strong> — verified with official
                business registration documents.
              </li>
              <li>
                <strong className="text-foreground">Online verified</strong> — verified via
                established online presence (website, social media, etc).
              </li>
              <li>
                <strong className="text-foreground">Unsecured verified</strong> — verified via
                manual submission with limited supporting evidence.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Important:</strong> Verification badges indicate
              that we have reviewed available evidence at a point in time. Badges do not guarantee
              product quality, customer satisfaction, or merchant reliability. All transactions
              remain at customer discretion. Unverified stores are not inherently unsafe — merchants
              may choose not to verify. Always review store policies, ratings, and contact details
              before ordering.
            </p>
          </Section>

          <Section title="7. Intellectual property">
            <p>
              The Lokal name, logo, and platform design are owned by Lokal. Merchants retain
              ownership of their store content (descriptions, photos) but grant Lokal a licence to
              display it on the platform.
            </p>
          </Section>

          <Section title="8. Limitation of liability">
            <p>To the maximum extent permitted by UK law, Lokal is not liable for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Loss or damage arising from transactions between customers and merchants.</li>
              <li>Inaccurate store information provided by merchants.</li>
              <li>Platform downtime or technical failures.</li>
              <li>Any indirect, consequential, or economic loss.</li>
            </ul>
            <p>
              Nothing in these Terms limits liability for death or personal injury caused by
              negligence, or for fraud or fraudulent misrepresentation.
            </p>
          </Section>

          <Section title="9. Acceptable use">
            <p>You must not use Lokal to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Submit false, misleading, or fraudulent orders or listings.</li>
              <li>Harass, abuse, or harm other users or merchants.</li>
              <li>Attempt to gain unauthorised access to the platform or other users' accounts.</li>
              <li>Scrape, copy, or republish platform content without permission.</li>
            </ul>
          </Section>

          <Section title="10. Termination">
            <p>
              We may suspend or terminate your access to Lokal at any time for breaches of these
              Terms or for any other reason at our discretion. Merchants may remove their listing at
              any time through the merchant dashboard. You may permanently delete your account and
              all associated data at any time via the{" "}
              <strong className="text-foreground">Delete my account</strong> option in the merchant
              dashboard. Existing order records are retained for 12 months after deletion in
              accordance with our Privacy Policy.
            </p>
          </Section>

          <Section title="11. Governing law">
            <p>
              These Terms are governed by the laws of{" "}
              <strong className="text-foreground">England and Wales</strong>. Any disputes will be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              For any questions about these Terms, contact us at{" "}
              <strong className="text-foreground">helplokal@gmail.com</strong>.
            </p>
          </Section>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          See also our{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/refunds-cancellations" className="text-primary hover:underline">
            Refund &amp; Cancellation policy
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
