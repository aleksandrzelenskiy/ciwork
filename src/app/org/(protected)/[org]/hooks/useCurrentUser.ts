import * as React from 'react';

type UseCurrentUserState = {
    isSuperAdmin: boolean;
};

export default function useCurrentUser(): UseCurrentUserState {
    const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/current-user', { cache: 'no-store' });
                const data = (await res.json().catch(() => ({}))) as { isSuperAdmin?: boolean };
                if (!cancelled && res.ok && typeof data.isSuperAdmin === 'boolean') {
                    setIsSuperAdmin(data.isSuperAdmin);
                }
            } catch {
                if (!cancelled) {
                    setIsSuperAdmin(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return { isSuperAdmin };
}
