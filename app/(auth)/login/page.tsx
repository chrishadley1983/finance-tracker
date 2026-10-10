'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'not_allowed' ? 'This account does not have access to Hadley Finance.' : null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Something went wrong signing in. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" aria-label="Sign in">
      {error && (
        <p role="alert" className="rounded-[3px] bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </Field>
      <Button type="submit" variant="primary" loading={isLoading} className="mt-1 w-full">
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

/** A centred column, no card: the app name, one line, and the form. */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="grid w-full max-w-[360px] gap-6">
        <div className="grid gap-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Hadley Finance</h1>
          <p className="text-sm text-ink-3">Sign in with the email and password for this app.</p>
        </div>
        <Suspense fallback={<p className="text-sm text-ink-3">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="text-xs text-ink-3">
          <Link href="/privacy" className="underline-offset-2 hover:text-ink-2 hover:underline">
            Privacy
          </Link>
          {' · '}
          <Link href="/terms" className="underline-offset-2 hover:text-ink-2 hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}
