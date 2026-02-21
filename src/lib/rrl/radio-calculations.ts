import type {
    ElevationPoint,
    ProfilePoint,
    RecommendedLift,
    RrlProfileCalculateRequest,
    RrlProfileCalculateResponse,
    RrlProfileSample,
} from './types';

const SPEED_OF_LIGHT = 299_792_458;
const EARTH_RADIUS_METERS = 6_371_000;
const EPS = 1e-9;

const roundTo = (value: number, digits = 3): number => {
    const base = 10 ** digits;
    return Math.round(value * base) / base;
};

const resolveRecommendedLift = (samples: RrlProfileSample[], distanceMeters: number): RecommendedLift => {
    let onlyA = 0;
    let onlyB = 0;
    let bothEqual = 0;

    for (const sample of samples) {
        const deficit = Math.max(0, -sample.clearance60);
        if (deficit <= 0) {
            continue;
        }

        const ratio = sample.distanceMeters / distanceMeters;
        const influenceA = 1 - ratio;
        const influenceB = ratio;

        if (influenceA > EPS) {
            onlyA = Math.max(onlyA, deficit / influenceA);
        }

        if (influenceB > EPS) {
            onlyB = Math.max(onlyB, deficit / influenceB);
        }

        bothEqual = Math.max(bothEqual, deficit);
    }

    return {
        onlyA: roundTo(onlyA),
        onlyB: roundTo(onlyB),
        bothEqual: roundTo(bothEqual),
    };
};

export const calculateRrlProfile = (
    input: RrlProfileCalculateRequest,
    points: ProfilePoint[],
    elevations: ElevationPoint[],
    distanceMeters: number
): RrlProfileCalculateResponse => {
    if (points.length < 2 || elevations.length < 2) {
        throw new Error('Недостаточно точек для расчёта профиля.');
    }

    if (points.length !== elevations.length) {
        throw new Error('Количество точек трассы и высот не совпадает.');
    }

    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
        throw new Error('Некорректная длина трассы.');
    }

    const zA = elevations[0].elevation;
    const zB = elevations[elevations.length - 1].elevation;

    const antennaHeightA = input.antennaA;
    const antennaHeightB = input.antennaB;

    const HA = zA + antennaHeightA;
    const HB = zB + antennaHeightB;

    const frequencyHz = input.freqGHz * 1e9;
    const lambda = SPEED_OF_LIGHT / frequencyHz;
    const effectiveEarthRadius = input.kFactor * EARTH_RADIUS_METERS;

    const samples: RrlProfileSample[] = points.map((sample, index) => {
        const terrain = elevations[index].elevation;
        const d = sample.distanceMeters;
        const los = HA + ((HB - HA) * d) / distanceMeters;
        const bulge = (d * (distanceMeters - d)) / (2 * effectiveEarthRadius);
        const terrainEff = terrain + bulge;
        const fresnelR1 = Math.sqrt((lambda * d * (distanceMeters - d)) / distanceMeters);
        const fresnelLimitLine = los - 0.6 * fresnelR1;
        const clearance = los - terrainEff;
        const clearance60 = fresnelLimitLine - terrainEff;

        return {
            index: sample.index,
            lat: sample.lat,
            lon: sample.lon,
            distanceMeters: roundTo(d),
            terrain: roundTo(terrain),
            bulge: roundTo(bulge),
            terrainEff: roundTo(terrainEff),
            los: roundTo(los),
            fresnelR1: roundTo(fresnelR1),
            clearance: roundTo(clearance),
            clearance60: roundTo(clearance60),
            fresnelLimitLine: roundTo(fresnelLimitLine),
        };
    });

    let minClearance = Number.POSITIVE_INFINITY;
    let minClearance60 = Number.POSITIVE_INFINITY;
    let criticalIndex = 0;

    samples.forEach((sample, index) => {
        if (sample.clearance < minClearance) {
            minClearance = sample.clearance;
        }

        if (sample.clearance60 < minClearance60) {
            minClearance60 = sample.clearance60;
            criticalIndex = index;
        }
    });

    const criticalSample = samples[criticalIndex];

    return {
        input,
        summary: {
            distanceMeters: roundTo(distanceMeters),
            losOk: minClearance >= 0,
            fresnelOk: minClearance60 >= 0,
            minClearance: roundTo(minClearance),
            minClearance60: roundTo(minClearance60),
            criticalPoint: {
                index: criticalSample.index,
                distanceMeters: criticalSample.distanceMeters,
                lat: criticalSample.lat,
                lon: criticalSample.lon,
            },
            recommendedLift: resolveRecommendedLift(samples, distanceMeters),
        },
        samples,
    };
};
