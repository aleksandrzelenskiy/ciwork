import * as React from 'react';

import type { MemberDTO, OrgRole } from '@/types/org';
import type { ProjectManagerOption } from '@/app/workspace/components/ProjectDialog';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseMembersState = {
    members: MemberDTO[];
    loading: boolean;
    memberSearch: string;
    showMemberSearch: boolean;
    setMemberSearch: (value: string) => void;
    setShowMemberSearch: (value: boolean) => void;
    filteredMembers: MemberDTO[];
    invitedMembersCount: number;
    activeMembersCount: number;
    managerOptions: ProjectManagerOption[];
    memberByEmail: Map<string, MemberDTO>;
    fetchMembers: () => Promise<void>;
};

export default function useMembers(
    org: string | undefined,
    canManage: boolean,
    setSnack: SnackSetter
): UseMembersState {
    const [members, setMembers] = React.useState<MemberDTO[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState('');
    const [showMemberSearch, setShowMemberSearch] = React.useState(false);

    const fetchMembers = React.useCallback(async () => {
        if (!org || !canManage) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { members?: MemberDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setMembers(Array.isArray(data?.members) ? data.members : []);
        } finally {
            setLoading(false);
        }
    }, [org, canManage, setSnack]);

    const filteredMembers = React.useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter((member) => {
            const name = (member.userName || '').toLowerCase();
            const email = (member.userEmail || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [memberSearch, members]);

    const memberByEmail = React.useMemo(() => {
        const map = new Map<string, MemberDTO>();
        for (const member of members) {
            if (member.userEmail) {
                map.set(member.userEmail.toLowerCase(), member);
            }
        }
        return map;
    }, [members]);

    const invitedMembersCount = React.useMemo(
        () => members.filter((member) => member.status === 'invited').length,
        [members]
    );
    const activeMembersCount = members.length - invitedMembersCount;

    const managerOptions: ProjectManagerOption[] = React.useMemo(
        () =>
            members
                .filter((member) => member.status === 'active')
                .filter((member) => ['owner', 'org_admin', 'manager'].includes(member.role))
                .map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role as OrgRole,
                })),
        [members]
    );

    return {
        members,
        loading,
        memberSearch,
        showMemberSearch,
        setMemberSearch,
        setShowMemberSearch,
        filteredMembers,
        invitedMembersCount,
        activeMembersCount,
        managerOptions,
        memberByEmail,
        fetchMembers,
    };
}
