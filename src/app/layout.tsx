// src/app/layout.tsx
import './globals.css';
import localFont from 'next/font/local';
import Providers from './Providers';

const primaryFont = localFont({
    src: [{ path: '../../public/fonts/Roboto-Regular.ttf', weight: '400', style: 'normal' }],
    display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Check your .env configuration.'
        );
    }

    return (
        <html lang="ru">
        <body className={primaryFont.className}>
        <Providers publishableKey={publishableKey} fontFamily={primaryFont.style.fontFamily}>
            {children}
        </Providers>
        </body>
        </html>
    );
}
