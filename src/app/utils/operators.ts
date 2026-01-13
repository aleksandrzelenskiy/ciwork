import { CORE_OPERATORS } from '@/app/constants/operators';

export const OPERATORS = CORE_OPERATORS;
export type OperatorCode = (typeof OPERATORS)[number]['value'];

const OPERATOR_ALIASES: Record<string, OperatorCode> = {
    t2: '250020',
    't-2': '250020',
    '250020': '250020',
    '250-20': '250020',
    beeline: '250099',
    'bee-line': '250099',
    '250099': '250099',
    '250-99': '250099',
    megafon: '250002',
    '250002': '250002',
    '250-2': '250002',
    mts: '250001',
    '250001': '250001',
    '250-1': '250001',
};

export const normalizeOperatorCode = (value?: string | null): OperatorCode | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    return OPERATOR_ALIASES[key] ?? null;
};

export const getOperatorLabel = (value?: string | null): string | null => {
    const normalized = normalizeOperatorCode(value);
    if (!normalized) return null;
    return OPERATORS.find((operator) => operator.value === normalized)?.label ?? null;
};
