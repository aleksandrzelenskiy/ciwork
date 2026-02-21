import { along, distance, lineString, point } from '@turf/turf';
import type { CoordinateInput, ProfilePoint } from './types';

const METERS_PER_KILOMETER = 1000;

export const calculateDistanceMeters = (a: CoordinateInput, b: CoordinateInput): number => {
    const dKm = distance(point([a.lon, a.lat]), point([b.lon, b.lat]), { units: 'kilometers' });
    return dKm * METERS_PER_KILOMETER;
};

export const buildProfilePoints = (
    a: CoordinateInput,
    b: CoordinateInput,
    stepMeters: number
): { points: ProfilePoint[]; distanceMeters: number } => {
    const distanceMeters = calculateDistanceMeters(a, b);

    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
        throw new Error('Некорректная длина трассы.');
    }

    const route = lineString([
        [a.lon, a.lat],
        [b.lon, b.lat],
    ]);

    const minSegmentCount = 2;
    const segments = Math.max(minSegmentCount, Math.ceil(distanceMeters / stepMeters));
    const lastIndex = segments;
    const stepKm = (distanceMeters / segments) / METERS_PER_KILOMETER;

    const points: ProfilePoint[] = [];

    for (let index = 0; index <= lastIndex; index += 1) {
        const distanceKm = Math.min((index * stepKm), distanceMeters / METERS_PER_KILOMETER);
        const samplePoint = along(route, distanceKm, { units: 'kilometers' });
        const [lon, lat] = samplePoint.geometry.coordinates;

        points.push({
            index,
            lat,
            lon,
            distanceMeters: distanceKm * METERS_PER_KILOMETER,
        });
    }

    points[points.length - 1] = {
        index: points.length - 1,
        lat: b.lat,
        lon: b.lon,
        distanceMeters,
    };

    return {
        points,
        distanceMeters,
    };
};
