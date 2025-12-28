import 'server-only';

// src/server/models/BsCoordinateModel.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import { BASE_STATION_COLLECTIONS } from '@/app/constants/baseStations';

export const IRKUTSK_REGION_CODE = '38';
export const T2_OPERATOR_CODE = '250020';
const T2_OPERATOR_SLUGS = new Set(['t2', 't-2', '250020', '250-20']);
const DEFAULT_COLLECTION =
    BASE_STATION_COLLECTIONS[0]?.collection || '38-t2-bs-coords';

export interface BsCoordinate extends Document {
    name?: string;
    coordinates?: string;
    address?: string;
    lat?: number;
    lon?: number;
    coordKey?: string;
    source?: string;
    region?: string;
    op?: string;
    operatorCode?: string;
    mcc?: string;
    mnc?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const to6 = (x: number) => Number(x.toFixed(6));

export function makeCoordKey(lat: number, lon: number): string {
    const lat6 = to6(lat);
    const lon6 = to6(lon);
    return `${lat6}|${lon6}`;
}

export function normalizeCoords(lat?: number | null, lon?: number | null): {
    lat?: number;
    lon?: number;
    coordKey?: string;
    coordinates?: string;
} {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
        return {};
    }
    const lat6 = to6(lat);
    const lon6 = to6(lon);
    return {
        lat: lat6,
        lon: lon6,
        coordKey: `${lat6}|${lon6}`,
        coordinates: `${lat6} ${lon6}`,
    };
}

export function normalizeBsNumber(input: string): string {
    if (!input) return '';
    const base = input.split(',')[0] ?? input;
    return base.trim().toUpperCase();
}

export function normalizeOperatorCode(input?: string | null): string | undefined {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    if (T2_OPERATOR_SLUGS.has(lower)) return T2_OPERATOR_CODE;
    return trimmed;
}

export function isIrkutskT2(region?: string | null, operator?: string | null): boolean {
    const reg = (region ?? '').trim();
    if (reg !== IRKUTSK_REGION_CODE) return false;
    if (!operator) return false;
    const op = operator.trim().toLowerCase();
    if (!op) return false;
    if (T2_OPERATOR_SLUGS.has(op)) return true;
    return operator.trim() === T2_OPERATOR_CODE;
}

const schema = new Schema<BsCoordinate>(
    {
        name: { type: String, index: true },
        coordinates: { type: String, default: '' },
        address: { type: String, default: '' },
        lat: { type: Number },
        lon: { type: Number },
        coordKey: { type: String, index: true, unique: true, sparse: true },
        source: { type: String, default: 'kmz' },
        region: { type: String, index: true },
        op: { type: String, index: true },
        operatorCode: { type: String, index: true },
        mcc: { type: String },
        mnc: { type: String },
    },
    { timestamps: true }
);

// normalize coords/name/op/region before save
schema.pre('save', function (next) {
    const normalized = normalizeCoords(this.lat, this.lon);
    if (typeof normalized.lat === 'number' && typeof normalized.lon === 'number') {
        this.lat = normalized.lat;
        this.lon = normalized.lon;
        this.coordinates = normalized.coordinates;
        this.coordKey = normalized.coordKey;
    }

    if (this.name) {
        this.name = normalizeBsNumber(this.name);
    }

    if (typeof this.region === 'string') {
        const trimmedRegion = this.region.trim();
        this.region = trimmedRegion || undefined;
    }

    const opCode = normalizeOperatorCode(this.operatorCode || this.op);
    if (opCode) {
        this.operatorCode = opCode;
        if (!this.op && opCode === T2_OPERATOR_CODE) this.op = 't2';
        if (opCode === T2_OPERATOR_CODE) {
            if (!this.mcc) this.mcc = '250';
            if (!this.mnc) this.mnc = '020';
        }
    }

    next();
});

const MODEL_CACHE: Record<string, Model<BsCoordinate>> = {};

export function getBsCoordinateModel(collectionName: string): Model<BsCoordinate> {
    if (!MODEL_CACHE[collectionName]) {
        const modelName = `BsCoordinate_${collectionName}`;
        MODEL_CACHE[collectionName] =
            (mongoose.models[modelName] as Model<BsCoordinate>) ||
            mongoose.model<BsCoordinate>(modelName, schema, collectionName);
    }
    return MODEL_CACHE[collectionName];
}

export function getDefaultBsCoordinateModel(): Model<BsCoordinate> {
    return getBsCoordinateModel(DEFAULT_COLLECTION);
}

// Ensure default Irkutsk T2 station exists/updated (used in tasks sync)
type StationSyncPayload = {
    bsNumber: string;
    bsAddress?: string;
    lat?: number | null;
    lon?: number | null;
    region?: string | null;
    operatorCode?: string | null;
};

function sanitizeCoordinate(value?: number | null): number | undefined {
    if (typeof value !== 'number') return undefined;
    if (!Number.isFinite(value)) return undefined;
    return Number(value.toFixed(6));
}

export async function ensureIrkutskT2Station(payload: StationSyncPayload): Promise<void> {
    if (!isIrkutskT2(payload.region, payload.operatorCode)) return;
    const normalized = normalizeBsNumber(payload.bsNumber);
    if (!normalized) return;

    const lat = sanitizeCoordinate(payload.lat);
    const lon = sanitizeCoordinate(payload.lon);

    const Model = getDefaultBsCoordinateModel();
    const match = await Model.findOne({ name: normalized });

    if (!match) {
        await Model.create({
            name: normalized,
            address: payload.bsAddress?.trim() || undefined,
            lat,
            lon,
            region: IRKUTSK_REGION_CODE,
            op: 't2',
            operatorCode: T2_OPERATOR_CODE,
            mcc: '250',
            mnc: '020',
            source: 'tasks',
        });
        return;
    }

    let dirty = false;

    if (!match.address && payload.bsAddress) {
        match.address = payload.bsAddress.trim();
        dirty = true;
    }
    if (typeof lat === 'number' && typeof match.lat !== 'number') {
        match.lat = lat;
        dirty = true;
    }
    if (typeof lon === 'number' && typeof match.lon !== 'number') {
        match.lon = lon;
        dirty = true;
    }
    if (!match.region) {
        match.region = IRKUTSK_REGION_CODE;
        dirty = true;
    }
    if (!match.operatorCode) {
        match.operatorCode = T2_OPERATOR_CODE;
        dirty = true;
    }
    if (!match.op) {
        match.op = 't2';
        dirty = true;
    }
    if (!match.mcc) {
        match.mcc = '250';
        dirty = true;
    }
    if (!match.mnc) {
        match.mnc = '020';
        dirty = true;
    }
    if (!match.source) {
        match.source = 'tasks';
        dirty = true;
    }

    if (dirty) {
        await match.save();
    }
}
