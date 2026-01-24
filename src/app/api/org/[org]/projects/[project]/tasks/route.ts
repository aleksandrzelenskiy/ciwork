// src/app/api/org/[org]/projects/[project]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { Types } from 'mongoose';
import { getOrgAndProjectByRef } from '@/server/org/project-ref';
import { ensureIrkutskT2Station } from '@/server/models/BsCoordinateModel';
import { notifyTaskAssignment } from '@/server/tasks/notifications';
import { syncBsCoordsForProject } from '@/app/utils/syncBsCoords';
import { buildBsAddressFromLocations, sanitizeBsLocationAddresses } from '@/utils/bsLocation';
import { splitAttachmentsAndDocuments } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import { addReverseRelations } from '@/app/utils/relatedTasksSync';
import { ensureSubscriptionWriteAccess } from '@/utils/subscriptionBilling';
import { ensureMonthlyTaskSlot } from '@/utils/taskLimits';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

const TASK_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genTaskId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += TASK_ID_ALPHABET[Math.floor(Math.random() * TASK_ID_ALPHABET.length)];
    return s;
}

function normalizeStatus(input?: string) {
    if (!input) return 'To do';
    const s = input.trim().toLowerCase();
    if (['to do', 'todo', 'to_do', 'to-do'].includes(s)) return 'To do';
    if (s === 'assigned') return 'Assigned';
    if (['in progress', 'in_progress', 'at work'].includes(s)) return 'At work';
    if (s === 'done') return 'Done';
    if (s === 'pending') return 'Pending';
    if (['issues', 'blocked', 'problem'].includes(s)) return 'Issues';
    if (s === 'fixed') return 'Fixed';
    if (['agreed', 'approved'].includes(s)) return 'Agreed';
    return 'To do';
}

const SAFE_SORT_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'dueDate',
    'priority',
    'status',
    'taskId',
    'taskName',
]);

function sanitizeSortParam(raw: string) {
    const field = raw.replace(/^-/, '');
    if (!SAFE_SORT_FIELDS.has(field)) return '-createdAt';
    return raw.startsWith('-') ? `-${field}` : field;
}

function parseCoordinatesPair(value?: string | null): { lat?: number; lon?: number } {
    if (!value) return {};
    const trimmed = value.trim();
    if (!trimmed) return {};
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return {};
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    return {
        lat: Number.isFinite(lat) ? Number(lat.toFixed(6)) : undefined,
        lon: Number.isFinite(lon) ? Number(lon.toFixed(6)) : undefined,
    };
}

function toObjectId(id: unknown): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
}

type OrgDocLean = {
    _id: unknown;
    orgSlug?: string;
    name?: string;
};

type ProjectDocLean = {
    _id: unknown;
    key?: string;
    name?: string;
    regionCode?: string;
    operator?: string;
};

type OrgProjectRelOk = { orgDoc: OrgDocLean; projectDoc: ProjectDocLean };
type OrgProjectRelErr = { error: string };

function isOrgProjectRelOk(value: unknown): value is OrgProjectRelOk {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (!('orgDoc' in obj) || !('projectDoc' in obj)) return false;
    const orgDoc = obj.orgDoc as Record<string, unknown> | null;
    const projectDoc = obj.projectDoc as Record<string, unknown> | null;
    return Boolean(
        orgDoc &&
            typeof orgDoc === 'object' &&
            '_id' in orgDoc &&
            projectDoc &&
            typeof projectDoc === 'object' &&
            '_id' in projectDoc
    );
}

function getOrgProjectError(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const obj = value as Partial<OrgProjectRelErr>;
    return typeof obj.error === 'string' ? obj.error : undefined;
}

function getDocObjectId(doc: unknown): Types.ObjectId | null {
    if (!doc || typeof doc !== 'object') return null;
    const rawId = (doc as { _id?: unknown })._id;
    if (!rawId) return null;
    return toObjectId(rawId);
}
  
type WorkItemInput = {
    workType: string;
    quantity: number;
    unit: string;
    note?: string;
};

function sanitizeWorkItems(raw: unknown): WorkItemInput[] | null {
    if (!Array.isArray(raw)) return null;
    const cleaned: WorkItemInput[] = [];

    raw.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const source = item as Partial<WorkItemInput> & Record<string, unknown>;
        const workType = typeof source.workType === 'string' ? source.workType.trim() : '';
        const unit = typeof source.unit === 'string' ? source.unit.trim() : '';
        const quantityRaw = source.quantity;
        const quantity = typeof quantityRaw === 'number' ? quantityRaw : Number(quantityRaw);
        if (!workType || !unit || !Number.isFinite(quantity)) return;
        const note =
            typeof source.note === 'string' && source.note.trim() ? source.note.trim() : undefined;
        cleaned.push({ workType, quantity, unit, note });
    });

    return cleaned;
}

type CreateTaskBody = {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name: string; coordinates: string; address?: string }>;
    bsLatitude?: number;
    bsLongitude?: number;
    totalCost?: number | string;
    contractorPayment?: number | string;
    workItems?: unknown[];
    status?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    dueDate?: string;
    taskType?: 'construction' | 'installation' | 'document';
    requiredAttachments?: Array<'photo' | 'pdf' | 'doc' | 'xlsm' | 'xlsx' | 'dwg'>;
    orderUrl?: string;
    orderNumber?: string;
    orderDate?: string;
    orderSignDate?: string;
    taskDescription?: string;
    initiatorName?: string;
    initiatorEmail?: string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    relatedTasks?: unknown[];
    [extra: string]: unknown;
};

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, project } = await ctx.params;

        const relUnknown = (await getOrgAndProjectByRef(org, project)) as unknown;
        if (!isOrgProjectRelOk(relUnknown)) {
            const reason = getOrgProjectError(relUnknown) ?? 'Org or project not found';
            console.warn('[GET tasks] not found:', { org, project, reason });
            return NextResponse.json({ error: reason }, { status: 404 });
        }
        const rel = relUnknown;

        const orgObjId = getDocObjectId(rel.orgDoc);
        const projectObjId = getDocObjectId(rel.projectDoc);
        if (!orgObjId || !projectObjId) {
            return NextResponse.json({ error: 'Org or project not found' }, { status: 404 });
        }

        const access = await ensureSubscriptionWriteAccess(orgObjId);
        if (!access.ok) {
            return NextResponse.json(
                {
                    error: access.reason || 'Недостаточно средств для оплаты подписки',
                    graceAvailable: access.graceAvailable,
                    graceUntil: access.graceUntil ? access.graceUntil.toISOString() : null,
                },
                { status: 402 }
            );
        }


        const { searchParams } = new URL(req.url);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
        const q = (searchParams.get('q') || '').trim();
        const statusRaw = (searchParams.get('status') || '').trim();
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const sortParam = sanitizeSortParam((searchParams.get('sort') || '-createdAt').trim());

        const filter: Record<string, unknown> = {
            orgId: orgObjId,
            projectId: projectObjId,
        };

        if (q) {
            filter.$or = [
                { taskName: { $regex: q, $options: 'i' } },
                { bsNumber: { $regex: q, $options: 'i' } },
                { taskId: { $regex: q, $options: 'i' } },
            ];
        }
        if (statusRaw) {
            filter.status = normalizeStatus(statusRaw);
        }
        if (from || to) {
            const createdAt: Record<string, Date> = {};
            if (from) createdAt.$gte = new Date(from);
            if (to) createdAt.$lte = new Date(to);
            filter.createdAt = createdAt;
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            TaskModel.find(filter).sort(sortParam).skip(skip).limit(limit).lean(),
            TaskModel.countDocuments(filter),
        ]);

        const projectOperator =
            typeof rel.projectDoc.operator === 'string' ? rel.projectDoc.operator : undefined;
        const normalizedItems = items.map((task: Record<string, unknown>) => {
            const { attachments, documents } = splitAttachmentsAndDocuments(
                (task as { attachments?: unknown }).attachments,
                (task as { documents?: unknown }).documents
            );
            return {
                ...task,
                attachments,
                documents,
                projectOperator,
            };
        });

        return NextResponse.json({ ok: true, page, limit, total, items: normalizedItems });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, project } = await ctx.params;

        let body: CreateTaskBody;
        try {
            body = (await req.json()) as CreateTaskBody;
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const relUnknown = (await getOrgAndProjectByRef(org, project)) as unknown;
        if (!isOrgProjectRelOk(relUnknown)) {
            const reason = getOrgProjectError(relUnknown) ?? 'Org or project not found';
            console.warn('[POST tasks] not found:', { org, project, reason });
            return NextResponse.json({ error: reason }, { status: 404 });
        }
        const rel = relUnknown;

        const orgObjId = getDocObjectId(rel.orgDoc);
        const projectObjId = getDocObjectId(rel.projectDoc);
        if (!orgObjId || !projectObjId) {
            return NextResponse.json({ error: 'Org or project not found' }, { status: 404 });
        }

        const {
            taskId,
            taskName,
            bsNumber,
            bsAddress,
            bsLocation,
            bsLatitude,
            bsLongitude,
            totalCost,
            contractorPayment,
            workItems,
            status,
            priority,
            dueDate,
            taskType,
            requiredAttachments,
            orderUrl,
            orderNumber,
            orderDate,
            orderSignDate,
            taskDescription,
            initiatorName,
            initiatorEmail,
            executorId,
            executorName,
            executorEmail,
            relatedTasks,
            ...rest
        } = body;

        const normalizedBsLocation = sanitizeBsLocationAddresses(bsLocation, bsAddress);
        const finalBsAddress = buildBsAddressFromLocations(normalizedBsLocation, bsAddress);

        if (!taskName) return NextResponse.json({ error: 'taskName is required' }, { status: 400 });
        if (!bsNumber) return NextResponse.json({ error: 'bsNumber is required' }, { status: 400 });
        if (!finalBsAddress)
            return NextResponse.json({ error: 'bsAddress is required' }, { status: 400 });
        const initiatorNameValue = typeof initiatorName === 'string' ? initiatorName.trim() : '';
        const initiatorEmailValue = typeof initiatorEmail === 'string' ? initiatorEmail.trim() : '';
        const hasInitiatorName = Boolean(initiatorNameValue);
        const hasInitiatorEmail = Boolean(initiatorEmailValue);
        if (hasInitiatorName !== hasInitiatorEmail) {
            return NextResponse.json(
                { error: 'initiatorName and initiatorEmail are required' },
                { status: 400 }
            );
        }

        const taskLimit = await ensureMonthlyTaskSlot(orgObjId, { consume: true });
        if (!taskLimit.ok) {
            return NextResponse.json(
                { error: taskLimit.reason || 'Лимит задач на месяц исчерпан' },
                { status: 402 }
            );
        }

        const hasExecutor = typeof executorId === 'string' && executorId.trim().length > 0;
        const finalStatus = hasExecutor ? 'Assigned' : normalizeStatus(status);
        const sanitizedWorkItems = sanitizeWorkItems(workItems);

        const creatorName =
            user.fullName || user.username || user.emailAddresses?.[0]?.emailAddress || 'User';

        // базовое событие "создано"
        const events: Array<{
            action: string;
            author: string;
            authorId: string;
            date: Date;
            details?: Record<string, unknown>;
        }> = [
            {
                action: 'created',
                author: creatorName,
                authorId: user.id,
                date: new Date(),
                details: {
                    taskName,
                    bsNumber,
                    status: finalStatus,
                    priority,
                },
            },
        ];

        // если сразу выбрали исполнителя — отдельное событие "назначена"
        if (hasExecutor) {
            events.push({
                action: 'status_changed_assigned',
                author: creatorName,
                authorId: user.id,
                date: new Date(),
                details: {
                    taskName,
                    bsNumber,
                    executorName: executorName ?? '',
                },
            });
        }

        const normalizedRelated = normalizeRelatedTasks(relatedTasks);
        const relatedObjectIds = normalizedRelated.map((entry) => new Types.ObjectId(entry._id));

        const created = await TaskModel.create({
            orgId: orgObjId,
            projectId: projectObjId,

            taskId: taskId || genTaskId(),
            taskName,
            bsNumber,
            bsAddress: finalBsAddress,
            bsLocation: normalizedBsLocation,
            totalCost:
                typeof totalCost === 'number'
                    ? totalCost
                    : totalCost
                        ? Number(totalCost)
                        : undefined,
            contractorPayment:
                typeof contractorPayment === 'number'
                    ? contractorPayment
                    : contractorPayment
                        ? Number(contractorPayment)
                        : undefined,
            workItems: sanitizedWorkItems ?? undefined,
            status: finalStatus,
            priority,
            dueDate: dueDate ? new Date(dueDate) : undefined,

            taskType,
            requiredAttachments,
            orderUrl,
            orderNumber,
            orderDate: orderDate ? new Date(orderDate) : undefined,
            orderSignDate: orderSignDate ? new Date(orderSignDate) : undefined,
            taskDescription,

            authorId: user.id,
            authorEmail: user.emailAddresses?.[0]?.emailAddress,
            authorName: creatorName,

            initiatorName: hasInitiatorName ? initiatorNameValue : undefined,
            initiatorEmail: hasInitiatorEmail ? initiatorEmailValue : undefined,

            executorId: hasExecutor ? executorId : undefined,
            executorName: hasExecutor ? executorName : undefined,
            executorEmail: hasExecutor ? executorEmail : undefined,

            events,
            relatedTasks: relatedObjectIds.length ? relatedObjectIds : undefined,

            ...rest,
        });

        if (hasExecutor) {
            try {
                await notifyTaskAssignment({
                    executorClerkId: executorId,
                    taskId: created.taskId,
                    taskName,
                    bsNumber,
                    orgId: orgObjId,
                    orgSlug: rel.orgDoc?.orgSlug,
                    orgName: rel.orgDoc?.name,
                    projectRef: project,
                    projectKey: rel.projectDoc?.key,
                    projectName: rel.projectDoc?.name,
                    triggeredByName: creatorName,
                    triggeredByEmail: user.emailAddresses?.[0]?.emailAddress,
                });
            } catch (notifyErr) {
                console.error('Failed to send task assignment notification', notifyErr);
            }
        }

        if (normalizedRelated.length) {
            await addReverseRelations(toObjectId(created._id), normalizedRelated.map((entry) => entry._id));
        }

        const coordsSource =
            Array.isArray(normalizedBsLocation) && normalizedBsLocation.length > 0
                ? normalizedBsLocation[0]?.coordinates
                : undefined;
        const coordsPair = parseCoordinatesPair(coordsSource);
        const latForSync = typeof bsLatitude === 'number' ? bsLatitude : coordsPair.lat;
        const lonForSync = typeof bsLongitude === 'number' ? bsLongitude : coordsPair.lon;

        const stationsForEnsure =
            Array.isArray(normalizedBsLocation) && normalizedBsLocation.length > 0
                ? normalizedBsLocation
                : bsNumber
                    ? [{ name: bsNumber, coordinates: coordsSource ?? '', address: finalBsAddress }]
                    : [];

        for (const st of stationsForEnsure) {
            const pair = parseCoordinatesPair(st.coordinates);
            const ensureLat =
                typeof pair.lat === 'number'
                    ? pair.lat
                    : stationsForEnsure.length === 1
                        ? latForSync
                        : undefined;
            const ensureLon =
                typeof pair.lon === 'number'
                    ? pair.lon
                    : stationsForEnsure.length === 1
                        ? lonForSync
                        : undefined;

            if (!st.name) continue;

            try {
                await ensureIrkutskT2Station({
                    bsNumber: st.name,
                    bsAddress: st.address ?? finalBsAddress,
                    lat: ensureLat,
                    lon: ensureLon,
                    region: rel.projectDoc.regionCode,
                    operatorCode: rel.projectDoc.operator,
                });
            } catch (syncErr) {
                console.error('Failed to sync base station document:', syncErr);
            }
        }

        // Синхронизация с коллекцией координат региона / оператора
        try {
            await syncBsCoordsForProject({
                region: rel.projectDoc.regionCode,
                operatorCode: rel.projectDoc.operator,
                bsNumber:
                    Array.isArray(normalizedBsLocation) && normalizedBsLocation.length > 1
                        ? undefined
                        : bsNumber,
                bsAddress: finalBsAddress,
                bsLocation: normalizedBsLocation,
                lat: latForSync,
                lon: lonForSync,
            });
        } catch (err) {
            console.error('Failed to sync bs coords collection:', err);
        }

        return NextResponse.json({ ok: true, task: created }, { status: 201 });

    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}
