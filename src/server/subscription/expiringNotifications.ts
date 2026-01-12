import 'server-only';

import Subscription from '@/server/models/SubscriptionModel';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';
import UserModel from '@/server/models/UserModel';
import NotificationModel from '@/server/models/NotificationModel';
import { createNotification } from '@/server/notifications/service';
import { DAY_MS } from '@/utils/org';

const NOTIFY_DAYS = [7, 1];
const RECIPIENT_ROLES = ['owner', 'org_admin'] as const;

type NotifySummary = {
    scanned: number;
    notified: number;
};

const formatDaysLabel = (days: number) => {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14)) return 'дня';
    return 'дней';
};

export async function notifyExpiringSubscriptions(now: Date = new Date()): Promise<NotifySummary> {
    const maxDays = Math.max(...NOTIFY_DAYS);
    const windowEnd = new Date(now.getTime() + maxDays * DAY_MS);

    const subscriptions = await Subscription.find({
        status: { $in: ['active', 'trial'] },
        periodEnd: { $gte: now, $lte: windowEnd },
    }).lean();

    let notified = 0;

    for (const subscription of subscriptions) {
        if (!subscription.orgId || !subscription.periodEnd) continue;
        const periodEnd = subscription.periodEnd instanceof Date
            ? subscription.periodEnd
            : new Date(subscription.periodEnd);
        if (Number.isNaN(periodEnd.getTime())) continue;
        if (periodEnd.getTime() <= now.getTime()) continue;

        const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS);
        if (!NOTIFY_DAYS.includes(daysLeft)) continue;

        const org = await Organization.findById(subscription.orgId)
            .select('name orgSlug')
            .lean();
        if (!org) continue;

        const memberships = await Membership.find({
            orgId: subscription.orgId,
            role: { $in: RECIPIENT_ROLES },
            status: 'active',
        }).lean();
        const emails = memberships.map((member) => member.userEmail).filter(Boolean);
        if (emails.length === 0) continue;

        const users = await UserModel.find({ email: { $in: emails } })
            .select('_id email')
            .lean();
        if (users.length === 0) continue;

        const periodEndIso = periodEnd.toISOString();
        const dateLabel = periodEnd.toLocaleDateString('ru-RU');
        const daysLabel = formatDaysLabel(daysLeft);
        const title =
            daysLeft === 1
                ? 'Подписка истекает завтра'
                : `Подписка истекает через ${daysLeft} ${daysLabel}`;
        const message = `Подписка организации ${org.name} истекает ${dateLabel}. Продлите, чтобы сохранить доступ.`;

        for (const user of users) {
            const alreadySent = await NotificationModel.findOne({
                recipientUserId: user._id,
                type: 'subscription_expiring',
                orgId: subscription.orgId,
                'metadata.periodEnd': periodEndIso,
                'metadata.daysLeft': daysLeft,
            }).lean();
            if (alreadySent) continue;

            await createNotification({
                recipientUserId: user._id,
                type: 'subscription_expiring',
                title,
                message,
                link: `/org/${encodeURIComponent(org.orgSlug)}/plans`,
                orgId: subscription.orgId,
                orgSlug: org.orgSlug,
                orgName: org.name,
                metadata: {
                    daysLeft,
                    periodEnd: periodEndIso,
                },
            });
            notified += 1;
        }
    }

    return { scanned: subscriptions.length, notified };
}
