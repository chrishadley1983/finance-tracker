'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Tabs, useUrlTab, type TabDef } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageIntro } from '@/components/ui/PageIntro';
import { ErnDashboard } from './ern/ErnDashboard';
import { MathsPlanningTab } from './MathsPlanningTab';
import { FireInputsForm } from './FireInputsForm';
import type { FireInputs, NetWorthSummary } from '@/lib/types/fire';

export type FireTab = 'ern' | 'maths' | 'settings';

export const FIRE_TABS: readonly TabDef<FireTab>[] = [
  { id: 'ern', label: 'ERN analysis' },
  { id: 'maths', label: 'Maths planning' },
  { id: 'settings', label: 'Settings' },
];

/** Keeps a tab mounted once opened, so the simulation isn't rerun on every switch. */
function TabPanel({ id, active, visited, children }: { id: FireTab; active: boolean; visited: boolean; children: ReactNode }) {
  if (!visited) return null;
  return (
    <div role="tabpanel" id={`fire-panel-${id}`} aria-label={FIRE_TABS.find((t) => t.id === id)?.label} hidden={!active}>
      {children}
    </div>
  );
}

export function FirePageContent() {
  const [tab, setTab] = useUrlTab(FIRE_TABS, 'ern');
  const [visited, setVisited] = useState<Set<FireTab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  const [fireInputs, setFireInputs] = useState<FireInputs | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [inputsRes, nwRes] = await Promise.all([fetch('/api/fire/inputs'), fetch('/api/wealth/net-worth')]);
      if (inputsRes.ok) {
        const data = await inputsRes.json();
        setFireInputs(data.inputs ?? null);
      } else {
        setLoadError('Your FIRE settings couldn’t be loaded, so defaults are shown.');
      }
      if (nwRes.ok) setNetWorth(await nwRes.json());
    } catch {
      setLoadError('Couldn’t reach the server. Defaults are shown until it’s back.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSaveInputs = async (updatedInputs: Partial<FireInputs>) => {
    const response = await fetch('/api/fire/inputs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fireInputs, ...updatedInputs }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error === 'Validation failed' ? 'Some values are out of range; check the numbers and try again.' : data.error || 'The settings weren’t saved. Try again.');
    }
    setFireInputs(data.inputs);
  };

  const liquid = netWorth?.byType
    ?.filter((t) => ['investment', 'isa', 'pension', 'savings', 'current'].includes(t.type))
    .reduce((s, t) => s + t.total, 0);

  return (
    <div className="grid gap-6 pb-6">
      <Tabs tabs={FIRE_TABS} active={tab} onChange={setTab} label="FIRE views" />

      {loadError && (
        <Notice tone="warn" action={<Button size="sm" onClick={fetchInitialData}>Try again</Button>}>
          {loadError}
        </Notice>
      )}

      <TabPanel id="ern" active={tab === 'ern'} visited={visited.has('ern')}>
        <ErnDashboard fireInputs={fireInputs} netWorth={netWorth} ready={!isLoading} />
      </TabPanel>

      <TabPanel id="maths" active={tab === 'maths'} visited={visited.has('maths')}>
        <MathsPlanningTab fireInputs={fireInputs} netWorth={netWorth} isLoading={isLoading && !fireInputs} />
      </TabPanel>

      <TabPanel id="settings" active={tab === 'settings'} visited={visited.has('settings')}>
        <div className="grid gap-6">
          <PageIntro>
            <p>
              These settings feed the ERN analysis, the maths planning tab and the Coast FIRE figure on{' '}
              <Link href="/wealth" className="text-accent underline-offset-2 hover:underline">
                Net worth
              </Link>
              . This is the only place they&apos;re edited.
            </p>
          </PageIntro>
          <FireInputsForm inputs={fireInputs} portfolioValue={liquid} onSave={handleSaveInputs} isLoading={isLoading && !fireInputs} />
        </div>
      </TabPanel>
    </div>
  );
}
