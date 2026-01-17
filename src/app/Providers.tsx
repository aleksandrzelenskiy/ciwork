// src/app/Providers.tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import type { ReactNode } from 'react';
import ClientApp from './ClientApp';
import { withBasePath } from '@/utils/basePath';

type ProvidersProps = {
    publishableKey: string;
    fontFamily: string;
    children: ReactNode;
};

export default function Providers({ publishableKey, fontFamily, children }: ProvidersProps) {
    const theme = createTheme({
        typography: { fontFamily: `${fontFamily}, 'Open Sans', sans-serif` },
    });
    const ruLocalization = ruRU as {
        signIn?: {
            start?: Record<string, unknown>;
        };
    };
    const localization = {
        ...ruLocalization,
        signIn: {
            ...(ruLocalization.signIn ?? {}),
            start: {
                ...(ruLocalization.signIn?.start ?? {}),
                subtitle: 'чтобы продолжить работу в системе',
            },
        },
    };

    return (
        <ClerkProvider
            localization={localization}
            publishableKey={publishableKey}
            dynamic
            signInUrl={withBasePath('/sign-in')}
            signUpUrl={withBasePath('/sign-up')}
        >
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
        </ClerkProvider>
    );
}
