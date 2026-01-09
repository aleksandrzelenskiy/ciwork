// src/app/org/[org]/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Box, Stack,
    Snackbar, Alert, Typography,
    CircularProgress,
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import { useTheme } from '@mui/material/styles';

import ProjectDialog from '@/app/workspace/components/ProjectDialog';
import OrgSetDialog, {
    OrgSettingsFormValues,
} from '@/app/workspace/components/OrgSetDialog';
import { resolveRegionCode } from '@/app/utils/regions';
import OrgWalletTransactionsDialog from '@/features/org/OrgWalletTransactionsDialog';
import OrgStorageUsageCard from '@/features/org/OrgStorageUsageCard';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';
import ProjectsDialog from '@/app/org/(protected)/[org]/components/ProjectsDialog';
import MembersDialog from '@/app/org/(protected)/[org]/components/MembersDialog';
import ApplicationsDialog from '@/app/org/(protected)/[org]/components/ApplicationsDialog';
import InviteMemberDialog from '@/app/org/(protected)/[org]/components/InviteMemberDialog';
import MemberRoleDialog from '@/app/org/(protected)/[org]/components/MemberRoleDialog';
import ConfirmDialog from '@/app/org/(protected)/[org]/components/ConfirmDialog';
import IntegrationDialog from '@/app/org/(protected)/[org]/components/IntegrationDialog';
import IntegrationSecretDialog from '@/app/org/(protected)/[org]/components/IntegrationSecretDialog';
import IntegrationKeyDialog from '@/app/org/(protected)/[org]/components/IntegrationKeyDialog';
import OrgPlansDialog from '@/app/org/(protected)/[org]/components/OrgPlansDialog';
import OrgOverviewPanel from '@/app/org/(protected)/[org]/components/OrgOverviewPanel';
import OrgNotificationsCard from '@/app/org/(protected)/[org]/components/OrgNotificationsCard';
import OrgWalletCard from '@/app/org/(protected)/[org]/components/OrgWalletCard';
import OrgProjectsCard from '@/app/org/(protected)/[org]/components/OrgProjectsCard';
import OrgIntegrationsCard from '@/app/org/(protected)/[org]/components/OrgIntegrationsCard';
import OrgMembersCard from '@/app/org/(protected)/[org]/components/OrgMembersCard';
import OrgApplicationsCard from '@/app/org/(protected)/[org]/components/OrgApplicationsCard';
import useOrgAccess from '@/app/org/(protected)/[org]/hooks/useOrgAccess';
import useFrontendBase from '@/app/org/(protected)/[org]/hooks/useFrontendBase';
import useMembers from '@/app/org/(protected)/[org]/hooks/useMembers';
import useProjects from '@/app/org/(protected)/[org]/hooks/useProjects';
import useApplications from '@/app/org/(protected)/[org]/hooks/useApplications';
import useWallet from '@/app/org/(protected)/[org]/hooks/useWallet';
import useIntegrations from '@/app/org/(protected)/[org]/hooks/useIntegrations';
import useSubscription from '@/app/org/(protected)/[org]/hooks/useSubscription';
import useOrgSettings from '@/app/org/(protected)/[org]/hooks/useOrgSettings';
import useIntegrationManager from '@/app/org/(protected)/[org]/hooks/useIntegrationManager';
import useSubscriptionActions from '@/app/org/(protected)/[org]/hooks/useSubscriptionActions';
import useOrgMutations from '@/app/org/(protected)/[org]/hooks/useOrgMutations';
import useProjectDialog from '@/app/org/(protected)/[org]/hooks/useProjectDialog';
import useCurrentUser from '@/app/org/(protected)/[org]/hooks/useCurrentUser';
import useOrgDerivedState from '@/app/org/(protected)/[org]/hooks/useOrgDerivedState';
import useOrgRefresh from '@/app/org/(protected)/[org]/hooks/useOrgRefresh';
import useOrgNavigation from '@/app/org/(protected)/[org]/hooks/useOrgNavigation';
import useOrgDialogs from '@/app/org/(protected)/[org]/hooks/useOrgDialogs';
import useInviteListener from '@/app/org/(protected)/[org]/hooks/useInviteListener';
import useInviteActions from '@/app/org/(protected)/[org]/hooks/useInviteActions';
import useOrgDialogActions from '@/app/org/(protected)/[org]/hooks/useOrgDialogActions';
import useMemberRoleDialog from '@/app/org/(protected)/[org]/hooks/useMemberRoleDialog';
import type {
    OrgRole,
} from '@/types/org';
import {
    integrationTypeLabel,
} from '@/utils/org';

type SnackState = { open: boolean; msg: string; sev: 'success' | 'error' | 'info' };

export default function OrgSettingsPage() {
    const params = useParams<{ org: string }>();
    const org = params?.org;

    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const { myRole, orgName, accessChecked } = useOrgAccess(org);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    // snackbar
    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

    const {
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
    } = useOrgDialogs();

    const { newRole, setNewRole, openRoleDialog } = useMemberRoleDialog(
        setMemberToEditRole,
        setRoleDialogOpen
    );

    const {
        orgSettingsOpen,
        orgSettingsData,
        orgSettingsLoading,
        orgSettingsError,
        orgSettingsSaving,
        setOrgSettingsOpen,
        fetchOrgSettings,
        saveOrgSettings,
    } = useOrgSettings(org);
    const {
        subscription,
        billing,
        subscriptionLoading,
        subscriptionError,
        planConfigs,
        loadSubscription,
        loadPlanConfigs,
        setSubscription,
        setBilling,
        setSubscriptionError,
    } = useSubscription(org, canManage);
    const {
        walletInfo,
        walletLoading,
        walletError,
        walletDialogOpen,
        walletTx,
        walletTxLoading,
        walletTxError,
        setWalletDialogOpen,
        fetchWalletInfo,
        fetchWalletTransactions,
    } = useWallet(org);
    const {
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
    } = useMembers(org, canManage, setSnack);

    const frontendBase = useFrontendBase();

    const {
        projects,
        projectsLoading,
        projectPreview,
        activeProjectsCount,
        projectNameById,
        fetchProjects,
    } = useProjects(org, canManage, setSnack);

    const {
        applications,
        applicationsLoading,
        applicationsError,
        applicationsPreview,
        fetchApplications,
    } = useApplications(org, canManage);

    const {
        integrations,
        integrationsLoading,
        integrationsError,
        fetchIntegrations,
    } = useIntegrations(org, canManage);

    const { isSuperAdmin } = useCurrentUser();

    const {
        updateMemberRole,
        removeMember,
        removeProject,
        removeApplication,
    } = useOrgMutations({
        org,
        canManage,
        setSnack,
        refreshMembers: fetchMembers,
        refreshProjects: fetchProjects,
        refreshApplications: fetchApplications,
    });

    const [removingApplication, setRemovingApplication] = React.useState(false);

    const [removing, setRemoving] = React.useState(false);
    const [removingProject, setRemovingProject] = React.useState(false);

    const {
        openRemoveDialog,
        closeRemoveDialog,
        openRemoveProjectDialog,
        closeRemoveProjectDialog,
        openRemoveApplicationDialog,
        closeRemoveApplicationDialog,
    } = useOrgDialogActions({
        removing,
        removingProject,
        removingApplication,
        setRemoveOpen,
        setMemberToRemove,
        setRemoveProjectOpen,
        setProjectToRemove,
        setRemoveApplicationOpen,
        setApplicationToRemove,
    });

    const confirmRemoveApplication = async () => {
        if (!org || !applicationToRemove?._id || !canManage) return;
        setRemovingApplication(true);
        try {
            const ok = await removeApplication(applicationToRemove._id);
            if (ok) {
                closeRemoveApplicationDialog();
            }
        } finally {
            setRemovingApplication(false);
        }
    };


    useInviteListener({
        fetchMembers,
        setInviteOpen,
        inviteCloseTimeoutRef,
    });

    const confirmRemove = async () => {
        if (!org || !memberToRemove?._id || !canManage) return;
        setRemoving(true);
        try {
            const ok = await removeMember(memberToRemove._id);
            if (ok) {
                closeRemoveDialog();
            }
        } finally {
            setRemoving(false);
        }
    };

    const confirmRemoveProject = async () => {
        const projectRef = projectToRemove?.key || projectToRemove?._id;
        if (!org || !projectRef || !canManage) return;
        setRemovingProject(true);
        try {
            const ok = await removeProject(projectRef);
            if (ok) {
                closeRemoveProjectDialog();
            }
        } finally {
            setRemovingProject(false);
        }
    };

    const {
        startTrialLoading,
        startTrial,
        activateGrace,
    } = useSubscriptionActions({
        org,
        setSubscription,
        setBilling,
        setSubscriptionError,
        setSnack,
    });

    const { goToProjectsPage, goToProjectTasks, goToTaskDetails } = useOrgNavigation({
        org,
        onError: (message) => setSnack({ open: true, msg: message, sev: 'error' }),
    });

    const handleOrgSettingsSubmit = async (values: OrgSettingsFormValues) => {
        const result = await saveOrgSettings(values);
        if (result.ok) {
            setOrgSettingsOpen(false);
            setSnack({ open: true, msg: 'Настройки организации обновлены', sev: 'success' });
        } else {
            setSnack({ open: true, msg: result.error || 'Не удалось сохранить реквизиты', sev: 'error' });
        }
    };


    const handleRoleDialogSave = async () => {
        if (!org || !memberToEditRole?._id) return;
        const ok = await updateMemberRole(memberToEditRole._id, newRole);
        if (ok) {
            setRoleDialogOpen(false);
            setMemberToEditRole(null);
        }
    };

    const theme = useTheme();
    const {
        isDarkMode,
        surfaceRadius,
        buttonRadius,
        iconRadius,
        headerBorder,
        cardBg,
        cardBorder,
        cardShadow,
        textPrimary,
        textSecondary,
        iconBorderColor,
        iconBg,
        iconHoverBg,
        iconShadow,
        disabledIconColor,
        pageWrapperSx,
        panelPadding,
        panelBaseSx,
        statCardSx,
        actionButtonBaseSx,
        getAlertSx,
        cardBaseSx,
        masonryCardSx,
        cardHeaderSx,
        cardContentSx,
        contentContainerSx,
        masonrySpacing,
        masonrySx,
    } = getOrgPageStyles(theme);
    const dialogPaperSx = {
        backdropFilter: 'blur(24px)',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        borderRadius: surfaceRadius,
    };
    const dialogActionsSx = {
        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
        borderTop: `1px solid ${cardBorder}`,
        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
    };
    const dialogContentBg = (cardContentSx as { backgroundColor?: string }).backgroundColor;
    const renderStatusPanel = (content: React.ReactNode) => (
        <Box sx={pageWrapperSx}>
            <Box sx={{ ...contentContainerSx, maxWidth: 720 }}>
                <Box sx={panelBaseSx}>
                    <Box sx={{ px: panelPadding }}>{content}</Box>
                </Box>
            </Box>
        </Box>
    );

    const {
        isTrialActive,
        isTrialExpired,
        isOwnerOrAdmin,
        canStartTrial,
        isSubscriptionActive,
        formattedTrialEnd,
        trialDaysLeft,
        disableCreationActions,
        creationTooltip,
        inviteTooltip,
        projectsLimitLabel,
        seatsLabel,
        subscriptionStatusLabel,
        subscriptionStatusColor,
        subscriptionStatusDescription,
        roleLabelRu,
        formatExpire,
        canEditOrgSettings,
        canRequestIntegrations,
        settingsTooltip,
        integrationRequestTooltip,
        integrationKeyTooltip,
    } = useOrgDerivedState({
        subscription,
        billing,
        subscriptionLoading,
        planConfigs,
        myRole,
        textSecondary,
    });
    const showNotificationsCard = Boolean(walletError || orgSettingsError);
    const settingsButtonDisabled = orgSettingsLoading || !canEditOrgSettings;
    const integrationKeyTooltipLabel = integrationKeyTooltip(isSuperAdmin);

    // первичная загрузка
    const { refreshAll } = useOrgRefresh({
        canManage,
        fetchMembers,
        fetchProjects,
        fetchOrgSettings,
        loadSubscription,
        fetchApplications,
        fetchWalletInfo,
        fetchWalletTransactions,
        loadPlanConfigs,
        fetchIntegrations,
    });
    const { openInviteDialog } = useInviteActions({
        members,
        disableCreationActions,
        setInviteExistingEmails,
        setInviteOpen,
    });

    const {
        integrationDialogOpen,
        integrationSubmitting,
        integrationDialogMode,
        integrationType,
        integrationName,
        integrationWebhookUrl,
        integrationProjectId,
        integrationConfigJson,
        integrationToDelete,
        integrationDeleting,
        integrationSecretDialogOpen,
        integrationWebhookSecret,
        integrationKeyDialogOpen,
        generatedKeyId,
        generatedKeySecret,
        setIntegrationDialogOpen,
        setIntegrationToDelete,
        openIntegrationDialog,
        openEditIntegrationDialog,
        submitIntegrationRequest,
        toggleIntegrationStatus,
        confirmDeleteIntegration,
        generateIntegrationKey,
        setIntegrationType,
        setIntegrationName,
        setIntegrationWebhookUrl,
        setIntegrationProjectId,
        setIntegrationConfigJson,
        setIntegrationSecretDialogOpen,
        setIntegrationKeyDialogOpen,
    } = useIntegrationManager(org, canRequestIntegrations, isSuperAdmin, setSnack, fetchIntegrations);

    const {
        projectDialogOpen,
        projectDialogMode,
        projectDialogLoading,
        projectToEdit,
        openProjectDialog,
        closeProjectDialog,
        submitProjectDialog,
    } = useProjectDialog({
        org,
        subscriptionLoading,
        isSubscriptionActive,
        setSnack,
        refreshProjects: fetchProjects,
    });

    const membersPreview = members.slice(0, 3);
    if (!accessChecked) {
        return renderStatusPanel(
            <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography color={textPrimary}>Проверяем доступ…</Typography>
            </Stack>
        );
    }

    if (!canManage) {
        return renderStatusPanel(
            <Alert severity="error" sx={getAlertSx('error')}>
                Недостаточно прав для просмотра страницы настроек организации.
            </Alert>
        );
    }

    return (
        <Box sx={pageWrapperSx}>
                <Box
                    sx={{
                        ...contentContainerSx,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                    }}
                >
                <OrgOverviewPanel
                    orgName={orgName}
                    orgSlug={org}
                    settingsTooltip={settingsTooltip}
                    settingsButtonDisabled={settingsButtonDisabled}
                    canEditOrgSettings={canEditOrgSettings}
                    onOpenOrgSettings={() => setOrgSettingsOpen(true)}
                    onGoToProjects={goToProjectsPage}
                    onInvite={openInviteDialog}
                    disableCreationActions={disableCreationActions}
                    inviteTooltip={inviteTooltip}
                    actionButtonBaseSx={actionButtonBaseSx}
                    panelBaseSx={panelBaseSx}
                    panelPadding={panelPadding}
                    statCardSx={statCardSx}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    headerBorder={headerBorder}
                    iconBorderColor={iconBorderColor}
                    iconBg={iconBg}
                    iconHoverBg={iconHoverBg}
                    iconShadow={iconShadow}
                    disabledIconColor={disabledIconColor}
                    iconRadius={iconRadius}
                    isDarkMode={isDarkMode}
                    activeProjectsCount={activeProjectsCount}
                    projectsLimitLabel={projectsLimitLabel}
                    activeMembersCount={activeMembersCount}
                    seatsLabel={seatsLabel}
                    subscriptionStatusLabel={subscriptionStatusLabel}
                    subscriptionStatusColor={subscriptionStatusColor}
                    subscriptionStatusDescription={subscriptionStatusDescription}
                    roleLabelRu={roleLabelRu}
                    onOpenPlansDialog={() => setPlansDialogOpen(true)}
                    subscriptionError={subscriptionError}
                    subscriptionLoading={subscriptionLoading}
                    billingReadOnly={Boolean(billing?.readOnly)}
                    billingReason={billing?.reason}
                    billingGraceAvailable={Boolean(billing?.graceAvailable)}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    onActivateGrace={() => activateGrace(isOwnerOrAdmin)}
                    isSubscriptionActive={isSubscriptionActive}
                    isTrialExpired={isTrialExpired}
                    formattedTrialEnd={formattedTrialEnd}
                    canStartTrial={canStartTrial}
                    startTrialLoading={startTrialLoading}
                    onStartTrial={() => startTrial(canStartTrial)}
                    trialDaysLeft={trialDaysLeft}
                    isTrialActive={isTrialActive}
                    getAlertSx={getAlertSx}
                />

                <Masonry
                    columns={{ xs: 1, sm: 1, md: 2, lg: 3, xl: 3 }}
                    spacing={masonrySpacing}
                    sx={masonrySx}
                >
                        {showNotificationsCard && (
                            <OrgNotificationsCard
                                walletError={walletError}
                                orgSettingsError={orgSettingsError}
                                onRetryOrgSettings={() => void fetchOrgSettings()}
                                orgSettingsLoading={orgSettingsLoading}
                                masonryCardSx={masonryCardSx}
                                getAlertSx={getAlertSx}
                                buttonRadius={buttonRadius}
                            />
                        )}

                        {org && (
                            <OrgStorageUsageCard
                                orgSlug={org}
                                cardSx={masonryCardSx}
                                cardHeaderSx={cardHeaderSx}
                                cardContentSx={cardContentSx}
                            />
                        )}

                        <OrgWalletCard
                            walletLoading={walletLoading}
                            walletInfo={walletInfo}
                            walletTxLoading={walletTxLoading}
                            walletTxError={walletTxError}
                            walletTx={walletTx}
                            onOpenHistory={() => {
                                setWalletDialogOpen(true);
                                void fetchWalletTransactions();
                            }}
                            masonryCardSx={masonryCardSx}
                            textSecondary={textSecondary}
                            buttonRadius={buttonRadius}
                        />

                        <OrgProjectsCard
                            projectsLoading={projectsLoading}
                            projectPreview={projectPreview}
                            activeProjectsCount={activeProjectsCount}
                            projectsLimitLabel={projectsLimitLabel}
                            onOpenDialog={() => setProjectsDialogOpen(true)}
                            onGoToProjects={goToProjectsPage}
                            onCreateProject={() => openProjectDialog()}
                            onOpenProjectTasks={(project) => goToProjectTasks(project._id)}
                            disableCreationActions={disableCreationActions}
                            creationTooltip={creationTooltip}
                            masonryCardSx={masonryCardSx}
                            cardBorder={cardBorder}
                            isDarkMode={isDarkMode}
                            textSecondary={textSecondary}
                            buttonRadius={buttonRadius}
                        />

                        <OrgIntegrationsCard
                            integrations={integrations}
                            integrationsLoading={integrationsLoading}
                            integrationsError={integrationsError}
                            projectNameById={projectNameById}
                            canRequestIntegrations={canRequestIntegrations}
                            integrationRequestTooltip={integrationRequestTooltip}
                            integrationKeyTooltip={integrationKeyTooltipLabel}
                            isSuperAdmin={isSuperAdmin}
                            onRefresh={() => void fetchIntegrations()}
                            onOpenDialog={openIntegrationDialog}
                            onGenerateKey={generateIntegrationKey}
                            onToggleStatus={(integration) => void toggleIntegrationStatus(integration)}
                            onEditIntegration={openEditIntegrationDialog}
                            onDeleteIntegration={setIntegrationToDelete}
                            masonryCardSx={masonryCardSx}
                            cardBorder={cardBorder}
                            isDarkMode={isDarkMode}
                            textSecondary={textSecondary}
                            getAlertSx={getAlertSx}
                            buttonRadius={buttonRadius}
                        />

                        <OrgMembersCard
                            loading={loading}
                            membersPreview={membersPreview}
                            activeMembersCount={activeMembersCount}
                            invitedMembersCount={invitedMembersCount}
                            onOpenDialog={() => setMembersDialogOpen(true)}
                            onInvite={openInviteDialog}
                            inviteTooltip={inviteTooltip}
                            disableCreationActions={disableCreationActions}
                            masonryCardSx={masonryCardSx}
                            cardBorder={cardBorder}
                            isDarkMode={isDarkMode}
                            textSecondary={textSecondary}
                            buttonRadius={buttonRadius}
                        />

                        <OrgApplicationsCard
                            applicationsLoading={applicationsLoading}
                            applicationsPreview={applicationsPreview}
                            applicationsCount={applications.length}
                            onOpenDialog={() => setApplicationsDialogOpen(true)}
                            onRefresh={() => void fetchApplications()}
                            masonryCardSx={masonryCardSx}
                            cardBorder={cardBorder}
                            isDarkMode={isDarkMode}
                            textSecondary={textSecondary}
                            buttonRadius={buttonRadius}
                        />
                </Masonry>
            </Box>

            <OrgPlansDialog
                open={plansDialogOpen}
                orgSlug={org}
                onClose={() => setPlansDialogOpen(false)}
            />

            {/* Диалоги таблиц */}
            <ProjectsDialog
                open={projectsDialogOpen}
                onClose={() => setProjectsDialogOpen(false)}
                projects={projects}
                projectsLoading={projectsLoading}
                disableCreationActions={disableCreationActions}
                creationTooltip={creationTooltip}
                onOpenProjectDialog={openProjectDialog}
                onRemoveProject={openRemoveProjectDialog}
                onGoToProjects={goToProjectsPage}
                onRefresh={refreshAll}
                onProjectNavigate={goToProjectTasks}
                memberByEmail={memberByEmail}
                cardBaseSx={cardBaseSx}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
                dialogContentBg={dialogContentBg}
            />

            <MembersDialog
                open={membersDialogOpen}
                onClose={() => setMembersDialogOpen(false)}
                members={members}
                filteredMembers={filteredMembers}
                loading={loading}
                showMemberSearch={showMemberSearch}
                memberSearch={memberSearch}
                onToggleSearch={() => setShowMemberSearch((prev) => !prev)}
                onSearchChange={setMemberSearch}
                onClearSearch={() => {
                    setMemberSearch('');
                    setShowMemberSearch(false);
                }}
                inviteTooltip={inviteTooltip}
                disableCreationActions={disableCreationActions}
                onInvite={openInviteDialog}
                onRefresh={refreshAll}
                orgSlug={orgName || org}
                frontendBase={frontendBase}
                formatExpire={formatExpire}
                onEditRole={openRoleDialog}
                onRemoveMember={openRemoveDialog}
                onInviteLinkCopied={() => setSnack({ open: true, msg: 'Ссылка скопирована', sev: 'info' })}
                cardBaseSx={cardBaseSx}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
                dialogContentBg={dialogContentBg}
            />

            <ApplicationsDialog
                open={applicationsDialogOpen}
                onClose={() => setApplicationsDialogOpen(false)}
                applications={applications}
                loading={applicationsLoading}
                error={applicationsError}
                onRefresh={() => void fetchApplications()}
                onOpenTask={(application) => goToTaskDetails(application.projectKey, application.taskId)}
                onRemoveApplication={openRemoveApplicationDialog}
                removingApplication={removingApplication}
                cardBaseSx={cardBaseSx}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
                dialogContentBg={dialogContentBg}
                alertSx={getAlertSx('warning')}
            />

            {/* Диалог добавления участника */}
            <InviteMemberDialog
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                orgSlug={org}
                existingEmails={inviteExistingEmails}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            <ProjectDialog
                open={projectDialogOpen}
                mode={projectDialogMode}
                loading={projectDialogLoading}
                members={managerOptions}
                onClose={closeProjectDialog}
                onSubmit={submitProjectDialog}
                initialData={
                    projectDialogMode === 'edit' && projectToEdit
                        ? {
                              projectId: projectToEdit._id,
                              name: projectToEdit.name,
                              key: projectToEdit.key,
                              description: projectToEdit.description ?? '',
                              regionCode: resolveRegionCode(projectToEdit.regionCode),
                              operator: projectToEdit.operator,
                              managers: projectToEdit.managers ?? [],
                          }
                        : undefined
                }
            />

            {/* Диалог изменения роли участника */}
            <MemberRoleDialog
                open={roleDialogOpen}
                onClose={() => setRoleDialogOpen(false)}
                member={memberToEditRole}
                value={newRole}
                onChange={setNewRole}
                onSave={handleRoleDialogSave}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            {/* Диалог удаления участника */}
            <ConfirmDialog
                open={removeOpen}
                onClose={closeRemoveDialog}
                onConfirm={confirmRemove}
                title="Удалить участника?"
                description={
                    <>
                        Вы действительно хотите удалить участника{' '}
                        <b>{memberToRemove?.userName || memberToRemove?.userEmail}</b>{' '}
                        из организации? Доступ пользователя {memberToRemove?.userName || memberToRemove?.userEmail} к
                        проектам будет утерян.
                    </>
                }
                confirmLabel={removing ? 'Удаляем…' : 'Удалить'}
                confirmColor="error"
                loading={removing}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            {/* Диалог удаления проекта */}
            <ConfirmDialog
                open={removeProjectOpen}
                onClose={closeRemoveProjectDialog}
                onConfirm={confirmRemoveProject}
                title="Удалить проект?"
                description={
                    <>
                        Вы действительно хотите удалить проект{' '}
                        <b>{projectToRemove?.name || projectToRemove?.key}</b>?
                    </>
                }
                confirmLabel={removingProject ? 'Удаляем…' : 'Удалить'}
                confirmColor="error"
                loading={removingProject}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            {/* Диалог удаления отклика */}
            <ConfirmDialog
                open={removeApplicationOpen}
                onClose={closeRemoveApplicationDialog}
                onConfirm={confirmRemoveApplication}
                title="Удалить отклик?"
                description={
                    <>
                        Вы уверены, что хотите удалить отклик на задачу{' '}
                        <b>{applicationToRemove?.taskName || 'Задача'}</b>{' '}
                        от кандидата {applicationToRemove?.contractorName || applicationToRemove?.contractorEmail || 'без имени'}?
                    </>
                }
                confirmLabel={removingApplication ? 'Удаляем…' : 'Удалить'}
                confirmColor="error"
                loading={removingApplication}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            <OrgWalletTransactionsDialog
                open={walletDialogOpen}
                onClose={() => setWalletDialogOpen(false)}
                loading={walletTxLoading}
                error={walletTxError}
                transactions={walletTx}
            />

            <IntegrationDialog
                open={integrationDialogOpen}
                onClose={() => setIntegrationDialogOpen(false)}
                mode={integrationDialogMode}
                submitting={integrationSubmitting}
                canRequestIntegrations={canRequestIntegrations}
                integrationType={integrationType}
                integrationName={integrationName}
                integrationWebhookUrl={integrationWebhookUrl}
                integrationProjectId={integrationProjectId}
                integrationConfigJson={integrationConfigJson}
                projects={projects}
                onSubmit={submitIntegrationRequest}
                onChangeType={setIntegrationType}
                onChangeName={setIntegrationName}
                onChangeWebhookUrl={setIntegrationWebhookUrl}
                onChangeProjectId={setIntegrationProjectId}
                onChangeConfigJson={setIntegrationConfigJson}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            <IntegrationSecretDialog
                open={integrationSecretDialogOpen}
                onClose={() => setIntegrationSecretDialogOpen(false)}
                webhookSecret={integrationWebhookSecret}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
                alertSx={getAlertSx('warning')}
            />

            <IntegrationKeyDialog
                open={integrationKeyDialogOpen}
                onClose={() => setIntegrationKeyDialogOpen(false)}
                keyId={generatedKeyId}
                keySecret={generatedKeySecret}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
                alertSx={getAlertSx('warning')}
            />

            <ConfirmDialog
                open={Boolean(integrationToDelete)}
                onClose={() => setIntegrationToDelete(null)}
                onConfirm={confirmDeleteIntegration}
                title="Удалить интеграцию?"
                description={
                    <>
                        Удалить интеграцию{' '}
                        <b>
                            {integrationToDelete?.name ||
                                (integrationToDelete ? integrationTypeLabel(integrationToDelete.type) : 'интеграцию')}
                        </b>
                        ? Подключение будет остановлено.
                    </>
                }
                confirmLabel={integrationDeleting ? 'Удаляем…' : 'Удалить'}
                confirmColor="error"
                loading={integrationDeleting}
                cardHeaderSx={cardHeaderSx}
                cardContentSx={cardContentSx}
                dialogPaperSx={dialogPaperSx}
                dialogActionsSx={dialogActionsSx}
            />

            <OrgSetDialog
                open={orgSettingsOpen}
                loading={orgSettingsSaving}
                initialValues={orgSettingsData}
                onCloseAction={() => setOrgSettingsOpen(false)}
                onSubmit={handleOrgSettingsSubmit}
            />

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.sev} variant="filled">
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
