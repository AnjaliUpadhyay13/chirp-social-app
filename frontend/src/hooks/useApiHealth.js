import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

// Real call to GET /api/v1/health -> proves frontend -> backend -> (db state) wiring.
export function useApiHealth() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const check = useCallback(async (signal) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const { data } = await api('/health', { signal });
      setState({ status: 'ok', data, error: null });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ status: 'error', data: null, error });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal);
    return () => controller.abort();
  }, [check]);

  return { ...state, retry: () => check() };
}
