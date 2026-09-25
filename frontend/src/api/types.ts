/**
 * src/api/types.ts
 * ----------------
 * Canonical TypeScript interfaces matching the real FastAPI backend response shapes.
 * Derived from: /cases/HHG-*.json (full case objects), /api/main.py Pydantic models.
 *
 * If the real API field names diverge from these, correct them here only — all
 * components consume these types, so changes propagate automatically.
 */

// ---------------------------------------------------------------------------
// Shared / primitive types
// ---------------------------------------------------------------------------

/** One of the 5 fraud patterns the agent can detect */
export type FraudPattern =
  | 'card_not_present_fraud'
  | 'account_takeover'
  | 'card_not_present_new_device'
  | 'out_of_region_use'
  | 'card_testing';

/** Verdict strings produced by the Gemini decision node */
export type Verdict = 'fraud' | 'uncertain' | 'legitimate';

/** Case lifecycle status */
export type CaseStatus = 'escalated' | 'closed_fraud' | 'closed_legit' | 'pending' | 'in_progress';

/** Trigger origin */
export type TriggerType = 'risk_score' | 'customer_report' | 'analyst_request';

/** Routing tier for NBA actions */
export type ActionRoute = 'auto' | 'L1' | 'L2';

/**
 * Valid Next-Best Action values from agent/state.py:
 * CREATE_CASE | BLOCK_CARD | VERIFY_WITH_CUSTOMER |
 * CLOSE_NO_FRAUD | FILE_REPORT | MONITOR_ACCOUNT | ESCALATE
 */
export type ActionType =
  | 'CREATE_CASE'
  | 'BLOCK_CARD'
  | 'VERIFY_WITH_CUSTOMER'
  | 'CLOSE_NO_FRAUD'
  | 'FILE_REPORT'
  | 'MONITOR_ACCOUNT'
  | 'ESCALATE';

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/** Single evidence entry in the append-only audit log */
export interface Evidence {
  claim: string;
  source: 'graph' | 'document' | string;
  ref: string;
  entity_ids: string[];
}

// ---------------------------------------------------------------------------
// Case inner object (nested under top-level case JSON)
// ---------------------------------------------------------------------------

export interface CaseInner {
  status: CaseStatus;
  verdict: Verdict;
  fraud_probability: number;          // 0.0 – 1.0
  pattern: FraudPattern;
  pattern_description: string;
  affected_txn_ids: string[];
  first_suspicious_txn_id: string;
  connected_card_ids: string[];
  connected_device_profiles: string[];
  exposure_usd: number;
  evidence: Evidence[];
  similar_prior_cases: string[];      // case IDs only — use for display
  summary: string;
  written_to_graph: boolean;
  graph_case_id: string;
}

// ---------------------------------------------------------------------------
// Next Best Actions
// ---------------------------------------------------------------------------

export interface NbaAction {
  action: ActionType;
  route: ActionRoute;
  reason: string;
}

export interface NextBestActions {
  initial: NbaAction[];
  final: NbaAction[];
  what_changed: string;
}

// ---------------------------------------------------------------------------
// SAR (Suspicious Activity Report)
// ---------------------------------------------------------------------------

export interface SAR {
  file: boolean;
  reason: string;
  narrative: string;
  subjects: string[];
  total_amount_usd: number;
  activity_dates: string[];   // ISO date strings e.g. "2016-11-01"
}

// ---------------------------------------------------------------------------
// Evidence Request
// ---------------------------------------------------------------------------

export interface EvidenceRequest {
  type: string;
  asked_after_step: number;
  assumed_response: string;
}

// ---------------------------------------------------------------------------
// Full Case Detail — shape of GET /cases/{case_id}
// ---------------------------------------------------------------------------

export interface CaseDetail {
  case_id: string;
  case: CaseInner;
  evidence_requests: EvidenceRequest[];
  next_best_actions: NextBestActions;
  sar: SAR;
  stop_reason: string;
  tool_calls: number;
  tokens: number;
  latency_s: number;

  // These fields may also appear at top-level from the agent state
  // (when stored directly rather than nested) — kept optional for compatibility
  trigger_type?: TriggerType;
  trigger_text?: string;
  flagged_txn_id?: string;
  card_id?: string;
  customer_id?: string;
  risk_score?: number;
  confidence?: number;
  explanation?: string;
  pattern_matches?: PatternMatch[];
  similar_cases?: SimilarCase[];
  recommended_actions?: string[];
  sar_required?: boolean;
  exposure_usd?: number;
}

// ---------------------------------------------------------------------------
// Pattern Match — from agent state pattern_matches list
// ---------------------------------------------------------------------------

export interface PatternMatch {
  pattern_id: FraudPattern;
  matched: boolean;
  evidence_entities: string[];
  risk_indicators: string[];
}

// ---------------------------------------------------------------------------
// Similar Case — from agent state similar_cases (GraphRAG)
// ---------------------------------------------------------------------------

export interface SimilarCase {
  case_id: string;
  outcome: string;
  pattern: FraudPattern | string;
  actions_taken: string[];
  analyst_notes: string;
  similarity_score: number;   // 0.0 – 1.0
}

// ---------------------------------------------------------------------------
// Case Summary — shape of GET /cases list items
// ---------------------------------------------------------------------------

export interface CaseSummary {
  case_id: string;
  trigger_type: TriggerType | null;
  status: CaseStatus;
  outcome: Verdict | null;
  pattern_matched: FraudPattern | null;
  confidence: number | null;
  sar_required: boolean | null;
  risk_score: number | null;
}

// ---------------------------------------------------------------------------
// Investigate Request — POST /investigate body
// ---------------------------------------------------------------------------

export interface InvestigateRequest {
  case_id: string;
  trigger_type: TriggerType;
  trigger_text: string;
  flagged_txn_id: string;
  card_id: string;
  customer_id: string;
  risk_score: number;   // 0.0 – 1.0
}

// ---------------------------------------------------------------------------
// Investigate Response — POST /investigate 200 body
// ---------------------------------------------------------------------------

export interface InvestigateResponse {
  case_id: string;
  status: string;
  outcome: Verdict | null;
  confidence: number | null;
  recommended_actions: string[] | null;
  sar_required: boolean | null;
}

// ---------------------------------------------------------------------------
// Health Response — GET /health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | string;
  timestamp: string;   // ISO datetime
}

// ---------------------------------------------------------------------------
// API Error shape
// ---------------------------------------------------------------------------

export interface ApiError {
  detail: string;
}
