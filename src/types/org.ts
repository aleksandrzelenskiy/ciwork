export type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'requested';

export type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    profilePic?: string;
    role: OrgRole;
    status: MemberStatus;
    clerkId?: string;
    inviteToken?: string;
    inviteExpiresAt?: string;
    requestedAt?: string;
};

export type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    projectType?: 'construction' | 'installation' | 'document';
    managers?: string[];
    managerEmail?: string;
    regionCode: string;
    operator: string;
};

export type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

export type PlanConfig = {
    plan: Plan;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksMonthLimit: number | null;
    publicTasksMonthlyLimit: number | null;
};

export type SubscriptionInfo = {
    orgSlug: string;
    plan: Plan;
    status: SubscriptionStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksMonthLimit?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    graceUntil?: string | null;
    graceUsedAt?: string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: string;
};

export type SubscriptionBillingInfo = {
    isActive: boolean;
    readOnly: boolean;
    reason?: string;
    graceAvailable: boolean;
    graceUntil?: string | null;
    priceRubMonthly: number;
};

export type GetSubscriptionResponse = { subscription: SubscriptionInfo; billing: SubscriptionBillingInfo };
export type PatchSubscriptionResponse = {
    ok: true;
    subscription: SubscriptionInfo;
    billing: SubscriptionBillingInfo;
};
export type OrgWalletInfo = { balance: number; currency: string };
export type OrgWalletTx = {
    id: string;
    amount: number;
    type: string;
    source: string;
    balanceAfter: number;
    createdAt: string;
    meta?: Record<string, unknown>;
};

export type ApplicationRow = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    projectKey?: string;
    publicStatus?: string;
    visibility?: string;
    proposedBudget: number;
    contractorName?: string;
    contractorEmail?: string;
    status: string;
    createdAt?: string;
};

export type IntegrationDTO = {
    _id: string;
    type: string;
    name?: string;
    status: string;
    webhookUrl?: string;
    projectId?: string | null;
    createdAt?: string;
    updatedAt?: string;
};
