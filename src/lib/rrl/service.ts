import { createElevationProviders } from './elevation';
import { buildProfilePoints } from './geodesy';
import { calculateRrlProfile } from './radio-calculations';
import type {
    ElevationPoint,
    RrlProfileCalculateRequest,
    RrlProfileCalculateResponse,
} from './types';

const MIN_ROUTE_DISTANCE_METERS = 10;

const resolveElevations = async (
    points: Array<{ lat: number; lon: number }>
): Promise<{ elevations: ElevationPoint[]; providerName: string }> => {
    const providers = createElevationProviders();
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const elevations = await provider.fetchElevations(points);
            return { elevations, providerName: provider.name };
        } catch (error) {
            errors.push(`${provider.name}: ${(error as Error).message}`);
        }
    }

    throw new Error(`Не удалось получить профиль высот. ${errors.join(' | ')}`);
};

export const calculateRrlProfileWithElevations = async (
    input: RrlProfileCalculateRequest
): Promise<RrlProfileCalculateResponse & { elevationProvider: string }> => {
    const { points, distanceMeters } = buildProfilePoints(input.a, input.b, input.stepMeters);

    if (distanceMeters < MIN_ROUTE_DISTANCE_METERS) {
        throw new Error(`Трасса слишком короткая (${distanceMeters.toFixed(2)} м). Минимум: 10 м.`);
    }

    const { elevations, providerName } = await resolveElevations(points);
    const profile = calculateRrlProfile(input, points, elevations, distanceMeters);

    return {
        ...profile,
        elevationProvider: providerName,
    };
};
