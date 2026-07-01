/**
 * Enable Banking integration — public surface.
 *
 * NOTE: sync.ts is intentionally NOT re-exported here. It is `server-only`
 * (uses supabaseAdmin + the categorisation engine); import it directly from
 * '@/lib/enable-banking/sync' inside API routes to avoid pulling server-only
 * code into client bundles via this barrel.
 */
export * from './types';
export * from './client';
export * from './aspsps';
export * from './auth';
export * from './sessions';
export * from './accounts';
export * from './transactions';
export * from './reconcile';
