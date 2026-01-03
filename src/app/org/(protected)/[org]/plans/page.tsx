'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import OrgPlansPanel from '@/features/org/OrgPlansPanel';

export default function OrgPlansPage() {
    const params = useParams<{ org: string }>();
    const orgSlug = params?.org;

    if (!orgSlug) {
        return null;
    }

    return <OrgPlansPanel orgSlug={orgSlug} />;
}
