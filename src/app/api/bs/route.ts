// app/api/bs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getBsCoordinateModel, normalizeBsNumber, normalizeCoords } from '@/server/models/BsCoordinateModel';
import { resolveBsCollectionName } from '@/app/utils/bsCollections';
import dbConnect from '@/server/db/mongoose';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const region = searchParams.get('region');
    const operator = searchParams.get('operator');
    const collectionName = resolveBsCollectionName(region, operator);
    if (!collectionName) {
      return NextResponse.json(
        { message: 'Не указан регион или оператор' },
        { status: 400 }
      );
    }

    // Агрегация для группировки и выбора последней версии
    const stations = await getBsCoordinateModel(collectionName).aggregate([
      {
        $match: {
          name: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$name',
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
    ]);

    return NextResponse.json(stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json(
      { message: 'Ошибка загрузки базовых станций' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    if (!body.name || !body.coordinates) {
      return NextResponse.json(
        { message: 'Необходимо указать номер и координаты БС' },
        { status: 400 }
      );
    }

    const collectionName = resolveBsCollectionName(body.region, body.operator);
    if (!collectionName) {
      return NextResponse.json(
        { message: 'Не указан регион или оператор' },
        { status: 400 }
      );
    }

    const normalizedName = normalizeBsNumber(body.name);
    const Model = getBsCoordinateModel(collectionName);
    const existingStation = await Model.findOne({ name: normalizedName });
    if (existingStation) {
      return NextResponse.json(
        { message: 'Базовая станция с таким номером уже существует' },
        { status: 400 }
      );
    }

    const [latRaw, lonRaw] = String(body.coordinates)
      .split(/\s+/)
      .map((part: string) => Number(part.replace(',', '.')));
    const normalizedCoords = normalizeCoords(latRaw, lonRaw);
    if (typeof normalizedCoords.lat !== 'number' || typeof normalizedCoords.lon !== 'number') {
      return NextResponse.json(
        { message: 'Некорректные координаты' },
        { status: 400 }
      );
    }

    const newStation = new Model({
      name: normalizedName,
      address: body.address ?? '',
      lat: normalizedCoords.lat,
      lon: normalizedCoords.lon,
      coordinates: normalizedCoords.coordinates,
      coordKey: normalizedCoords.coordKey,
      op: body.op ?? null,
      region: body.region ?? null,
      source: body.source ?? 'manual',
    });
    await newStation.save();

    return NextResponse.json(newStation, { status: 201 });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json(
      { message: 'Ошибка создания базовой станции' },
      { status: 500 }
    );
  }
}
