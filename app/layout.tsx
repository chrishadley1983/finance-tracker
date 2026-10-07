import type { Metadata } from 'next';
import { Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { themeInitScript } from '@/lib/theme';
import './globals.css';

const ui = Public_Sans({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const fig = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-fig',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hadley Finance Tracker',
  description: 'Track transactions, budgets, wealth, and FIRE projections',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${ui.variable} ${fig.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-ground text-ink">{children}</body>
    </html>
  );
}
