import * as React from 'react';

import type { ApplicationRow, MemberDTO, ProjectDTO } from '@/types/org';

type UseOrgDialogActionsArgs = {
    removing: boolean;
    removingProject: boolean;
    removingApplication: boolean;
    setRemoveOpen: (open: boolean) => void;
    setMemberToRemove: (member: MemberDTO | null) => void;
    setRemoveProjectOpen: (open: boolean) => void;
    setProjectToRemove: (project: ProjectDTO | null) => void;
    setRemoveApplicationOpen: (open: boolean) => void;
    setApplicationToRemove: (application: ApplicationRow | null) => void;
};

type UseOrgDialogActionsState = {
    openRemoveDialog: (member: MemberDTO) => void;
    closeRemoveDialog: () => void;
    openRemoveProjectDialog: (project: ProjectDTO) => void;
    closeRemoveProjectDialog: () => void;
    openRemoveApplicationDialog: (application: ApplicationRow) => void;
    closeRemoveApplicationDialog: () => void;
};

export default function useOrgDialogActions({
    removing,
    removingProject,
    removingApplication,
    setRemoveOpen,
    setMemberToRemove,
    setRemoveProjectOpen,
    setProjectToRemove,
    setRemoveApplicationOpen,
    setApplicationToRemove,
}: UseOrgDialogActionsArgs): UseOrgDialogActionsState {
    const openRemoveDialog = React.useCallback((member: MemberDTO) => {
        setMemberToRemove(member);
        setRemoveOpen(true);
    }, [setMemberToRemove, setRemoveOpen]);

    const closeRemoveDialog = React.useCallback(() => {
        if (removing) return;
        setRemoveOpen(false);
        setMemberToRemove(null);
    }, [removing, setRemoveOpen, setMemberToRemove]);

    const openRemoveProjectDialog = React.useCallback((project: ProjectDTO) => {
        setProjectToRemove(project);
        setRemoveProjectOpen(true);
    }, [setProjectToRemove, setRemoveProjectOpen]);

    const closeRemoveProjectDialog = React.useCallback(() => {
        if (removingProject) return;
        setRemoveProjectOpen(false);
        setProjectToRemove(null);
    }, [removingProject, setRemoveProjectOpen, setProjectToRemove]);

    const openRemoveApplicationDialog = React.useCallback((application: ApplicationRow) => {
        setApplicationToRemove(application);
        setRemoveApplicationOpen(true);
    }, [setApplicationToRemove, setRemoveApplicationOpen]);

    const closeRemoveApplicationDialog = React.useCallback(() => {
        if (removingApplication) return;
        setRemoveApplicationOpen(false);
        setApplicationToRemove(null);
    }, [removingApplication, setRemoveApplicationOpen, setApplicationToRemove]);

    return {
        openRemoveDialog,
        closeRemoveDialog,
        openRemoveProjectDialog,
        closeRemoveProjectDialog,
        openRemoveApplicationDialog,
        closeRemoveApplicationDialog,
    };
}
