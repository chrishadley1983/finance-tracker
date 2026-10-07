export const metadata = {
  title: 'Privacy Notice — Finance Tracker',
  description: 'How Finance Tracker handles your data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-ink">
      <h1 className="text-2xl font-bold mb-6">Privacy Notice</h1>
      <p className="text-sm text-ink-3 mb-8">Last updated: October 2026</p>

      <section className="space-y-4 text-sm leading-6">
        <p>
          Finance Tracker is a private, personal finance application used by a single household to
          track its own bank transactions, budgets and net worth. It is not offered as a public
          service and does not sell, share or advertise with your data.
        </p>

        <h2 className="text-lg font-semibold pt-4">Bank data (Open Banking)</h2>
        <p>
          With your explicit consent, Finance Tracker connects to your bank through TrueLayer, an
          Account Information Service Provider authorised by the Financial Conduct Authority, using
          the UK Open Banking standard. We request read-only access to account information, balances
          and transactions. We never receive or store your online banking credentials — you
          authenticate directly with your bank.
        </p>
        <p>
          Consent is time-limited (it must be reconfirmed at least every 90 days) and can be withdrawn
          at any time by disconnecting the bank in the app, through TrueLayer, or by contacting your
          bank. Only accounts you explicitly link are synchronised.
        </p>

        <h2 className="text-lg font-semibold pt-4">What we store</h2>
        <p>
          Transaction details (date, amount, description, category) and account balances. To keep
          the connection working between syncs we also store the TrueLayer access token, the refresh
          token and their expiry for each connected bank. These tokens grant read-only access. Access
          tokens expire after about an hour; the refresh token can only be used together with this
          application&apos;s private TrueLayer credentials, and both stop working when consent expires
          or is withdrawn. We never store bank credentials. Data is held in a
          private database that is accessible only to the account owner and to the application&apos;s
          server.
        </p>

        <h2 className="text-lg font-semibold pt-4">Contact</h2>
        <p>
          For any data protection matters, contact{' '}
          <a className="text-accent underline" href="mailto:chrishadley1983@gmail.com">
            chrishadley1983@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
