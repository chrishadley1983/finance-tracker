import { trueLayerHosts } from './client';
import { TrueLayerError } from './types';

/** Scopes: account + card data, balances, transactions, plus a refresh token. */
export const TRUELAYER_SCOPES = 'info accounts balance cards transactions offline_access';

/** Default provider filter: all UK Open Banking + OAuth banks (HSBC = ob-hsbc). */
export const DEFAULT_PROVIDERS = 'uk-ob-all uk-oauth-all';

export interface BuildAuthUrlOptions {
  redirectUri: string;
  state: string;
  providers?: string;
}

/** Build the TrueLayer authorization URL to redirect the user to. */
export function buildAuthUrl({ redirectUri, state, providers }: BuildAuthUrlOptions): string {
  const clientId = process.env.TRUELAYER_CLIENT_ID;
  if (!clientId) throw new TrueLayerError('Missing env var TRUELAYER_CLIENT_ID', 500, 'CONFIG');
  const { auth } = trueLayerHosts();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: TRUELAYER_SCOPES,
    redirect_uri: redirectUri,
    providers: providers ?? DEFAULT_PROVIDERS,
    state,
  });
  return `${auth}/?${params.toString()}`;
}
