// src/app/Providers.tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ruRU, enUS } from '@clerk/localizations';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import type { ReactNode } from 'react';
import ClientApp from './ClientApp';
import { withBasePath } from '@/utils/basePath';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';

type ProvidersProps = {
    publishableKey: string;
    fontFamily: string;
    children: ReactNode;
};

function InnerProviders({ publishableKey, fontFamily, children }: ProvidersProps) {
    const { locale, t } = useI18n();
    const theme = createTheme({
        typography: { fontFamily: `${fontFamily}, 'Open Sans', sans-serif` },
    });
    const baseLocalization = (locale === 'en' ? enUS : ruRU) as {
        signIn?: {
            start?: Record<string, unknown>;
        };
    };
    const localization = {
        ...baseLocalization,
        signIn: {
            ...(baseLocalization.signIn ?? {}),
            start: {
                ...(baseLocalization.signIn?.start ?? {}),
                subtitle: t('auth.subtitle', 'чтобы продолжить работу в системе'),
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

export default function Providers(props: ProvidersProps) {
    return (
        <I18nProvider>
            <InnerProviders {...props} />
        </I18nProvider>
    );
}
