'use client';

import React from 'react';
import {
    Box,
    Collapse,
    IconButton,
    LinearProgress,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ReportGallery from '@/features/reports/ReportGallery';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

type FolderPathOption = {
    id: string;
    path: string;
};

type TreeNode = {
    id: string;
    name: string;
    parentId: string | null;
    storagePath: string;
};

type ReportFolderBrowserProps = {
    taskId: string;
    baseId: string;
    mainPhotos: string[];
    fixedPhotos: string[];
    reportStatus?: string;
    hasIssues?: boolean;
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

const buildDetectedFolderPaths = (baseId: string, mainPhotos: string[], fixedPhotos: string[]) => {
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
    reportStatus = '',
    hasIssues = false,
}: ReportFolderBrowserProps) {
    const { t } = useI18n();
    const [folderPaths, setFolderPaths] = React.useState<FolderPathOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedNodeId, setSelectedNodeId] = React.useState('root');
    const [expandedNodeIds, setExpandedNodeIds] = React.useState<string[]>([]);

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

    const treeNodes = React.useMemo<TreeNode[]>(() => {
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
                const parentStoragePath = normalizePathForStorage(
                    segments.slice(0, -1).join('/')
                );
                const rawName = segments[segments.length - 1] ?? entry.displayPath;
                return {
                    id: entry.id,
                    name: rawName,
                    parentId: parentStoragePath ? byStoragePath.get(parentStoragePath) ?? null : null,
                    storagePath: entry.storagePath,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [effectiveFolderPaths]);

    const treeChildren = React.useMemo(() => {
        const map = new Map<string, TreeNode[]>();
        treeNodes.forEach((node) => {
            const key = node.parentId ?? 'root';
            const bucket = map.get(key) ?? [];
            bucket.push(node);
            map.set(key, bucket);
        });

        map.forEach((nodes) => nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru')));
        return map;
    }, [treeNodes]);

    const nodeById = React.useMemo(() => new Map(treeNodes.map((node) => [node.id, node])), [treeNodes]);

    React.useEffect(() => {
        if (selectedNodeId !== 'root' && !nodeById.has(selectedNodeId)) {
            setSelectedNodeId('root');
        }
    }, [selectedNodeId, nodeById]);

    React.useEffect(() => {
        setExpandedNodeIds((prev) => {
            if (prev.length > 0) return prev;
            return treeNodes.map((node) => node.id);
        });
    }, [treeNodes]);

    const activeStoragePath =
        selectedNodeId === 'root' ? '' : nodeById.get(selectedNodeId)?.storagePath ?? '';

    const filterBySelectedFolder = React.useCallback(
        (url: string, isFix: boolean) => {
            const path = getFolderStoragePathFromFileUrl(url, baseId, isFix);
            return path === activeStoragePath;
        },
        [activeStoragePath, baseId]
    );

    const visibleMainPhotos = React.useMemo(
        () => mainPhotos.filter((url) => filterBySelectedFolder(url, false)),
        [mainPhotos, filterBySelectedFolder]
    );
    const visibleFixedPhotos = React.useMemo(
        () => fixedPhotos.filter((url) => filterBySelectedFolder(url, true)),
        [fixedPhotos, filterBySelectedFolder]
    );

    const filesCountByMainPath = React.useMemo(() => {
        const map = new Map<string, number>();
        mainPhotos.forEach((url) => {
            const path = getFolderStoragePathFromFileUrl(url, baseId, false);
            map.set(path, (map.get(path) ?? 0) + 1);
        });
        return map;
    }, [mainPhotos, baseId]);

    const filesCountByFixPath = React.useMemo(() => {
        const map = new Map<string, number>();
        fixedPhotos.forEach((url) => {
            const path = getFolderStoragePathFromFileUrl(url, baseId, true);
            map.set(path, (map.get(path) ?? 0) + 1);
        });
        return map;
    }, [fixedPhotos, baseId]);

    const subtreeCounts = React.useMemo(() => {
        const memo = new Map<string, { main: number; fix: number }>();

        const countNode = (nodeId: string): { main: number; fix: number } => {
            if (memo.has(nodeId)) return memo.get(nodeId) ?? { main: 0, fix: 0 };
            const node = nodeById.get(nodeId);
            if (!node) return { main: 0, fix: 0 };

            let main = filesCountByMainPath.get(node.storagePath) ?? 0;
            let fix = filesCountByFixPath.get(node.storagePath) ?? 0;

            const children = treeChildren.get(nodeId) ?? [];
            children.forEach((child) => {
                const childCount = countNode(child.id);
                main += childCount.main;
                fix += childCount.fix;
            });

            const value = { main, fix };
            memo.set(nodeId, value);
            return value;
        };

        treeNodes.forEach((node) => {
            countNode(node.id);
        });

        return memo;
    }, [treeNodes, nodeById, treeChildren, filesCountByMainPath, filesCountByFixPath]);

    const hasIssueMode = hasIssues || reportStatus === 'Issues';

    const getNodeColors = React.useCallback(
        (counts: { main: number; fix: number }) => {
            if (counts.fix > 0) {
                return {
                    border: '1px solid rgba(34,197,94,0.28)',
                    background: 'rgba(34,197,94,0.1)',
                };
            }
            if (hasIssueMode && counts.main > 0) {
                return {
                    border: '1px solid rgba(245,158,11,0.32)',
                    background: 'rgba(245,158,11,0.12)',
                };
            }
            return {
                border: '1px solid transparent',
                background: 'transparent',
            };
        },
        [hasIssueMode]
    );

    const toggleExpanded = (nodeId: string) => {
        setExpandedNodeIds((prev) =>
            prev.includes(nodeId)
                ? prev.filter((id) => id !== nodeId)
                : [...prev, nodeId]
        );
    };

    const renderTreeNode = (node: TreeNode, depth: number): React.ReactNode => {
        const children = treeChildren.get(node.id) ?? [];
        const expanded = expandedNodeIds.includes(node.id);
        const counts = subtreeCounts.get(node.id) ?? { main: 0, fix: 0 };
        const total = counts.main + counts.fix;
        const nodeColors = getNodeColors(counts);

        return (
            <React.Fragment key={node.id}>
                <ListItemButton
                    selected={selectedNodeId === node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    sx={{
                        borderRadius: 1.5,
                        px: 1,
                        pl: 1 + depth * 2,
                        border: nodeColors.border,
                        backgroundColor: nodeColors.background,
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        {total > 0 ? (
                            <FolderIcon fontSize="small" color="primary" />
                        ) : (
                            <FolderOutlinedIcon fontSize="small" color="action" />
                        )}
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="body2">{node.name}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        borderRadius: 999,
                                        px: 0.75,
                                        py: 0.125,
                                        backgroundColor: 'rgba(59,130,246,0.12)',
                                        color: 'primary.main',
                                        fontWeight: 700,
                                    }}
                                >
                                    M:{counts.main}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        borderRadius: 999,
                                        px: 0.75,
                                        py: 0.125,
                                        backgroundColor:
                                            counts.fix > 0
                                                ? 'rgba(34,197,94,0.14)'
                                                : 'rgba(148,163,184,0.16)',
                                        color:
                                            counts.fix > 0
                                                ? 'rgb(21,128,61)'
                                                : 'text.secondary',
                                        fontWeight: 700,
                                    }}
                                >
                                    F:{counts.fix}
                                </Typography>
                                {total > 0 && (
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        ({total})
                                    </Typography>
                                )}
                            </Stack>
                        }
                    />
                    {children.length > 0 && (
                        <IconButton
                            size="small"
                            onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(node.id);
                            }}
                        >
                            {expanded ? (
                                <ExpandMoreIcon fontSize="small" />
                            ) : (
                                <ChevronRightIcon fontSize="small" />
                            )}
                        </IconButton>
                    )}
                </ListItemButton>
                {children.length > 0 && (
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <List dense disablePadding>
                            {children.map((child) => renderTreeNode(child, depth + 1))}
                        </List>
                    </Collapse>
                )}
            </React.Fragment>
        );
    };

    if (treeNodes.length === 0) {
        return (
            <Stack spacing={3}>
                <ReportGallery title={t('reports.gallery.main', 'Основные фото')} photos={mainPhotos} />
                <ReportGallery title={t('reports.gallery.fixed', 'Исправления')} photos={fixedPhotos} />
            </Stack>
        );
    }

    const currentPathLabel =
        selectedNodeId === 'root'
            ? t('reports.upload.folders.root', 'Корень БС')
            : nodeById.get(selectedNodeId)?.name ?? t('reports.upload.folders.root', 'Корень БС');
    const rootCounts = {
        main: mainPhotos.length,
        fix: fixedPhotos.length,
    };
    const rootTotal = rootCounts.main + rootCounts.fix;
    const rootColors = getNodeColors(rootCounts);

    return (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems="flex-start">
            <Box
                sx={(theme) => ({
                    width: { xs: '100%', md: 320 },
                    borderRadius: 3,
                    border:
                        theme.palette.mode === 'dark'
                            ? '1px solid rgba(148,163,184,0.18)'
                            : '1px solid rgba(15,23,42,0.08)',
                    background:
                        theme.palette.mode === 'dark'
                            ? 'rgba(15,18,26,0.92)'
                            : 'rgba(255,255,255,0.9)',
                    p: 1.25,
                })}
            >
                <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, py: 0.75 }}>
                    {t('reports.upload.folders.treeTitle', 'Структура папок')}
                </Typography>
                {loading && <LinearProgress sx={{ borderRadius: 999, mb: 1 }} />}
                {usingDetectedPaths && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, pb: 1 }}>
                        {t(
                            'reports.folders.detected',
                            'Показаны папки, обнаруженные по загруженным файлам.'
                        )}
                    </Typography>
                )}
                <List dense disablePadding>
                    <ListItemButton
                        selected={selectedNodeId === 'root'}
                        onClick={() => setSelectedNodeId('root')}
                        sx={{
                            borderRadius: 1.5,
                            px: 1,
                            border: rootColors.border,
                            backgroundColor: rootColors.background,
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 24 }}>
                            {mainPhotos.length + fixedPhotos.length > 0 ? (
                                <FolderIcon fontSize="small" color="primary" />
                            ) : (
                                <FolderOutlinedIcon fontSize="small" color="action" />
                            )}
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <Typography variant="body2">
                                        {t('reports.upload.folders.root', 'Корень БС')}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            borderRadius: 999,
                                            px: 0.75,
                                            py: 0.125,
                                            backgroundColor: 'rgba(59,130,246,0.12)',
                                            color: 'primary.main',
                                            fontWeight: 700,
                                        }}
                                    >
                                        M:{rootCounts.main}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            borderRadius: 999,
                                            px: 0.75,
                                            py: 0.125,
                                            backgroundColor:
                                                rootCounts.fix > 0
                                                    ? 'rgba(34,197,94,0.14)'
                                                    : 'rgba(148,163,184,0.16)',
                                            color:
                                                rootCounts.fix > 0
                                                    ? 'rgb(21,128,61)'
                                                    : 'text.secondary',
                                            fontWeight: 700,
                                        }}
                                    >
                                        F:{rootCounts.fix}
                                    </Typography>
                                    {rootTotal > 0 && (
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                            ({rootTotal})
                                        </Typography>
                                    )}
                                </Stack>
                            }
                        />
                    </ListItemButton>
                    {(treeChildren.get('root') ?? []).map((node) => renderTreeNode(node, 1))}
                </List>
            </Box>

            <Stack spacing={2.5} sx={{ flex: 1, width: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                    {t('reports.folders.current', 'Текущая папка: {path}', {
                        path: `${baseId} / ${currentPathLabel}`,
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
        </Stack>
    );
}
