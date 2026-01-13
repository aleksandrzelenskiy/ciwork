// src/app/utils/syncBsCoords.ts

import mongoose, { Types } from 'mongoose';
import { BASE_STATION_COLLECTIONS } from '@/app/constants/baseStations';
import { normalizeOperatorCode } from '@/app/utils/operators';

export interface BsLocationItem {
    name: string;
    coordinates: string;
    address?: string;
}

export interface SyncBsCoordsParams {
    region?: string | null;
    operatorCode?: string | null;
    bsNumber?: string | null;
    bsAddress?: string | null;
    bsLocation?: BsLocationItem[] | null;
    lat?: number | null;
    lon?: number | null;
}

// парсим координаты "lat lon"
function parseCoordsPair(value?: string | null): { lat?: number; lon?: number } {
    if (!value) return {};
    const trimmed = value.trim();
    if (!trimmed) return {};
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return {};

    const latRaw = Number(parts[0].replace(',', '.'));
    const lonRaw = Number(parts[1].replace(',', '.'));

    const latOk = Number.isFinite(latRaw) && latRaw >= -90 && latRaw <= 90;
    const lonOk = Number.isFinite(lonRaw) && lonRaw >= -180 && lonRaw <= 180;

    return {
        lat: latOk ? Number(latRaw.toFixed(6)) : undefined,
        lon: lonOk ? Number(lonRaw.toFixed(6)) : undefined,
    };
}

// сравнение чисел координат
function coordsEqual(a?: number, b?: number): boolean {
    if (typeof a !== 'number' || typeof b !== 'number') return false;
    return Number(a.toFixed(6)) === Number(b.toFixed(6));
}

/**
 * Синхронизирует БС из задачи с коллекцией координат региона/оператора:
 *  - если записи нет → вставляет (name, lat, lon, address, coordKey, region, op)
 *  - если есть и отсутствуют координаты или адрес → дополняет
 *  - если координаты или адрес отличаются → обновляет
 */
function resolveCollectionName(region?: string | null, operatorCode?: string | null): string | null {
    const normalizedRegion = region?.toString().trim();
    const normalizedOperator = normalizeOperatorCode(operatorCode) ?? operatorCode?.toString().trim();
    if (!normalizedRegion || !normalizedOperator) return null;

    const mapping = BASE_STATION_COLLECTIONS.find(
        (entry) => entry.region === normalizedRegion && entry.operator === normalizedOperator
    );

    if (mapping?.collection) {
        return mapping.collection;
    }

    return `${normalizedRegion}-${normalizedOperator}-bs-coords`;
}

export async function syncBsCoordsForProject(params: SyncBsCoordsParams): Promise<void> {
    const {
        region,
        operatorCode,
        bsNumber,
        bsAddress,
        bsLocation,
        lat,
        lon,
    } = params;

    const normalizedRegion = region?.toString().trim();
    const op = normalizeOperatorCode(operatorCode) ?? operatorCode?.toString().trim();

    if (!normalizedRegion || !op) {
        // нет привязки к региону/оператору
        return;
    }

    const db = mongoose.connection.db;
    if (!db) {
        console.error('[syncBsCoordsForProject] mongoose.connection.db is not available');
        return;
    }

    // пример: "38-250020-bs-coords"
    const collectionName = resolveCollectionName(normalizedRegion, op);
    if (!collectionName) return;
    const col = db.collection(collectionName);

    // Собираем список БС, которые нужно синхронизировать
    const items: { name: string; lat?: number; lon?: number; address?: string }[] = [];

    if (Array.isArray(bsLocation) && bsLocation.length > 0) {
        const useFallbackAddress = bsLocation.length === 1;

        for (const loc of bsLocation) {
            const name = loc?.name?.trim();
            if (!name) continue;

            const fromCoords = parseCoordsPair(loc.coordinates);
            let itemLat = fromCoords.lat;
            let itemLon = fromCoords.lon;

            // если в bsLocation координат нет, но сверху есть lat/lon и БС одна — используем их
            if (
                (typeof itemLat !== 'number' || typeof itemLon !== 'number') &&
                typeof lat === 'number' &&
                typeof lon === 'number' &&
                bsLocation.length === 1
            ) {
                itemLat = Number(lat.toFixed(6));
                itemLon = Number(lon.toFixed(6));
            }

            const addr =
                (loc.address ?? '').trim() ||
                (useFallbackAddress ? (bsAddress ?? '').trim() : '');
            const resolvedAddress = addr || undefined;

            if (!name && !resolvedAddress && typeof itemLat !== 'number' && typeof itemLon !== 'number') {
                continue;
            }

            items.push({
                name,
                lat: itemLat,
                lon: itemLon,
                address: resolvedAddress,
            });
        }

    } else if (bsNumber) {
        // fallback — одна БС без массива bsLocation
        const name = bsNumber.trim();
        if (name && !name.includes('-')) {
            const itemLat = typeof lat === 'number' ? Number(lat.toFixed(6)) : undefined;
            const itemLon = typeof lon === 'number' ? Number(lon.toFixed(6)) : undefined;

            const addr = bsAddress?.trim() || undefined;

            items.push({
                name,
                lat: itemLat,
                lon: itemLon,
                address: addr,
            });
        }
    }


    if (!items.length) return;

    for (const item of items) {
        const name = item.name;
        if (!name) continue;

        const hasNewCoords = typeof item.lat === 'number' && typeof item.lon === 'number';
        const hasNewAddress = typeof item.address === 'string' && item.address.trim().length > 0;

        if (!hasNewCoords && !hasNewAddress) {
            // ничего нового записать не можем - продолжаем
            continue;
        }

        try {
            const existing = await col.findOne<{
                _id: Types.ObjectId;
                name?: string;
                lat?: number;
                lon?: number;
                address?: string;
                operatorCode?: string;
            }>({ name });

            if (!existing) {
                // БС нет в коллекции → добавляем
                const doc: Record<string, unknown> = {
                    name,
                    region: normalizedRegion,
                    op,
                    operatorCode: op,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                if (hasNewCoords) {
                    doc.lat = item.lat;
                    doc.lon = item.lon;
                    doc.coordKey = `${item.lat}|${item.lon}`;
                }
                if (hasNewAddress) {
                    doc.address = item.address;
                }

                await col.insertOne(doc);
                continue;
            }

            // БС есть → проверяем, нужно ли обновлять
            const update: Record<string, unknown> = {};
            let needUpdate = false;

            if (hasNewAddress) {
                const existingAddr = existing.address?.trim() || '';
                const newAddr = item.address!.trim();
                if (!existingAddr || existingAddr !== newAddr) {
                    update.address = newAddr;
                    needUpdate = true;
                }
            }

            if (hasNewCoords) {
                const existingLat = typeof existing.lat === 'number' ? existing.lat : undefined;
                const existingLon = typeof existing.lon === 'number' ? existing.lon : undefined;

                if (
                    existingLat == null ||
                    existingLon == null ||
                    !coordsEqual(existingLat, item.lat) ||
                    !coordsEqual(existingLon, item.lon)
                ) {
                    update.lat = item.lat;
                    update.lon = item.lon;
                    update.coordKey = `${item.lat}|${item.lon}`;
                    needUpdate = true;
                }
            }

            if (!existing.operatorCode && op) {
                update.operatorCode = op;
                needUpdate = true;
            }

            if (needUpdate) {
                update.updatedAt = new Date();
                await col.updateOne({ _id: existing._id }, { $set: update });
            }
        } catch (err) {
            console.error('[syncBsCoordsForProject] error for', { region: normalizedRegion, op, name }, err);
        }
    }
}
