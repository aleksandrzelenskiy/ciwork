import * as React from 'react';

type UseInviteListenerArgs = {
    fetchMembers: () => Promise<void>;
    setInviteOpen: (open: boolean) => void;
    inviteCloseTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

export default function useInviteListener({
    fetchMembers,
    setInviteOpen,
    inviteCloseTimeoutRef,
}: UseInviteListenerArgs) {
    React.useEffect(() => {
        const handler = async () => {
            await fetchMembers();
            if (inviteCloseTimeoutRef.current) {
                clearTimeout(inviteCloseTimeoutRef.current);
            }
            inviteCloseTimeoutRef.current = setTimeout(() => {
                setInviteOpen(false);
                inviteCloseTimeoutRef.current = null;
            }, 3000);
        };
        window.addEventListener('org-members:invited', handler as EventListener);
        return () => {
            window.removeEventListener('org-members:invited', handler as EventListener);
            if (inviteCloseTimeoutRef.current) {
                clearTimeout(inviteCloseTimeoutRef.current);
                inviteCloseTimeoutRef.current = null;
            }
        };
    }, [fetchMembers, setInviteOpen, inviteCloseTimeoutRef]);
}
