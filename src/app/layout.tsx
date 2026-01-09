import './globals.css';
import localFont from 'next/font/local';
import Providers from './Providers';

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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isBuildPhase =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NEXT_PHASE === 'phase-export';

    if (!publishableKey && !isBuildPhase) {
        throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Check your .env.local configuration.');
    }

    return (
        <html lang="ru">
            <body className={primaryFont.className}>
                <Providers
                    publishableKey={publishableKey}
                    fontFamily={primaryFont.style.fontFamily}
                >
                    {children}
                </Providers>
            </body>
        </html>
    );
}
