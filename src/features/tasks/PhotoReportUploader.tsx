'use client';

import React from 'react';
import Image from 'next/image';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Typography,
    Collapse,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useDropzone } from 'react-dropzone';
import type { PhotoReport } from '@/app/types/taskTypes';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

type BaseLocation = {
    name?: string | null;
};

type UploadStatus = 'ready' | 'uploading' | 'done' | 'error' | 'canceled';

type UploadItem = {
    id: string;
    file: File;
    preview: string;
    progress: number;
    status: UploadStatus;
    error?: string;
};

type FolderState = {
    uploaded: boolean;
    fileCount: number;
};

type FolderPathOption = {
    id: string;
    path: string;
};

type TreeNode = {
    id: string;
    name: string;
    parentId: string | null;
};

type FolderNodeOption = {
    id: string;
    name: string;
    parentId?: string | null;
};

type PhotoReportUploaderProps = {
    open: boolean;
    onClose: () => void;
    taskId: string;
    taskName?: string | null;
    bsLocations?: BaseLocation[];
    photoReports?: PhotoReport[];
    initialBaseId?: string;
    onUploaded?: () => void;
    onSubmitted?: () => void;
    readOnly?: boolean;
};

const getReadableSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;

const getStatusLabel = (status: UploadStatus) => {
    if (status === 'uploading') return 'Загрузка';
    if (status === 'done') return 'Готово';
    if (status === 'error') return 'Ошибка';
    if (status === 'canceled') return 'Отменено';
    return 'Готово к отправке';
};

const MAX_PREVIEW_ITEMS = 12;
const MAX_FILE_SIZE_MB = 15;
const MAX_BATCH_FILES = 5;
const MAX_BATCH_MB = 20;

export default function PhotoReportUploader(props: PhotoReportUploaderProps) {
    const {
        open,
        onClose,
        taskId,
        taskName,
        bsLocations = [],
        photoReports = [],
        initialBaseId,
        onUploaded,
        onSubmitted,
        readOnly = false,
    } = props;

    const [view, setView] = React.useState<'folders' | 'upload'>('folders');
    const [activeBase, setActiveBase] = React.useState('');
    const [items, setItems] = React.useState<UploadItem[]>([]);
    const [folderState, setFolderState] = React.useState<Record<string, FolderState>>({});
    const [existingFilesByBase, setExistingFilesByBase] = React.useState<Record<string, string[]>>({});
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [folderConfigError, setFolderConfigError] = React.useState<string | null>(null);
    const [existingError, setExistingError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [existingLoading, setExistingLoading] = React.useState(false);
    const [folderAlert, setFolderAlert] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);
    const [submitLoading, setSubmitLoading] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<{ baseId: string; url: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [autoClosed, setAutoClosed] = React.useState(false);
    const [folderConfigLoading, setFolderConfigLoading] = React.useState(false);
    const [folderPaths, setFolderPaths] = React.useState<FolderPathOption[]>([]);
    const [selectedFolderByBase, setSelectedFolderByBase] = React.useState<Record<string, string>>({});
    const [expandedFolderNodesByBase, setExpandedFolderNodesByBase] = React.useState<Record<string, string[]>>({});

    const theme = useTheme();
    const { t } = useI18n();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const cancelRef = React.useRef(false);
    const xhrRef = React.useRef<XMLHttpRequest | null>(null);
    const submitAlertTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const folderAlertTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const baseOptions = React.useMemo(() => {
        const names = bsLocations
            .map((loc) => (loc?.name || '').trim())
            .filter(Boolean) as string[];
        return Array.from(new Set(names));
    }, [bsLocations]);

    const initialExistingFilesByBase = React.useMemo(() => {
        const map: Record<string, string[]> = {};
        photoReports.forEach((report) => {
            const baseId = report?.baseId?.trim();
            const files = Array.isArray(report?.files) ? report.files.filter(Boolean) : [];
            if (baseId && files.length > 0) {
                map[baseId] = files;
            }
        });
        return map;
    }, [photoReports]);

    const initialFolderState = React.useMemo(() => {
        const map: Record<string, FolderState> = {};
        baseOptions.forEach((baseId) => {
            const count = initialExistingFilesByBase[baseId]?.length ?? 0;
            if (count > 0) {
                map[baseId] = { uploaded: true, fileCount: count };
            }
        });
        return map;
    }, [baseOptions, initialExistingFilesByBase]);

    const resetState = React.useCallback(() => {
        setView('folders');
        setActiveBase('');
        setUploadError(null);
        setExistingError(null);
        setExistingLoading(false);
        setFolderAlert(null);
        setSubmitError(null);
        setSubmitSuccess(null);
        setDeleteTarget(null);
        setDeleteError(null);
        setDeleteLoading(false);
        setFolderConfigError(null);
        setFolderConfigLoading(false);
        setItems((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.preview));
            return [];
        });
        setFolderState(initialFolderState);
        setExistingFilesByBase(initialExistingFilesByBase);
        setFolderPaths([]);
        setSelectedFolderByBase({});
        setExpandedFolderNodesByBase({});
    }, [initialExistingFilesByBase, initialFolderState]);

    const loadFolderConfig = React.useCallback(async () => {
        if (!taskId) {
            setFolderPaths([]);
            return;
        }
        setFolderConfigLoading(true);
        setFolderConfigError(null);
        try {
            const res = await fetch(
                withBasePath(`/api/reports/config?taskId=${encodeURIComponent(taskId)}`),
                { cache: 'no-store' }
            );
            const data = (await res.json().catch(() => ({}))) as {
                folderPaths?: FolderPathOption[];
                folders?: FolderNodeOption[];
                error?: string;
            };
            if (!res.ok) {
                setFolderConfigError(
                    data.error ||
                        t(
                            'reports.upload.folders.error.load',
                            'Не удалось загрузить структуру папок'
                        )
                );
                setFolderPaths([]);
                return;
            }
            const directPaths = Array.isArray(data.folderPaths) ? data.folderPaths : [];
            if (directPaths.length > 0) {
                setFolderPaths(directPaths);
                return;
            }
            const folders = Array.isArray(data.folders) ? data.folders : [];
            if (folders.length === 0) {
                setFolderPaths([]);
                return;
            }
            const byId = new Map(folders.map((item) => [item.id, item]));
            const resolvePath = (id: string) => {
                const parts: string[] = [];
                const visited = new Set<string>();
                let current = byId.get(id);
                while (current) {
                    if (visited.has(current.id)) break;
                    visited.add(current.id);
                    parts.unshift((current.name || '').trim());
                    const parentId =
                        typeof current.parentId === 'string' && current.parentId.trim()
                            ? current.parentId.trim()
                            : '';
                    if (!parentId) break;
                    current = byId.get(parentId);
                }
                return parts.filter(Boolean).join('/');
            };
            setFolderPaths(
                folders
                    .map((item) => ({ id: item.id, path: resolvePath(item.id) }))
                    .filter((item) => item.id && item.path)
            );
        } catch (error) {
            setFolderConfigError(
                error instanceof Error
                    ? error.message
                    : t('reports.upload.folders.error.load', 'Не удалось загрузить структуру папок')
            );
            setFolderPaths([]);
        } finally {
            setFolderConfigLoading(false);
        }
    }, [taskId, t]);

    const loadExistingFiles = React.useCallback(
        async (baseId: string) => {
            if (!taskId || !baseId) return;
            setExistingLoading(true);
            setExistingError(null);
            try {
            const res = await fetch(
                withBasePath(
                    `/api/reports/${encodeURIComponent(taskId)}/${encodeURIComponent(baseId)}`
                ),
                { cache: 'no-store' }
            );
                if (res.status === 404) {
                    setExistingFilesByBase((prev) => ({ ...prev, [baseId]: [] }));
                    setFolderState((prev) => ({
                        ...prev,
                        [baseId]: { uploaded: false, fileCount: 0 },
                    }));
                    return;
                }
                const data = (await res.json().catch(() => ({}))) as { files?: string[]; error?: string };
                if (!res.ok) {
                    setExistingError(data.error || 'Не удалось загрузить фотоотчет');
                    return;
                }
                const files = Array.isArray(data.files) ? data.files.filter(Boolean) : [];
                setExistingFilesByBase((prev) => ({ ...prev, [baseId]: files }));
                setFolderState((prev) => ({
                    ...prev,
                    [baseId]: { uploaded: files.length > 0, fileCount: files.length },
                }));
            } catch (error) {
                setExistingError(error instanceof Error ? error.message : 'Ошибка загрузки фотоотчета');
            } finally {
                setExistingLoading(false);
            }
        },
        [taskId]
    );

    const folderTreeNodes = React.useMemo<TreeNode[]>(() => {
        if (folderPaths.length === 0) return [];
        const byPath = new Map(folderPaths.map((item) => [item.path, item.id]));
        return folderPaths.map((item) => {
            const segments = item.path.split('/').map((s) => s.trim()).filter(Boolean);
            const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : '';
            return {
                id: item.id,
                name: segments[segments.length - 1] ?? item.path,
                parentId: parentPath ? byPath.get(parentPath) ?? null : null,
            };
        });
    }, [folderPaths]);

    const folderTreeChildren = React.useMemo(() => {
        const map = new Map<string, TreeNode[]>();
        folderTreeNodes.forEach((node) => {
            const key = node.parentId ?? '__root__';
            const bucket = map.get(key) ?? [];
            bucket.push(node);
            map.set(key, bucket);
        });
        map.forEach((nodes) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        });
        return map;
    }, [folderTreeNodes]);
    const folderTreeChildCountById = React.useMemo(() => {
        const map = new Map<string, number>();
        folderTreeNodes.forEach((node) => {
            map.set(node.id, (folderTreeChildren.get(node.id) ?? []).length);
        });
        return map;
    }, [folderTreeNodes, folderTreeChildren]);

    const folderPathById = React.useMemo(() => {
        const map = new Map<string, string>();
        folderPaths.forEach((item) => map.set(item.id, item.path));
        return map;
    }, [folderPaths]);

    React.useEffect(() => {
        if (open) {
            setAutoClosed(false);
            resetState();
            void loadFolderConfig();
            const normalizedBaseId = initialBaseId?.trim();
            if (normalizedBaseId) {
                setActiveBase(normalizedBaseId);
                setView('upload');
                void loadExistingFiles(normalizedBaseId);
            }
        }
    }, [open, resetState, initialBaseId, loadExistingFiles, loadFolderConfig]);

    React.useEffect(() => {
        if (!activeBase || view !== 'upload') return;
        setExpandedFolderNodesByBase((prev) => {
            if (prev[activeBase] && prev[activeBase].length > 0) {
                return prev;
            }
            return {
                ...prev,
                [activeBase]: ['root', ...folderTreeNodes.map((node) => node.id)],
            };
        });
    }, [activeBase, view, folderTreeNodes]);

    React.useEffect(() => {
        if (!open && !uploading && !submitLoading) {
            resetState();
        }
    }, [open, uploading, submitLoading, resetState]);

    React.useEffect(() => {
        return () => {
            items.forEach((item) => URL.revokeObjectURL(item.preview));
        };
    }, [items]);

    React.useEffect(() => {
        if (submitAlertTimerRef.current) {
            clearTimeout(submitAlertTimerRef.current);
            submitAlertTimerRef.current = null;
        }
        if (submitSuccess) {
            submitAlertTimerRef.current = setTimeout(() => {
                setSubmitSuccess(null);
                setAutoClosed(true);
                onClose();
                onSubmitted?.();
            }, 3000);
            return;
        }
    }, [submitError, submitSuccess, onClose, onSubmitted]);

    React.useEffect(() => {
        if (folderAlertTimerRef.current) {
            clearTimeout(folderAlertTimerRef.current);
            folderAlertTimerRef.current = null;
        }
        if (!folderAlert) return;
        folderAlertTimerRef.current = setTimeout(() => {
            setFolderAlert(null);
        }, 3000);
        return () => {
            if (folderAlertTimerRef.current) {
                clearTimeout(folderAlertTimerRef.current);
                folderAlertTimerRef.current = null;
            }
        };
    }, [folderAlert, onClose]);

    const updateItem = React.useCallback((id: string, patch: Partial<UploadItem>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        multiple: true,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        disabled: uploading || readOnly,
        onDrop: (acceptedFiles, fileRejections) => {
            setItems((prev) => {
                let previewCount = prev.reduce((count, item) => (item.preview ? count + 1 : count), 0);
                const mapped = acceptedFiles.map((file) => {
                    const canPreview = previewCount < MAX_PREVIEW_ITEMS;
                    const preview = canPreview ? URL.createObjectURL(file) : '';
                    if (canPreview) previewCount += 1;
                    return {
                        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                        file,
                        preview,
                        progress: 0,
                        status: 'ready' as const,
                    };
                });
                return [...prev, ...mapped];
            });
            if (fileRejections.length > 0) {
                const firstError = fileRejections[0]?.errors?.[0]?.message;
                setUploadError(firstError || 'Некоторые файлы отклонены');
            } else {
                setUploadError(null);
            }
        },
        onDropRejected: (rejections) => {
            const firstError = rejections[0]?.errors?.[0]?.message;
            setUploadError(firstError || 'Файлы не приняты');
        },
    });

    const handleRemoveItem = (id: string) => {
        setItems((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target?.preview) URL.revokeObjectURL(target.preview);
            return prev.filter((item) => item.id !== id);
        });
    };

    const handleDialogClose = (
        _event?: object,
        reason?: 'backdropClick' | 'escapeKeyDown'
    ) => {
        if (uploading || submitLoading) return;
        if (reason) return;
        onClose();
    };

    const handleBackToFolders = () => {
        if (uploading) return;
        setItems((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.preview));
            return [];
        });
        setUploadError(null);
        setExistingError(null);
        setView('folders');
    };

    const handleCancelUpload = () => {
        cancelRef.current = true;
        if (xhrRef.current) {
            xhrRef.current.abort();
        }
        setUploading(false);
        setItems((prev) =>
            prev.map((item) =>
                item.status === 'uploading' || item.status === 'ready'
                    ? { ...item, status: 'canceled' as const }
                    : item
            )
        );
        setUploadError('Загрузка отменена');
    };

    const handleUpload = async () => {
        if (readOnly) return;
        if (!activeBase) {
            setUploadError('Выберите папку БС для загрузки фотоотчета');
            return;
        }
        if (hasCustomStructure && !activeFolderId) {
            return;
        }
        if (hasCustomStructure && activeFolderHasChildren) {
            return;
        }
        if (items.length === 0) {
            setUploadError('Добавьте хотя бы одно фото');
            return;
        }
        setUploading(true);
        cancelRef.current = false;
        setUploadError(null);

        const targets = items.filter((item) => item.status !== 'done');
        const maxBatchBytes = MAX_BATCH_MB * 1024 * 1024;
        const maxBatchFiles = MAX_BATCH_FILES;
        const batches: UploadItem[][] = [];
        let currentBatch: UploadItem[] = [];
        let currentBytes = 0;

        targets.forEach((item) => {
            const size = Math.max(1, item.file.size);
            const wouldExceed =
                currentBatch.length > 0 &&
                (currentBatch.length >= maxBatchFiles || currentBytes + size > maxBatchBytes);
            if (wouldExceed) {
                batches.push(currentBatch);
                currentBatch = [];
                currentBytes = 0;
            }
            currentBatch.push(item);
            currentBytes += size;
            if (currentBatch.length >= maxBatchFiles) {
                batches.push(currentBatch);
                currentBatch = [];
                currentBytes = 0;
            }
        });
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        const uploadBatch = async (batch: UploadItem[]) => {
            batch.forEach((item) => {
                updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
            });

            const ranges = batch.reduce<{ id: string; start: number; end: number; size: number }[]>(
                (acc, item) => {
                    const start = acc.length === 0 ? 0 : acc[acc.length - 1].end;
                    const safeSize = Math.max(1, item.file.size);
                    const end = start + safeSize;
                    acc.push({ id: item.id, start, end, size: safeSize });
                    return acc;
                },
                []
            );
            const totalSize = ranges.length > 0 ? ranges[ranges.length - 1].end : 0;

            const formData = new FormData();
            formData.append('baseId', activeBase);
            formData.append('taskId', taskId);
            const selectedFolderId = selectedFolderByBase[activeBase]?.trim();
            if (selectedFolderId) {
                formData.append('folderId', selectedFolderId);
            }
            batch.forEach((item) => {
                formData.append('files', item.file);
            });

            return new Promise<{ ok: boolean; urls: string[]; error?: string }>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhrRef.current = xhr;

                xhr.upload.onprogress = (event) => {
                    if (!event.lengthComputable || totalSize === 0) return;
                    const loaded = event.loaded;
                    setItems((prev) =>
                        prev.map((item) => {
                            const range = ranges.find((r) => r.id === item.id);
                            if (!range) return item;
                            const progressRaw = (loaded - range.start) / range.size;
                            const progress = Math.max(0, Math.min(1, progressRaw));
                            return {
                                ...item,
                                status: item.status === 'canceled' ? item.status : 'uploading',
                                progress: Math.round(progress * 100),
                            };
                        })
                    );
                };

                xhr.onload = () => {
                    const success = xhr.status >= 200 && xhr.status < 300;
                    let urls: string[] = [];
                    if (success) {
                        try {
                            const payload = JSON.parse(xhr.responseText || '{}') as { urls?: string[] };
                            urls = Array.isArray(payload.urls) ? payload.urls : [];
                        } catch {
                            urls = [];
                        }
                    }
                    setItems((prev) =>
                        prev.map((item) => {
                            const isTarget = batch.some((target) => target.id === item.id);
                            if (!isTarget) return item;
                            return {
                                ...item,
                                status: success ? 'done' : 'error',
                                progress: success ? 100 : item.progress,
                                error: success ? undefined : 'Ошибка загрузки',
                            };
                        })
                    );
                    if (!success) {
                        const responseError = (() => {
                            try {
                                const payload = JSON.parse(xhr.responseText || '{}') as {
                                    error?: string;
                                    readOnly?: boolean;
                                };
                                if (payload.readOnly) {
                                    return payload.error || 'Хранилище доступно только для чтения';
                                }
                                return payload.error;
                            } catch {
                                return undefined;
                            }
                        })();
                        resolve({ ok: false, urls: [], error: responseError || 'Ошибка загрузки' });
                    } else {
                        resolve({ ok: true, urls });
                    }
                    xhrRef.current = null;
                };

                xhr.onerror = () => {
                    setItems((prev) =>
                        prev.map((item) =>
                            batch.some((target) => target.id === item.id)
                                ? { ...item, status: 'error', error: 'Сбой сети' }
                                : item
                        )
                    );
                    xhrRef.current = null;
                    resolve({ ok: false, urls: [], error: 'Сбой сети' });
                };

                xhr.onabort = () => {
                    setItems((prev) =>
                        prev.map((item) =>
                            batch.some((target) => target.id === item.id)
                                ? { ...item, status: 'canceled', error: 'Отменено' }
                                : item
                        )
                    );
                    xhrRef.current = null;
                    resolve({ ok: false, urls: [], error: 'Загрузка отменена' });
                };

                xhr.open('POST', withBasePath('/api/reports/upload'), true);
                xhr.send(formData);
            });
        };

        let uploadOk = true;
        let uploadedUrls: string[] = [];
        for (const batch of batches) {
            if (cancelRef.current) {
                uploadOk = false;
                break;
            }
            const result = await uploadBatch(batch);
            if (!result.ok) {
                uploadOk = false;
                setUploadError(result.error || 'Ошибка загрузки');
                break;
            }
            uploadedUrls = [...uploadedUrls, ...result.urls];
        }

        if (cancelRef.current) {
            setUploading(false);
            return;
        }

        setUploading(false);
        if (uploadOk) {
            setExistingFilesByBase((prev) => {
                const existing = prev[activeBase] ?? [];
                const next = uploadedUrls.length > 0 ? [...existing, ...uploadedUrls] : existing;
                return { ...prev, [activeBase]: next };
            });
            setFolderState((prev) => ({
                ...prev,
                [activeBase]: {
                    uploaded: true,
                    fileCount:
                        (prev[activeBase]?.fileCount ?? 0) +
                        (uploadedUrls.length > 0 ? uploadedUrls.length : targets.length),
                },
            }));
            setFolderAlert(`Фото в папке ${activeBase} успешно загружены`);
            setItems((prev) => {
                prev.forEach((item) => {
                    if (item.preview) URL.revokeObjectURL(item.preview);
                });
                return [];
            });
            setView('folders');
            onUploaded?.();
        }
    };

    const allUploaded =
        baseOptions.length > 0 &&
        baseOptions.every((base) => folderState[base]?.uploaded);

    const handleOpenFolder = (baseId: string) => {
        if (uploading || submitLoading) return;
        setActiveBase(baseId);
        setUploadError(null);
        setExistingError(null);
        setFolderAlert(null);
        setView('upload');
        setSelectedFolderByBase((prev) => ({ ...prev, [baseId]: prev[baseId] ?? '' }));
        const defaultExpanded = ['root', ...folderTreeNodes.map((node) => node.id)];
        setExpandedFolderNodesByBase((prev) => ({ ...prev, [baseId]: defaultExpanded }));
        void loadExistingFiles(baseId);
    };

    const handleDeleteExisting = (baseId: string, url: string) => {
        if (readOnly) return;
        setDeleteError(null);
        setDeleteTarget({ baseId, url });
    };

    const handleConfirmDelete = async () => {
        if (readOnly) return;
        if (!deleteTarget) return;
        setDeleteLoading(true);
        setDeleteError(null);
        try {
            const res = await fetch(
                withBasePath(
                    `/api/reports/${encodeURIComponent(taskId)}/${encodeURIComponent(deleteTarget.baseId)}/files`
                ),
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: deleteTarget.url }),
                }
            );
            const data = (await res.json().catch(() => ({}))) as { error?: string; files?: string[] };
            if (!res.ok) {
                setDeleteError(data.error || 'Не удалось удалить фото');
                return;
            }
            const nextFiles = Array.isArray(data.files)
                ? data.files.filter(Boolean)
                : (existingFilesByBase[deleteTarget.baseId] ?? []).filter(
                      (fileUrl) => fileUrl !== deleteTarget.url
                  );
            setExistingFilesByBase((prev) => ({
                ...prev,
                [deleteTarget.baseId]: nextFiles,
            }));
            setFolderState((prev) => ({
                ...prev,
                [deleteTarget.baseId]: {
                    uploaded: nextFiles.length > 0,
                    fileCount: nextFiles.length,
                },
            }));
            setDeleteTarget(null);
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Ошибка удаления фото');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDeleteDialogClose = () => {
        if (deleteLoading) return;
        setDeleteTarget(null);
        setDeleteError(null);
    };

    const handleSubmit = async () => {
        if (readOnly) return;
        if (!allUploaded) {
            setSubmitError('Сначала загрузите фото по всем папкам БС');
            return;
        }
        setSubmitLoading(true);
        setSubmitError(null);
        setSubmitSuccess(null);
        try {
            const res = await fetch(withBasePath('/api/reports/submit'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    baseIds: baseOptions,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
            if (!res.ok) {
                setSubmitError(data.error || 'Не удалось отправить фотоотчет');
                return;
            }
            setSubmitSuccess(
                data.message ||
                    t('reports.upload.submit.success', 'Фотоотчет отправлен менеджеру')
            );
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Ошибка отправки');
        } finally {
            setSubmitLoading(false);
        }
    };

    const existingFiles = activeBase ? existingFilesByBase[activeBase] ?? [] : [];
    const activeFolderId = activeBase ? selectedFolderByBase[activeBase] ?? '' : '';
    const activeFolderPath = activeFolderId ? folderPathById.get(activeFolderId) ?? '' : '';
    const activeTreeNodeId = activeFolderId || 'root';
    const hasCustomStructure = folderPaths.length > 0;
    const activeFolderHasChildren = activeFolderId
        ? (folderTreeChildCountById.get(activeFolderId) ?? 0) > 0
        : false;
    const canUploadToSelectedFolder = !hasCustomStructure
        ? true
        : Boolean(activeFolderId) && !activeFolderHasChildren;
    const expandedNodeIds = activeBase ? expandedFolderNodesByBase[activeBase] ?? [] : [];
    const effectiveExpandedNodeIds =
        expandedNodeIds.length > 0
            ? expandedNodeIds
            : ['root', ...folderTreeNodes.map((node) => node.id)];
    const isNodeExpanded = (nodeId: string) => effectiveExpandedNodeIds.includes(nodeId);
    const toggleNodeExpanded = (nodeId: string) => {
        setExpandedFolderNodesByBase((prev) => {
            const current = prev[activeBase] ?? ['root', ...folderTreeNodes.map((node) => node.id)];
            const exists = current.includes(nodeId);
            return {
                ...prev,
                [activeBase]: exists
                    ? current.filter((id) => id !== nodeId)
                    : [...current, nodeId],
            };
        });
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
    const activeFolderStoragePath = normalizePathForStorage(activeFolderPath || '');
    const getFolderPathFromFileUrl = (url: string) => {
        const key = extractStorageKey(url);
        if (!key || !activeBase) return '';
        const segments = key
            .split('/')
            .filter(Boolean)
            .map((segment) => decodeUrlSegment(segment));
        const baseIndex = segments.findIndex((segment) => segment === activeBase);
        if (baseIndex < 0) return '';
        const tail = segments.slice(baseIndex + 1);
        if (tail.length <= 1) return '';
        return normalizePathForStorage(tail.slice(0, -1).join('/'));
    };
    const visibleExistingFiles = existingFiles.filter((url) => {
        const folderPath = getFolderPathFromFileUrl(url);
        return folderPath === activeFolderStoragePath;
    });
    const filesCountByFolderPath = (() => {
        const map = new Map<string, number>();
        existingFiles.forEach((url) => {
            const folderPath = getFolderPathFromFileUrl(url);
            map.set(folderPath, (map.get(folderPath) ?? 0) + 1);
        });
        return map;
    })();
    const getFolderCount = (folderId: string) =>
        filesCountByFolderPath.get(
            normalizePathForStorage(folderPathById.get(folderId) ?? '')
        ) ?? 0;
    const rootFolderCount = filesCountByFolderPath.get('') ?? 0;
    const totalSelectedBytes = items.reduce((sum, item) => sum + (item.file.size || 0), 0);

    return (
        <Dialog
            open={open && !autoClosed}
            onClose={handleDialogClose}
            disableEscapeKeyDown
            fullWidth
            maxWidth="md"
            fullScreen={isMobile}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: isMobile ? 0 : 4,
                        p: 1,
                        background:
                            'linear-gradient(160deg, rgba(255,255,255,0.95), rgba(235,240,248,0.95))',
                        border: '1px solid rgba(255,255,255,0.65)',
                        boxShadow: '0 36px 90px rgba(15, 23, 42, 0.25)',
                        backdropFilter: 'blur(18px)',
                    },
                },
            }}
        >
            <DialogTitle
                sx={{
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pr: 1,
                    gap: 1,
                }}
            >
                <Stack direction="row" alignItems="center" gap={1}>
                    {view === 'upload' && (
                        <IconButton onClick={handleBackToFolders} disabled={uploading}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography variant="inherit">
                        {view === 'upload'
                            ? t('reports.upload.dialog.titleWithBase', 'Фотоотчет — {baseId}', {
                                  baseId: activeBase,
                              })
                            : t('reports.header.title', 'Фотоотчет')}
                    </Typography>
                </Stack>
                <IconButton onClick={handleDialogClose} disabled={uploading || submitLoading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {view === 'folders' ? (
                            <>
                                <Typography variant="body2" color="text.secondary">
                            {readOnly
                                ? 'Просмотр фотоотчета по папкам БС.'
                                : 'Загрузите фото по каждой БС, затем отправьте отчет менеджеру.'}
                        </Typography>
                        {folderAlert && <Alert severity="success">{folderAlert}</Alert>}
                        {submitError && (
                            <Alert variant="filled" severity="error">
                                {submitError}
                            </Alert>
                        )}
                        {submitSuccess && (
                            <Alert variant="filled" severity="success">
                                {submitSuccess}
                            </Alert>
                        )}

                        {baseOptions.length === 0 ? (
                            <Alert severity="warning">Нет папок БС для загрузки.</Alert>
                        ) : (
                            <Stack spacing={1.5}>
                                {baseOptions.map((baseId) => {
                                    const state = folderState[baseId];
                                    return (
                                        <Paper
                                            key={baseId}
                                            onClick={() => handleOpenFolder(baseId)}
                                            role="button"
                                            sx={{
                                                p: 2,
                                                borderRadius: 3,
                                                cursor: 'pointer',
                                                border: '1px solid rgba(15,23,42,0.08)',
                                                background:
                                                    'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,244,250,0.96))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                                '&:hover': {
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: '0 14px 30px rgba(15,23,42,0.12)',
                                                },
                                            }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <FolderOutlinedIcon />
                                                <Box>
                                                    <Typography fontWeight={600}>{baseId}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('reports.header.title', 'Фотоотчет')}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                {state?.uploaded && (
                                                    <Chip
                                                        size="small"
                                                        icon={<CheckCircleIcon />}
                                                        label={`Загружено (${state.fileCount})`}
                                                        sx={{
                                                            borderRadius: 999,
                                                            bgcolor: 'rgba(34,197,94,0.16)',
                                                            color: '#0f3d1d',
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                )}
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        )}
                    </>
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary">
                            {readOnly
                                ? `Просмотр фото для БС ${activeBase}.`
                                : `Загружайте фото для БС ${activeBase}.`}
                        </Typography>
                        {taskName && (
                            <Typography variant="caption" color="text.secondary">
                                Задача: {taskName}
                            </Typography>
                        )}
                        {uploadError && <Alert severity="error">{uploadError}</Alert>}
                        {folderConfigError && <Alert severity="warning">{folderConfigError}</Alert>}
                        {existingError && <Alert severity="error">{existingError}</Alert>}
                        {folderConfigLoading && <LinearProgress sx={{ borderRadius: 999 }} />}
                        {folderPaths.length > 0 && (
                            <Stack spacing={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('reports.upload.folders.treeTitle', 'Структура папок')}
                                </Typography>
                                <Box
                                    sx={{
                                        border: '1px solid rgba(15,23,42,0.1)',
                                        borderRadius: 2,
                                        px: 0.5,
                                        py: 0.75,
                                        background: 'rgba(255,255,255,0.55)',
                                    }}
                                >
                                    <List dense disablePadding>
                                        <ListItemButton
                                            selected={activeTreeNodeId === 'root'}
                                            onClick={() =>
                                                setSelectedFolderByBase((prev) => ({
                                                    ...prev,
                                                    [activeBase]: '',
                                                }))
                                            }
                                            sx={{ borderRadius: 1.5, mx: 0.5 }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                                        <FolderOutlinedIcon fontSize="small" />
                                                        <Typography variant="body2">
                                                            {activeBase ||
                                                                t('reports.upload.folders.root', 'Корень БС')}
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
                                        {(folderTreeChildren.get('__root__') ?? []).map((rootNode) => {
                                            const renderNode = (
                                                node: TreeNode,
                                                depth: number
                                            ): React.ReactNode => {
                                                const children = folderTreeChildren.get(node.id) ?? [];
                                                const expanded = isNodeExpanded(node.id);
                                                return (
                                                    <React.Fragment key={node.id}>
                                                        <ListItemButton
                                                            selected={activeTreeNodeId === node.id}
                                                            onClick={() =>
                                                                setSelectedFolderByBase((prev) => ({
                                                                    ...prev,
                                                                    [activeBase]: node.id,
                                                                }))
                                                            }
                                                            sx={{
                                                                borderRadius: 1.5,
                                                                mx: 0.5,
                                                                pl: 1 + depth * 2,
                                                            }}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                                                <Stack direction="row" alignItems="center" spacing={0.25}>
                                                                    <FolderOutlinedIcon fontSize="small" />
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
                                                                        <Typography variant="body2">{node.name}</Typography>
                                                                        {getFolderCount(node.id) > 0 && (
                                                                            <Typography
                                                                                variant="body2"
                                                                                sx={{ color: 'primary.main', fontWeight: 600 }}
                                                                            >
                                                                                ({getFolderCount(node.id)})
                                                                            </Typography>
                                                                        )}
                                                                    </Stack>
                                                                }
                                                            />
                                                        </ListItemButton>
                                                        {children.length > 0 && (
                                                            <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                                <List disablePadding dense>
                                                                    {children.map((child) =>
                                                                        renderNode(child, depth + 1)
                                                                    )}
                                                                </List>
                                                            </Collapse>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            };
                                            return renderNode(rootNode, 1);
                                        })}
                                    </List>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                    {t('reports.upload.folders.path', 'Путь загрузки: {path}', {
                                        path: `${activeBase}${activeFolderPath ? ` / ${activeFolderPath}` : ''}`,
                                    })}
                                </Typography>
                            </Stack>
                        )}
                        {existingLoading && <LinearProgress sx={{ borderRadius: 999 }} />}
                        {visibleExistingFiles.length > 0 && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Уже загружено
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
                                        gap: 1.5,
                                    }}
                                >
                                    {visibleExistingFiles.map((url) => (
                                        <Box
                                            key={url}
                                            sx={{
                                                position: 'relative',
                                                width: '100%',
                                                aspectRatio: '1 / 1',
                                                borderRadius: 2.5,
                                                overflow: 'hidden',
                                                border: '1px solid rgba(15,23,42,0.08)',
                                            }}
                                        >
                                            <Image
                                                src={url}
                                                alt="Фотоотчет"
                                                fill
                                                style={{ objectFit: 'cover' }}
                                                unoptimized
                                            />
                                            {!readOnly && (
                                                <IconButton
                                                    onClick={() => handleDeleteExisting(activeBase, url)}
                                                    disabled={uploading || deleteLoading}
                                                    size="small"
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 4,
                                                        right: 4,
                                                        bgcolor: 'rgba(15,23,42,0.65)',
                                                        color: '#fff',
                                                        '&:hover': {
                                                            bgcolor: 'rgba(15,23,42,0.8)',
                                                        },
                                                    }}
                                                    aria-label="Удалить фото"
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                            </Stack>
                        )}
                        {!readOnly && canUploadToSelectedFolder && (
                            <Box
                                {...getRootProps()}
                                sx={{
                                    border: '1.5px dashed',
                                    borderColor: isDragActive ? 'primary.main' : 'rgba(15, 23, 42, 0.2)',
                                    borderRadius: 4,
                                    p: 3,
                                    textAlign: 'center',
                                    background:
                                        'linear-gradient(140deg, rgba(255,255,255,0.8), rgba(236,242,249,0.92))',
                                    transition: 'all 0.2s ease',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    opacity: uploading ? 0.6 : 1,
                                }}
                            >
                                <input {...getInputProps()} disabled={uploading} />
                                <CloudUploadIcon fontSize="large" color="action" />
                                <Typography variant="h6" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
                                    Перетащите фото или нажмите, чтобы выбрать
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    До {MAX_FILE_SIZE_MB} МБ каждое. Партия до {MAX_BATCH_FILES} файлов или{' '}
                                    {MAX_BATCH_MB} МБ.
                                </Typography>
                            </Box>
                        )}


                        {!readOnly && items.length > 0 && (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                    gap: 1.25,
                                }}
                            >
                                {items.map((item) => (
                                    <Paper
                                        key={item.id}
                                        variant="outlined"
                                        sx={{
                                            p: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1,
                                            borderRadius: 3,
                                            background:
                                                'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(241,245,251,0.92))',
                                            borderColor: 'rgba(15,23,42,0.08)',
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                                            {item.preview ? (
                                                <Image
                                                    src={item.preview}
                                                    alt={item.file.name}
                                                    width={64}
                                                    height={64}
                                                    style={{ objectFit: 'cover', borderRadius: 14 }}
                                                    unoptimized
                                                />
                                            ) : (
                                                <Box
                                                    sx={{
                                                        width: 64,
                                                        height: 64,
                                                        borderRadius: 3,
                                                        bgcolor: 'rgba(15,23,42,0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: 'rgba(15,23,42,0.6)',
                                                    }}
                                                >
                                                    Фото
                                                </Box>
                                            )}
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography sx={{ wordBreak: 'break-word', fontWeight: 600 }}>
                                                    {item.file.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {getReadableSize(item.file.size)}
                                                </Typography>
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                    <Chip
                                                        size="small"
                                                        label={getStatusLabel(item.status)}
                                                        sx={{
                                                            borderRadius: 999,
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                item.status === 'done'
                                                                    ? 'rgba(34,197,94,0.16)'
                                                                    : item.status === 'error'
                                                                      ? 'rgba(239,68,68,0.12)'
                                                                      : item.status === 'canceled'
                                                                        ? 'rgba(15,23,42,0.12)'
                                                                        : 'rgba(59,130,246,0.1)',
                                                        }}
                                                    />
                                                    {item.status === 'uploading' && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.progress}%
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Box>
                                            {item.status !== 'uploading' && (
                                                <IconButton
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    disabled={uploading}
                                                    size="small"
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Stack>
                                        {item.status === 'uploading' && (
                                            <Box sx={{ mt: 1 }}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={item.progress}
                                                    sx={{
                                                        height: 6,
                                                        borderRadius: 999,
                                                        backgroundColor: 'rgba(15,23,42,0.08)',
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 999,
                                                            background:
                                                                'linear-gradient(90deg, rgba(0,122,255,0.9), rgba(88,86,214,0.9))',
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        )}
                                    </Paper>
                                ))}
                            </Box>
                        )}
                        {!readOnly && items.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Выбрано: {items.length} · Общий размер: {getReadableSize(totalSelectedBytes)}
                            </Typography>
                        )}

                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'space-between' }}>
                {view === 'folders' ? (
                    <>
                        <Button onClick={handleDialogClose} sx={{ textTransform: 'none', borderRadius: 999 }}>
                            {readOnly ? 'Закрыть' : 'Отмена'}
                        </Button>
                        {!readOnly && (
                            <Button
                                variant="contained"
                                onClick={() => void handleSubmit()}
                                disabled={!allUploaded || submitLoading}
                                startIcon={<SendIcon />}
                                sx={{
                                    textTransform: 'none',
                                    borderRadius: 999,
                                    fontWeight: 700,
                                    px: 3,
                                    background: allUploaded
                                        ? 'linear-gradient(135deg, rgba(0,122,255,0.95), rgba(88,86,214,0.95))'
                                        : 'rgba(148,163,184,0.6)',
                                    boxShadow: allUploaded ? '0 12px 28px rgba(0, 122, 255, 0.35)' : 'none',
                                    '&:hover': {
                                        background: allUploaded
                                            ? 'linear-gradient(135deg, rgba(0,113,240,0.98), rgba(72,69,212,0.98))'
                                            : 'rgba(148,163,184,0.6)',
                                    },
                                }}
                            >
                                {submitLoading ? 'Отправка...' : 'Отправить'}
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        <Button
                            onClick={uploading ? handleCancelUpload : handleBackToFolders}
                            sx={{ textTransform: 'none', borderRadius: 999 }}
                        >
                            {uploading ? 'Отменить загрузку' : readOnly ? 'Назад' : 'Отмена'}
                        </Button>
                        {!readOnly && (
                            <Button
                                variant="contained"
                                onClick={() => void handleUpload()}
                                disabled={uploading || items.length === 0 || !canUploadToSelectedFolder}
                                startIcon={<CloudUploadIcon />}
                                sx={{
                                    textTransform: 'none',
                                    borderRadius: 999,
                                    fontWeight: 700,
                                    px: 3,
                                    background: 'linear-gradient(135deg, rgba(0,122,255,0.95), rgba(88,86,214,0.95))',
                                    boxShadow: '0 12px 28px rgba(0, 122, 255, 0.35)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, rgba(0,113,240,0.98), rgba(72,69,212,0.98))',
                                    },
                                }}
                            >
                                {uploading ? 'Загрузка...' : 'Загрузить'}
                            </Button>
                        )}
                    </>
                )}
            </DialogActions>
            <Dialog open={Boolean(deleteTarget)} onClose={handleDeleteDialogClose}>
                <DialogTitle>Удалить фото?</DialogTitle>
                <DialogContent sx={{ pt: 1.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Фото будет удалено из фотоотчета и хранилища. Это действие нельзя отменить.
                    </Typography>
                    {deleteTarget && (
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                height: 180,
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid rgba(15,23,42,0.1)',
                            }}
                        >
                            <Image
                                src={deleteTarget.url}
                                alt="Фото для удаления"
                                fill
                                style={{ objectFit: 'cover' }}
                                unoptimized
                            />
                        </Box>
                    )}
                    {deleteError && (
                        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                            {deleteError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={handleDeleteDialogClose}
                        disabled={deleteLoading}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => void handleConfirmDelete()}
                        disabled={deleteLoading}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {deleteLoading ? 'Удаление...' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
