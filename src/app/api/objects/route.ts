// src/app/api/objects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import mongoose from 'mongoose';
import { getBsCoordinateModel, normalizeBsNumber } from '@/server/models/BsCoordinateModel';
import { BASE_STATION_COLLECTIONS } from '@/app/constants/baseStations';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StationDoc = {
    _id: mongoose.Types.ObjectId | string;
    name?: string;
    address?: string;
    lat?: number | null;
    lon?: number | null;
};

const normalizeRegionCode = (input?: string | null): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const directMatch = REGION_MAP.get(trimmed);
    if (directMatch) return directMatch.code;

    const isoMatch = REGION_ISO_MAP.get(trimmed);
    if (isoMatch) return isoMatch.code;

    return trimmed;
};

const findCollectionName = (region?: string | null, operator?: string | null): string | null => {
    const normalizedRegion = normalizeRegionCode(region);
    if (!normalizedRegion || !operator) return null;
    const normalizedOperator = operator.trim();
    if (!normalizedOperator) return null;

    const entry = BASE_STATION_COLLECTIONS.find(
        (item) => item.region === normalizedRegion && item.operator === normalizedOperator
    );

    return entry?.collection ?? null;
};

const mapStation = (doc: StationDoc) => {
    const id = typeof doc._id === 'string' ? doc._id : doc._id.toString();
    const stationName = doc.name || '';
    return {
        id,
        name: normalizeBsNumber(stationName),
        address: doc.address ?? '',
        lat: typeof doc.lat === 'number' ? doc.lat : null,
        lon: typeof doc.lon === 'number' ? doc.lon : null,
    };
};

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q')?.trim() ?? '';
        const limit = Number(searchParams.get('limit') ?? 20);
        const region = searchParams.get('region');
        const operator = searchParams.get('operator');

        const collectionName = findCollectionName(region, operator);
        if (!collectionName) {
            return NextResponse.json({ objects: [] });
        }

        const BaseStationModel = getBsCoordinateModel(collectionName);

        const filter: Record<string, unknown> = {};
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { address: { $regex: q, $options: 'i' } },
            ];
        }

        const docs = await BaseStationModel.find(filter)
            .sort({ name: 1 })
            .limit(limit)
            .lean<StationDoc[]>();

        return NextResponse.json({
            objects: docs.map((doc) => mapStation(doc)),
        });
    } catch (e: unknown) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to load objects' }, { status: 500 });
    }
}
