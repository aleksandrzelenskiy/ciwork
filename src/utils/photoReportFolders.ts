export type PhotoReportFolderNode = {
    id: string;
    name: string;
    parentId?: string | null;
    order?: number;
};

export type NormalizedPhotoReportFolderNode = {
    id: string;
    name: string;
    parentId: string | null;
    order: number;
};

export const MAX_PHOTO_REPORT_FOLDERS = 200;
export const MAX_PHOTO_REPORT_FOLDER_DEPTH = 6;

const normalizeFolderName = (value: string) =>
    value
        .trim()
        .replace(/[\\/]/g, '_')
        .replace(/\s+/g, ' ');

export const normalizePhotoReportFolders = (
    input: unknown
): { ok: true; nodes: NormalizedPhotoReportFolderNode[] } | { ok: false; error: string } => {
    if (input == null) {
        return { ok: true, nodes: [] };
    }
    if (!Array.isArray(input)) {
        return { ok: false, error: 'Неверный формат структуры папок фотоотчета' };
    }
    if (input.length > MAX_PHOTO_REPORT_FOLDERS) {
        return {
            ok: false,
            error: `Слишком много папок. Максимум: ${MAX_PHOTO_REPORT_FOLDERS}`,
        };
    }

    const byId = new Map<string, NormalizedPhotoReportFolderNode>();
    const nodes: NormalizedPhotoReportFolderNode[] = [];

    for (let index = 0; index < input.length; index += 1) {
        const raw = input[index];
        if (!raw || typeof raw !== 'object') {
            return { ok: false, error: 'Неверный формат узла папки' };
        }
        const item = raw as Record<string, unknown>;
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const rawName = String(item.name ?? '');
        if (!rawName.trim()) {
            return { ok: false, error: 'Название папки не может быть пустым' };
        }
        const name = normalizeFolderName(rawName);
        const parentId =
            typeof item.parentId === 'string' && item.parentId.trim()
                ? item.parentId.trim()
                : null;
        const orderValue =
            typeof item.order === 'number' && Number.isFinite(item.order)
                ? item.order
                : index;

        if (!id) {
            return { ok: false, error: 'У папки отсутствует id' };
        }
        if (!name) {
            return { ok: false, error: 'Название папки не может быть пустым' };
        }
        if (name === '.' || name === '..') {
            return { ok: false, error: 'Недопустимое название папки' };
        }
        if (byId.has(id)) {
            return { ok: false, error: 'Дублирующиеся id папок' };
        }

        const normalizedNode: NormalizedPhotoReportFolderNode = {
            id,
            name,
            parentId,
            order: orderValue,
        };
        byId.set(id, normalizedNode);
        nodes.push(normalizedNode);
    }

    for (const node of nodes) {
        if (node.parentId && !byId.has(node.parentId)) {
            return { ok: false, error: 'Указан несуществующий родитель папки' };
        }
    }

    const getDepth = (node: NormalizedPhotoReportFolderNode, seen: Set<string>): number => {
        if (seen.has(node.id)) {
            return Number.POSITIVE_INFINITY;
        }
        if (!node.parentId) {
            return 1;
        }
        const parent = byId.get(node.parentId);
        if (!parent) {
            return Number.POSITIVE_INFINITY;
        }
        const nextSeen = new Set(seen);
        nextSeen.add(node.id);
        return 1 + getDepth(parent, nextSeen);
    };

    for (const node of nodes) {
        const depth = getDepth(node, new Set());
        if (!Number.isFinite(depth)) {
            return { ok: false, error: 'Обнаружен цикл в структуре папок' };
        }
        if (depth > MAX_PHOTO_REPORT_FOLDER_DEPTH) {
            return {
                ok: false,
                error: `Слишком большая вложенность папок. Максимум: ${MAX_PHOTO_REPORT_FOLDER_DEPTH}`,
            };
        }
    }

    return { ok: true, nodes };
};

export const resolvePhotoReportFolderPath = (
    nodes: PhotoReportFolderNode[] | null | undefined,
    folderId: string | null | undefined
): string | null => {
    const targetId = typeof folderId === 'string' ? folderId.trim() : '';
    if (!targetId) {
        return null;
    }
    const normalized = normalizePhotoReportFolders(nodes);
    if (!normalized.ok) {
        return null;
    }
    const byId = new Map(normalized.nodes.map((node) => [node.id, node]));
    const target = byId.get(targetId);
    if (!target) {
        return null;
    }

    const segments: string[] = [];
    let current: NormalizedPhotoReportFolderNode | undefined = target;
    let guard = 0;
    while (current) {
        guard += 1;
        if (guard > MAX_PHOTO_REPORT_FOLDER_DEPTH + 2) {
            return null;
        }
        segments.unshift(current.name);
        if (!current.parentId) {
            break;
        }
        current = byId.get(current.parentId);
        if (!current) {
            return null;
        }
    }

    return segments.length > 0 ? segments.join('/') : null;
};

export const buildFolderPathMap = (
    nodes: PhotoReportFolderNode[] | null | undefined
): Array<{ id: string; path: string }> => {
    const normalized = normalizePhotoReportFolders(nodes);
    if (!normalized.ok) {
        return [];
    }
    return normalized.nodes
        .map((node) => ({
            id: node.id,
            path: resolvePhotoReportFolderPath(normalized.nodes, node.id) ?? node.name,
        }))
        .sort((a, b) => a.path.localeCompare(b.path, 'ru'));
};
