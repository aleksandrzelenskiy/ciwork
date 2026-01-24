import PlanConfigModel, { type PlanCode } from '@/server/models/PlanConfigModel';

export type PlanConfigDTO = {
    plan: PlanCode;
    title: string;
    priceRubMonthly: number;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksMonthLimit: number | null;
    publicTasksMonthlyLimit: number | null;
    storageIncludedGb: number | null;
    storageOverageRubPerGbMonth: number;
    storagePackageGb: number | null;
    storagePackageRubMonthly: number | null;
    features: string[];
};

export const DEFAULT_PLAN_CONFIGS: Record<PlanCode, PlanConfigDTO> = {
    basic: {
        plan: 'basic',
        title: 'Basic',
        priceRubMonthly: 0,
        projectsLimit: 1,
        seatsLimit: 5,
        tasksMonthLimit: 10,
        publicTasksMonthlyLimit: 5,
        storageIncludedGb: 5,
        storageOverageRubPerGbMonth: 120,
        storagePackageGb: 100,
        storagePackageRubMonthly: 9000,
        features: [
            '1 проект',
            'До 5 активных рабочих мест',
            'До 10 задач в месяц',
            'Хранилище 5 GB включено',
        ],
    },
    pro: {
        plan: 'pro',
        title: 'Pro',
        priceRubMonthly: 5490,
        projectsLimit: 20,
        seatsLimit: 50,
        tasksMonthLimit: 100,
        publicTasksMonthlyLimit: 10,
        storageIncludedGb: 50,
        storageOverageRubPerGbMonth: 120,
        storagePackageGb: 100,
        storagePackageRubMonthly: 9000,
        features: [
            '20 проектов',
            'До 50 активных рабочих мест',
            'До 100 задач в месяц',
            'Хранилище 50 GB включено',
            'Базовые интеграции',
            'Экспорт',
            'SLA 48ч',
        ],
    },
    business: {
        plan: 'business',
        title: 'Business',
        priceRubMonthly: 9990,
        projectsLimit: 50,
        seatsLimit: 100,
        tasksMonthLimit: 300,
        publicTasksMonthlyLimit: 20,
        storageIncludedGb: 100,
        storageOverageRubPerGbMonth: 120,
        storagePackageGb: 100,
        storagePackageRubMonthly: 9000,
        features: [
            '50 проектов',
            'До 100 активных рабочих мест',
            'До 300 задач в месяц',
            'Хранилище 100 GB включено',
            'Расширенные интеграции',
            'Аудит-лог',
            'SLA 24ч',
        ],
    },
    enterprise: {
        plan: 'enterprise',
        title: 'Enterprise',
        priceRubMonthly: 0,
        projectsLimit: null,
        seatsLimit: null,
        tasksMonthLimit: null,
        publicTasksMonthlyLimit: null,
        storageIncludedGb: null,
        storageOverageRubPerGbMonth: 0,
        storagePackageGb: null,
        storagePackageRubMonthly: null,
        features: [
            'Индивидуальные условия',
            'Без ограничений',
            'Персональный менеджер',
        ],
    },
};

const normalizeLimit = (value?: number | null): number | null => {
    if (typeof value !== 'number') return null;
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
};

const normalizePlanConfig = (plan: PlanCode, source?: Partial<PlanConfigDTO> | null): PlanConfigDTO => {
    const fallback = DEFAULT_PLAN_CONFIGS[plan];
    return {
        plan,
        title: source?.title?.trim() || fallback.title,
        priceRubMonthly:
            typeof source?.priceRubMonthly === 'number' && Number.isFinite(source.priceRubMonthly)
                ? source.priceRubMonthly
                : fallback.priceRubMonthly,
        projectsLimit: normalizeLimit(source?.projectsLimit) ?? fallback.projectsLimit,
        seatsLimit: normalizeLimit(source?.seatsLimit) ?? fallback.seatsLimit,
        tasksMonthLimit: normalizeLimit(source?.tasksMonthLimit) ?? fallback.tasksMonthLimit,
        publicTasksMonthlyLimit: normalizeLimit(source?.publicTasksMonthlyLimit) ?? fallback.publicTasksMonthlyLimit,
        storageIncludedGb: normalizeLimit(source?.storageIncludedGb) ?? fallback.storageIncludedGb,
        storageOverageRubPerGbMonth:
            typeof source?.storageOverageRubPerGbMonth === 'number' &&
            Number.isFinite(source.storageOverageRubPerGbMonth)
                ? source.storageOverageRubPerGbMonth
                : fallback.storageOverageRubPerGbMonth,
        storagePackageGb: normalizeLimit(source?.storagePackageGb) ?? fallback.storagePackageGb,
        storagePackageRubMonthly:
            typeof source?.storagePackageRubMonthly === 'number' &&
            Number.isFinite(source.storagePackageRubMonthly)
                ? source.storagePackageRubMonthly
                : fallback.storagePackageRubMonthly,
        features: Array.isArray(source?.features) ? source?.features.filter(Boolean) : fallback.features,
    };
};

export const getPlanConfig = async (plan: PlanCode): Promise<PlanConfigDTO> => {
    const doc = await PlanConfigModel.findOne({ plan }).lean();
    return normalizePlanConfig(plan, doc as Partial<PlanConfigDTO> | null);
};

export const getAllPlanConfigs = async (): Promise<PlanConfigDTO[]> => {
    const rows = await PlanConfigModel.find({}).lean();
    const mapped = new Map(rows.map((row) => [row.plan as PlanCode, row]));
    return (['basic', 'pro', 'business', 'enterprise'] as PlanCode[]).map((plan) =>
        normalizePlanConfig(plan, mapped.get(plan) as Partial<PlanConfigDTO> | null)
    );
};

export const ensurePlanConfigs = async (): Promise<void> => {
    const existing = await PlanConfigModel.find({}, { plan: 1 }).lean();
    const existingPlans = new Set(existing.map((row) => row.plan));
    const toInsert = (Object.keys(DEFAULT_PLAN_CONFIGS) as PlanCode[])
        .filter((plan) => !existingPlans.has(plan))
        .map((plan) => DEFAULT_PLAN_CONFIGS[plan]);
    if (!toInsert.length) return;
    await PlanConfigModel.insertMany(toInsert, { ordered: false });
};
