import Link from 'next/link';

export const metadata = {
  title: 'Terms · Hadley Finance Tracker',
  description: 'Terms of use for Hadley Finance Tracker.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[65ch] px-4 py-10 text-ink sm:py-14">
      <Link
        href="/"
        className="mb-8 inline-block text-[13px] text-ink-3 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        ← Back to Hadley Finance
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Terms</h1>
      <p className="text-sm text-ink-3 mb-8">Last updated: October 2026</p>

      <section className="space-y-4 text-sm leading-6">
        <p>
          Hadley Finance Tracker is a private, personal application provided for the sole use of its owner
          and household. It is supplied &quot;as is&quot;, without warranty of any kind.
        </p>

        <h2 className="text-lg font-semibold pt-4">Open Banking access</h2>
        <p>
          Account information is retrieved via TrueLayer, an FCA-authorised Account Information
          Service Provider, under the UK Open Banking standard, on a read-only basis and only for
          accounts you explicitly link. The application never initiates payments and never stores
          your banking credentials.
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
          <a className="text-accent underline" href="mailto:chrishadley1983@gmail.com">
            chrishadley1983@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
