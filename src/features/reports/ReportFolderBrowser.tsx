'use client';

import React from 'react';
import {
    Box,
    Breadcrumbs,
    Button,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ReportGallery from '@/features/reports/ReportGallery';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

type FolderPathOption = {
    id: string;
    path: string;
};

type FolderNode = {
    id: string;
    name: string;
    parentId: string | null;
    storagePath: string;
    displayPath: string;
};

type ReportFolderBrowserProps = {
    taskId: string;
    baseId: string;
    mainPhotos: string[];
    fixedPhotos: string[];
};

const normalizePathForStorage = (path: string) =>
    path
        .split('/')
        .map((segment) =>
            segment
                .trim()
                .replace(/[\\/]/g, '_')
                .replace(/\s+/g, '_')
        )
        .filter(Boolean)
        .join('/');

const decodeUrlSegment = (segment: string) => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

const extractStorageKey = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) {
        try {
            const parsed = new URL(url);
            return parsed.pathname.replace(/^\/+/, '');
        } catch {
            return '';
        }
    }
    return url.replace(/^\/+/, '');
};

const getFolderStoragePathFromFileUrl = (
    url: string,
    baseId: string,
    isFix: boolean
): string => {
    const key = extractStorageKey(url);
    if (!key || !baseId) return '';
    const segments = key
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeUrlSegment(segment));
    const baseIndex = segments.findIndex(
        (segment) => segment.toLowerCase() === baseId.toLowerCase()
    );
    if (baseIndex < 0) return '';

    const tail = segments.slice(baseIndex + 1);
    if (tail.length <= 1) return '';

    const folderSegments = tail.slice(0, -1);
    if (isFix && folderSegments.length > 0) {
        const last = folderSegments[folderSegments.length - 1];
        if (last.toLowerCase() === 'fix') {
            folderSegments.pop();
        }
    }

    return normalizePathForStorage(folderSegments.join('/'));
};

const buildDetectedFolderPaths = (
    baseId: string,
    mainPhotos: string[],
    fixedPhotos: string[]
) => {
    const uniquePaths = new Set<string>();
    mainPhotos.forEach((url) => {
        const folder = getFolderStoragePathFromFileUrl(url, baseId, false);
        if (folder) uniquePaths.add(folder);
    });
    fixedPhotos.forEach((url) => {
        const folder = getFolderStoragePathFromFileUrl(url, baseId, true);
        if (folder) uniquePaths.add(folder);
    });

    return Array.from(uniquePaths)
        .sort((a, b) => a.localeCompare(b, 'ru'))
        .map((path) => ({ id: `detected:${path}`, path }));
};

export default function ReportFolderBrowser({
    taskId,
    baseId,
    mainPhotos,
    fixedPhotos,
}: ReportFolderBrowserProps) {
    const { t } = useI18n();
    const [folderPaths, setFolderPaths] = React.useState<FolderPathOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeFolderId, setActiveFolderId] = React.useState<string>('');

    React.useEffect(() => {
        const normalizedTaskId = taskId.trim();
        if (!normalizedTaskId) {
            setFolderPaths([]);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    withBasePath(`/api/reports/config?taskId=${encodeURIComponent(normalizedTaskId)}`),
                    { cache: 'no-store' }
                );
                const payload = (await response.json().catch(() => ({}))) as {
                    folderPaths?: FolderPathOption[];
                };

                if (!cancelled && response.ok && Array.isArray(payload.folderPaths)) {
                    setFolderPaths(
                        payload.folderPaths
                            .filter(
                                (item) =>
                                    typeof item?.id === 'string' &&
                                    typeof item?.path === 'string' &&
                                    item.id.trim() &&
                                    item.path.trim()
                            )
                            .map((item) => ({ id: item.id.trim(), path: item.path.trim() }))
                    );
                }
            } catch {
                if (!cancelled) {
                    setFolderPaths([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [taskId]);

    const detectedFolderPaths = React.useMemo(
        () => buildDetectedFolderPaths(baseId, mainPhotos, fixedPhotos),
        [baseId, mainPhotos, fixedPhotos]
    );

    const usingDetectedPaths = folderPaths.length === 0 && detectedFolderPaths.length > 0;
    const effectiveFolderPaths = folderPaths.length > 0 ? folderPaths : detectedFolderPaths;

    const folderNodes = React.useMemo<FolderNode[]>(() => {
        if (effectiveFolderPaths.length === 0) return [];

        const normalizedEntries = effectiveFolderPaths
            .map((item) => {
                const displayPath = item.path.trim().replace(/^\/+|\/+$/g, '');
                const storagePath = normalizePathForStorage(displayPath);
                return {
                    id: item.id,
                    displayPath,
                    storagePath,
                };
            })
            .filter((item) => item.id && item.displayPath && item.storagePath);

        const byStoragePath = new Map(
            normalizedEntries.map((entry) => [entry.storagePath, entry.id])
        );

        return normalizedEntries
            .map((entry) => {
                const segments = entry.displayPath.split('/').map((s) => s.trim()).filter(Boolean);
                const parentStoragePath = normalizePathForStorage(segments.slice(0, -1).join('/'));
                const name = segments[segments.length - 1] ?? entry.displayPath;
                return {
                    id: entry.id,
                    name,
                    parentId: parentStoragePath ? byStoragePath.get(parentStoragePath) ?? null : null,
                    storagePath: entry.storagePath,
                    displayPath: entry.displayPath,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [effectiveFolderPaths]);

    const nodeById = React.useMemo(
        () => new Map(folderNodes.map((node) => [node.id, node])),
        [folderNodes]
    );

    const childrenByParentId = React.useMemo(() => {
        const map = new Map<string, FolderNode[]>();
        folderNodes.forEach((node) => {
            const key = node.parentId ?? 'root';
            const bucket = map.get(key) ?? [];
            bucket.push(node);
            map.set(key, bucket);
        });
        map.forEach((nodes) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        });
        return map;
    }, [folderNodes]);

    React.useEffect(() => {
        if (activeFolderId && !nodeById.has(activeFolderId)) {
            setActiveFolderId('');
        }
    }, [activeFolderId, nodeById]);

    const activeStoragePath = activeFolderId ? nodeById.get(activeFolderId)?.storagePath ?? '' : '';

    const visibleMainPhotos = React.useMemo(
        () =>
            mainPhotos.filter(
                (url) => getFolderStoragePathFromFileUrl(url, baseId, false) === activeStoragePath
            ),
        [mainPhotos, baseId, activeStoragePath]
    );

    const visibleFixedPhotos = React.useMemo(
        () =>
            fixedPhotos.filter(
                (url) => getFolderStoragePathFromFileUrl(url, baseId, true) === activeStoragePath
            ),
        [fixedPhotos, baseId, activeStoragePath]
    );

    const mainCountByPath = React.useMemo(() => {
        const map = new Map<string, number>();
        mainPhotos.forEach((url) => {
            const path = getFolderStoragePathFromFileUrl(url, baseId, false);
            map.set(path, (map.get(path) ?? 0) + 1);
        });
        return map;
    }, [mainPhotos, baseId]);

    const fixCountByPath = React.useMemo(() => {
        const map = new Map<string, number>();
        fixedPhotos.forEach((url) => {
            const path = getFolderStoragePathFromFileUrl(url, baseId, true);
            map.set(path, (map.get(path) ?? 0) + 1);
        });
        return map;
    }, [fixedPhotos, baseId]);

    const currentChildren = childrenByParentId.get(activeFolderId || 'root') ?? [];

    const breadcrumbs = React.useMemo(() => {
        if (!activeFolderId) return [] as FolderNode[];
        const items: FolderNode[] = [];
        let current = nodeById.get(activeFolderId);
        let guard = 0;
        while (current && guard < 30) {
            items.unshift(current);
            guard += 1;
            current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return items;
    }, [activeFolderId, nodeById]);

    if (folderNodes.length === 0) {
        return (
            <Stack spacing={3}>
                <ReportGallery title={t('reports.gallery.main', 'Основные фото')} photos={mainPhotos} />
                <ReportGallery title={t('reports.gallery.fixed', 'Исправления')} photos={fixedPhotos} />
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5}>
            <Paper
                sx={(theme) => ({
                    borderRadius: 3,
                    border:
                        theme.palette.mode === 'dark'
                            ? '1px solid rgba(148,163,184,0.18)'
                            : '1px solid rgba(15,23,42,0.08)',
                    background:
                        theme.palette.mode === 'dark'
                            ? 'rgba(15,18,26,0.92)'
                            : 'rgba(255,255,255,0.9)',
                    p: 2,
                })}
            >
                <Stack spacing={1.25}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                        spacing={1}
                    >
                        <Typography variant="subtitle2" fontWeight={700}>
                            {t('reports.upload.folders.treeTitle', 'Структура папок')}
                        </Typography>
                        {loading && <LinearProgress sx={{ width: { xs: '100%', sm: 180 }, borderRadius: 999 }} />}
                    </Stack>

                    {usingDetectedPaths && (
                        <Typography variant="caption" color="text.secondary">
                            {t(
                                'reports.folders.detected',
                                'Показаны папки, обнаруженные по загруженным файлам.'
                            )}
                        </Typography>
                    )}

                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="folders">
                        <Button
                            onClick={() => setActiveFolderId('')}
                            sx={{ textTransform: 'none', minWidth: 0, px: 0.5 }}
                        >
                            {baseId}
                        </Button>
                        {breadcrumbs.map((item, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            if (isLast) {
                                return (
                                    <Typography key={item.id} color="text.primary" fontWeight={600}>
                                        {item.name}
                                    </Typography>
                                );
                            }
                            return (
                                <Button
                                    key={item.id}
                                    onClick={() => setActiveFolderId(item.id)}
                                    sx={{ textTransform: 'none', minWidth: 0, px: 0.5 }}
                                >
                                    {item.name}
                                </Button>
                            );
                        })}
                    </Breadcrumbs>

                    {currentChildren.length > 0 && (
                        <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                                {t('reports.folders.subfolders', 'Подпапки')}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 1,
                                }}
                            >
                                {currentChildren.map((node) => {
                                    const mainCount = mainCountByPath.get(node.storagePath) ?? 0;
                                    const fixCount = fixCountByPath.get(node.storagePath) ?? 0;
                                    return (
                                        <Button
                                            key={node.id}
                                            variant="outlined"
                                            startIcon={<FolderOpenIcon />}
                                            onClick={() => setActiveFolderId(node.id)}
                                            sx={{
                                                justifyContent: 'space-between',
                                                textTransform: 'none',
                                                borderRadius: 2,
                                                px: 1.25,
                                                py: 0.75,
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={0.75}
                                                alignItems="center"
                                                sx={{ width: '100%', justifyContent: 'space-between' }}
                                            >
                                                <Typography variant="body2" noWrap>
                                                    {node.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                                    M:{mainCount} · F:{fixCount}
                                                </Typography>
                                            </Stack>
                                        </Button>
                                    );
                                })}
                            </Box>
                        </Stack>
                    )}

                    {currentChildren.length === 0 && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <FolderOutlinedIcon fontSize="small" color="disabled" />
                            <Typography variant="caption" color="text.secondary">
                                {t('reports.folders.leaf', 'Конечная папка. Подпапок нет.')}
                            </Typography>
                        </Stack>
                    )}
                </Stack>
            </Paper>

            <Typography variant="body2" color="text.secondary">
                {t('reports.folders.current', 'Текущая папка: {path}', {
                    path: `${baseId}${activeStoragePath ? ` / ${activeStoragePath}` : ''}`,
                })}
            </Typography>

            <ReportGallery
                title={`${t('reports.gallery.main', 'Основные фото')} (${visibleMainPhotos.length})`}
                photos={visibleMainPhotos}
            />
            <ReportGallery
                title={`${t('reports.gallery.fixed', 'Исправления')} (${visibleFixedPhotos.length})`}
                photos={visibleFixedPhotos}
            />
        </Stack>
    );
}
