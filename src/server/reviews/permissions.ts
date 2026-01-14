import 'server-only';

import TaskModel from '@/server/models/TaskModel';

type ReviewActor = {
    clerkUserId?: string | null;
    email?: string | null;
};

type ReviewEligibility = {
    canReview: boolean;
    reason?: string;
};

const normalizeId = (value?: string | null) => value?.trim() ?? '';
const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const buildInteractionMatch = (viewer: ReviewActor, target: ReviewActor) => {
    const viewerId = normalizeId(viewer.clerkUserId);
    const targetId = normalizeId(target.clerkUserId);
    const viewerEmail = normalizeEmail(viewer.email);
    const targetEmail = normalizeEmail(target.email);
    const orConditions: Record<string, unknown>[] = [];

    if (viewerId && targetId) {
        orConditions.push(
            { authorId: viewerId, executorId: targetId },
            { authorId: targetId, executorId: viewerId }
        );
    }

    if (viewerEmail && targetEmail) {
        orConditions.push(
            { authorEmail: viewerEmail, executorEmail: targetEmail },
            { authorEmail: targetEmail, executorEmail: viewerEmail }
        );
    }

    if (viewerId && targetEmail) {
        orConditions.push(
            { authorId: viewerId, executorEmail: targetEmail },
            { executorId: viewerId, authorEmail: targetEmail }
        );
    }

    if (targetId && viewerEmail) {
        orConditions.push(
            { authorId: targetId, executorEmail: viewerEmail },
            { executorId: targetId, authorEmail: viewerEmail }
        );
    }

    if (orConditions.length === 0) {
        return null;
    }

    return { $or: orConditions };
};

export const checkReviewEligibility = async (
    viewer: ReviewActor,
    target: ReviewActor
): Promise<ReviewEligibility> => {
    const viewerId = normalizeId(viewer.clerkUserId);
    const targetId = normalizeId(target.clerkUserId);

    if (!viewerId || !targetId) {
        return {
            canReview: false,
            reason: 'Не удалось определить участников для отзыва.',
        };
    }

    if (viewerId === targetId) {
        return {
            canReview: false,
            reason: 'Нельзя оставлять отзыв о себе.',
        };
    }

    const match = buildInteractionMatch(viewer, target);
    if (!match) {
        return {
            canReview: false,
            reason: 'Оставлять отзыв можно только после совместной задачи.',
        };
    }

    const hasInteraction = await TaskModel.exists(match);
    if (!hasInteraction) {
        return {
            canReview: false,
            reason: 'Оставлять отзыв можно только после совместной задачи.',
        };
    }

    return { canReview: true };
};
