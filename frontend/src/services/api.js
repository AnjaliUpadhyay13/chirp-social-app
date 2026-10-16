const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Thin fetch wrapper: JSON in/out, cookies included, errors normalised to ApiError.
export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the backend running?');
  }

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok || json?.success === false) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code || 'HTTP_ERROR', e?.message || `Request failed (${res.status})`, e?.details);
  }
  return json; // { success, data, meta? }
}
