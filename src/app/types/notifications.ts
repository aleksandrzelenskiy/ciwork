// src/app/types/notifications.ts

export type NotificationKind =
    | 'org_invite'
    | 'org_join_request'
    | 'org_join_approved'
    | 'org_join_declined'
    | 'org_welcome'
    | 'signup_bonus'
    | 'invite_accepted'
    | 'invite_declined'
    | 'task_assigned'
    | 'task_unassigned'
    | 'task_comment'
    | 'task_status_change'
    | 'task_published'
    | 'task_application_submitted'
    | 'task_application_status'
    | 'task_public_moderation_requested'
    | 'task_public_moderation_result'
    | 'profile_moderation'
    | 'subscription_expiring'
    | 'user_registered'
    | 'review_received';

export type NotificationStatus = 'unread' | 'read';

export interface NotificationDTO {
    id: string;
    type: NotificationKind;
    title: string;
    message: string;
    link?: string;
    createdAt: string;
    status: NotificationStatus;
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    senderName?: string;
    senderEmail?: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationNewEventPayload {
    notification: NotificationDTO;
    unreadCount: number;
}

interface NotificationRealtimeEventBase {
    unreadCount: number;
}

export interface NotificationReadEventPayload extends NotificationRealtimeEventBase {
    notificationIds?: string[];
}

export interface NotificationDeletedEventPayload extends NotificationRealtimeEventBase {
    notificationIds?: string[];
}

export type NotificationUnreadEventPayload = NotificationRealtimeEventBase;

export type NotificationServerToClientEvents = {
    'notification:new': (payload: NotificationNewEventPayload) => void;
    'notification:read': (payload: NotificationReadEventPayload) => void;
    'notification:deleted': (payload: NotificationDeletedEventPayload) => void;
    'notification:unread': (payload: NotificationUnreadEventPayload) => void;
};
