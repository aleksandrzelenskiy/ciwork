'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import ClientApp from './ClientApp';

type ProvidersProps = {
    publishableKey?: string;
    fontFamily: string;
    children: React.ReactNode;
};

export default function Providers({
    publishableKey,
    fontFamily,
    children,
}: ProvidersProps) {
    const theme = createTheme({
        typography: {
            fontFamily: `${fontFamily}, 'Open Sans', sans-serif`,
        },
    });

    if (!publishableKey) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
        );
    }

    return (
        <ClerkProvider publishableKey={publishableKey} localization={ruRU} dynamic>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
        </ClerkProvider>
    );
}
