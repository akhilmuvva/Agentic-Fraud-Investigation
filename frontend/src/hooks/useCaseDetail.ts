/**
 * src/hooks/useCaseDetail.ts
 * Fetches GET /cases/{case_id} detail.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchCaseDetail } from '../api/client';
import { ApiClientError } from '../api/client';
import type { CaseDetail } from '../api/types';

interface UseCaseDetailResult {
  caseData: CaseDetail | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

export function useCaseDetail(caseId: string | undefined): UseCaseDetailResult {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await fetchCaseDetail(caseId);
      setCaseData(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load case');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  return { caseData, loading, error, notFound, refetch: load };
}
