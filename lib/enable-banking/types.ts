/**
 * TypeScript types for the Enable Banking API.
 * Field names mirror the Enable Banking REST API (snake_case) so responses
 * can be used directly without remapping.
 * @see https://enablebanking.com/docs/api/reference/
 */

// --- ASPSPs (banks) ---------------------------------------------------------

export interface ASPSP {
  name: string;
  country: string;
  logo?: string;
  psu_types?: string[];
  maximum_consent_validity?: number; // seconds
  beta?: boolean;
}

// --- Authorization / sessions ----------------------------------------------

export type PsuType = 'personal' | 'business';

export interface StartAuthOptions {
  aspspName: string;
  aspspCountry: string;
  redirectUrl: string;
  state: string;
  /** ISO 8601 datetime the access should remain valid until (max per ASPSP). */
  validUntil: string;
  psuType?: PsuType;
}

export interface StartAuthResponse {
  url: string;
  authorization_id?: string;
  psu_id_hash?: string;
}

export interface EnableBankingAccountRef {
  uid: string;
  identification_hash?: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  name?: string;
  product?: string;
  currency?: string;
  account_type?: string;
  usage?: string;
  cash_account_type?: string;
}

export interface EnableBankingSession {
  session_id: string;
  status: string;
  accounts: string[]; // account uids
  accounts_data?: EnableBankingAccountRef[];
  aspsp?: { name: string; country: string };
  psu_type?: string;
  access?: { valid_until?: string };
  created?: string;
}

// --- Balances ---------------------------------------------------------------

export interface Amount {
  amount: string;
  currency: string;
}

export interface AccountBalance {
  name?: string;
  balance_amount: Amount;
  balance_type: string; // CLBD, ITAV, XPCD, etc.
  reference_date?: string;
}

// --- Transactions -----------------------------------------------------------

export type CreditDebitIndicator = 'CRDT' | 'DBIT';
export type TransactionStatus = 'BOOK' | 'PDNG';

export interface EnableBankingTransaction {
  entry_reference?: string;
  transaction_amount: Amount;
  credit_debit_indicator: CreditDebitIndicator;
  status: TransactionStatus;
  booking_date?: string; // YYYY-MM-DD
  value_date?: string;
  transaction_date?: string;
  balance_after_transaction?: { balance_amount?: Amount };
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
  remittance_information_structured?: string;
  bank_transaction_code?: { description?: string; code?: string };
}

export interface TransactionsPage {
  transactions: EnableBankingTransaction[];
  continuation_key?: string;
}

// --- Errors -----------------------------------------------------------------

export class EnableBankingError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'EnableBankingError';
  }
}
