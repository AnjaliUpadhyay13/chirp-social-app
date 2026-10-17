import { useEffect, useState } from 'react';

// Loads one thing: fetcher(signal) -> data. Gives { status: 'loading'|'ready'|'error', data, error, retry }.
export function useRemote(fetcher, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetcher(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error }); });
    return () => controller.abort();
  }, [attempt, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
