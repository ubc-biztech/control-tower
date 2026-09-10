/** Tiny TTL cache. State lives in AWS; this only keeps Tower from hammering it. */
interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;

  // Collapse concurrent misses so a page load does not fan out N times.
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/** Last known good value, regardless of TTL — used when AWS is unreachable. */
export function stale<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

export function ageOf(key: string, ttlMs: number): number | null {
  const e = store.get(key);
  return e ? Date.now() - (e.expires - ttlMs) : null;
}
