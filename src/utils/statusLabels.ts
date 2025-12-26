import type { CurrentStatus } from '@/app/types/taskTypes';

export const STATUS_ORDER: CurrentStatus[] = [
    'To do',
    'Assigned',
    'At work',
    'Done',
    'Pending',
    'Issues',
    'Fixed',
    'Agreed',
];

export const STATUS_LABELS_RU: Record<CurrentStatus, string> = {
    'To do': 'К выполнению',
    Assigned: 'Назначена',
    'At work': 'В работе',
    Done: 'Выполнено',
    Pending: 'На проверке',
    Issues: 'Замечания',
    Fixed: 'Исправлено',
    Agreed: 'Согласовано',
};

const TITLE_CASE_MAP: Record<string, CurrentStatus> = {
    'TO DO': 'To do',
    TODO: 'To do',
    'TO-DO': 'To do',
    'К ВЫПОЛНЕНИЮ': 'To do',
    ASSIGNED: 'Assigned',
    'НАЗНАЧЕНА': 'Assigned',
    'IN PROGRESS': 'At work',
    'IN-PROGRESS': 'At work',
    'AT WORK': 'At work',
    'В РАБОТЕ': 'At work',
    DONE: 'Done',
    'ВЫПОЛНЕНО': 'Done',
    PENDING: 'Pending',
    'НА ПРОВЕРКЕ': 'Pending',
    ISSUES: 'Issues',
    'ЗАМЕЧАНИЯ': 'Issues',
    FIXED: 'Fixed',
    'ИСПРАВЛЕНО': 'Fixed',
    AGREED: 'Agreed',
    'СОГЛАСОВАНО': 'Agreed',
};

const EXTRA_STATUS_LABELS: Record<string, string> = {
    Cancelled: 'Отменено',
};

export const normalizeStatusTitle = (status?: string): CurrentStatus => {
    if (!status) return 'To do';
    const key = status.trim().toUpperCase();
    return TITLE_CASE_MAP[key] ?? (status as CurrentStatus);
};

export const getStatusLabel = (status?: string): string => {
    if (!status) return '';
    const normalized = normalizeStatusTitle(status);
    return STATUS_LABELS_RU[normalized] ?? EXTRA_STATUS_LABELS[status] ?? status;
};
