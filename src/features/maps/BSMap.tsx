'use client';

import * as React from 'react';
import { REGION_BORDERS } from '@/app/constants/borders';
import {
    Box,
    CircularProgress,
    Alert,
    TextField,
    IconButton,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import {
    YMaps,
    Map,
    Placemark,
    ZoomControl,
    FullscreenControl,
    Clusterer,
    Polygon,
} from '@pbe/react-yandex-maps';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import AddLocationOutlinedIcon from '@mui/icons-material/AddLocationOutlined';
import {
    OPERATOR_CLUSTER_PRESETS,
    OPERATOR_COLORS,
    normalizeOperator,
} from '@/utils/operatorColors';
import {
    OPERATORS,
    OperatorCode,
    getOperatorLabel,
    normalizeOperatorCode,
} from '@/app/utils/operators';
import { withBasePath } from '@/utils/basePath';

type BaseStation = {
    _id: string;
    op: string | null;
    name: string | null;
    lat: number;
    lon: number;
    address: string | null;
    mcc: string | null;
    mnc: string | null;
    region: string | null;
};
type ApiStation = {
    _id: string;
    op: string | null;
    name?: string | null;
    lat?: number | string | null;
    lon?: number | string | null;
    address?: string | null;
    mcc?: string | null;
    mnc?: string | null;
    region?: string | null;
};

const resolveStationName = (primary?: string | null): string | null => {
    if (typeof primary === 'string') {
        const trimmed = primary.trim();
        if (trimmed) return trimmed;
    }
    return null;
};

const parseCoordinate = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const normalizeStationPayload = (station: ApiStation): BaseStation | null => {
    const lat = parseCoordinate(station.lat);
    const lon = parseCoordinate(station.lon);
    if (lat === null || lon === null) {
        return null;
    }
    const name = resolveStationName(station.name ?? null);
    return {
        _id: station._id,
        op: station.op ?? null,
        name,
        lat,
        lon,
        address: station.address ?? null,
        mcc: station.mcc ?? null,
        mnc: station.mnc ?? null,
        region: station.region ?? null,
    };
};

const normalizeStations = (stations: ApiStation[] | undefined | null): BaseStation[] => {
    if (!Array.isArray(stations)) {
        return [];
    }
    const normalized: BaseStation[] = [];
    for (const station of stations) {
        const parsed = normalizeStationPayload(station);
        if (parsed) {
            normalized.push(parsed);
        }
    }
    return normalized;
};

type YMapsLang = 'tr_TR' | 'en_US' | 'en_RU' | 'ru_RU' | 'ru_UA' | 'uk_UA';
type YMapsQuery = {
    lang?: YMapsLang;
    apikey?: string;
    suggest_apikey?: string;
    coordorder?: 'latlong' | 'longlat';
    load?: string;
    mode?: 'release' | 'debug';
    csp?: boolean;
    ns?: string;
};
type YMapInstance = {
    events?: {
        add: (eventName: string, handler: () => void) => void;
        remove: (eventName: string, handler: () => void) => void;
    };
};

const DEFAULT_CENTER: [number, number] = [56.0, 104.0];
const DEFAULT_OPERATOR = (OPERATORS[0]?.value ?? '250020') as OperatorCode;
const ACTION_ICON_WRAPPER_STYLE = 'display:flex;align-items:center;gap:12px;margin-top:12px;';
const ACTION_ICON_STYLE =
    'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;border:1px solid #d1d5db;background:#fff;color:#1976d2;cursor:pointer;';
const EDIT_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 11h2.12l6.16-6.16-2.12-2.12L11 8.88zm9.71-9L20 1.29a.996.996 0 0 0-1.41 0l-.72.72 2.12 2.12.72-.72c.39-.39.39-1.02 0-1.41M17.9 9.05c.06.36.1.74.1 1.15 0 1.71-1.08 4.64-6 9.14-4.92-4.49-6-7.43-6-9.14C6 6.17 9.09 4 12 4c.32 0 .65.03.97.08l1.65-1.65C13.78 2.16 12.9 2 12 2c-4.2 0-8 3.22-8 8.2 0 3.32 2.67 7.25 8 11.8 5.33-4.55 8-8.48 8-11.8 0-1.01-.16-1.94-.45-2.8z"/></svg>';
const DELETE_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zm2-10h8v10H8zm7.5-5-1-1h-5l-1 1H5v2h14V4z"/></svg>';
type RegionOption = { code: string; label: string };
const ALL_REGIONS_OPTION: RegionOption = { code: 'ALL', label: 'Все регионы' };
const RUSSIAN_REGIONS: readonly RegionOption[] = [
    { code: '01', label: 'Республика Адыгея (Адыгея)' },
    { code: '02', label: 'Республика Башкортостан' },
    { code: '03', label: 'Республика Бурятия' },
    { code: '04', label: 'Республика Алтай' },
    { code: '05', label: 'Республика Дагестан' },
    { code: '06', label: 'Республика Ингушетия' },
    { code: '07', label: 'Кабардино-Балкарская Республика' },
    { code: '08', label: 'Республика Калмыкия' },
    { code: '09', label: 'Карачаево-Черкесская Республика' },
    { code: '10', label: 'Республика Карелия' },
    { code: '11', label: 'Республика Коми' },
    { code: '12', label: 'Республика Марий Эл' },
    { code: '13', label: 'Республика Мордовия' },
    { code: '14', label: 'Республика Саха (Якутия)' },
    { code: '15', label: 'Республика Северная Осетия - Алания' },
    { code: '16', label: 'Республика Татарстан (Татарстан)' },
    { code: '17', label: 'Республика Тыва' },
    { code: '18', label: 'Удмуртская Республика' },
    { code: '19', label: 'Республика Хакасия' },
    { code: '20', label: 'Чеченская Республика' },
    { code: '21', label: 'Чувашская Республика - Чувашия' },
    { code: '22', label: 'Алтайский край' },
    { code: '23', label: 'Краснодарский край' },
    { code: '24', label: 'Красноярский край' },
    { code: '25', label: 'Приморский край' },
    { code: '26', label: 'Ставропольский край' },
    { code: '27', label: 'Хабаровский край' },
    { code: '28', label: 'Амурская область' },
    { code: '29', label: 'Архангельская область' },
    { code: '30', label: 'Астраханская область' },
    { code: '31', label: 'Белгородская область' },
    { code: '32', label: 'Брянская область' },
    { code: '33', label: 'Владимирская область' },
    { code: '34', label: 'Волгоградская область' },
    { code: '35', label: 'Вологодская область' },
    { code: '36', label: 'Воронежская область' },
    { code: '37', label: 'Ивановская область' },
    { code: '38', label: 'Иркутская область' },
    { code: '39', label: 'Калининградская область' },
    { code: '40', label: 'Калужская область' },
    { code: '41', label: 'Камчатский край' },
    { code: '42', label: 'Кемеровская область' },
    { code: '43', label: 'Кировская область' },
    { code: '44', label: 'Костромская область' },
    { code: '45', label: 'Курганская область' },
    { code: '46', label: 'Курская область' },
    { code: '47', label: 'Ленинградская область' },
    { code: '48', label: 'Липецкая область' },
    { code: '49', label: 'Магаданская область' },
    { code: '50', label: 'Московская область' },
    { code: '51', label: 'Мурманская область' },
    { code: '52', label: 'Нижегородская область' },
    { code: '53', label: 'Новгородская область' },
    { code: '54', label: 'Новосибирская область' },
    { code: '55', label: 'Омская область' },
    { code: '56', label: 'Оренбургская область' },
    { code: '57', label: 'Орловская область' },
    { code: '58', label: 'Пензенская область' },
    { code: '59', label: 'Пермский край' },
    { code: '60', label: 'Псковская область' },
    { code: '61', label: 'Ростовская область' },
    { code: '62', label: 'Рязанская область' },
    { code: '63', label: 'Самарская область' },
    { code: '64', label: 'Саратовская область' },
    { code: '65', label: 'Сахалинская область' },
    { code: '66', label: 'Свердловская область' },
    { code: '67', label: 'Смоленская область' },
    { code: '68', label: 'Тамбовская область' },
    { code: '69', label: 'Тверская область' },
    { code: '70', label: 'Томская область' },
    { code: '71', label: 'Тульская область' },
    { code: '72', label: 'Тюменская область' },
    { code: '73', label: 'Ульяновская область' },
    { code: '74', label: 'Челябинская область' },
    { code: '75', label: 'Забайкальский край' },
    { code: '76', label: 'Ярославская область' },
    { code: '77', label: 'г. Москва' },
    { code: '78', label: 'Санкт-Петербург' },
    { code: '79', label: 'Еврейская автономная область' },
    { code: '83', label: 'Ненецкий автономный округ' },
    { code: '86', label: 'Ханты-Мансийский автономный округ - Югра' },
    { code: '87', label: 'Чукотский автономный округ' },
    { code: '89', label: 'Ямало-Ненецкий автономный округ' },
    { code: '99', label: 'Иные территории, включая город и космодром Байконур' },
] as const;
const REGION_OPTIONS: readonly RegionOption[] = [ALL_REGIONS_OPTION, ...RUSSIAN_REGIONS];
const REGION_OPTION_MAP: Record<string, RegionOption> = REGION_OPTIONS.reduce(
    (acc, option) => {
        acc[option.code] = option;
        return acc;
    },
    {} as Record<string, RegionOption>
);
const IRKUTSK_REGION_CODE = '38';
const IRKUTSK_POLYGON_COORDINATES: number[][][] = REGION_BORDERS['38']?.coordinates ?? [];

export default function BSMap(): React.ReactElement {
    const [stations, setStations] = React.useState<BaseStation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchName, setSearchName] = React.useState('');
    const [operator, setOperator] = React.useState<OperatorCode>(DEFAULT_OPERATOR);
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const [selectedRegionCode, setSelectedRegionCode] = React.useState<string>(ALL_REGIONS_OPTION.code);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [editingStationId, setEditingStationId] = React.useState<string | null>(null);
    const [editForm, setEditForm] = React.useState({ name: '', lat: '', lon: '', address: '' });
    const [deletingStationId, setDeletingStationId] = React.useState<string | null>(null);
    const [editDialogLoading, setEditDialogLoading] = React.useState(false);
    const [editDialogError, setEditDialogError] = React.useState<string | null>(null);
    const [deleteDialogLoading, setDeleteDialogLoading] = React.useState(false);
    const [deleteDialogError, setDeleteDialogError] = React.useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [createForm, setCreateForm] = React.useState({ name: '', lat: '', lon: '', address: '' });
    const [createDialogLoading, setCreateDialogLoading] = React.useState(false);
    const [createDialogError, setCreateDialogError] = React.useState<string | null>(null);

    const mapRef = React.useRef<YMapInstance | null>(null);

    React.useEffect(() => {
        setSearchName('');
    }, [operator]);

    React.useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function loadStations(): Promise<void> {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/bsmap?operator=${encodeURIComponent(operator)}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = (await res.json().catch(() => null)) as
                    | { stations: ApiStation[] }
                    | { error: string }
                    | null;

                if (!res.ok || !data || 'error' in data) {
                    if (!cancelled) {
                        setStations([]);
                        setError(
                            !data || !('error' in data)
                                ? `Не удалось загрузить базовые станции (${res.status})`
                                : data.error
                        );
                    }
                    return;
                }

                if (!cancelled) {
                    setStations(normalizeStations(data.stations));
                }
            } catch (e) {
                if (!cancelled) {
                    setStations([]);
                    setError(e instanceof Error ? e.message : 'Ошибка сети');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadStations();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [operator]);

    const selectedRegion = REGION_OPTION_MAP[selectedRegionCode] ?? ALL_REGIONS_OPTION;
    const regionLabelByCode = React.useCallback(
        (code: string | null | undefined) => {
            if (!code) return null;
            return REGION_OPTION_MAP[code]?.label ?? null;
        },
        []
    );
    const formatRegion = React.useCallback(
        (code: string | null | undefined) => {
            if (!code) return '—';
            const label = regionLabelByCode(code);
            return label ? `${label} (${code})` : code;
        },
        [regionLabelByCode]
    );

    const regionFilteredStations = React.useMemo(() => {
        return stations.filter((station) => {
            const stationOperator = normalizeOperatorCode(station.op) ?? DEFAULT_OPERATOR;
            if (stationOperator !== operator) {
                return false;
            }
            if (selectedRegion.code === ALL_REGIONS_OPTION.code) {
                return true;
            }
            return station.region === selectedRegion.code;
        });
    }, [stations, selectedRegion, operator]);

    const filteredStations = React.useMemo(() => {
        const term = searchName.trim();
        if (!term) return regionFilteredStations;
        return regionFilteredStations.filter((station) => station.name?.toString().includes(term));
    }, [regionFilteredStations, searchName]);

    const mapCenter = React.useMemo<[number, number]>(() => {
        if (!filteredStations.length) return DEFAULT_CENTER;
        const sums = filteredStations.reduce(
            (acc, station) => {
                acc.lat += station.lat;
                acc.lon += station.lon;
                return acc;
            },
            { lat: 0, lon: 0 }
        );
        return [sums.lat / filteredStations.length, sums.lon / filteredStations.length];
    }, [filteredStations]);

    const zoom = React.useMemo(() => {
        if (!filteredStations.length) return 4;
        return filteredStations.length > 1 ? 5 : 12;
    }, [filteredStations.length]);

    const ymapsQuery = React.useMemo<YMapsQuery>(() => {
        const apiKey =
            process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY ?? process.env.NEXT_PUBLIC_YMAPS_API_KEY;
        const base: YMapsQuery = { lang: 'ru_RU' };
        return apiKey ? { ...base, apikey: apiKey } : base;
    }, []);

    const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${filteredStations.length}`;
    const noSearchResults =
        !loading && !error && Boolean(searchName.trim()) && filteredStations.length === 0;
    const noStationsAfterFilters =
        !loading && !error && selectedRegion.code !== ALL_REGIONS_OPTION.code && !regionFilteredStations.length;
    const selectedOperatorLabel = React.useMemo(
        () => getOperatorLabel(operator) ?? '',
        [operator]
    );
    const isIrkutskRegionSelected = selectedRegion.code === IRKUTSK_REGION_CODE;
    const canCreateStation = selectedRegion.code !== ALL_REGIONS_OPTION.code;
    React.useEffect(() => {
        if (error || noSearchResults || noStationsAfterFilters) {
            setFiltersOpen(true);
        }
    }, [error, noSearchResults, noStationsAfterFilters]);

    const handleFullscreenEnter = React.useCallback(() => setIsFullscreen(true), []);
    const handleFullscreenExit = React.useCallback(() => setIsFullscreen(false), []);

    const mapInstanceRef = React.useCallback(
        (instance: YMapInstance | null) => {
            if (mapRef.current) {
                mapRef.current.events?.remove('fullscreenenter', handleFullscreenEnter);
                mapRef.current.events?.remove('fullscreenexit', handleFullscreenExit);
            }
            if (instance) {
                mapRef.current = instance;
                instance.events?.add('fullscreenenter', handleFullscreenEnter);
                instance.events?.add('fullscreenexit', handleFullscreenExit);
            } else {
                mapRef.current = null;
            }
        },
        [handleFullscreenEnter, handleFullscreenExit]
    );

    const handleExternalClick = React.useCallback(
        (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const actionEl = target.closest('[data-bsmap-action]') as HTMLElement | null;
            if (actionEl) {
                event.preventDefault();
                const stationId = actionEl.getAttribute('data-bsmap-station');
                const action = actionEl.getAttribute('data-bsmap-action');
                if (!stationId || !action) return;
                if (action === 'edit') {
                    setEditingStationId(stationId);
                } else if (action === 'delete') {
                    setDeletingStationId(stationId);
                }
                return;
            }
            const linkEl = target.closest('[data-bsmap-link]') as HTMLElement | null;
            if (linkEl) {
                event.preventDefault();
            }
        },
        []
    );

    React.useEffect(() => {
        document.addEventListener('click', handleExternalClick);
        return () => document.removeEventListener('click', handleExternalClick);
    }, [handleExternalClick]);

    const editingStation = React.useMemo(
        () => (editingStationId ? stations.find((station) => station._id === editingStationId) ?? null : null),
        [editingStationId, stations]
    );

    const deletingStation = React.useMemo(
        () => (deletingStationId ? stations.find((station) => station._id === deletingStationId) ?? null : null),
        [deletingStationId, stations]
    );

    React.useEffect(() => {
        if (editingStation) {
            setEditForm({
                name: editingStation.name ?? '',
                lat: editingStation.lat.toString(),
                lon: editingStation.lon.toString(),
                address: editingStation.address ?? '',
            });
        } else {
            setEditForm({ name: '', lat: '', lon: '', address: '' });
        }
    }, [editingStation]);

    React.useEffect(() => {
        setEditDialogError(null);
        setEditDialogLoading(false);
    }, [editingStationId]);

    React.useEffect(() => {
        setDeleteDialogError(null);
        setDeleteDialogLoading(false);
    }, [deletingStationId]);

    React.useEffect(() => {
        if (!createDialogOpen) {
            setCreateForm({ name: '', lat: '', lon: '', address: '' });
            setCreateDialogError(null);
            setCreateDialogLoading(false);
        }
    }, [createDialogOpen]);

    const closeEditDialog = React.useCallback(() => {
        setEditingStationId(null);
        setEditDialogError(null);
        setEditDialogLoading(false);
    }, []);

    const closeDeleteDialog = React.useCallback(() => {
        setDeletingStationId(null);
        setDeleteDialogError(null);
        setDeleteDialogLoading(false);
    }, []);

    const openCreateDialog = React.useCallback(() => {
        setCreateDialogOpen(true);
    }, []);

    const closeCreateDialog = React.useCallback(() => {
        setCreateDialogOpen(false);
        setCreateDialogError(null);
        setCreateDialogLoading(false);
    }, []);

    const handleEditFieldChange = React.useCallback(
        (field: keyof typeof editForm) =>
            (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const value = event.target.value;
                setEditForm((prev) => ({ ...prev, [field]: value }));
            },
        []
    );

    const handleCreateFieldChange = React.useCallback(
        (field: keyof typeof createForm) =>
            (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const value = event.target.value;
                setCreateForm((prev) => ({ ...prev, [field]: value }));
            },
        []
    );

    const handleEditSave = React.useCallback(async () => {
        if (!editingStation) return;

        const editingOperator =
            normalizeOperatorCode(editingStation.op ?? operator) ?? operator;
        const nameValue = editForm.name.trim() || null;
        const latNumber = Number(editForm.lat);
        const lonNumber = Number(editForm.lon);
        if (!Number.isFinite(latNumber) || !Number.isFinite(lonNumber)) {
            setEditDialogError('Некорректные координаты');
            return;
        }

        setEditDialogLoading(true);
        setEditDialogError(null);

        try {
            const response = await fetch(withBasePath('/api/bsmap'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingStation._id,
                    operator: editingOperator,
                    name: nameValue,
                    lat: latNumber,
                    lon: lonNumber,
                    region: editingStation.region ?? selectedRegion.code,
                    address: editForm.address.trim() || null,
                }),
            });
            const payload = (await response.json().catch(() => null)) as
                | { station?: BaseStation; error?: string }
                | null;

            if (!response.ok || !payload || !payload.station) {
                setEditDialogError(payload?.error ?? 'Не удалось сохранить изменения');
                return;
            }

            setStations((prev) =>
                prev.map((station) => (station._id === payload.station!._id ? payload.station! : station))
            );
            closeEditDialog();
        } catch (error) {
            setEditDialogError(error instanceof Error ? error.message : 'Не удалось сохранить изменения');
        } finally {
            setEditDialogLoading(false);
        }
    }, [closeEditDialog, editForm, editingStation, operator, selectedRegion.code]);

    const handleDeleteConfirm = React.useCallback(async () => {
        if (!deletingStation) return;
        const deletingOperator =
            normalizeOperatorCode(deletingStation.op ?? operator) ?? operator;
        setDeleteDialogLoading(true);
        setDeleteDialogError(null);

        try {
            const response = await fetch(withBasePath('/api/bsmap'), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: deletingStation._id,
                    operator: deletingOperator,
                }),
            });
            const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;

            if (!response.ok || !payload?.success) {
                setDeleteDialogError(payload?.error ?? 'Не удалось удалить базовую станцию');
                return;
            }

            setStations((prev) => prev.filter((station) => station._id !== deletingStation._id));
            closeDeleteDialog();
        } catch (error) {
            setDeleteDialogError(error instanceof Error ? error.message : 'Не удалось удалить базовую станцию');
        } finally {
            setDeleteDialogLoading(false);
        }
    }, [closeDeleteDialog, deletingStation, operator]);

    const handleCreateSave = React.useCallback(async () => {
        if (selectedRegion.code === ALL_REGIONS_OPTION.code) {
            setCreateDialogError('Выберите регион перед добавлением объекта');
            return;
        }
        if (!createForm.name.trim()) {
            setCreateDialogError('Введите имя/номер БС');
            return;
        }

        const latNumber = Number(createForm.lat);
        const lonNumber = Number(createForm.lon);
        if (!Number.isFinite(latNumber) || !Number.isFinite(lonNumber)) {
            setCreateDialogError('Некорректные координаты');
            return;
        }

        setCreateDialogLoading(true);
        setCreateDialogError(null);

        try {
            const response = await fetch(withBasePath('/api/bsmap'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operator,
                    name: createForm.name.trim(),
                    lat: latNumber,
                    lon: lonNumber,
                    region: selectedRegion.code,
                    address: createForm.address.trim() || null,
                }),
            });
            const payload = (await response.json().catch(() => null)) as
                | { station?: BaseStation; error?: string }
                | null;

            if (!response.ok || !payload?.station) {
                setCreateDialogError(payload?.error ?? 'Не удалось создать базовую станцию');
                return;
            }

            setStations((prev) => [...prev, payload.station!]);
            closeCreateDialog();
        } catch (error) {
            setCreateDialogError(error instanceof Error ? error.message : 'Не удалось создать базовую станцию');
        } finally {
            setCreateDialogLoading(false);
        }
    }, [closeCreateDialog, createForm, operator, selectedRegion.code]);

    const buildBalloonContent = React.useCallback((station: BaseStation) => {
        const hintTitle = station.name ? `БС №${station.name}` : 'Базовая станция';
        const operatorLabel =
            getOperatorLabel(station.op) ??
            (station.op ? station.op.toUpperCase() : '—');
        const mccMnc = station.mcc && station.mnc ? ` (${station.mcc}/${station.mnc})` : '';
        const linkStyle = 'color:#1976d2;text-decoration:none;font-weight:500;';
        const regionInfo = formatRegion(station.region);
        const addressBlock = station.address
            ? `<div style="margin-bottom:4px;">Адрес: ${station.address}</div>`
            : '';
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:240px;">
            <div style="font-weight:600;margin-bottom:4px;">${hintTitle}</div>
            <div style="margin-bottom:4px;">Оператор: ${operatorLabel}${mccMnc}</div>
            <div style="margin-bottom:4px;">Регион: ${regionInfo}</div>
            ${addressBlock}
            <div style="margin-bottom:4px;">Координаты: ${station.lat.toFixed(5)}, ${station.lon.toFixed(5)}</div>
            <div style="margin-top:12px;display:flex;gap:16px;">
                <a href="#" data-bsmap-link="history" data-bsmap-station="${station._id}" style="${linkStyle}">История работ</a>
                <a href="#" data-bsmap-link="task" data-bsmap-station="${station._id}" style="${linkStyle}">Создать задачу</a>
            </div>
            <div style="${ACTION_ICON_WRAPPER_STYLE}">
                <span data-bsmap-action="edit" data-bsmap-station="${station._id}" title="Редактировать" style="${ACTION_ICON_STYLE}">${EDIT_ICON_SVG}</span>
                <span data-bsmap-action="delete" data-bsmap-station="${station._id}" title="Удалить" style="${ACTION_ICON_STYLE}">${DELETE_ICON_SVG}</span>
            </div>
        </div>`;
    }, [formatRegion]);

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    position: isFullscreen ? 'fixed' : 'absolute',
                    top: isFullscreen ? 24 : 16,
                    left: isFullscreen ? 24 : 16,
                    zIndex: 5,
                    pointerEvents: 'none',
                    width: { xs: 'calc(100% - 48px)', sm: 360 },
                }}
            >
                <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
                    <Tooltip title="Фильтры по базовым станциям">
                        <IconButton
                            color="primary"
                            onClick={() => setFiltersOpen((prev) => !prev)}
                            sx={{
                                bgcolor: 'background.paper',
                                boxShadow: 3,
                                '&:hover': { bgcolor: 'background.paper' },
                            }}
                            aria-label="Открыть фильтры"
                        >
                            <TravelExploreIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={canCreateStation ? 'Добавить объект' : 'Выберите регион'}>
                        <span>
                            <IconButton
                                color="primary"
                                onClick={openCreateDialog}
                                disabled={!canCreateStation}
                                sx={{
                                    bgcolor: 'background.paper',
                                    boxShadow: 3,
                                    '&:hover': { bgcolor: 'background.paper' },
                                }}
                                aria-label="Добавить объект"
                            >
                                <AddLocationOutlinedIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
                {filtersOpen && (
                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: 1,
                            boxShadow: 3,
                            p: 1.5,
                            pointerEvents: 'auto',
                            mt: 1.5,
                        }}
                    >
                        <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                            <InputLabel id="operator-select-label">Оператор</InputLabel>
                            <Select
                                labelId="operator-select-label"
                                label="Оператор"
                                value={operator}
                                onChange={(event) => setOperator(event.target.value as typeof operator)}
                            >
                                {OPERATORS.map((item) => (
                                    <MenuItem key={item.value} value={item.value}>
                                        {item.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Autocomplete
                            options={REGION_OPTIONS}
                            value={selectedRegion}
                            onChange={(_event, value) =>
                                setSelectedRegionCode((value ?? ALL_REGIONS_OPTION).code)
                            }
                            disableClearable
                            size="small"
                            fullWidth
                            getOptionLabel={(option) =>
                                option.code === ALL_REGIONS_OPTION.code
                                    ? option.label
                                    : `${option.code} — ${option.label}`
                            }
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                            sx={{ mb: 1 }}
                            renderInput={(params) => <TextField {...params} label="Регион" />}
                        />
                        <TextField
                            label="Поиск по БС"
                            value={searchName}
                            onChange={(event) => setSearchName(event.target.value)}
                            type="text"
                            fullWidth
                            size="small"
                            disabled={loading || !!error || !regionFilteredStations.length}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchName ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchName('')}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : undefined,
                            }}
                        />
                        {error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                                {error}
                            </Alert>
                        )}
                        {noSearchResults && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                БС «{searchName.trim()}» для оператора {selectedOperatorLabel} не найдена.
                            </Alert>
                        )}
                        {noStationsAfterFilters && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                Базовые станции не найдены для выбранных фильтров.
                            </Alert>
                        )}
                    </Box>
                )}
            </Box>
            <Box sx={{ width: '100%', height: '100%' }}>
                {loading ? (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : (
                    <YMaps query={ymapsQuery}>
                        <Map
                            key={mapKey}
                            defaultState={{ center: mapCenter, zoom }}
                            width="100%"
                            height="100%"
                            options={{
                                suppressObsoleteBrowserNotifier: true,
                                suppressMapOpenBlock: true,
                            }}
                            instanceRef={mapInstanceRef}
                        >
                            <FullscreenControl options={{ position: { right: 16, top: 16 } }} />
                            <ZoomControl options={{ position: { right: 16, top: 80 } }} />
                            {isIrkutskRegionSelected && (
                                <Polygon
                                    geometry={IRKUTSK_POLYGON_COORDINATES}
                                    options={{
                                        fillColor: '#1976d220',
                                        strokeColor: '#1976d2',
                                        strokeWidth: 2,
                                    }}
                                />
                            )}
                            <Clusterer
                                options={{
                                    preset: OPERATOR_CLUSTER_PRESETS[normalizeOperator(operator)],
                                    groupByCoordinates: false,
                                    gridSize: 80,
                                }}
                            >
                                {filteredStations.map((station) => {
                                    const hintTitle = station.name ? `БС ${station.name}` : 'Базовая станция';
                                    const normalizedOperator = normalizeOperator(station.op);
                                    const iconColor = OPERATOR_COLORS[normalizedOperator] ?? OPERATOR_COLORS.t2;
                                    const label =
                                        station.name != null && station.name !== ''
                                            ? String(station.name)
                                            : station._id.slice(-4);

                                    return (
                                        <Placemark
                                            key={station._id}
                                            geometry={[station.lat, station.lon]}
                                            properties={{
                                                hintContent: hintTitle,
                                                balloonContent: buildBalloonContent(station),
                                                iconCaption: label,
                                            }}
                                            options={{
                                                preset: 'islands#circleIcon',
                                                iconColor,
                                                hideIconOnBalloonOpen: false,
                                            }}
                                            modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                                        />
                                    );
                                })}
                            </Clusterer>
                        </Map>
                    </YMaps>
                )}
            </Box>
            <Dialog open={createDialogOpen} onClose={closeCreateDialog} fullWidth maxWidth="xs">
                <DialogTitle>Добавление БС</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        margin="dense"
                        label="Оператор"
                        value={selectedOperatorLabel}
                        fullWidth
                        disabled
                    />
                    <TextField
                        margin="dense"
                        label="Регион"
                        value={formatRegion(selectedRegion.code)}
                        fullWidth
                        disabled
                    />
                    <TextField
                        margin="dense"
                        label="Имя/номер БС"
                        value={createForm.name}
                        onChange={handleCreateFieldChange('name')}
                        fullWidth
                        autoFocus
                    />
                    <TextField
                        margin="dense"
                        label="Адрес"
                        value={createForm.address}
                        onChange={handleCreateFieldChange('address')}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TextField
                        margin="dense"
                        label="Широта"
                        value={createForm.lat}
                        onChange={handleCreateFieldChange('lat')}
                        type="number"
                        fullWidth
                    />
                    <TextField
                        margin="dense"
                        label="Долгота"
                        value={createForm.lon}
                        onChange={handleCreateFieldChange('lon')}
                        type="number"
                        fullWidth
                    />
                    {createDialogError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {createDialogError}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeCreateDialog} disabled={createDialogLoading}>
                        Отмена
                    </Button>
                    <Button variant="contained" onClick={handleCreateSave} disabled={createDialogLoading}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={Boolean(editingStation)} onClose={closeEditDialog} fullWidth maxWidth="xs">
                <DialogTitle>Редактирование БС</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        margin="dense"
                        label="Имя/номер БС"
                        value={editForm.name}
                        onChange={handleEditFieldChange('name')}
                        fullWidth
                    />
                    <TextField
                        margin="dense"
                        label="Адрес"
                        value={editForm.address}
                        onChange={handleEditFieldChange('address')}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TextField
                        margin="dense"
                        label="Широта"
                        value={editForm.lat}
                        onChange={handleEditFieldChange('lat')}
                        type="number"
                        fullWidth
                    />
                    <TextField
                        margin="dense"
                        label="Долгота"
                        value={editForm.lon}
                        onChange={handleEditFieldChange('lon')}
                        type="number"
                        fullWidth
                    />
                    {editDialogError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {editDialogError}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEditDialog} disabled={editDialogLoading}>
                        Отмена
                    </Button>
                    <Button variant="contained" onClick={handleEditSave} disabled={editDialogLoading}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={Boolean(deletingStation)}
                onClose={closeDeleteDialog}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Удаление БС</DialogTitle>
                <DialogContent dividers>
                    Вы уверены, что хотите удалить{' '}
                    {deletingStation?.name ? `БС №${deletingStation.name}` : 'эту базовую станцию'}?
                    {deleteDialogError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {deleteDialogError}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} disabled={deleteDialogLoading}>
                        Отмена
                    </Button>
                    <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteDialogLoading}>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
