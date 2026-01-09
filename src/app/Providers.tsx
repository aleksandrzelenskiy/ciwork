// src/app/Providers.tsx
'use client';

import { ClerkProvider } from '@clerk/nextjs';
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

    return (
        <ClerkProvider publishableKey={publishableKey} dynamic>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
        </ClerkProvider>
    );
}
