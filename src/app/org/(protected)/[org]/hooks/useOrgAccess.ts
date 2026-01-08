import * as React from 'react';

import type { OrgRole } from '@/types/org';

type OrgAccessState = {
    accessChecked: boolean;
    myRole: OrgRole | null;
    orgName: string;
};

export default function useOrgAccess(org?: string): OrgAccessState {
    const [myRole, setMyRole] = React.useState<OrgRole | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [accessChecked, setAccessChecked] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!org) return;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}`);
                type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
                const data = (await res.json().catch(() => ({}))) as OrgInfoOk | { error: string };
                if (!cancelled) {
                    if (!res.ok || 'error' in data) {
                        setMyRole(null);
                    } else {
                        setMyRole(data.role);
                        setOrgName(data.org.name);
                    }
                    setAccessChecked(true);
                }
            } catch {
                if (!cancelled) {
                    setMyRole(null);
                    setAccessChecked(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [org]);

    return { accessChecked, myRole, orgName };
}
