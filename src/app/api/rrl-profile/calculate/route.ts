import { NextRequest, NextResponse } from 'next/server';
import { calculateRrlProfileWithElevations } from '@/lib/rrl/service';
import { validateRrlProfileInput } from '@/lib/rrl/validators';
import type { ApiErrorPayload, RrlProfileCalculateResponse } from '@/lib/rrl/types';

export const runtime = 'nodejs';

type CalculateResponsePayload = RrlProfileCalculateResponse & {
    meta: {
        elevationProvider: string;
    };
};

const buildError = (
    status: number,
    code: ApiErrorPayload['error']['code'],
    message: string,
    details?: string
) => {
    return NextResponse.json<ApiErrorPayload>(
        {
            error: {
                code,
                message,
                details,
            },
        },
        { status }
    );
};

export async function POST(request: NextRequest) {
    try {
        const json = await request.json().catch(() => null);

        const validated = validateRrlProfileInput(json);
        if (!validated.success) {
            return buildError(400, 'VALIDATION_ERROR', validated.message);
        }

        const result = await calculateRrlProfileWithElevations(validated.data);

        return NextResponse.json<CalculateResponsePayload>({
            input: result.input,
            summary: result.summary,
            samples: result.samples,
            meta: {
                elevationProvider: result.elevationProvider,
            },
        });
    } catch (error) {
        const message = (error as Error).message || 'Internal error';
        if (message.includes('профиль высот')) {
            return buildError(502, 'ELEVATION_ERROR', 'Ошибка получения высот.', message);
        }
        if (message.includes('Трасса') || message.includes('расч')) {
            return buildError(400, 'CALCULATION_ERROR', 'Ошибка инженерного расчёта.', message);
        }

        return buildError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервиса.', message);
    }
}
