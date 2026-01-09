// src/app/layout.tsx
import './globals.css';
import localFont from 'next/font/local';
import Providers from './Providers';

const primaryFont = localFont({
    src: [{ path: '../../public/fonts/Roboto-Regular.ttf', weight: '400', style: 'normal' }],
    display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const isBuildPhase =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NEXT_PHASE === 'phase-export';

    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    // На runtime ключ обязателен
    if (!publishableKey && !isBuildPhase) {
        throw new Error(
            'Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Check your .env configuration.'
        );
    }

    // На build даём "заглушку", чтобы ClerkProvider существовал и хуки не падали
    const effectivePublishableKey = publishableKey || (isBuildPhase ? 'pk_build_dummy' : undefined);

    return (
        <html lang="ru">
        <body className={primaryFont.className}>
        <Providers publishableKey={effectivePublishableKey} fontFamily={primaryFont.style.fontFamily}>
            {children}
        </Providers>
        </body>
        </html>
    );
}
