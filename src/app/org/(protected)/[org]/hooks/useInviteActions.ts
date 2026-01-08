import * as React from 'react';

import type { MemberDTO } from '@/types/org';

type UseInviteActionsArgs = {
    members: MemberDTO[];
    disableCreationActions: boolean;
    setInviteExistingEmails: (emails: string[]) => void;
    setInviteOpen: (open: boolean) => void;
};

type UseInviteActionsState = {
    openInviteDialog: () => void;
};

export default function useInviteActions({
    members,
    disableCreationActions,
    setInviteExistingEmails,
    setInviteOpen,
}: UseInviteActionsArgs): UseInviteActionsState {
    const openInviteDialog = React.useCallback(() => {
        if (disableCreationActions) return;
        setInviteExistingEmails(members.map((member) => member.userEmail.toLowerCase()));
        setInviteOpen(true);
    }, [disableCreationActions, members, setInviteExistingEmails, setInviteOpen]);

    return { openInviteDialog };
}
