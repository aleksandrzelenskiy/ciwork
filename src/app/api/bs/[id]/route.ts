// app/api/bs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getBsCoordinateModel, normalizeBsNumber } from '@/server/models/BsCoordinateModel';
import { resolveBsCollectionName } from '@/app/utils/bsCollections';
import dbConnect from '@/server/db/mongoose';

export async function PUT(req: NextRequest) {
  await dbConnect();
  try {
    // Получаем ID из URL вручную
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    const region = url.searchParams.get('region');
    const operator = url.searchParams.get('operator');
    const collectionName = resolveBsCollectionName(region, operator);
    if (!collectionName) {
      return NextResponse.json(
        { message: 'Не указан регион или оператор' },
        { status: 400 }
      );
    }

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { message: 'Неверный ID станции' },
        { status: 400 }
      );
    }

    const body = await req.json();

    const Model = getBsCoordinateModel(collectionName);
    const existingStation = await Model.findById(id);
    if (!existingStation) {
      return NextResponse.json(
        { message: 'Базовая станция не найдена' },
        { status: 404 }
      );
    }

    if (body.name) {
      const normalizedName = normalizeBsNumber(body.name);
      const duplicateStation = await Model.findOne({ name: normalizedName, _id: { $ne: id } });
      if (duplicateStation) {
        return NextResponse.json(
          { message: 'Базовая станция с таким номером уже существует' },
          { status: 400 }
        );
      }
      existingStation.name = normalizedName;
    }
    existingStation.coordinates =
      body.coordinates || existingStation.coordinates;
    await existingStation.save();

    return NextResponse.json(existingStation);
  } catch (error) {
    console.error('Error updating station:', error);
    return NextResponse.json(
      { message: 'Ошибка обновления базовой станции' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await dbConnect();
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    const region = url.searchParams.get('region');
    const operator = url.searchParams.get('operator');
    const collectionName = resolveBsCollectionName(region, operator);
    if (!collectionName) {
      return NextResponse.json(
        { message: 'Не указан регион или оператор' },
        { status: 400 }
      );
    }

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { message: 'Неверный ID станции' },
        { status: 400 }
      );
    }

    const Model = getBsCoordinateModel(collectionName);
    const deletedStation = await Model.findByIdAndDelete(id);
    if (!deletedStation) {
      return NextResponse.json(
        { message: 'Базовая станция не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Базовая станция успешно удалена' });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json(
      { message: 'Ошибка удаления базовой станции' },
      { status: 500 }
    );
  }
}
