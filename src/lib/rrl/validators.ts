import { z } from 'zod';
import type { RrlProfileCalculateRequest } from './types';

const coordinateSchema = z.object({
    name: z.string().trim().max(120).optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
});

export const rrlProfileCalculateSchema = z
    .object({
        a: coordinateSchema,
        b: coordinateSchema,
        antennaA: z.number().min(0),
        antennaB: z.number().min(0),
        freqGHz: z.number().positive(),
        kFactor: z.number().positive(),
        stepMeters: z.number().positive().max(1000),
    })
    .superRefine((value, ctx) => {
        if (value.a.lat === value.b.lat && value.a.lon === value.b.lon) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['b'],
                message: 'Точки A и B совпадают. Задайте разные координаты.',
            });
        }
    });

export const validateRrlProfileInput = (
    payload: unknown
): { success: true; data: RrlProfileCalculateRequest } | { success: false; message: string } => {
    const parsed = rrlProfileCalculateSchema.safeParse(payload);

    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return {
            success: false,
            message: issue?.message ?? 'Некорректные входные данные.',
        };
    }

    return {
        success: true,
        data: parsed.data,
    };
};
