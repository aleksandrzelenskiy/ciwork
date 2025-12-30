'use client';

import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { ruRU } from '@clerk/localizations';
import ClientApp from './ClientApp';
import localFont from 'next/font/local';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Локальный шрифт, чтобы не тянуть Google Fonts при сборке без сети
const primaryFont = localFont({
    src: [
        {
            path: '../../public/fonts/Roboto-Regular.ttf',
            weight: '400',
            style: 'normal',
        },
    ],
    display: 'swap',
});

// Создаём тему MUI, где переопределяем основной шрифт
const theme = createTheme({
    typography: {
        fontFamily: `${primaryFont.style.fontFamily}, 'Open Sans', sans-serif`,
    },
});

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
        throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Check your .env.local configuration.');
    }

    return (
        <ClerkProvider
            publishableKey={publishableKey}
            localization={ruRU}
            dynamic
        >
            <html lang="ru">
                <body className={primaryFont.className}>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <ClientApp>{children}</ClientApp>
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
