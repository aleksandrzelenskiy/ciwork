// src/app/api/admin/organizations/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Subscription from '@/server/models/SubscriptionModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import { GetUserContext } from '@/server-actions/user-context';
import { resolveEffectivePlanLimits, resolveEffectiveStorageLimit } from '@/utils/billingLimits';
import { getAllPlanConfigs } from '@/utils/planConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';
type Plan = 'basic' | 'pro' | 'business' | 'enterprise';

type AdminOrganizationDTO = {
    orgId: string;
    name: string;
    orgSlug: string;
    ownerEmail?: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksMonthLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    walletBalance?: number;
    walletCurrency?: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    note?: string;
    updatedAt?: string | null;
    createdAt?: string | null;
};

type ResponsePayload = {
    organizations: AdminOrganizationDTO[];
};

const toISOStringOrNull = (value?: Date | string | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

export async function GET(): Promise<NextResponse<ResponsePayload>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ organizations: [] }, { status: 403 });
    }

    await dbConnect();
    const organizations = await Organization.find({}, {
        name: 1,
        orgSlug: 1,
        ownerEmail: 1,
        createdAt: 1,
    }).lean();
    const orgIds = organizations.map((org) => org._id);
    const [subscriptions, planConfigs] = await Promise.all([
        Subscription.find({ orgId: { $in: orgIds } }).lean(),
        getAllPlanConfigs(),
    ]);
    const wallets = await OrgWalletModel.find({ orgId: { $in: orgIds } }).lean();
    const subscriptionMap = new Map<string, typeof subscriptions[number]>();
    subscriptions.forEach((subscription) => {
        if (subscription.orgId) {
            subscriptionMap.set(String(subscription.orgId), subscription);
        }
    });
    const planConfigMap = new Map(planConfigs.map((config) => [config.plan, config]));
    const fallbackPlanConfig = planConfigMap.get('basic') ?? planConfigs[0];
    const walletMap = new Map<string, typeof wallets[number]>();
    wallets.forEach((wallet) => {
        if (wallet.orgId) {
            walletMap.set(String(wallet.orgId), wallet);
        }
    });

    const result: AdminOrganizationDTO[] = organizations.map((org) => {
        const subscription = subscriptionMap.get(String(org._id));
        const wallet = walletMap.get(String(org._id));
        const plan = (subscription?.plan as Plan) ?? 'basic';
        const planConfig = planConfigMap.get(plan) ?? fallbackPlanConfig;
        const limits = planConfig
            ? resolveEffectivePlanLimits(plan, planConfig, {
                  seats: subscription?.seats,
                  projectsLimit: subscription?.projectsLimit,
                  publicTasksLimit: subscription?.publicTasksLimit,
                  tasksMonthLimit: subscription?.tasksMonthLimit,
              })
            : {
                  seats: subscription?.seats ?? null,
                  projects: subscription?.projectsLimit ?? null,
                  publications: subscription?.publicTasksLimit ?? null,
                  tasksMonth: subscription?.tasksMonthLimit ?? null,
              };
        const storageLimitGb = planConfig
            ? resolveEffectiveStorageLimit(plan, planConfig, subscription?.storageLimitGb)
            : subscription?.storageLimitGb ?? null;
        return {
            orgId: String(org._id),
            name: org.name,
            orgSlug: org.orgSlug,
            ownerEmail: org.ownerEmail,
            plan,
            status: (subscription?.status as SubStatus) ?? 'inactive',
            seats: limits.seats ?? undefined,
            projectsLimit: limits.projects ?? undefined,
            publicTasksLimit: limits.publications ?? undefined,
            tasksMonthLimit: limits.tasksMonth ?? undefined,
            boostCredits: subscription?.boostCredits,
            storageLimitGb: storageLimitGb ?? undefined,
            walletBalance: wallet?.balance ?? 0,
            walletCurrency: wallet?.currency ?? 'RUB',
            periodStart: toISOStringOrNull(subscription?.periodStart ?? null),
            periodEnd: toISOStringOrNull(subscription?.periodEnd ?? null),
            note: subscription?.note,
            updatedAt: toISOStringOrNull(subscription?.updatedAt ?? subscription?.createdAt ?? null),
            createdAt: toISOStringOrNull(org.createdAt ?? null),
        };
    });

    return NextResponse.json({ organizations: result });
}
