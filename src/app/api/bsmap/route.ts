// src/app/api/bsmap/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { getBsCoordinateModel } from '@/server/models/BsCoordinateModel';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPERATOR_COLLECTIONS: Record<string, { collection: string; label: string }> = {
    t2: { collection: '38-t2-bs-coords', label: 'T2' },
    beeline: { collection: '38-beeline-bs-coords', label: 'Билайн' },
    megafon: { collection: '38-megafon-bs-coords', label: 'Мегафон' },
    mts: { collection: '38-mts-bs-coords', label: 'МТС' },
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const operatorParam = searchParams.get('operator')?.toLowerCase().trim() ?? 't2';
        const operator = OPERATOR_COLLECTIONS[operatorParam] ? operatorParam : 't2';
        const { collection } = OPERATOR_COLLECTIONS[operator];

        await dbConnect();
        const Model = getBsCoordinateModel(collection);
        const stations = await Model.find(
            {},
            { op: 1, name: 1, lat: 1, lon: 1, address: 1, mcc: 1, mnc: 1, region: 1 }
        )
            .lean()
            .exec();

        return NextResponse.json({
            operator,
            stations: stations.map((station) => ({
                _id: station._id.toString(),
                op: station.op ?? null,
                name: resolveStationName(station.name),
                lat: station.lat,
                lon: station.lon,
                address: station.address ?? null,
                mcc: station.mcc ?? null,
                mnc: station.mnc ?? null,
                region: station.region ?? null,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load base stations';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

type StationPayload = {
    op: string | null;
    name: string | null;
    lat: number;
    lon: number;
    address: string | null;
    mcc: string | null;
    mnc: string | null;
    region: string | null;
};
type StationDocument = StationPayload & { _id: Types.ObjectId | string };

function normalizeOperator(value: string | null | undefined): keyof typeof OPERATOR_COLLECTIONS | null {
    const key = value?.toLowerCase().trim();
    if (key && key in OPERATOR_COLLECTIONS) {
        return key as keyof typeof OPERATOR_COLLECTIONS;
    }
    return null;
}

function resolveStationName(primary: unknown): string | null {
    if (typeof primary === 'string') {
        const trimmed = primary.trim();
        if (trimmed) return trimmed;
    }
    return null;
}

function serializeStation(doc: StationDocument): StationPayload & { _id: string } {
    const name = resolveStationName(doc.name);
    return {
        _id: typeof doc._id === 'string' ? doc._id : doc._id.toString(),
        op: doc.op ?? null,
        name,
        lat: doc.lat,
        lon: doc.lon,
        address: doc.address ?? null,
        mcc: doc.mcc ?? null,
        mnc: doc.mnc ?? null,
        region: doc.region ?? null,
    };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as
            | {
                  operator?: string;
                  name?: string | null;
                  lat?: number;
                  lon?: number;
                  region?: string;
                  address?: string | null;
              }
            | null;

        if (!body || typeof body.lat !== 'number' || typeof body.lon !== 'number') {
            return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];
        const stationName = resolveStationName(body.name);
        if (!stationName) {
            return NextResponse.json({ error: 'Не указан номер БС' }, { status: 400 });
        }
        const regionValue = typeof body.region === 'string' && body.region.trim().length > 0 ? body.region.trim() : null;

        if (!regionValue) {
            return NextResponse.json({ error: 'Не указан регион' }, { status: 400 });
        }

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const createdDoc = await Model.create({
            op: operatorKey,
            name: stationName,
            lat: body.lat,
            lon: body.lon,
            region: regionValue,
            address: typeof body.address === 'string' && body.address.trim().length > 0 ? body.address.trim() : undefined,
        });
        const created = createdDoc.toObject() as StationDocument;

        return NextResponse.json({ station: serializeStation(created), operator: operatorKey }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось создать базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as
            | {
                  id?: string;
                  operator?: string;
                  name?: string | null;
                  lat?: number;
                  lon?: number;
                  region?: string | null;
                  address?: string | null;
              }
            | null;

        if (!body?.id) {
            return NextResponse.json({ error: 'Не указан идентификатор базовой станции' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];

        if (typeof body.lat !== 'number' || Number.isNaN(body.lat) || typeof body.lon !== 'number' || Number.isNaN(body.lon)) {
            return NextResponse.json({ error: 'Некорректные координаты' }, { status: 400 });
        }

        const updatePayload: Partial<StationPayload> = {
            lat: body.lat,
            lon: body.lon,
            region:
                typeof body.region === 'string' && body.region.trim().length > 0
                    ? body.region.trim()
                    : undefined,
        };

        const resolvedName = resolveStationName(body.name);
        if (resolvedName !== null) {
            updatePayload.name = resolvedName;
        }
        if (typeof body.address === 'string') {
            const trimmed = body.address.trim();
            updatePayload.address = trimmed.length > 0 ? trimmed : null;
        } else if (body.address === null) {
            updatePayload.address = null;
        }

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const updated = (await Model.findByIdAndUpdate(body.id, { $set: updatePayload }, { new: true, lean: true })) as
            | StationDocument
            | null;

        if (!updated) {
            return NextResponse.json({ error: 'Базовая станция не найдена' }, { status: 404 });
        }

        return NextResponse.json({ station: serializeStation(updated), operator: operatorKey });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось обновить базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as { id?: string; operator?: string } | null;

        if (!body?.id) {
            return NextResponse.json({ error: 'Не указан идентификатор базовой станции' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const deleted = (await Model.findByIdAndDelete(body.id).lean()) as StationDocument | null;

        if (!deleted) {
            return NextResponse.json({ error: 'Базовая станция не найдена' }, { status: 404 });
        }

        return NextResponse.json({ success: true, id: body.id });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось удалить базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
