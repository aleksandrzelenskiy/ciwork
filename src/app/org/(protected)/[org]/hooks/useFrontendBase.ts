import * as React from 'react';

import { normalizeBaseUrl } from '@/utils/org';

export default function useFrontendBase() {
    const [frontendBase, setFrontendBase] = React.useState('');

    React.useEffect(() => {
        const envPublic = process.env.NEXT_PUBLIC_FRONTEND_URL;
        const envPrivate = process.env.FRONTEND_URL;
        if (envPublic) {
            setFrontendBase(normalizeBaseUrl(envPublic));
        } else if (envPrivate) {
            setFrontendBase(normalizeBaseUrl(envPrivate));
        } else if (typeof window !== 'undefined') {
            setFrontendBase(normalizeBaseUrl(window.location.origin));
        }
    }, []);

    return frontendBase;
}
