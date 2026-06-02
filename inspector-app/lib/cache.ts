interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheItem<any>>();
// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const getCachedData = <T>(key: string): T | null => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

export const setCachedData = <T>(key: string, data: T) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (keyPattern?: string) => {
  if (!keyPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(keyPattern)) {
      cache.delete(key);
    }
  }
};