export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

export const TOKEN_KEY = "ledger.auth.token";

export type LedgerPayload = {
  accounts: {
    bank: number;
    ewallet: number;
    cash: number;
  };
  transactions: unknown[];
  loans: unknown[];
  debts: unknown[];
};

export type AuthResponse = {
  token: string;
  expires_at: string;
  user_id: number;
  email: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response) {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return (await res.json()) as AuthResponse;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return (await res.json()) as AuthResponse;
}

export async function fetchLedgerData(token: string): Promise<LedgerPayload> {
  const res = await fetch(`${API_BASE}/api/data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return (await res.json()) as LedgerPayload;
}

export async function syncLedgerData(
  token: string,
  payload: LedgerPayload,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/data/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
}

export function normalizeLedgerPayload(raw: LedgerPayload): {
  accounts: LedgerPayload["accounts"];
  transactions: LedgerPayload["transactions"];
  loans: LedgerPayload["loans"];
  debts: LedgerPayload["debts"];
} {
  return {
    accounts: {
      bank: Number(raw.accounts?.bank) || 0,
      ewallet: Number(raw.accounts?.ewallet) || 0,
      cash: Number(raw.accounts?.cash) || 0,
    },
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    debts: Array.isArray(raw.debts) ? raw.debts : [],
  };
}
