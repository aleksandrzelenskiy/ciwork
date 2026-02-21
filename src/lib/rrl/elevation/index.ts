import type { ElevationProvider } from './provider';
import { OpenTopoDataProvider } from './opentopodata';
import { OpenMeteoElevationProvider } from './openmeteo';

const resolveProviderName = (): string => {
    const fromEnv = process.env.ELEVATION_PROVIDER?.trim().toLowerCase();
    return fromEnv || 'opentopodata';
};

export const createElevationProviders = (): ElevationProvider[] => {
    const selected = resolveProviderName();

    if (selected === 'openmeteo') {
        return [new OpenMeteoElevationProvider(), new OpenTopoDataProvider()];
    }

    return [new OpenTopoDataProvider(), new OpenMeteoElevationProvider()];
};
