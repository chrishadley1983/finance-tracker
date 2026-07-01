import { ebFetch } from './client';
import type { StartAuthOptions, StartAuthResponse } from './types';

/**
 * Begin the bank authorization flow. Returns a URL the user must visit to
 * authenticate with their bank and grant consent. After consent the bank
 * redirects to `redirectUrl?code=...&state=...`, which we exchange for a
 * session (see createSession).
 */
export async function startAuthorization(opts: StartAuthOptions): Promise<StartAuthResponse> {
  return ebFetch<StartAuthResponse>('/auth', {
    method: 'POST',
    body: {
      access: { valid_until: opts.validUntil },
      aspsp: { name: opts.aspspName, country: opts.aspspCountry },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: opts.psuType ?? 'personal',
    },
  });
}
