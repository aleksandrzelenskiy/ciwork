import type { ElevationPoint } from '../types';
import { chunkArray, fetchJsonWithTimeout, type ElevationCoordinate, type ElevationProvider } from './provider';

type OpenMeteoResponse = {
    elevation?: unknown[];
};

const DEFAULT_BASE_URL = 'https://api.open-meteo.com/v1/elevation';
const BATCH_SIZE = 100;

export class OpenMeteoElevationProvider implements ElevationProvider {
    public readonly name = 'openmeteo';

    constructor(private readonly baseUrl = process.env.OPEN_METEO_BASE_URL || DEFAULT_BASE_URL) {}

    async fetchElevations(points: ElevationCoordinate[]): Promise<ElevationPoint[]> {
        const chunks = chunkArray(points, BATCH_SIZE);
        const results: ElevationPoint[] = [];

        for (const chunk of chunks) {
            const latitude = chunk.map((sample) => sample.lat).join(',');
            const longitude = chunk.map((sample) => sample.lon).join(',');
            const url = `${this.baseUrl}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
            const payload = await fetchJsonWithTimeout<OpenMeteoResponse>(url);

            if (!Array.isArray(payload.elevation) || payload.elevation.length !== chunk.length) {
                throw new Error('Open-Meteo вернул некорректный набор высот.');
            }

            payload.elevation.forEach((rawElevation, index) => {
                if (typeof rawElevation !== 'number' || Number.isNaN(rawElevation)) {
                    throw new Error('Open-Meteo вернул NaN/empty значение высоты.');
                }

                results.push({
                    lat: chunk[index].lat,
                    lon: chunk[index].lon,
                    elevation: rawElevation,
                });
            });
        }

        return results;
    }
}
