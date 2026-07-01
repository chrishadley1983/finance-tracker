export const metadata = {
  title: 'Privacy Notice — Finance Tracker',
  description: 'How Finance Tracker handles your data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <h1 className="text-2xl font-bold mb-6">Privacy Notice</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

      <section className="space-y-4 text-sm leading-6">
        <p>
          Finance Tracker is a private, personal finance application used by a single household to
          track its own bank transactions, budgets and net worth. It is not offered as a public
          service and does not sell, share or advertise with your data.
        </p>

        <h2 className="text-lg font-semibold pt-4">Bank data (Open Banking)</h2>
        <p>
          With your explicit consent, Finance Tracker connects to your bank through Enable Banking Oy,
          a regulated Account Information Service Provider, using the UK Open Banking standard. We
          request read-only access to account information and transactions. We never receive or store
          your online banking credentials — you authenticate directly with your bank.
        </p>
        <p>
          Consent is time-limited (up to 90 days) and can be withdrawn at any time by unlinking the
          account in the app or contacting your bank. Only accounts you explicitly link can be accessed.
        </p>

        <h2 className="text-lg font-semibold pt-4">What we store</h2>
        <p>
          Transaction details (date, amount, description, category), account balances and the
          Enable Banking session identifier and its expiry. We do not store access tokens or bank
          credentials. Data is held in a private database accessible only to the account owner.
        </p>

        <h2 className="text-lg font-semibold pt-4">Contact</h2>
        <p>
          For any data protection matters, contact{' '}
          <a className="text-blue-600 underline" href="mailto:chrishadley1983@gmail.com">
            chrishadley1983@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
