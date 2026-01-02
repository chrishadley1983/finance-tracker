/**
 * Import Session Store
 *
 * In-memory store for parsed CSV data between requests.
 * Data is stored temporarily until import is completed or session expires.
 */

export interface PdfMetadata {
  totalPages: number;
  processedPages: number;
  visionConfidence: number;
  originalFilename: string;
  statementPeriod?: {
    start: string;
    end: string;
  };
  accountInfo?: {
    accountNumber?: string;
    sortCode?: string;
    accountName?: string;
  };
}

export interface SessionData {
  headers: string[];
  rows: string[][];
  encoding: string;
  delimiter: string;
  createdAt: Date;
  sourceType: 'csv' | 'pdf';
  pdfMetadata?: PdfMetadata;
}

// In-memory store for session data
const sessionStore = new Map<string, SessionData>();

// Session expiry time (1 hour)
const SESSION_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Store parsed data for a session.
 */
export function storeSessionData(
  sessionId: string,
  data: {
    headers: string[];
    rows: string[][];
    encoding: string;
    delimiter: string;
    sourceType?: 'csv' | 'pdf';
    pdfMetadata?: PdfMetadata;
  }
): void {
  sessionStore.set(sessionId, {
    ...data,
    sourceType: data.sourceType || 'csv',
    createdAt: new Date(),
  });
}

/**
 * Retrieve session data.
 */
export function getSessionData(sessionId: string): SessionData | null {
  const data = sessionStore.get(sessionId);

  if (!data) {
    return null;
  }

  // Check if session has expired
  const now = new Date();
  if (now.getTime() - data.createdAt.getTime() > SESSION_EXPIRY_MS) {
    sessionStore.delete(sessionId);
    return null;
  }

  return data;
}

/**
 * Delete session data.
 */
export function deleteSessionData(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * Clean up expired sessions.
 * Call this periodically to prevent memory leaks.
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let deleted = 0;

  for (const [sessionId, data] of Array.from(sessionStore.entries())) {
    if (now.getTime() - data.createdAt.getTime() > SESSION_EXPIRY_MS) {
      sessionStore.delete(sessionId);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get the number of active sessions.
 */
export function getActiveSessionCount(): number {
  return sessionStore.size;
}
