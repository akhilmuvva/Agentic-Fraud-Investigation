/// <reference types="vite/client" />
/**
 * src/api/client.ts
 * -----------------
 * Typed API client for the TigerGraph Fraud Investigation FastAPI backend.
 * All mutations go through the auditable FastAPI layer; this client is
 * read-only except for POST /investigate.
 *
 * Base URL is read from VITE_API_BASE_URL (env var) with fallback to
 * http://localhost:8000 for local development.
 */

import type {
  CaseSummary,
  CaseDetail,
  HealthResponse,
  InvestigateRequest,
  InvestigateResponse,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL: string = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiClientError(0, `Network error: unable to reach ${url}`);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      detail = errBody?.detail ?? detail;
    } catch {
      // ignore JSON parse error on error body
    }
    throw new ApiClientError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/** GET /health — liveness probe */
export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

/**
 * GET /cases — summary list of all investigated cases.
 * Returns an empty array if the store is empty.
 */
export async function fetchCases(): Promise<CaseSummary[]> {
  return request<CaseSummary[]>('/cases');
}

/**
 * GET /cases/{case_id} — full agent state dict for one case.
 * Throws ApiClientError with status 404 if not found.
 */
export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  return request<CaseDetail>(`/cases/${encodeURIComponent(caseId)}`);
}

/**
 * GET /api/full-cases — all complete case objects (pre-loaded from /cases/*.json).
 * Used to hydrate the case list with richer data than /cases summaries provide.
 */
export async function fetchFullCases(): Promise<CaseDetail[]> {
  try {
    return await request<CaseDetail[]>('/api/full-cases');
  } catch {
    const list = await request<any[]>('/cases');
    return list as CaseDetail[];
  }
}

/**
 * POST /investigate — trigger an investigation for a fraud case.
 * This is the ONLY write operation in the frontend; all other actions are read-only.
 */
export async function postInvestigate(
  req: InvestigateRequest,
): Promise<InvestigateResponse> {
  return request<InvestigateResponse>('/investigate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export { ApiClientError };
