import { validateRrlProfileInput } from '@/lib/rrl/validators';

describe('validateRrlProfileInput', () => {
    it('accepts valid payload', () => {
        const payload = {
            a: { lat: 52.072472, lon: 113.376417 },
            b: { lat: 52.074328, lon: 113.385764 },
            antennaA: 30,
            antennaB: 20,
            freqGHz: 18,
            kFactor: 1.33,
            stepMeters: 30,
        };

        const result = validateRrlProfileInput(payload);

        expect(result.success).toBe(true);
    });

    it('rejects same coordinates for A and B', () => {
        const payload = {
            a: { lat: 52.072472, lon: 113.376417 },
            b: { lat: 52.072472, lon: 113.376417 },
            antennaA: 30,
            antennaB: 20,
            freqGHz: 18,
            kFactor: 1.33,
            stepMeters: 30,
        };

        const result = validateRrlProfileInput(payload);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.message).toContain('совпадают');
        }
    });

    it('rejects invalid ranges', () => {
        const payload = {
            a: { lat: 120, lon: 113.376417 },
            b: { lat: 52.074328, lon: 113.385764 },
            antennaA: -1,
            antennaB: 20,
            freqGHz: 0,
            kFactor: -1,
            stepMeters: 0,
        };

        const result = validateRrlProfileInput(payload);

        expect(result.success).toBe(false);
    });
});
