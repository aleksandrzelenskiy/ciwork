import { z } from 'zod';

const emptyToUndefined = (value: unknown) => {
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }
    return value;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const serverEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    MONGODB_URI: optionalString,
    EMAIL_HOST: optionalString,
    EMAIL_PORT: optionalString,
    EMAIL_USER: optionalString,
    EMAIL_PASS: optionalString,
    EMAIL_SECURE: optionalString,
    EMAIL_FROM: optionalString,
    NOTIFICATIONS_SOCKET_SECRET: optionalString,
    CLERK_SECRET_KEY: optionalString,
    REPORT_ACCESS_SECRET: optionalString,
    FRONTEND_URL: optionalUrl,
    NEXT_PUBLIC_FRONTEND_URL: optionalUrl,
    AWS_S3_BUCKET: optionalString,
    AWS_S3_REGION: optionalString,
    AWS_S3_ENDPOINT: optionalString,
    AWS_ACCESS_KEY_ID: optionalString,
    AWS_SECRET_ACCESS_KEY: optionalString,
    AWS_S3_INVENTORY_BUCKET: optionalString,
    AWS_S3_INVENTORY_PREFIX: optionalString,
    BILLING_CRON_SECRET: optionalString,
    STORAGE_RECONCILE_CRON_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export const getServerEnv = (): ServerEnv => {
    if (!cachedEnv) {
        cachedEnv = serverEnvSchema.parse(process.env);
    }
    return cachedEnv;
};

export const requireEnv = <T extends keyof ServerEnv>(
    key: T,
    label?: string
): string => {
    const value = getServerEnv()[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${label ?? String(key)} is required`);
    }
    return value;
};
