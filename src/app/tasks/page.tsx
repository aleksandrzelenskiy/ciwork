// app/tasks/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, MouseEvent } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Paper,
    Typography,
    Tabs,
    Tab,
    Stack,
    TextField,
    IconButton,
    Tooltip,
    Popover,
    InputAdornment,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'next/navigation';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import CloseIcon from '@mui/icons-material/Close';

import TaskListPage, { TaskListPageHandle } from '@/features/tasks/TaskListPage';
import TaskColumnPage from '@/features/tasks/TaskColumnPage';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { defaultTaskFilters, type TaskFilterOptions, type TaskFilters } from '@/app/types/taskFilters';
import { getPriorityLabelRu } from '@/utils/priorityIcons';
import { getStatusLabel } from '@/utils/statusLabels';
import { UI_RADIUS } from '@/config/uiTokens';

type ViewMode = 'table' | 'kanban';

export default function TasksPage() {
    const [tab, setTab] = useState<ViewMode>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);
    const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
    const taskListRef = useRef<TaskListPageHandle>(null);
    const [filters, setFilters] = useState<TaskFilters>(defaultTaskFilters);
    const [filterOptions, setFilterOptions] = useState<TaskFilterOptions>({
        managers: [],
        executors: [],
        statuses: [],
        priorities: [],
    });
    const [userRole, setUserRole] = useState<EffectiveOrgRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);
    const [roleError, setRoleError] = useState<string | null>(null);
    const searchParams = useSearchParams();

    const searchOpen = Boolean(searchAnchor);
    const filterOpen = Boolean(filterAnchor);
    const hasActiveFilters = Boolean(filters.manager || filters.status || filters.priority);
    const activeFilterCount =
        Number(Boolean(filters.manager)) +
        Number(Boolean(filters.status)) +
        Number(Boolean(filters.priority));
    const isExecutor = userRole === 'executor';
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

    useEffect(() => {
        const statusParam = searchParams?.get('status');
        if (statusParam) {
            setFilters((prev) => {
                if (prev.status === statusParam) return prev;
                return { ...prev, status: statusParam };
            });
        }
    }, [searchParams]);

    useEffect(() => {
        let active = true;
        setRoleLoading(true);
        setRoleError(null);

        (async () => {
            try {
                const context = await fetchUserContext();
                if (!active) return;

                if (!context) {
                    setRoleError('Не удалось загрузить данные пользователя');
                    setUserRole(null);
                    return;
                }

                const resolvedRole = resolveRoleFromContext(context);
                if (!resolvedRole) {
                    setRoleError('Не удалось определить роль пользователя');
                    setUserRole(null);
                    return;
                }

                setUserRole(resolvedRole);
            } catch (err) {
                if (!active) return;
                console.error('Error loading user context', err);
                setRoleError('Не удалось загрузить данные пользователя');
                setUserRole(null);
            } finally {
                if (active) {
                    setRoleLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const handleSearchIconClick = (event: MouseEvent<HTMLElement>) => {
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
        setSearchQuery('');
        handleSearchClose();
    };

    const handleFilterButtonClick = (event: MouseEvent<HTMLElement>) => {
        if (filterAnchor && event.currentTarget === filterAnchor) {
            setFilterAnchor(null);
            return;
        }
        setFilterAnchor(event.currentTarget);
    };

    const handleFilterClose = () => {
        setFilterAnchor(null);
    };

    const handleFilterReset = () => {
        setFilters({ ...defaultTaskFilters });
    };

    const handleManagerFilterChange = (_event: unknown, value: string | null) => {
        setFilters((prev) => ({ ...prev, manager: value }));
    };

    const handleSelectFilterChange =
        (key: 'status' | 'priority') =>
        (event: SelectChangeEvent) => {
            const value = event.target.value;
            setFilters((prev) => ({
                ...prev,
                [key]: value,
            }));
        };

    const handleStatusFilterChange = handleSelectFilterChange('status');
    const handlePriorityFilterChange = handleSelectFilterChange('priority');

    const handleColumnsClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (tab !== 'table') return;
            taskListRef.current?.openColumns(event.currentTarget);
        },
        [tab]
    );

    if (roleLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (roleError) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{roleError}</Alert>
            </Box>
        );
    }

    if (!isExecutor) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="info">
                    Модуль «Мои задачи» доступен только исполнителям. Попросите менеджера
                    назначить вас исполнителем в организации, чтобы получить доступ к своим
                    назначениям.
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 0.25, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
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
                                Мои задачи
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                Все задачи. Воспользуйтесь поиском или фильтрами
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Tooltip title="Поиск">
                                <IconButton
                                    onClick={handleSearchIconClick}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        backgroundColor: searchOpen || searchQuery ? iconActiveBg : iconBg,
                                        color: searchOpen || searchQuery ? iconActiveText : iconText,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor: searchOpen || searchQuery ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Фильтры задач">
                                <IconButton
                                    onClick={handleFilterButtonClick}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        color: filterOpen || hasActiveFilters ? iconActiveText : iconText,
                                        backgroundColor: filterOpen || hasActiveFilters ? iconActiveBg : iconBg,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor:
                                                filterOpen || hasActiveFilters ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>
                            {tab === 'table' && (
                                <Tooltip title="Настроить колонки">
                                    <IconButton
                                        onClick={handleColumnsClick}
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
                                        <ViewColumnOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => setRefreshToken((prev) => prev + 1)}
                                        disabled={false}
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

            <Popover
                open={searchOpen}
                anchorEl={searchAnchor}
                onClose={handleSearchClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: {
                        borderRadius: UI_RADIUS.tooltip,
                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'}`,
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.95)' : 'rgba(255,255,255,0.9)',
                        boxShadow: isDarkMode ? '0 25px 70px rgba(0,0,0,0.6)' : '0 25px 70px rgba(15,23,42,0.15)',
                        backdropFilter: 'blur(18px)',
                    },
                }}
            >
                <Box sx={{ p: 2, width: 320 }}>
                    <TextField
                        label="Поиск (ID, название, БС)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleSearchClose();
                            }
                        }}
                        autoFocus
                        fullWidth
                        InputProps={{
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleSearchReset} edge="end">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />
                </Box>
            </Popover>

            <Popover
                open={filterOpen}
                anchorEl={filterAnchor}
                onClose={handleFilterClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: {
                        borderRadius: UI_RADIUS.tooltip,
                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'}`,
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.95)' : 'rgba(255,255,255,0.9)',
                        boxShadow: isDarkMode ? '0 25px 70px rgba(0,0,0,0.6)' : '0 25px 70px rgba(15,23,42,0.15)',
                        backdropFilter: 'blur(18px)',
                    },
                }}
            >
                <Box sx={{ p: 2, width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Autocomplete
                        options={filterOptions.managers}
                        value={filters.manager}
                        onChange={handleManagerFilterChange}
                        clearOnEscape
                        handleHomeEndKeys
                        renderInput={(params) => (
                            <TextField {...params} label="Менеджер" size="small" />
                        )}
                        fullWidth
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel>Статус</InputLabel>
                        <Select
                            label="Статус"
                            value={filters.status}
                            onChange={handleStatusFilterChange}
                        >
                            <MenuItem value="">
                                <em>Все</em>
                            </MenuItem>
                            {filterOptions.statuses
                                .filter((status): status is string => Boolean(status))
                                .map((status) => (
                                    <MenuItem key={status} value={status}>
                                        {getStatusLabel(status)}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Приоритет</InputLabel>
                        <Select
                            label="Приоритет"
                            value={filters.priority}
                            onChange={handlePriorityFilterChange}
                        >
                            <MenuItem value="">
                                <em>Все</em>
                            </MenuItem>
                            {filterOptions.priorities
                                .filter((priority): priority is string => Boolean(priority))
                                .map((priority) => (
                                    <MenuItem key={priority} value={priority}>
                                        {getPriorityLabelRu(priority)}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                    {hasActiveFilters && (
                        <Typography variant="caption" color="text.secondary">
                            Активные фильтры: {activeFilterCount}
                        </Typography>
                    )}
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Button size="small" onClick={handleFilterReset} color="secondary">
                            Сбросить
                        </Button>
                        <Button size="small" variant="contained" onClick={handleFilterClose}>
                            Готово
                        </Button>
                    </Stack>
                </Box>
            </Popover>

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
                        onChange={(_, newValue) => setTab(newValue as ViewMode)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 0,
                            mb: 2,
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        <Tab
                            value="table"
                            label="СПИСОК"
                            sx={{
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                borderRadius: UI_RADIUS.tab,
                                minHeight: 0,
                                px: 2.5,
                                py: 1.2,
                                mx: 0.5,
                                color: tab === 'table' ? textPrimary : tabInactiveColor,
                                backgroundColor: tab === 'table' ? tabActiveBg : 'transparent',
                                border: `1px solid ${tabBorderColor}`,
                                boxShadow:
                                    tab === 'table'
                                        ? iconShadow
                                        : 'none',
                            }}
                        />
                        <Tab
                            value="kanban"
                            label="ДОСКА"
                            sx={{
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                borderRadius: UI_RADIUS.tab,
                                minHeight: 0,
                                px: 2.5,
                                py: 1.2,
                                mx: 0.5,
                                color: tab === 'kanban' ? textPrimary : tabInactiveColor,
                                backgroundColor: tab === 'kanban' ? tabActiveBg : 'transparent',
                                border: `1px solid ${tabBorderColor}`,
                                boxShadow:
                                    tab === 'kanban'
                                        ? iconShadow
                                        : 'none',
                            }}
                        />
                    </Tabs>

                    {tab === 'table' && (
                        <TaskListPage
                            ref={taskListRef}
                            searchQuery={searchQuery}
                            refreshToken={refreshToken}
                            hideToolbarControls
                            filters={filters}
                            onFilterOptionsChange={setFilterOptions}
                        />
                    )}
                    {tab === 'kanban' && (
                        <TaskColumnPage
                            searchQuery={searchQuery}
                            refreshToken={refreshToken}
                            filters={filters}
                        />
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
