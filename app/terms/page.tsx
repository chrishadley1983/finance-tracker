export const metadata = {
  title: 'Terms of Service — Finance Tracker',
  description: 'Terms of use for Finance Tracker.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

      <section className="space-y-4 text-sm leading-6">
        <p>
          Finance Tracker is a private, personal application provided for the sole use of its owner
          and household. It is supplied &quot;as is&quot;, without warranty of any kind.
        </p>

        <h2 className="text-lg font-semibold pt-4">Open Banking access</h2>
        <p>
          Account information is retrieved via Enable Banking Oy under the UK Open Banking standard,
          on a read-only basis and only for accounts you explicitly link. The application never
          initiates payments and never stores your banking credentials.
        </p>

        <h2 className="text-lg font-semibold pt-4">Accuracy</h2>
        <p>
          Balances and transactions are provided by your bank and may be delayed or incomplete.
          Figures shown are for personal tracking only and should not be relied upon for financial,
          tax or investment decisions.
        </p>

        <h2 className="text-lg font-semibold pt-4">Contact</h2>
        <p>
          Questions about these terms:{' '}
          <a className="text-blue-600 underline" href="mailto:chrishadley1983@gmail.com">
            chrishadley1983@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
