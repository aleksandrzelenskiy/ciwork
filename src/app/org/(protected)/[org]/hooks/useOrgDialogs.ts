import * as React from 'react';

import type { ApplicationRow, MemberDTO, ProjectDTO } from '@/types/org';

type UseOrgDialogsState = {
    projectsDialogOpen: boolean;
    membersDialogOpen: boolean;
    applicationsDialogOpen: boolean;
    plansDialogOpen: boolean;
    inviteOpen: boolean;
    roleDialogOpen: boolean;
    removeOpen: boolean;
    removeProjectOpen: boolean;
    removeApplicationOpen: boolean;
    memberToEditRole: MemberDTO | null;
    memberToRemove: MemberDTO | null;
    projectToRemove: ProjectDTO | null;
    applicationToRemove: ApplicationRow | null;
    inviteExistingEmails: string[];
    setProjectsDialogOpen: (open: boolean) => void;
    setMembersDialogOpen: (open: boolean) => void;
    setApplicationsDialogOpen: (open: boolean) => void;
    setPlansDialogOpen: (open: boolean) => void;
    setInviteOpen: (open: boolean) => void;
    setRoleDialogOpen: (open: boolean) => void;
    setRemoveOpen: (open: boolean) => void;
    setRemoveProjectOpen: (open: boolean) => void;
    setRemoveApplicationOpen: (open: boolean) => void;
    setMemberToEditRole: (member: MemberDTO | null) => void;
    setMemberToRemove: (member: MemberDTO | null) => void;
    setProjectToRemove: (project: ProjectDTO | null) => void;
    setApplicationToRemove: (application: ApplicationRow | null) => void;
    setInviteExistingEmails: (emails: string[]) => void;
    inviteCloseTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

export default function useOrgDialogs(): UseOrgDialogsState {
    const [projectsDialogOpen, setProjectsDialogOpen] = React.useState(false);
    const [membersDialogOpen, setMembersDialogOpen] = React.useState(false);
    const [applicationsDialogOpen, setApplicationsDialogOpen] = React.useState(false);
    const [plansDialogOpen, setPlansDialogOpen] = React.useState(false);
    const [inviteOpen, setInviteOpen] = React.useState(false);
    const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const [removeProjectOpen, setRemoveProjectOpen] = React.useState(false);
    const [removeApplicationOpen, setRemoveApplicationOpen] = React.useState(false);
    const [memberToEditRole, setMemberToEditRole] = React.useState<MemberDTO | null>(null);
    const [memberToRemove, setMemberToRemove] = React.useState<MemberDTO | null>(null);
    const [projectToRemove, setProjectToRemove] = React.useState<ProjectDTO | null>(null);
    const [applicationToRemove, setApplicationToRemove] = React.useState<ApplicationRow | null>(null);
    const [inviteExistingEmails, setInviteExistingEmails] = React.useState<string[]>([]);
    const inviteCloseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    return {
        projectsDialogOpen,
        membersDialogOpen,
        applicationsDialogOpen,
        plansDialogOpen,
        inviteOpen,
        roleDialogOpen,
        removeOpen,
        removeProjectOpen,
        removeApplicationOpen,
        memberToEditRole,
        memberToRemove,
        projectToRemove,
        applicationToRemove,
        inviteExistingEmails,
        setProjectsDialogOpen,
        setMembersDialogOpen,
        setApplicationsDialogOpen,
        setPlansDialogOpen,
        setInviteOpen,
        setRoleDialogOpen,
        setRemoveOpen,
        setRemoveProjectOpen,
        setRemoveApplicationOpen,
        setMemberToEditRole,
        setMemberToRemove,
        setProjectToRemove,
        setApplicationToRemove,
        setInviteExistingEmails,
        inviteCloseTimeoutRef,
    };
}
