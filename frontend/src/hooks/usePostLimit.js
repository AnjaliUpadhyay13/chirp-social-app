import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const DEFAULT_LIMIT = 280;
let cached = null;
let inflight = null;

async function load() {
  try { cached = (await api('/config')).data.postMaxLength; } catch { /* fall back to default; server still enforces */ }
  return cached ?? DEFAULT_LIMIT;
}

// Character limit comes from the backend (POST_MAX_LENGTH) so UI and API never disagree.
export function usePostLimit() {
  const [limit, setLimit] = useState(cached ?? DEFAULT_LIMIT);
  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    inflight ||= load().finally(() => { inflight = null; });
    inflight.then((v) => alive && setLimit(v));
    return () => { alive = false; };
  }, []);
  return limit;
}
