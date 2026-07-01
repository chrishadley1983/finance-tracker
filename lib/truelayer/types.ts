/**
 * Types for the TrueLayer Data API (account information).
 * @see https://docs.truelayer.com/docs/data-api-basics
 */

export interface TrueLayerTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface TrueLayerAccount {
  account_id: string;
  account_type?: string; // TRANSACTION, SAVINGS, etc.
  display_name?: string;
  currency: string;
  account_number?: { iban?: string; number?: string; sort_code?: string };
  provider?: { provider_id?: string; display_name?: string };
}

export interface TrueLayerCard {
  account_id: string;
  card_network?: string;
  card_type?: string;
  display_name?: string;
  currency: string;
  partial_card_number?: string;
  name_on_card?: string;
  provider?: { provider_id?: string; display_name?: string };
}

export interface TrueLayerBalance {
  currency: string;
  available: number;
  current: number;
  overdraft?: number;
  update_timestamp?: string;
}

export interface TrueLayerTransaction {
  transaction_id: string;
  timestamp: string; // ISO datetime
  description: string;
  amount: number;
  currency: string;
  transaction_type: 'DEBIT' | 'CREDIT';
  transaction_category?: string;
  merchant_name?: string;
  running_balance?: { amount: number; currency: string };
  meta?: {
    provider_transaction_id?: string;
    provider_id?: string;
    transaction_type?: string;
  };
}

export interface TrueLayerResults<T> {
  results: T[];
  status?: string;
}

export class TrueLayerError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'TrueLayerError';
  }
}
