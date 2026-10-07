'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastProvider } from '@/components/ui/Toast';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

/**
 * Page shell. Also mounts the ToastProvider, so `useToast()` works in any
 * component rendered inside an AppLayout (not in the component that renders it).
 */
export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content area */}
        <div className="lg:pl-64">
          <Header title={title} onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
