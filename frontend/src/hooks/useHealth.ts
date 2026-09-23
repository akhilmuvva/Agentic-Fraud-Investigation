/**
 * src/hooks/useHealth.ts
 * Polls GET /health every 30s and returns connection status.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchHealth } from '../api/client';
import type { HealthResponse } from '../api/types';

export type HealthStatus = 'ok' | 'error' | 'loading';

interface UseHealthResult {
  status: HealthStatus;
  lastCheck: Date | null;
  data: HealthResponse | null;
}

export function useHealth(pollIntervalMs = 30_000): UseHealthResult {
  const [status, setStatus] = useState<HealthStatus>('loading');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [data, setData] = useState<HealthResponse | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetchHealth();
      setData(res);
      setStatus(res.status === 'ok' ? 'ok' : 'error');
    } catch {
      setStatus('error');
      setData(null);
    } finally {
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, pollIntervalMs);
    return () => clearInterval(id);
  }, [check, pollIntervalMs]);

  return { status, lastCheck, data };
}
