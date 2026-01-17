'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { withBasePath } from '@/utils/basePath';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, startOfDay, endOfDay } from 'date-fns';

import { UI_RADIUS } from '@/config/uiTokens';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle, STATUS_ORDER } from '@/utils/statusLabels';
import { getOperatorLabel } from '@/app/utils/operators';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import ProfileDialog from '@/features/profile/ProfileDialog';

type AdminReport = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    createdById?: string;
    createdByName?: string;
    executorName?: string;
    initiatorName?: string;
    createdAt: string;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    projectId?: string;
    projectKey?: string;
    projectName?: string;
    projectRegionCode?: string;
    projectOperator?: string;
    baseStatuses: Array<{
        baseId: string;
        status: string;
        latestStatusChangeDate: string;
        fileCount?: number;
    }>;
};

type AdminReportFilters = {
    orgId: string;
    projectId: string;
    regionCode: string;
    operatorCode: string;
    status: string;
    author: string;
    createdFrom: Date | null;
    createdTo: Date | null;
};

type OrgOption = { id: string; label: string; slug?: string };
type ProjectOption = { id: string; label: string; key?: string; orgId?: string };
type RegionOption = { code: string; label: string };
type OperatorOption = { code: string; label: string };

const defaultFilters: AdminReportFilters = {
    orgId: '',
    projectId: '',
    regionCode: '',
    operatorCode: '',
    status: '',
    author: '',
    createdFrom: null,
    createdTo: null,
};

const getRegionLabel = (code?: string | null) => {
    if (!code) return '—';
    return RUSSIAN_REGIONS.find((region) => region.code === code)?.label ?? code;
};

const formatDateRU = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU');
};

const getTaskStatus = (baseStatuses: AdminReport['baseStatuses'] = []) => {
    const nonAgreed = baseStatuses.find(
        (base) => normalizeStatusTitle(base.status) !== 'Agreed'
    );
    return nonAgreed ? normalizeStatusTitle(nonAgreed.status) : 'Agreed';
};

const getOrgHref = (report: AdminReport) => {
    if (!report.orgSlug) return null;
    return `/org/${encodeURIComponent(report.orgSlug)}`;
};

const getProjectHref = (report: AdminReport) => {
    if (!report.orgSlug) return null;
    const projectRef = report.projectKey || report.projectId;
    if (!projectRef) return null;
    return `/org/${encodeURIComponent(report.orgSlug)}/projects/${encodeURIComponent(projectRef)}`;
};

const getReportHref = (report: AdminReport) => {
    if (!report.orgSlug) return null;
    const projectRef = report.projectKey || report.projectId;
    if (!projectRef) return null;
    return `/org/${encodeURIComponent(report.orgSlug)}/projects/${encodeURIComponent(
        projectRef
    )}/tasks/${encodeURIComponent(report.taskId)}`;
};

export default function ReportsAdmin() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const headerBg = isDarkMode ? 'rgba(17,22,33,0.85)' : 'rgba(255,255,255,0.55)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const headerShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 25px 80px rgba(15,23,42,0.1)';
    const sectionBg = isDarkMode ? 'rgba(18,24,36,0.85)' : 'rgba(255,255,255,0.65)';
    const sectionBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
    const sectionShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.5)' : '0 35px 90px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.7)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
    const iconShadow = isDarkMode ? '0 6px 18px rgba(0,0,0,0.4)' : '0 6px 18px rgba(15,23,42,0.08)';
    const iconText = textPrimary;
    const iconActiveBg = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(15,23,42,0.9)';
    const iconActiveText = '#ffffff';
    const tabActiveBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const tabInactiveColor = isDarkMode ? 'rgba(226,232,240,0.65)' : 'rgba(15,23,42,0.55)';
    const tabBorderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';

    const [tab, setTab] = React.useState<'list'>('list');
    const [q, setQ] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<AdminReport[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [searchAnchor, setSearchAnchor] = React.useState<HTMLElement | null>(null);
    const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
    const [filters, setFilters] = React.useState<AdminReportFilters>(defaultFilters);
    const [detailReport, setDetailReport] = React.useState<AdminReport | null>(null);
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);

    const load = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(withBasePath('/api/admin/reports'), { cache: 'no-store' });
            const payload = (await res.json().catch(() => null)) as
                | { reports?: AdminReport[]; error?: string }
                | null;
            if (!res.ok || !payload?.reports) {
                setError(payload?.error || `Не удалось загрузить отчеты (${res.status})`);
                setItems([]);
                return;
            }
            setItems(payload.reports);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки отчетов');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const orgOptions = React.useMemo<OrgOption[]>(() => {
        const map = new Map<string, OrgOption>();
        items.forEach((report) => {
            if (!report.orgId) return;
            const label = report.orgName || report.orgSlug || report.orgId;
            if (!map.has(report.orgId)) {
                map.set(report.orgId, { id: report.orgId, label, slug: report.orgSlug });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const projectOptions = React.useMemo<ProjectOption[]>(() => {
        const map = new Map<string, ProjectOption>();
        items.forEach((report) => {
            if (!report.projectId) return;
            const label = report.projectName || report.projectKey || report.projectId;
            if (!map.has(report.projectId)) {
                map.set(report.projectId, {
                    id: report.projectId,
                    label,
                    key: report.projectKey,
                    orgId: report.orgId,
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const regionOptions = React.useMemo<RegionOption[]>(() => {
        const codes = Array.from(
            new Set(items.map((report) => report.projectRegionCode).filter(Boolean))
        ) as string[];
        return codes
            .map((code) => ({ code, label: getRegionLabel(code) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const operatorOptions = React.useMemo<OperatorOption[]>(() => {
        const codes = Array.from(
            new Set(items.map((report) => report.projectOperator).filter(Boolean))
        ) as string[];
        return codes
            .map((code) => ({ code, label: getOperatorLabel(code) || code }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const filterOptions = React.useMemo(() => {
        const statuses = new Set<(typeof STATUS_ORDER)[number]>();
        const authors = new Set<string>();
        items.forEach((report) => {
            const status = getTaskStatus(report.baseStatuses);
            statuses.add(status);
            if (report.createdByName) authors.add(report.createdByName);
        });
        const orderedStatuses = STATUS_ORDER.filter((status) => statuses.has(status));
        const remainingStatuses = Array.from(statuses).filter(
            (status) => !STATUS_ORDER.includes(status)
        );
        return {
            statuses: [...orderedStatuses, ...remainingStatuses],
            authors: Array.from(authors).sort((a, b) => a.localeCompare(b)),
        };
    }, [items]);

    const filteredItems = React.useMemo(() => {
        const normalizedSearch = q.trim().toLowerCase();
        return items.filter((report) => {
            if (filters.orgId && report.orgId !== filters.orgId) return false;
            if (filters.projectId && report.projectId !== filters.projectId) return false;
            if (filters.regionCode && report.projectRegionCode !== filters.regionCode) return false;
            if (filters.operatorCode && report.projectOperator !== filters.operatorCode) return false;
            if (filters.author && report.createdByName !== filters.author) return false;
            if (filters.status) {
                const status = getTaskStatus(report.baseStatuses);
                if (status !== filters.status) return false;
            }

            if (filters.createdFrom || filters.createdTo) {
                const createdDate = new Date(report.createdAt);
                if (Number.isNaN(createdDate.getTime())) return false;
                if (filters.createdFrom && createdDate < startOfDay(filters.createdFrom)) return false;
                if (filters.createdTo && createdDate > endOfDay(filters.createdTo)) return false;
            }

            if (normalizedSearch) {
                const haystack = [
                    report.taskId,
                    report.taskName,
                    report.bsNumber,
                    report.orgName,
                    report.orgSlug,
                    report.projectName,
                    report.projectKey,
                    report.projectRegionCode,
                    getRegionLabel(report.projectRegionCode),
                    report.projectOperator,
                    getOperatorLabel(report.projectOperator),
                    report.createdByName,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(normalizedSearch)) return false;
            }
            return true;
        });
    }, [filters, items, q]);

    const handleSearchIconClick = (event: React.MouseEvent<HTMLElement>) => {
        if (searchAnchor && event.currentTarget === searchAnchor) {
            setSearchAnchor(null);
            return;
        }
        setSearchAnchor(event.currentTarget);
    };

    const handleSearchClose = () => {
        setSearchAnchor(null);
    };

    const handleSearchReset = () => {
        setQ('');
        handleSearchClose();
    };

    const handleFilterClose = () => {
        setFilterDialogOpen(false);
    };

    const handleFilterReset = () => {
        setFilters(defaultFilters);
    };

    const hasActiveFilters = Boolean(
        filters.orgId ||
            filters.projectId ||
            filters.regionCode ||
            filters.operatorCode ||
            filters.status ||
            filters.author ||
            filters.createdFrom ||
            filters.createdTo
    );

    const activeFilterCount =
        Number(Boolean(filters.orgId)) +
        Number(Boolean(filters.projectId)) +
        Number(Boolean(filters.regionCode)) +
        Number(Boolean(filters.operatorCode)) +
        Number(Boolean(filters.status)) +
        Number(Boolean(filters.author)) +
        Number(Boolean(filters.createdFrom)) +
        Number(Boolean(filters.createdTo));

    const filterChips = React.useMemo(() => {
        const chips: Array<{ key: keyof AdminReportFilters; label: string }> = [];
        const orgLabel = orgOptions.find((option) => option.id === filters.orgId)?.label;
        const projectLabel = projectOptions.find((option) => option.id === filters.projectId)?.label;
        const regionLabel = regionOptions.find((option) => option.code === filters.regionCode)?.label;
        const operatorLabel = operatorOptions.find(
            (option) => option.code === filters.operatorCode
        )?.label;

        if (filters.orgId) chips.push({ key: 'orgId', label: `Организация: ${orgLabel || filters.orgId}` });
        if (filters.projectId) chips.push({ key: 'projectId', label: `Проект: ${projectLabel || filters.projectId}` });
        if (filters.regionCode) chips.push({ key: 'regionCode', label: `Регион: ${regionLabel || filters.regionCode}` });
        if (filters.operatorCode) chips.push({ key: 'operatorCode', label: `Оператор: ${operatorLabel || filters.operatorCode}` });
        if (filters.author) chips.push({ key: 'author', label: `Автор: ${filters.author}` });
        if (filters.status) chips.push({ key: 'status', label: `Статус: ${getStatusLabel(filters.status)}` });
        if (filters.createdFrom) chips.push({ key: 'createdFrom', label: `Создан от: ${format(filters.createdFrom, 'dd.MM.yyyy')}` });
        if (filters.createdTo) chips.push({ key: 'createdTo', label: `Создан до: ${format(filters.createdTo, 'dd.MM.yyyy')}` });
        return chips;
    }, [filters, operatorOptions, orgOptions, projectOptions, regionOptions]);

    const handleRemoveFilter = (key: keyof AdminReportFilters) => {
        setFilters((prev) => ({ ...prev, [key]: defaultFilters[key] }));
    };

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    const orgCount = orgOptions.length;
    const projectCount = projectOptions.length;
    const regionCount = regionOptions.length;

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 0.25, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 1320, mx: 'auto', width: '100%' }}>
                <Box
                    sx={{
                        mb: 3,
                        borderRadius: UI_RADIUS.surface,
                        p: { xs: 2, md: 3 },
                        backgroundColor: headerBg,
                        border: `1px solid ${headerBorder}`,
                        boxShadow: headerShadow,
                        backdropFilter: 'blur(22px)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography
                                variant="h5"
                                fontWeight={700}
                                color={textPrimary}
                                sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                            >
                                Все фотоотчеты организаций
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                {loading
                                    ? 'Загружаем отчеты...'
                                    : `Отчетов: ${items.length}. Организаций: ${orgCount}. Проектов: ${projectCount}. Регионов: ${regionCount}.`}
                            </Typography>
                            {error && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    {error}
                                </Typography>
                            )}
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ flexWrap: 'wrap', rowGap: 1 }}
                        >
                            <Tooltip title="Поиск">
                                <IconButton
                                    onClick={handleSearchIconClick}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        backgroundColor: searchAnchor || q ? iconActiveBg : iconBg,
                                        color: searchAnchor || q ? iconActiveText : iconText,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor: searchAnchor || q ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Фильтры отчетов">
                                <IconButton
                                    onClick={() => setFilterDialogOpen(true)}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        color: filterDialogOpen || hasActiveFilters ? iconActiveText : iconText,
                                        backgroundColor: filterDialogOpen || hasActiveFilters ? iconActiveBg : iconBg,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor:
                                                filterDialogOpen || hasActiveFilters ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => void load()}
                                        disabled={loading}
                                        sx={{
                                            borderRadius: UI_RADIUS.overlay,
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            color: iconText,
                                            boxShadow: iconShadow,
                                            backdropFilter: 'blur(14px)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                backgroundColor: iconHoverBg,
                                            },
                                        }}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Box>

                <Dialog open={filterDialogOpen} onClose={handleFilterClose} fullWidth maxWidth="xs">
                    <DialogTitle
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            pr: 1,
                        }}
                    >
                        <Typography variant="h6" fontWeight={600}>
                            Фильтры отчетов
                        </Typography>
                        <IconButton onClick={handleFilterClose}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack spacing={2}>
                                <Autocomplete
                                    options={orgOptions}
                                    value={
                                        orgOptions.find((option) => option.id === filters.orgId) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, orgId: value?.id ?? '' }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Организация" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={projectOptions}
                                    value={
                                        projectOptions.find(
                                            (option) => option.id === filters.projectId
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, projectId: value?.id ?? '' }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Проект" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={regionOptions}
                                    value={
                                        regionOptions.find(
                                            (option) => option.code === filters.regionCode
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            regionCode: value?.code ?? '',
                                        }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Регион" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={operatorOptions}
                                    value={
                                        operatorOptions.find(
                                            (option) => option.code === filters.operatorCode
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            operatorCode: value?.code ?? '',
                                        }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Оператор" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={filterOptions.authors}
                                    value={filters.author || null}
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, author: value ?? '' }))
                                    }
                                    renderInput={(params) => (
                                        <TextField {...params} label="Автор" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel>Статус</InputLabel>
                                    <Select
                                        label="Статус"
                                        value={filters.status}
                                        onChange={(event) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                status: event.target.value,
                                            }))
                                        }
                                    >
                                        <MenuItem value="">
                                            <em>Все</em>
                                        </MenuItem>
                                        {filterOptions.statuses.map((status) => (
                                            <MenuItem key={status} value={status}>
                                                {getStatusLabel(status)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction="row" spacing={1}>
                                    <DatePicker
                                        label="Создан от"
                                        value={filters.createdFrom}
                                        onChange={(value) =>
                                            setFilters((prev) => ({ ...prev, createdFrom: value }))
                                        }
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                    <DatePicker
                                        label="Создан до"
                                        value={filters.createdTo}
                                        onChange={(value) =>
                                            setFilters((prev) => ({ ...prev, createdTo: value }))
                                        }
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                </Stack>
                                {filterChips.length > 0 && (
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {filterChips.map((chip) => (
                                            <Chip
                                                key={chip.key}
                                                label={chip.label}
                                                onDelete={() => handleRemoveFilter(chip.key)}
                                                color="primary"
                                                variant="outlined"
                                            />
                                        ))}
                                    </Stack>
                                )}
                                {hasActiveFilters && (
                                    <Typography variant="caption" color="text.secondary">
                                        Активные фильтры: {activeFilterCount}
                                    </Typography>
                                )}
                            </Stack>
                        </LocalizationProvider>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
                        <Button onClick={handleFilterReset} color="secondary">
                            Сбросить
                        </Button>
                        <Button variant="contained" onClick={handleFilterClose}>
                            Готово
                        </Button>
                    </DialogActions>
                </Dialog>

                <Paper
                    variant="outlined"
                    sx={{
                        p: { xs: 2, md: 3 },
                        borderRadius: UI_RADIUS.surface,
                        border: `1px solid ${sectionBorder}`,
                        backgroundColor: sectionBg,
                        boxShadow: sectionShadow,
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v as 'list')}
                        sx={{
                            minHeight: 0,
                            mb: 2.5,
                            borderRadius: UI_RADIUS.tooltip,
                            border: `1px solid ${tabBorderColor}`,
                            backgroundColor: isDarkMode
                                ? 'rgba(15,18,28,0.65)'
                                : 'rgba(255,255,255,0.7)',
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        <Tab
                            value="list"
                            label="Список"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: UI_RADIUS.tooltip,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                    </Tabs>

                    {loading ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">Загрузка…</Typography>
                        </Box>
                    ) : filteredItems.length === 0 ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">Отчеты не найдены.</Typography>
                        </Box>
                    ) : (
                        <TableContainer sx={{ borderRadius: UI_RADIUS.panel, boxShadow: sectionShadow }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Отчет</TableCell>
                                        <TableCell>Организация</TableCell>
                                        <TableCell>Проект</TableCell>
                                        <TableCell>Регион / оператор</TableCell>
                                        <TableCell>Автор</TableCell>
                                        <TableCell align="center">Создан</TableCell>
                                        <TableCell align="center">Статус</TableCell>
                                        <TableCell align="center">Базы</TableCell>
                                        <TableCell align="center">Файлы</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredItems.map((report) => {
                                        const status = getTaskStatus(report.baseStatuses);
                                        const statusColor = getStatusColor(status);
                                        const reportHref = getReportHref(report);
                                        const orgHref = getOrgHref(report);
                                        const projectHref = getProjectHref(report);
                                        const operatorLabel =
                                            getOperatorLabel(report.projectOperator) ||
                                            report.projectOperator ||
                                            '—';
                                        const filesCount = report.baseStatuses.reduce(
                                            (sum, base) => sum + (base.fileCount ?? 0),
                                            0
                                        );
                                        return (
                                            <TableRow key={report.taskId} hover>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <FolderIcon sx={{ color: statusColor }} />
                                                        <Box>
                                                            <Typography variant="subtitle2">
                                                                {reportHref ? (
                                                                    <Link href={reportHref}>
                                                                        {report.taskName || report.taskId}
                                                                    </Link>
                                                                ) : (
                                                                    report.taskName || report.taskId
                                                                )}
                                                            </Typography>
                                                            {report.bsNumber && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    БС: {report.bsNumber}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    {orgHref ? (
                                                        <Link href={orgHref}>
                                                            {report.orgName || report.orgSlug || '—'}
                                                        </Link>
                                                    ) : (
                                                        report.orgName || report.orgSlug || '—'
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {projectHref ? (
                                                        <Link href={projectHref}>
                                                            {report.projectName || report.projectKey || '—'}
                                                        </Link>
                                                    ) : (
                                                        report.projectName || report.projectKey || '—'
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {getRegionLabel(report.projectRegionCode)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {operatorLabel}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {report.createdById ? (
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => openProfileDialog(report.createdById)}
                                                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                                        >
                                                            {report.createdByName || report.createdById}
                                                        </Button>
                                                    ) : (
                                                        report.createdByName || '—'
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">{formatDateRU(report.createdAt)}</TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={getStatusLabel(status)}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: statusColor,
                                                            color: '#fff',
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => setDetailReport(report)}
                                                    >
                                                        {report.baseStatuses.length}
                                                    </Button>
                                                </TableCell>
                                                <TableCell align="center">{filesCount}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </Box>

            <Dialog open={Boolean(searchAnchor)} onClose={handleSearchClose}>
                <DialogTitle sx={{ pr: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6" fontWeight={600}>
                            Поиск
                        </Typography>
                        <IconButton onClick={handleSearchClose}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Поиск (задача, организация, проект, автор)"
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleSearchClose();
                            }
                        }}
                        autoFocus
                        fullWidth
                        InputProps={{
                            endAdornment: q ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleSearchReset} edge="end">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(detailReport)}
                onClose={() => setDetailReport(null)}
                maxWidth="xs"
                fullWidth
            >
                {detailReport && (
                    <>
                        <DialogTitle
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    {'Открыть отчет по "' +
                                        (detailReport.taskName || detailReport.taskId) +
                                        '" на базовой станции:'}
                                </Typography>
                            </Box>
                            <IconButton onClick={() => setDetailReport(null)}>
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Создан: {formatDateRU(detailReport.createdAt)}
                            </Typography>
                            <Stack spacing={1}>
                                {detailReport.baseStatuses.map((base) => {
                                    const color = getStatusColor(normalizeStatusTitle(base.status));
                                    return (
                                        <Button
                                            key={base.baseId}
                                            component={Link}
                                            href={`/reports/${encodeURIComponent(
                                                detailReport.taskId
                                            )}/${encodeURIComponent(base.baseId)}`}
                                            variant="outlined"
                                            sx={{ justifyContent: 'space-between' }}
                                        >
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <FolderIcon sx={{ color }} />
                                                <Typography>{base.baseId}</Typography>
                                            </Stack>
                                            <Chip
                                                label={getStatusLabel(base.status)}
                                                size="small"
                                                sx={{
                                                    backgroundColor: color,
                                                    color: theme.palette.common.white,
                                                    textTransform: 'capitalize',
                                                }}
                                            />
                                        </Button>
                                    );
                                })}
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setDetailReport(null)}>Закрыть</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Box>
    );
}
