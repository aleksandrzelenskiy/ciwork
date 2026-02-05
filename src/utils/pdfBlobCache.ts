'use client';

type CacheEntry = {
    blobUrl?: string;
    promise?: Promise<string>;
    lastUsed: number;
};

const MAX_ENTRIES = 20;
const cache = new Map<string, CacheEntry>();

const touch = (key: string, entry: CacheEntry) => {
    entry.lastUsed = Date.now();
    cache.set(key, entry);
};

const evictIfNeeded = () => {
    if (cache.size <= MAX_ENTRIES) return;
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const excess = cache.size - MAX_ENTRIES;
    for (let i = 0; i < excess; i += 1) {
        const [key, entry] = entries[i];
        if (entry.blobUrl) {
            URL.revokeObjectURL(entry.blobUrl);
        }
        cache.delete(key);
    }
};

export const fetchPdfBlobUrl = async (
    key: string,
    fetcher: () => Promise<Blob>
): Promise<string> => {
    const cached = cache.get(key);
    if (cached?.blobUrl) {
        touch(key, cached);
        return cached.blobUrl;
    }
    if (cached?.promise) {
        touch(key, cached);
        return cached.promise;
    }

    const entry: CacheEntry = { lastUsed: Date.now() };
    const promise = fetcher()
        .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            entry.blobUrl = blobUrl;
            entry.promise = undefined;
            touch(key, entry);
            evictIfNeeded();
            return blobUrl;
        })
        .catch((err) => {
            cache.delete(key);
            throw err;
        });

    entry.promise = promise;
    cache.set(key, entry);
    return promise;
};

export const clearPdfBlobCache = () => {
    for (const entry of cache.values()) {
        if (entry.blobUrl) {
            URL.revokeObjectURL(entry.blobUrl);
        }
    }
    cache.clear();
};
