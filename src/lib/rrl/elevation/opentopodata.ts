import type { ElevationPoint } from '../types';
import { chunkArray, fetchJsonWithTimeout, type ElevationCoordinate, type ElevationProvider } from './provider';

type OpenTopoDataResultItem = {
    elevation: number | null;
    location?: {
        lat: number;
        lng: number;
    };
};

type OpenTopoDataResponse = {
    status?: string;
    results?: OpenTopoDataResultItem[];
    error?: string;
};

const DEFAULT_BASE_URL = 'https://api.opentopodata.org/v1';
const DEFAULT_DATASET = 'aster30m';
const BATCH_SIZE = 100;

export class OpenTopoDataProvider implements ElevationProvider {
    public readonly name = 'opentopodata';

    constructor(
        private readonly baseUrl = process.env.OPENTOPODATA_BASE_URL || DEFAULT_BASE_URL,
        private readonly dataset = process.env.OPENTOPODATA_DATASET || DEFAULT_DATASET
    ) {}

    async fetchElevations(points: ElevationCoordinate[]): Promise<ElevationPoint[]> {
        const chunks = chunkArray(points, BATCH_SIZE);
        const results: ElevationPoint[] = [];

        for (const chunk of chunks) {
            const locationsParam = chunk.map((sample) => `${sample.lat},${sample.lon}`).join('|');
            const url = `${this.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(this.dataset)}?locations=${encodeURIComponent(locationsParam)}`;
            const payload = await fetchJsonWithTimeout<OpenTopoDataResponse>(url);

            if (payload.status !== 'OK' || !Array.isArray(payload.results)) {
                throw new Error(payload.error || 'OpenTopoData вернул некорректный ответ.');
            }

            if (payload.results.length !== chunk.length) {
                throw new Error('OpenTopoData вернул неполный набор высот.');
            }

            payload.results.forEach((item, index) => {
                const elevation = item.elevation;
                if (typeof elevation !== 'number' || Number.isNaN(elevation)) {
                    throw new Error('OpenTopoData вернул NaN/empty значение высоты.');
                }

                results.push({
                    lat: chunk[index].lat,
                    lon: chunk[index].lon,
                    elevation,
                });
            });
        }

        return results;
    }
}
