import { BASE_STATION_COLLECTIONS } from '@/app/constants/baseStations';
import { normalizeOperatorCode } from '@/app/utils/operators';
import { REGION_ISO_MAP, REGION_MAP } from '@/app/utils/regions';

export const normalizeRegionCode = (input?: string | null): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const directMatch = REGION_MAP.get(trimmed);
    if (directMatch) return directMatch.code;

    const isoMatch = REGION_ISO_MAP.get(trimmed);
    if (isoMatch) return isoMatch.code;

    return trimmed;
};

export const normalizeOperator = (input?: string | null): string | null => {
    if (!input) return null;
    const normalized = normalizeOperatorCode(input);
    if (normalized) return normalized;
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const resolveBsCollectionName = (
    region?: string | null,
    operator?: string | null
): string | null => {
    const normalizedRegion = normalizeRegionCode(region);
    const normalizedOperator = normalizeOperator(operator);
    if (!normalizedRegion || !normalizedOperator) return null;

    const entry = BASE_STATION_COLLECTIONS.find(
        (item) => item.region === normalizedRegion && item.operator === normalizedOperator
    );

    return entry?.collection ?? `${normalizedRegion}-${normalizedOperator}-bs-coords`;
};
