import { calculateRrlProfile } from '@/lib/rrl/radio-calculations';
import type { ElevationPoint, ProfilePoint, RrlProfileCalculateRequest } from '@/lib/rrl/types';

const makeInput = (): RrlProfileCalculateRequest => ({
    a: { lat: 52.072472, lon: 113.376417, name: 'A' },
    b: { lat: 52.074328, lon: 113.385764, name: 'B' },
    antennaA: 30,
    antennaB: 20,
    freqGHz: 18,
    kFactor: 1.33,
    stepMeters: 30,
});

const profilePoints: ProfilePoint[] = [
    { index: 0, lat: 52.072472, lon: 113.376417, distanceMeters: 0 },
    { index: 1, lat: 52.0734, lon: 113.3811, distanceMeters: 500 },
    { index: 2, lat: 52.074328, lon: 113.385764, distanceMeters: 1000 },
];

describe('calculateRrlProfile', () => {
    it('returns positive LoS and Fresnel clearance for flat profile', () => {
        const elevations: ElevationPoint[] = [
            { lat: profilePoints[0].lat, lon: profilePoints[0].lon, elevation: 100 },
            { lat: profilePoints[1].lat, lon: profilePoints[1].lon, elevation: 100 },
            { lat: profilePoints[2].lat, lon: profilePoints[2].lon, elevation: 100 },
        ];

        const result = calculateRrlProfile(makeInput(), profilePoints, elevations, 1000);

        expect(result.summary.losOk).toBe(true);
        expect(result.summary.fresnelOk).toBe(true);
        expect(result.summary.minClearance).toBeGreaterThan(0);
        expect(result.summary.minClearance60).toBeGreaterThan(0);
        expect(result.samples).toHaveLength(3);
        expect(result.samples[1].fresnelR1).toBeGreaterThan(0);
    });

    it('detects blocked path and returns mast lift recommendations', () => {
        const elevations: ElevationPoint[] = [
            { lat: profilePoints[0].lat, lon: profilePoints[0].lon, elevation: 100 },
            { lat: profilePoints[1].lat, lon: profilePoints[1].lon, elevation: 150 },
            { lat: profilePoints[2].lat, lon: profilePoints[2].lon, elevation: 100 },
        ];

        const result = calculateRrlProfile(makeInput(), profilePoints, elevations, 1000);

        expect(result.summary.losOk).toBe(false);
        expect(result.summary.fresnelOk).toBe(false);
        expect(result.summary.minClearance60).toBeLessThan(0);
        expect(result.summary.recommendedLift.bothEqual).toBeGreaterThan(0);
        expect(result.summary.recommendedLift.onlyA).toBeGreaterThanOrEqual(
            result.summary.recommendedLift.bothEqual
        );
        expect(result.summary.recommendedLift.onlyB).toBeGreaterThanOrEqual(
            result.summary.recommendedLift.bothEqual
        );
    });

    it('throws on invalid points/elevations length mismatch', () => {
        const elevations: ElevationPoint[] = [
            { lat: profilePoints[0].lat, lon: profilePoints[0].lon, elevation: 100 },
            { lat: profilePoints[1].lat, lon: profilePoints[1].lon, elevation: 100 },
        ];

        expect(() =>
            calculateRrlProfile(makeInput(), profilePoints, elevations, 1000)
        ).toThrow('Количество точек трассы и высот не совпадает.');
    });
});
