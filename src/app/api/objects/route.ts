// src/app/api/objects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import mongoose from 'mongoose';
import { getBsCoordinateModel, normalizeBsNumber } from '@/server/models/BsCoordinateModel';
import { resolveBsCollectionName } from '@/app/utils/bsCollections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StationDoc = {
    _id: mongoose.Types.ObjectId | string;
    name?: string;
    address?: string;
    lat?: number | null;
    lon?: number | null;
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

        const collectionName = resolveBsCollectionName(region, operator);
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
