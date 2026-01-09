export type OperatorSlug = 't2' | 'beeline' | 'megafon' | 'mts';

const OPERATOR_ALIASES: Record<string, OperatorSlug> = {
    t2: 't2',
    't-2': 't2',
    '250020': 't2',
    '250-20': 't2',
    beeline: 'beeline',
    'bee-line': 'beeline',
    '250099': 'beeline',
    '250-99': 'beeline',
    megafon: 'megafon',
    '250002': 'megafon',
    '250-2': 'megafon',
    mts: 'mts',
    '250001': 'mts',
    '250-1': 'mts',
};

export const OPERATOR_COLORS: Record<OperatorSlug, string> = {
    t2: '#1f1f1f',
    beeline: '#fbc02d',
    megafon: '#388e3c',
    mts: '#d32f2f',
};

export const OPERATOR_CLUSTER_PRESETS: Record<OperatorSlug, string> = {
    t2: 'islands#blackClusterIcons',
    beeline: 'islands#yellowClusterIcons',
    megafon: 'islands#greenClusterIcons',
    mts: 'islands#redClusterIcons',
};

export const normalizeOperator = (value?: string | null): OperatorSlug => {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    if (normalized && OPERATOR_ALIASES[normalized]) {
        return OPERATOR_ALIASES[normalized];
    }
    return 't2';
};
