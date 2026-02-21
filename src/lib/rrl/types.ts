export type CoordinateInput = {
    lat: number;
    lon: number;
    name?: string;
};

export type RrlProfileCalculateRequest = {
    a: CoordinateInput;
    b: CoordinateInput;
    antennaA: number;
    antennaB: number;
    freqGHz: number;
    kFactor: number;
    stepMeters: number;
};

export type ElevationPoint = {
    lat: number;
    lon: number;
    elevation: number;
};

export type ProfilePoint = {
    index: number;
    lat: number;
    lon: number;
    distanceMeters: number;
};

export type RrlProfileSample = {
    index: number;
    lat: number;
    lon: number;
    distanceMeters: number;
    terrain: number;
    bulge: number;
    terrainEff: number;
    los: number;
    fresnelR1: number;
    clearance: number;
    clearance60: number;
    fresnelLimitLine: number;
};

export type CriticalPoint = {
    index: number;
    distanceMeters: number;
    lat: number;
    lon: number;
};

export type RecommendedLift = {
    onlyA: number;
    onlyB: number;
    bothEqual: number;
};

export type RrlProfileSummary = {
    distanceMeters: number;
    losOk: boolean;
    fresnelOk: boolean;
    minClearance: number;
    minClearance60: number;
    criticalPoint: CriticalPoint;
    recommendedLift: RecommendedLift;
};

export type RrlProfileCalculateResponse = {
    input: RrlProfileCalculateRequest;
    summary: RrlProfileSummary;
    samples: RrlProfileSample[];
};

export type AppErrorCode =
    | 'VALIDATION_ERROR'
    | 'ELEVATION_ERROR'
    | 'CALCULATION_ERROR'
    | 'INTERNAL_ERROR';

export type ApiErrorPayload = {
    error: {
        code: AppErrorCode;
        message: string;
        details?: string;
    };
};
