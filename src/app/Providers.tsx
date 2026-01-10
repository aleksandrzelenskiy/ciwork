// src/app/Providers.tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import ClientApp from './ClientApp';

type ProvidersProps = {
    publishableKey: string;
    fontFamily: string;
    children: React.ReactNode;
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
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
        >
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
        </ClerkProvider>
    );
}
