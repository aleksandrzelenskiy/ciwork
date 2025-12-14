'use server';

import type { ReactNode } from 'react';
import { GetUserContext } from '@/server-actions/user-context';

type AdminLayoutProps = {
    children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
    const context = await GetUserContext();
    const isSuperAdmin = context.success && Boolean(context.data?.isSuperAdmin);

    if (!isSuperAdmin) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        maxWidth: 440,
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        border: '1px solid rgba(0,0,0,0.1)',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.08)',
                        backgroundColor: '#fff',
                    }}
                >
                    <h1 style={{ margin: '0 0 0.75rem 0' }}>Доступ запрещён</h1>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        Для просмотра этой секции необходима роль супер-администратора.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
