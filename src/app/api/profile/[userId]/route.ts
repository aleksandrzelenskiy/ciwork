import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import MembershipModel from '@/server/models/MembershipModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';
import TaskModel from '@/server/models/TaskModel';
import { checkReviewEligibility } from '@/server/reviews/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    const lookupKey = userId?.trim();
    if (!lookupKey) {
        return NextResponse.json(
            { error: 'Некорректный идентификатор пользователя' },
            { status: 400 }
        );
    }

    const viewer = await GetCurrentUserFromMongoDB();
    if (!viewer.success) {
        return NextResponse.json(
            { error: 'Требуется авторизация' },
            { status: 401 }
        );
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('GET /api/profile/[userId] db error', error);
        return NextResponse.json(
            { error: 'Не удалось подключиться к базе' },
            { status: 500 }
        );
    }

    const user = await UserModel.findOne({ clerkUserId: lookupKey }).lean();
    if (!user) {
        return NextResponse.json(
            { error: 'Пользователь не найден' },
            { status: 404 }
        );
    }

    const normalizedEmail = user.email?.toLowerCase?.() ?? '';
    let organizationName: string | null = null;
    let organizationRole: string | null = null;
    let managedProjects: { name: string; key?: string | null }[] = [];

    if (user.profileType === 'employer' && normalizedEmail) {
        let membership = user.activeOrgId
            ? await MembershipModel.findOne({
                  orgId: user.activeOrgId,
                  userEmail: normalizedEmail,
              }).lean()
            : null;

        if (!membership) {
            membership = await MembershipModel.findOne({
                userEmail: normalizedEmail,
                status: 'active',
            }).lean();
        }

        if (membership) {
            const org = await OrganizationModel.findById(membership.orgId)
                .select('name')
                .lean();
            organizationName = org?.name ?? null;
            organizationRole = membership.role ?? null;
            const projects = await ProjectModel.find({
                orgId: membership.orgId,
                managers: { $in: [normalizedEmail] },
            })
                .select('name key')
                .lean();
            managedProjects = projects.map((project) => ({
                name: project.name,
                key: project.key ?? null,
            }));
        }
    }

    let recentTasks: { taskName: string; bsNumber: string }[] = [];
    if (user.profileType === 'contractor' && normalizedEmail) {
        const tasks = await TaskModel.find({
            executorEmail: normalizedEmail,
            status: { $in: ['Done', 'Agreed'] },
        })
            .select('taskName bsNumber workCompletionDate createdAt')
            .sort({ workCompletionDate: -1, createdAt: -1 })
            .limit(3)
            .lean();
        recentTasks = tasks.map((task) => ({
            taskName: task.taskName,
            bsNumber: task.bsNumber,
        }));
    }

    const canEdit =
        user._id?.toString?.() === viewer.data._id?.toString?.();
    const isAdminViewer =
        viewer.data.platformRole === 'super_admin' ||
        viewer.data.platformRole === 'staff';
    const reviewEligibility = await checkReviewEligibility(
        { clerkUserId: viewer.data.clerkUserId, email: viewer.data.email },
        { clerkUserId: user.clerkUserId, email: user.email }
    );
    const reviewBlockReason = reviewEligibility.canReview
        ? null
        : reviewEligibility.reason || null;

    return NextResponse.json({
        profile: {
            id: user._id?.toString?.(),
            name: user.name,
            email: user.email,
            phone: isAdminViewer ? user.phone ?? '' : '',
            regionCode: user.regionCode ?? '',
            profilePic: user.profilePic || '',
            profileType: user.profileType,
            specializations: Array.isArray(user.specializations)
                ? user.specializations.map((spec) => (spec === 'construction' ? 'installation' : spec))
                : [],
            platformRole: user.platformRole,
            viewerPlatformRole: viewer.data.platformRole,
            clerkUserId: user.clerkUserId,
            desiredRate: user.desiredRate ?? null,
            bio: user.bio ?? '',
            portfolioLinks: user.portfolioLinks ?? [],
            moderationStatus: user.profileStatus ?? 'pending',
            moderationComment: user.moderationComment ?? '',
            completedCount: user.completedCount ?? 0,
            rating: typeof user.rating === 'number' ? user.rating : null,
            workRating: null,
            organizationName,
            organizationRole,
            managedProjects,
            recentTasks,
            canReview: reviewEligibility.canReview,
            reviewBlockReason,
        },
        canEdit,
    });
}
