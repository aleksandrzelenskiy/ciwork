// src/utils/priorityIcons.tsx
import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Translator } from '@/i18n';

import RemoveIcon from '@mui/icons-material/Remove';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';

const PRIORITY_COLOR: Record<Priority, string> = {
    low: '#28a0e9',
    medium: '#df9b18',
    high: '#ca3131',
    urgent: '#ff0000',
};

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_LABEL_RU: Record<Priority, string> = {
    urgent: 'Срочный',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
};

export function normalizePriority(p?: string): Priority | null {
    if (!p) return null;
    const v = p.toString().trim().toLowerCase();
    if (v === 'urgent' || v === 'high' || v === 'medium' || v === 'low') return v;
    return null;
}

export function getPriorityIcon(priority?: string | null, sx?: SxProps<Theme>) {
    const p = normalizePriority(priority ?? '');
    if (!p) return null;

    const baseSx: SxProps<Theme> = { color: PRIORITY_COLOR[p], fontSize: 20, ...(sx || {}) };

    switch (p) {
        case 'low':
            return <RemoveIcon sx={baseSx} />;
        case 'medium':
            return <DragHandleIcon sx={baseSx} />;
        case 'high':
            return <KeyboardArrowUpIcon sx={baseSx} />;
        case 'urgent':
            return <KeyboardDoubleArrowUpIcon sx={baseSx} />;
        default:
            return null;
    }
}

export function getPriorityLabelRu(priority?: string | null): string {
    const normalized = normalizePriority(priority ?? '');
    if (!normalized) return '';
    return PRIORITY_LABEL_RU[normalized];
}

export function getPriorityLabel(priority?: string | null, t?: Translator): string {
    const normalized = normalizePriority(priority ?? '');
    if (!normalized) return '';
    if (!t) return PRIORITY_LABEL_RU[normalized];

    switch (normalized) {
        case 'urgent':
            return t('priority.urgent', PRIORITY_LABEL_RU.urgent);
        case 'high':
            return t('priority.high', PRIORITY_LABEL_RU.high);
        case 'medium':
            return t('priority.medium', PRIORITY_LABEL_RU.medium);
        case 'low':
            return t('priority.low', PRIORITY_LABEL_RU.low);
        default:
            return PRIORITY_LABEL_RU[normalized];
    }
}
