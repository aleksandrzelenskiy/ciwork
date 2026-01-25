import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import MembershipModel from '@/server/models/MembershipModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';
import TaskModel from '@/server/models/TaskModel';
import { checkReviewEligibility } from '@/server/reviews/permissions';
import { CONTRACTOR_SPECIALIZATIONS, type ContractorSpecialization } from '@/app/types/specializations';

const sanitizeString = (value?: string | null) => value?.trim() ?? '';

const isValidRegionCode = (value?: string) =>
  !!value && RUSSIAN_REGIONS.some((region) => region.code === value);

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    await dbConnect();
    const user = await UserModel.findOne({ clerkUserId: clerkUser.id }).lean();
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

    const reviewEligibility = await checkReviewEligibility(
      { clerkUserId: user.clerkUserId, email: user.email },
      { clerkUserId: user.clerkUserId, email: user.email }
    );
    const reviewBlockReason = reviewEligibility.canReview
      ? null
      : reviewEligibility.reason || null;

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      regionCode: user.regionCode ?? '',
      profilePic: user.profilePic || clerkUser.imageUrl || '',
      profileType: user.profileType,
      specializations: user.specializations ?? [],
      platformRole: user.platformRole,
      viewerPlatformRole: user.platformRole,
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
    });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить профиль' },
      { status: 500 }
    );
  }
}

type ProfilePatchPayload = {
  name?: string;
  phone?: string;
  regionCode?: string;
  desiredRate?: number | null;
  bio?: string;
  portfolioLinks?: string[];
  specializations?: ContractorSpecialization[];
};

export async function PATCH(request: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const body = (await request.json()) as ProfilePatchPayload;
    const nextName =
      typeof body.name === 'string' ? sanitizeString(body.name) : undefined;
    const nextPhone =
      typeof body.phone === 'string' ? sanitizeString(body.phone) : undefined;
    const nextRegion =
      typeof body.regionCode === 'string' ? sanitizeString(body.regionCode) : undefined;
    const desiredRate =
      typeof body.desiredRate === 'number' && Number.isFinite(body.desiredRate) && body.desiredRate > 0
        ? body.desiredRate
        : body.desiredRate === null
            ? null
            : undefined;
    const bio =
      typeof body.bio === 'string'
        ? body.bio.trim().slice(0, 2000)
        : undefined;
    const portfolioLinks =
      Array.isArray(body.portfolioLinks)
        ? body.portfolioLinks
            .map((link) => sanitizeString(link))
            .filter(Boolean)
            .slice(0, 20)
        : undefined;
    const specializations = Array.isArray(body.specializations)
      ? body.specializations.filter((value): value is ContractorSpecialization =>
          CONTRACTOR_SPECIALIZATIONS.includes(value as ContractorSpecialization)
        )
      : undefined;

    if (typeof body.name !== 'undefined' && !nextName) {
      return NextResponse.json(
        { error: 'Имя не может быть пустым' },
        { status: 400 }
      );
    }

    if (typeof nextRegion !== 'undefined' && !isValidRegionCode(nextRegion)) {
      return NextResponse.json(
        { error: 'Некорректный регион' },
        { status: 400 }
      );
    }

    await dbConnect();

    const updatePayload: Record<string, unknown> = {};
    let shouldMarkPending = false;
    if (typeof nextName !== 'undefined') {
      updatePayload.name = nextName;
      shouldMarkPending = true;
    }
    if (typeof nextPhone !== 'undefined') {
      updatePayload.phone = nextPhone;
      shouldMarkPending = true;
    }
    if (typeof nextRegion !== 'undefined') {
      updatePayload.regionCode = nextRegion;
      shouldMarkPending = true;
    }
    if (typeof desiredRate !== 'undefined') {
      updatePayload.desiredRate = desiredRate === null ? undefined : desiredRate;
      shouldMarkPending = true;
    }
    if (typeof bio !== 'undefined') {
      updatePayload.bio = bio;
      shouldMarkPending = true;
    }
    if (typeof portfolioLinks !== 'undefined') {
      updatePayload.portfolioLinks = portfolioLinks;
      shouldMarkPending = true;
    }
    if (typeof specializations !== 'undefined') {
      updatePayload.specializations = specializations;
      shouldMarkPending = true;
    }
    if (shouldMarkPending) {
      updatePayload.profileStatus = 'pending';
      updatePayload.moderationComment = '';
    }
    if (!Object.keys(updatePayload).length) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 }
      );
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { $set: updatePayload },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile: {
        name: updatedUser.name,
        phone: updatedUser.phone ?? '',
        email: updatedUser.email,
        regionCode: updatedUser.regionCode ?? '',
        profilePic: updatedUser.profilePic || clerkUser.imageUrl || '',
        profileType: updatedUser.profileType,
        specializations: updatedUser.specializations ?? [],
        platformRole: updatedUser.platformRole,
        viewerPlatformRole: updatedUser.platformRole,
        clerkUserId: updatedUser.clerkUserId,
        desiredRate: updatedUser.desiredRate ?? null,
        bio: updatedUser.bio ?? '',
        portfolioLinks: updatedUser.portfolioLinks ?? [],
        moderationStatus: updatedUser.profileStatus ?? 'pending',
        moderationComment: updatedUser.moderationComment ?? '',
      },
    });
  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить профиль' },
      { status: 500 }
    );
  }
}
