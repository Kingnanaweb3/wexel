// Every call to an outside service goes through here, so one slow or
// flaky service can't hang the app, and a brief outage serves the last
// good answer instead of an empty screen.

export const UA = { "User-Agent": "Mozilla/5.0" };

export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 6000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

const store = new Map<string, { at: number; data: any }>();

// Fresh within ttl; on failure, fall back to the last good value if we have one.
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return { data: hit.data as T, stale: false };
  try {
    const data = await fn();
    store.set(key, { at: Date.now(), data });
    return { data, stale: false };
  } catch (e) {
    if (hit) return { data: hit.data as T, stale: true };
    throw e;
  }
}
