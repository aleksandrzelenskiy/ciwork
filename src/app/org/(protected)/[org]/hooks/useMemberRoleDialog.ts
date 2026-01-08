import * as React from 'react';

import type { MemberDTO, OrgRole } from '@/types/org';

type UseMemberRoleDialogState = {
    newRole: OrgRole;
    setNewRole: (role: OrgRole) => void;
    openRoleDialog: (member: MemberDTO) => void;
};

export default function useMemberRoleDialog(
    setMemberToEditRole: (member: MemberDTO | null) => void,
    setRoleDialogOpen: (open: boolean) => void
): UseMemberRoleDialogState {
    const [newRole, setNewRole] = React.useState<OrgRole>('executor');

    const openRoleDialog = React.useCallback(
        (member: MemberDTO) => {
            setMemberToEditRole(member);
            setNewRole(member.role);
            setRoleDialogOpen(true);
        },
        [setMemberToEditRole, setRoleDialogOpen]
    );

    return {
        newRole,
        setNewRole,
        openRoleDialog,
    };
}
