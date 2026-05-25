export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  updatedAt: string;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): CacheEntry<T> | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
    updatedAt: new Date().toISOString(),
  };

  cache.set(key, entry);
  return entry;
}

export async function getOrSetCached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
) {
  const cached = getCached<T>(key);

  if (cached) {
    return { entry: cached, cached: true };
  }

  const value = await load();
  return { entry: setCached(key, value, ttlMs), cached: false };
}

export function clearMemoryCache() {
  cache.clear();
}
