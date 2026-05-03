import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/lokal/Navbar";
import { Footer } from "@/components/lokal/Footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({ meta: [{ title: "Privacy Policy · Lokal" }] }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
        </div>

        <div className="space-y-10">
          <Section title="1. Who we are">
            <p>
              Lokal ("we", "us", "our") operates the marketplace at <strong className="text-foreground">lokalshops.co.uk</strong>.
              We connect customers with African and Caribbean independent stores. We are the data controller for
              information collected through this platform.
            </p>
            <p>
              For any privacy queries contact us at: <strong className="text-foreground">helplokal@gmail.com</strong>
            </p>
          </Section>

          <Section title="2. What data we collect">
            <p>We collect the following personal data when you use Lokal:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Customers:</strong> name, phone number, email address, and order details when you place an order.</li>
              <li><strong className="text-foreground">Merchants:</strong> name, email address, store information, and bank account details (for display to customers) when you register a store.</li>
              <li><strong className="text-foreground">All visitors:</strong> approximate location (city-level, derived from your browser's geolocation API — only if you grant permission), and standard web logs (IP address, browser type).</li>
            </ul>
          </Section>

          <Section title="3. How we use your data">
            <p>We use your data to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process and communicate about orders you place or receive.</li>
              <li>Send order status notifications (email and/or SMS) where you have provided contact details.</li>
              <li>Display relevant stores near your location.</li>
              <li>Allow merchants to manage their store listings and orders.</li>
              <li>Maintain the security and operation of the platform.</li>
            </ul>
            <p>
              Our lawful basis is <strong className="text-foreground">contract performance</strong> (processing orders) and
              <strong className="text-foreground"> legitimate interests</strong> (operating the platform securely).
            </p>
          </Section>

          <Section title="4. Who we share data with">
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Merchants</strong> — when you place an order, your name, phone, and order details are shared with the relevant store owner so they can fulfil your order.</li>
              <li><strong className="text-foreground">Supabase</strong> — our database and authentication provider (data stored in EU region).</li>
              <li><strong className="text-foreground">Brevo</strong> — used to send transactional emails and SMS notifications.</li>
              <li><strong className="text-foreground">Cloudflare</strong> — our hosting and CDN provider.</li>
            </ul>
          </Section>

          <Section title="5. Payment data">
            <p>
              Lokal does not process payments. All payments are made directly between customers and merchants
              via bank transfer. We display merchant bank details (sort code and account number) solely to
              facilitate this direct transfer. We do not store customer payment information.
            </p>
          </Section>

          <Section title="6. Data retention">
            <p>
              Order data is retained for 2 years to support order disputes and records. Merchant account data
              is retained for as long as the account remains active, and up to 1 year after deletion upon
              request. You may request deletion of your data at any time (see Section 8).
            </p>
          </Section>

          <Section title="7. Cookies and tracking">
            <p>
              We use only essential session cookies required for authentication. We do not use advertising
              cookies or cross-site tracking. No consent banner is required for essential cookies under UK GDPR.
            </p>
          </Section>

          <Section title="8. Your rights">
            <p>Under UK GDPR you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion ("right to be forgotten").</li>
              <li>Object to processing or request restriction.</li>
              <li>Data portability.</li>
            </ul>
            <p>
              To exercise any of these rights, email <strong className="text-foreground">helplokal@gmail.com</strong>.
              We will respond within 30 days. You also have the right to lodge a complaint with the
              <strong className="text-foreground"> Information Commissioner's Office (ICO)</strong> at ico.org.uk.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this policy periodically. Material changes will be flagged on the site.
              Continued use of Lokal after changes constitutes acceptance of the updated policy.
            </p>
          </Section>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          See also our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
        </div>
      </main>
      <Footer />
    </div>
  );
}
