'use client';

import React from 'react';
import {
    Box,
    Breadcrumbs,
    Button,
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
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
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
    const [selectedNodeId, setSelectedNodeId] = React.useState('root');
    const [expandedNodeIds, setExpandedNodeIds] = React.useState<string[]>([]);
    const [structureVisible, setStructureVisible] = React.useState(true);

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

    const effectiveFolderPaths = React.useMemo(() => {
        if (folderPaths.length === 0) return detectedFolderPaths;
        if (detectedFolderPaths.length === 0) return folderPaths;

        const byStoragePath = new Map<string, FolderPathOption>();
        folderPaths.forEach((item) => {
            const normalized = normalizePathForStorage(item.path);
            if (!normalized) return;
            byStoragePath.set(normalized, item);
        });
        detectedFolderPaths.forEach((item) => {
            const normalized = normalizePathForStorage(item.path);
            if (!normalized || byStoragePath.has(normalized)) return;
            byStoragePath.set(normalized, item);
        });

        return Array.from(byStoragePath.values()).sort((a, b) =>
            a.path.localeCompare(b.path, 'ru')
        );
    }, [folderPaths, detectedFolderPaths]);

    const usingDetectedPaths = React.useMemo(() => {
        if (detectedFolderPaths.length === 0) return false;
        if (folderPaths.length === 0) return true;

        const configured = new Set(
            folderPaths
                .map((item) => normalizePathForStorage(item.path))
                .filter(Boolean)
        );
        return detectedFolderPaths.some(
            (item) => !configured.has(normalizePathForStorage(item.path))
        );
    }, [folderPaths, detectedFolderPaths]);

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
            const key = node.parentId ?? '__root__';
            const bucket = map.get(key) ?? [];
            bucket.push(node);
            map.set(key, bucket);
        });

        map.forEach((nodes) => nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru')));
        return map;
    }, [treeNodes]);

    const nodeById = React.useMemo(
        () => new Map(treeNodes.map((node) => [node.id, node])),
        [treeNodes]
    );

    React.useEffect(() => {
        if (selectedNodeId !== 'root' && !nodeById.has(selectedNodeId)) {
            setSelectedNodeId('root');
        }
    }, [selectedNodeId, nodeById]);

    React.useEffect(() => {
        setExpandedNodeIds((prev) => {
            if (prev.length > 0) return prev;
            return ['root', ...treeNodes.map((node) => node.id)];
        });
    }, [treeNodes]);

    const activeStoragePath =
        selectedNodeId === 'root' ? '' : nodeById.get(selectedNodeId)?.storagePath ?? '';

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

    const filesCountByFolderPath = React.useMemo(() => {
        const map = new Map<string, number>();
        mainPhotos.forEach((url) => {
            const folderPath = getFolderStoragePathFromFileUrl(url, baseId, false);
            map.set(folderPath, (map.get(folderPath) ?? 0) + 1);
        });
        fixedPhotos.forEach((url) => {
            const folderPath = getFolderStoragePathFromFileUrl(url, baseId, true);
            map.set(folderPath, (map.get(folderPath) ?? 0) + 1);
        });
        return map;
    }, [mainPhotos, fixedPhotos, baseId]);

    const folderSubtreeCountById = React.useMemo(() => {
        const memo = new Map<string, number>();
        const countNode = (folderId: string): number => {
            if (memo.has(folderId)) return memo.get(folderId) ?? 0;
            const node = nodeById.get(folderId);
            if (!node) return 0;
            let total = filesCountByFolderPath.get(node.storagePath) ?? 0;
            const children = treeChildren.get(folderId) ?? [];
            children.forEach((child) => {
                total += countNode(child.id);
            });
            memo.set(folderId, total);
            return total;
        };

        treeNodes.forEach((node) => {
            countNode(node.id);
        });
        return memo;
    }, [treeNodes, nodeById, treeChildren, filesCountByFolderPath]);

    const getFolderCount = React.useCallback(
        (folderId: string) => folderSubtreeCountById.get(folderId) ?? 0,
        [folderSubtreeCountById]
    );

    const rootFolderCount = mainPhotos.length + fixedPhotos.length;
    const rootHasFiles = rootFolderCount > 0;

    const isNodeExpanded = React.useCallback(
        (nodeId: string) => expandedNodeIds.includes(nodeId),
        [expandedNodeIds]
    );

    const toggleNodeExpanded = (nodeId: string) => {
        setExpandedNodeIds((prev) => {
            const exists = prev.includes(nodeId);
            return exists ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];
        });
    };

    const breadcrumbsNodes = React.useMemo(() => {
        if (selectedNodeId === 'root') return [] as TreeNode[];
        const nodes: TreeNode[] = [];
        let current = nodeById.get(selectedNodeId);
        let guard = 0;
        while (current && guard < 30) {
            nodes.unshift(current);
            guard += 1;
            current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return nodes;
    }, [selectedNodeId, nodeById]);

    const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
        const children = treeChildren.get(node.id) ?? [];
        const nodeCount = getFolderCount(node.id);
        const nodeHasFiles = nodeCount > 0;
        const expanded = isNodeExpanded(node.id);

        return (
            <React.Fragment key={node.id}>
                <ListItemButton
                    selected={selectedNodeId === node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    sx={{
                        borderRadius: 1.5,
                        mx: 0.5,
                        pl: 1 + depth * 2,
                        backgroundColor: nodeHasFiles ? 'rgba(59,130,246,0.08)' : 'transparent',
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                        <Stack direction="row" alignItems="center" spacing={0.25}>
                            {nodeHasFiles ? (
                                <FolderIcon fontSize="small" color="primary" />
                            ) : (
                                <FolderOutlinedIcon fontSize="small" color="action" />
                            )}
                            {children.length > 0 && (
                                <IconButton
                                    size="small"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleNodeExpanded(node.id);
                                    }}
                                >
                                    {expanded ? (
                                        <ExpandMoreIcon fontSize="small" />
                                    ) : (
                                        <ChevronRightIcon fontSize="small" />
                                    )}
                                </IconButton>
                            )}
                        </Stack>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 400 }}>
                                    {node.name}
                                </Typography>
                                {nodeCount > 0 && (
                                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                        ({nodeCount})
                                    </Typography>
                                )}
                            </Stack>
                        }
                    />
                </ListItemButton>
                {children.length > 0 && (
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <List disablePadding dense>
                            {children.map((child) => renderNode(child, depth + 1))}
                        </List>
                    </Collapse>
                )}
            </React.Fragment>
        );
    };

    if (treeNodes.length === 0) {
        return (
            <Stack spacing={3} sx={{ width: '100%' }}>
                <Box sx={{ width: '100%' }}>
                    <ReportGallery title={t('reports.gallery.report', 'Фотографии')} photos={mainPhotos} />
                </Box>
                {fixedPhotos.length > 0 && (
                    <Box sx={{ width: '100%' }}>
                        <ReportGallery title={t('reports.gallery.fixed', 'Исправления')} photos={fixedPhotos} />
                    </Box>
                )}
            </Stack>
        );
    }

    return (
        <Stack spacing={2.5} sx={{ width: '100%' }}>
            {loading && <LinearProgress sx={{ borderRadius: 999 }} />}

            <Button
                onClick={() => setStructureVisible((prev) => !prev)}
                startIcon={structureVisible ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0.5 }}
            >
                {structureVisible
                    ? t('reports.folders.hide', 'Скрыть структуру папок')
                    : t('reports.folders.show', 'Показать структуру папок')}
            </Button>

            <Collapse in={structureVisible} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                <Box
                    sx={{
                        width: '100%',
                        border: '1px solid rgba(15,23,42,0.1)',
                        borderRadius: 2,
                        px: 0.5,
                        py: 0.75,
                        background: 'rgba(255,255,255,0.55)',
                    }}
                >
                    {usingDetectedPaths && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', px: 1, pb: 1 }}
                        >
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
                                mx: 0.5,
                                backgroundColor: rootHasFiles ? 'rgba(59,130,246,0.08)' : 'transparent',
                            }}
                        >
                            <ListItemText
                                primary={
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        {rootHasFiles ? (
                                            <FolderIcon fontSize="small" color="primary" />
                                        ) : (
                                            <FolderOutlinedIcon fontSize="small" color="action" />
                                        )}
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.primary', fontWeight: 400 }}
                                        >
                                            {baseId || t('reports.upload.folders.root', 'Корень БС')}
                                        </Typography>
                                        {rootFolderCount > 0 && (
                                            <Typography
                                                variant="body2"
                                                sx={{ color: 'primary.main', fontWeight: 600 }}
                                            >
                                                ({rootFolderCount})
                                            </Typography>
                                        )}
                                    </Stack>
                                }
                            />
                        </ListItemButton>
                        {(treeChildren.get('__root__') ?? []).map((rootNode) =>
                            renderNode(rootNode, 1)
                        )}
                    </List>
                </Box>
            </Collapse>

            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="folder-path"
                sx={{ width: '100%' }}
            >
                <Button
                    onClick={() => setSelectedNodeId('root')}
                    sx={{ textTransform: 'none', minWidth: 0, px: 0.25 }}
                >
                    {baseId || t('reports.upload.folders.root', 'Корень БС')}
                </Button>
                {breadcrumbsNodes.map((node, index) => {
                    const isLast = index === breadcrumbsNodes.length - 1;
                    if (isLast) {
                        return (
                            <Typography key={node.id} variant="body2" fontWeight={600}>
                                {node.name}
                            </Typography>
                        );
                    }
                    return (
                        <Button
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            sx={{ textTransform: 'none', minWidth: 0, px: 0.25 }}
                        >
                            {node.name}
                        </Button>
                    );
                })}
            </Breadcrumbs>

            <Box sx={{ width: '100%' }}>
                <ReportGallery
                    title={`${t('reports.gallery.report', 'Фотографии')} (${visibleMainPhotos.length})`}
                    photos={visibleMainPhotos}
                />
            </Box>

            {fixedPhotos.length > 0 && (
                <Box sx={{ width: '100%' }}>
                    <ReportGallery
                        title={`${t('reports.gallery.fixed', 'Исправления')} (${visibleFixedPhotos.length})`}
                        photos={visibleFixedPhotos}
                    />
                </Box>
            )}
        </Stack>
    );
}
