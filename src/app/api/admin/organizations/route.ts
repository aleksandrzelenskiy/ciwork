// src/app/api/admin/organizations/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Subscription from '@/server/models/SubscriptionModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import MembershipModel from '@/server/models/MembershipModel';
import ProjectModel from '@/server/models/ProjectModel';
import BillingUsageModel from '@/server/models/BillingUsageModel';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { getBillingPeriod, resolveEffectivePlanLimits, resolveEffectiveStorageLimit } from '@/utils/billingLimits';
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
    companyProfile?: {
        plan?: Plan;
        legalForm?: 'ООО' | 'ИП' | 'АО' | 'ЗАО';
        organizationName?: string;
        legalAddress?: string;
        inn?: string;
        kpp?: string;
        ogrn?: string;
        okpo?: string;
        bik?: string;
        bankName?: string;
        correspondentAccount?: string;
        settlementAccount?: string;
        directorTitle?: string;
        directorName?: string;
        directorBasis?: string;
        contacts?: string;
    };
    usage?: {
        seatsUsed: number;
        projectsUsed: number;
        publicationsUsed: number;
        tasksUsed: number;
        period: string;
    };
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
        companyProfile: 1,
        createdAt: 1,
    }).lean();
    const orgIds = organizations.map((org) => org._id);
    const now = new Date();
    const billingPeriod = getBillingPeriod(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [subscriptions, planConfigs] = await Promise.all([
        Subscription.find({ orgId: { $in: orgIds } }).lean(),
        getAllPlanConfigs(),
    ]);
    const [wallets, activeSeats, projects, usages, tasksByMonth] = await Promise.all([
        OrgWalletModel.find({ orgId: { $in: orgIds } }).lean(),
        MembershipModel.aggregate<{ _id: unknown; count: number }>([
            { $match: { orgId: { $in: orgIds }, status: 'active' } },
            { $group: { _id: '$orgId', count: { $sum: 1 } } },
        ]),
        ProjectModel.aggregate<{ _id: unknown; count: number }>([
            { $match: { orgId: { $in: orgIds } } },
            { $group: { _id: '$orgId', count: { $sum: 1 } } },
        ]),
        BillingUsageModel.find({ orgId: { $in: orgIds }, period: billingPeriod }).lean(),
        TaskModel.aggregate<{ _id: unknown; count: number }>([
            {
                $match: {
                    orgId: { $in: orgIds },
                    createdAt: {
                        $gte: monthStart,
                        $lt: monthEnd,
                    },
                },
            },
            { $group: { _id: '$orgId', count: { $sum: 1 } } },
        ]),
    ]);
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

    const activeSeatsMap = new Map(activeSeats.map((item) => [String(item._id), item.count]));
    const projectsMap = new Map(projects.map((item) => [String(item._id), item.count]));
    const usageMap = new Map<string, typeof usages[number]>();
    usages.forEach((usage) => {
        if (usage.orgId) {
            usageMap.set(String(usage.orgId), usage);
        }
    });
    const tasksMonthMap = new Map(tasksByMonth.map((item) => [String(item._id), item.count]));

    const result: AdminOrganizationDTO[] = organizations.map((org) => {
        const subscription = subscriptionMap.get(String(org._id));
        const wallet = walletMap.get(String(org._id));
        const usage = usageMap.get(String(org._id));
        const monthTasks = tasksMonthMap.get(String(org._id)) ?? 0;
        const snapshotTasks = usage?.tasksUsed ?? 0;
        const tasksUsed = Math.max(snapshotTasks, monthTasks);
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
            companyProfile: org.companyProfile,
            usage: {
                seatsUsed: activeSeatsMap.get(String(org._id)) ?? 0,
                projectsUsed: projectsMap.get(String(org._id)) ?? usage?.projectsUsed ?? 0,
                publicationsUsed: usage?.publicationsUsed ?? 0,
                tasksUsed,
                period: billingPeriod,
            },
        };
    });

    return NextResponse.json({ organizations: result });
}
