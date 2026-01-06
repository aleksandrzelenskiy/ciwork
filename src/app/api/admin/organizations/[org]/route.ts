import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import ApplicationModel from '@/server/models/ApplicationModel';
import BillingUsageModel from '@/server/models/BillingUsageModel';
import ChatConversationModel from '@/server/models/ChatConversationModel';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import IntegrationApiKeyModel from '@/server/models/IntegrationApiKeyModel';
import IntegrationModel from '@/server/models/IntegrationModel';
import MembershipModel from '@/server/models/MembershipModel';
import NotificationModel from '@/server/models/NotificationModel';
import Organization from '@/server/models/OrganizationModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import OrgWalletTransactionModel from '@/server/models/OrgWalletTransactionModel';
import ProjectModel from '@/server/models/ProjectModel';
import ReportDeletionLog from '@/server/models/ReportDeletionLog';
import ReportModel from '@/server/models/ReportModel';
import StorageBillingModel from '@/server/models/StorageBillingModel';
import StoragePackageModel from '@/server/models/StoragePackageModel';
import StorageUsageModel from '@/server/models/StorageUsageModel';
import SubscriptionModel from '@/server/models/SubscriptionModel';
import TaskDeletionLog from '@/server/models/TaskDeletionLog';
import TaskModel from '@/server/models/TaskModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DeleteResponse = { ok: true } | { error: string };

export async function DELETE(
    _request: Request,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<DeleteResponse>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { org: orgRaw } = await ctx.params;
    const orgSlug = orgRaw?.trim().toLowerCase();
    if (!orgSlug) {
        return NextResponse.json({ error: 'Org not specified' }, { status: 400 });
    }

    await dbConnect();
    const organization = await Organization.findOne({ orgSlug }).lean<{ _id: unknown }>();
    if (!organization?._id) {
        return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
    }

    const orgId = organization._id;

    await Promise.all([
        ApplicationModel.deleteMany({ orgId }),
        BillingUsageModel.deleteMany({ orgId }),
        ChatConversationModel.deleteMany({ orgId }),
        ChatMessageModel.deleteMany({ orgId }),
        IntegrationApiKeyModel.deleteMany({ orgId }),
        IntegrationModel.deleteMany({ orgId }),
        MembershipModel.deleteMany({ orgId }),
        NotificationModel.deleteMany({ orgId }),
        OrgWalletTransactionModel.deleteMany({ orgId }),
        OrgWalletModel.deleteMany({ orgId }),
        ProjectModel.deleteMany({ orgId }),
        ReportDeletionLog.deleteMany({ orgId }),
        ReportModel.deleteMany({ orgId }),
        StorageBillingModel.deleteMany({ orgId }),
        StoragePackageModel.deleteMany({ orgId }),
        StorageUsageModel.deleteMany({ orgId }),
        SubscriptionModel.deleteMany({ orgId }),
        TaskDeletionLog.deleteMany({ orgId }),
        TaskModel.deleteMany({ orgId }),
    ]);

    await Organization.deleteOne({ _id: orgId });

    return NextResponse.json({ ok: true });
}
