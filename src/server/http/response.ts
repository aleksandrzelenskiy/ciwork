import 'server-only';

import { NextResponse } from 'next/server';

export const jsonData = <T>(data: T, status = 200) =>
    NextResponse.json(data, { status });

export const jsonError = (
    error: string,
    status = 500,
    extras?: Record<string, unknown>
) =>
    NextResponse.json(
        {
            error,
            ...(extras ?? {}),
        },
        { status }
    );
