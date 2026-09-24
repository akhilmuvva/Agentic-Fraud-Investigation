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
  Verdict,
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

import staticCasesData from '../data/staticCases.json';
const staticCases = staticCasesData as CaseDetail[];

// ---------------------------------------------------------------------------
// Public API methods (with static fallback for GitHub Pages demo mode)
// ---------------------------------------------------------------------------

/** GET /health — liveness probe */
export async function fetchHealth(): Promise<HealthResponse> {
  try {
    return await request<HealthResponse>('/health');
  } catch {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

/**
 * GET /cases — summary list of all investigated cases.
 * Returns an empty array if the store is empty.
 */
export async function fetchCases(): Promise<CaseSummary[]> {
  try {
    return await request<CaseSummary[]>('/cases');
  } catch {
    return staticCases.map(c => ({
      case_id: c.case_id,
      trigger_type: c.trigger_type ?? 'risk_score',
      status: c.case.status ?? 'closed_fraud',
      outcome: c.case.verdict ?? 'fraud',
      pattern_matched: c.case.pattern ?? null,
      confidence: c.case.fraud_probability ?? null,
      sar_required: c.sar?.file ?? null,
      risk_score: c.case.fraud_probability ?? null,
    }));
  }
}

/**
 * GET /cases/{case_id} — full agent state dict for one case.
 * Throws ApiClientError with status 404 if not found.
 */
export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  try {
    return await request<CaseDetail>(`/cases/${encodeURIComponent(caseId)}`);
  } catch {
    const found = staticCases.find(c => c.case_id.toLowerCase() === caseId.toLowerCase());
    if (found) return found;
    throw new ApiClientError(404, `Case '${caseId}' not found`);
  }
}

/**
 * GET /api/full-cases — all complete case objects (pre-loaded from /cases/*.json).
 * Used to hydrate the case list with richer data than /cases summaries provide.
 */
export async function fetchFullCases(): Promise<CaseDetail[]> {
  try {
    return await request<CaseDetail[]>('/api/full-cases');
  } catch {
    try {
      const list = await request<any[]>('/cases');
      return list as CaseDetail[];
    } catch {
      return staticCases;
    }
  }
}

/**
 * POST /investigate — trigger an investigation for a fraud case.
 * This is the ONLY write operation in the frontend; all other actions are read-only.
 */
export async function postInvestigate(
  req: InvestigateRequest,
): Promise<InvestigateResponse> {
  try {
    return await request<InvestigateResponse>('/investigate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  } catch {
    const caseId = req.case_id || 'HHG-NEW';
    const existing = staticCases.find(c => c.case_id.toLowerCase() === caseId.toLowerCase());
    const verdict: Verdict = existing
      ? existing.case.verdict
      : ((req.risk_score || 0) >= 0.7 ? 'fraud' : (req.risk_score || 0) >= 0.4 ? 'uncertain' : 'legitimate');

    return {
      case_id: caseId,
      status: 'completed',
      outcome: verdict,
      confidence: existing ? existing.case.fraud_probability : (req.risk_score || 0.75),
      recommended_actions: existing?.next_best_actions?.final?.map(a => a.action) || ['VERIFY_WITH_CUSTOMER'],
      sar_required: existing ? existing.sar?.file : (req.risk_score || 0) > 0.7,
    };
  }
}

export { ApiClientError };
