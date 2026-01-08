import * as React from 'react';

type UseOrgRefreshArgs = {
    canManage: boolean;
    fetchMembers: () => Promise<void>;
    fetchProjects: () => Promise<void>;
    fetchOrgSettings: () => Promise<void>;
    loadSubscription: () => Promise<void>;
    fetchApplications: () => Promise<void>;
    fetchWalletInfo: () => Promise<void>;
    fetchWalletTransactions: () => Promise<void>;
    loadPlanConfigs: () => Promise<void>;
    fetchIntegrations: () => Promise<void>;
};

type UseOrgRefreshState = {
    refreshAll: () => void;
};

export default function useOrgRefresh({
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
}: UseOrgRefreshArgs): UseOrgRefreshState {
    React.useEffect(() => {
        if (!canManage) return;
        void fetchMembers();
        void fetchProjects();
        void fetchOrgSettings();
        void loadSubscription();
        void fetchApplications();
        void fetchWalletInfo();
        void fetchWalletTransactions();
        void loadPlanConfigs();
        void fetchIntegrations();
    }, [
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
    ]);

    const refreshAll = React.useCallback(() => {
        void fetchMembers();
        void fetchProjects();
        void loadSubscription();
        void fetchApplications();
        void fetchWalletInfo();
        void fetchWalletTransactions();
        void fetchIntegrations();
    }, [
        fetchMembers,
        fetchProjects,
        loadSubscription,
        fetchApplications,
        fetchWalletInfo,
        fetchWalletTransactions,
        fetchIntegrations,
    ]);

    return { refreshAll };
}
