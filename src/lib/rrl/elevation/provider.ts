import type { ElevationPoint } from '../types';

export type ElevationCoordinate = {
    lat: number;
    lon: number;
};

export interface ElevationProvider {
    readonly name: string;
    fetchElevations(points: ElevationCoordinate[]): Promise<ElevationPoint[]>;
}

const DEFAULT_TIMEOUT_MS = 10000;

export const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

export const fetchJsonWithTimeout = async <T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
        }

        return (await response.json()) as T;
    } finally {
        clearTimeout(timeout);
    }
};
