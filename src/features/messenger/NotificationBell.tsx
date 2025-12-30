// src/app/components/NotificationBell.tsx
'use client';

import React from 'react';
import {
    Badge,
    Box,
    CircularProgress,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Menu,
    Typography,
    Button,
    type SxProps,
    type Theme,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import dayjs from 'dayjs';
import Link from 'next/link';
import type {
    NotificationDTO,
    NotificationDeletedEventPayload,
    NotificationNewEventPayload,
    NotificationReadEventPayload,
    NotificationUnreadEventPayload,
} from '@/app/types/notifications';
import { MANAGER_ROLES } from '@/app/types/roles';
import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import {
    fetchUserContext,
    type UserContextResponse,
} from '@/app/utils/userContext';
import type { Socket } from 'socket.io-client';

type NotificationSocketEventMap = {
    'notification:new': (payload: NotificationNewEventPayload) => void;
    'notification:read': (payload: NotificationReadEventPayload) => void;
    'notification:deleted': (payload: NotificationDeletedEventPayload) => void;
    'notification:unread': (payload: NotificationUnreadEventPayload) => void;
    connect: () => void;
    connect_error: (error: unknown) => void;
};

type SocketClient = Socket<NotificationSocketEventMap, NotificationSocketEventMap>;
type SocketModule = typeof import('socket.io-client');
type SocketConnector =
    | SocketModule['io']
    | SocketModule['connect']
    | SocketModule['default'];

type NotificationsResponse =
    | {
          ok: true;
          notifications: NotificationDTO[];
          unreadCount: number;
          totalCount: number;
          page: number;
          limit: number;
          hasMore: boolean;
      }
    | { ok: false; error: string };

const fetchNotifications = async (
    page = 1,
    limit = 10
): Promise<NotificationsResponse> => {
    try {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });
        const res = await fetch(`/api/notifications?${params.toString()}`, {
            cache: 'no-store',
        });
        if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
                error?: string;
            };
            return {
                ok: false,
                error: payload.error || res.statusText,
            };
        }
        return (await res.json()) as NotificationsResponse;
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
};

const markAllNotificationsAsRead = async () => {
    try {
        const res = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markAll: true }),
        });
        if (!res.ok) {
            console.error('Failed to mark notifications as read', res.statusText);
            return;
        }
    } catch (error) {
        console.error('Failed to mark notifications as read', error);
    }
};

const formatTimestamp = (value: string) =>
    dayjs(value).isValid() ? dayjs(value).format('DD.MM.YYYY HH:mm') : value;

const normalizeMetadataValue = (value: unknown) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
};

const isManagerForNotification = (
    notification: NotificationDTO,
    userContext: UserContextResponse | null
) => {
    if (!userContext) return false;
    if (userContext.isSuperAdmin) return true;
    const orgId = notification.orgId;
    if (!orgId) return false;
    const membership =
        userContext.memberships?.find((item) => String(item.orgId) === String(orgId)) ??
        (userContext.activeMembership?.orgId === orgId
            ? userContext.activeMembership
            : null);
    const role = membership?.role ?? null;
    if (!role) return false;
    return MANAGER_ROLES.includes(role);
};

const getNotificationLink = (
    notification: NotificationDTO,
    userContext: UserContextResponse | null
) => {
    const isTaskNotification =
        notification.type === 'task_assigned' ||
        notification.type === 'task_unassigned' ||
        notification.type === 'task_comment' ||
        notification.type === 'task_status_change' ||
        notification.type === 'task_application_submitted' ||
        notification.type === 'task_application_status';

    if (!isTaskNotification) {
        return notification.link;
    }

    const metadata = notification.metadata || {};
    const taskPublicId = normalizeMetadataValue(metadata.taskId);
    const isContractor = userContext?.profileType === 'contractor';
    const orgSlug = notification.orgSlug ?? undefined;
    const projectRef =
        normalizeMetadataValue(metadata.projectRef) ??
        normalizeMetadataValue(metadata.projectKey) ??
        undefined;

    if (isContractor && taskPublicId) {
        return `/tasks/${encodeURIComponent(taskPublicId.toLowerCase())}`;
    }

    const canUseOrgRoute = isManagerForNotification(notification, userContext);
    if (canUseOrgRoute && orgSlug && projectRef && taskPublicId) {
        const normalizedTaskId = taskPublicId.toLowerCase();
        return `/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
            projectRef
        )}/tasks/${encodeURIComponent(normalizedTaskId)}`;
    }

    if (notification.link) {
        return notification.link;
    }

    if (taskPublicId) {
        return `/tasks/${encodeURIComponent(taskPublicId.toLowerCase())}`;
    }

    return notification.link;
};

type NotificationBellProps = {
    buttonSx?: SxProps<Theme>;
};

const PAGE_SIZE = 10;

const fetchSocketToken = async (): Promise<string> => {
    const res = await fetch('/api/notifications/socket-auth', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
    });
    const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        error?: string;
    };
    if (!res.ok || payload.ok !== true || !payload.token) {
        throw new Error(payload.error || 'Не удалось получить токен сокета');
    }
    return payload.token;
};

export default function NotificationBell({ buttonSx }: NotificationBellProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const menuBg = isDark ? 'rgba(12,16,26,0.95)' : theme.palette.background.paper;
    const menuBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuShadow = isDark ? '0 30px 70px rgba(0,0,0,0.65)' : '0 18px 50px rgba(15,23,42,0.12)';
    const unreadBg = isDark
        ? 'rgba(59,130,246,0.14)'
        : (theme: Theme) => theme.palette.action.selected;
    const readBg = isDark ? 'rgba(255,255,255,0.03)' : theme.palette.background.paper;

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [userContext, setUserContext] = React.useState<UserContextResponse | null>(null);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [actionError, setActionError] = React.useState<string | null>(null);
    const [pendingDeletes, setPendingDeletes] = React.useState<Record<string, boolean>>({});
    const [page, setPage] = React.useState(1);
    const [hasMore, setHasMore] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [realtimeError, setRealtimeError] = React.useState<string | null>(null);
    const socketRef = React.useRef<SocketClient | null>(null);

    const open = Boolean(anchorEl);

    type LoadOptions = {
        page?: number;
        append?: boolean;
    };

    const loadNotifications = React.useCallback(
        async ({ page: pageToLoad = 1, append = false }: LoadOptions = {}) => {
            const usePrimaryLoader = pageToLoad === 1 && !append;
            if (usePrimaryLoader) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setActionError(null);

            try {
                const result = await fetchNotifications(pageToLoad, PAGE_SIZE);
                if (result.ok) {
                    setNotifications((prev) => {
                        if (append) {
                            const existingIds = new Set(prev.map((item) => item.id));
                            const nextItems = result.notifications.filter(
                                (item) => !existingIds.has(item.id)
                            );
                            return [...prev, ...nextItems];
                        }
                        return result.notifications;
                    });
                    setUnreadCount(result.unreadCount);
                    setError(null);
                    setHasMore(result.hasMore);
                    setPage(result.page);
                    return result;
                }
                setError(result.error);
                return null;
            } finally {
                if (usePrimaryLoader) {
                    setLoading(false);
                } else {
                    setLoadingMore(false);
                }
            }
        },
        []
    );

    React.useEffect(() => {
        loadNotifications({ page: 1 });
    }, [loadNotifications]);

    React.useEffect(() => {
        const loadUserContext = async () => {
            const context = await fetchUserContext();
            setUserContext(context);
        };
        void loadUserContext();
    }, []);

    const handleToggleMenu = async (event: React.MouseEvent<HTMLElement>) => {
        if (open) {
            setAnchorEl(null);
            return;
        }
        setAnchorEl(event.currentTarget);
        const payload = await loadNotifications({ page: 1 });
        if (payload?.ok && payload.unreadCount > 0) {
            await markAllNotificationsAsRead();
            setUnreadCount(0);
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, status: 'read' }))
            );
        }
    };

    const handleClose = () => setAnchorEl(null);
    const handleLoadMore = React.useCallback(async () => {
        if (loadingMore || !hasMore) return;
        await loadNotifications({ page: page + 1, append: true });
    }, [hasMore, loadingMore, loadNotifications, page]);
    const handleDeleteNotification = async (notificationId: string) => {
        const targetNotification = notifications.find((n) => n.id === notificationId);

        setPendingDeletes((prev) => ({ ...prev, [notificationId]: true }));
        setActionError(null);
        try {
            const res = await fetch('/api/notifications', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: [notificationId] }),
            });
            const payload = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                unreadCount?: number;
                error?: string;
            };
            if (!res.ok || payload.ok !== true) {
                const message = payload.error || res.statusText;
                setActionError(message);
                return;
            }

            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            if (typeof payload.unreadCount === 'number') {
                setUnreadCount(payload.unreadCount);
            } else if (targetNotification?.status === 'unread') {
                setUnreadCount((prev) => Math.max(prev - 1, 0));
            }
        } catch (deleteError) {
            console.error('Failed to delete notification', deleteError);
            setActionError('Не удалось удалить уведомление. Попробуйте ещё раз.');
        } finally {
            setPendingDeletes((prev) => {
                const next = { ...prev };
                delete next[notificationId];
                return next;
            });
        }
    };

    const handleRealtimeNewNotification = React.useCallback(
        (payload: NotificationNewEventPayload) => {
            setNotifications((prev) => {
                const existingIndex = prev.findIndex(
                    (notification) => notification.id === payload.notification.id
                );
                if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = payload.notification;
                    if (existingIndex > 0) {
                        next.splice(existingIndex, 1);
                        next.unshift(payload.notification);
                    }
                    return next;
                }
                return [payload.notification, ...prev];
            });
            setUnreadCount(payload.unreadCount);
            setRealtimeError(null);
        },
        []
    );

    const handleRealtimeMarkedAsRead = React.useCallback(
        (payload: NotificationReadEventPayload) => {
            setNotifications((prev) => {
                if (!payload.notificationIds || payload.notificationIds.length === 0) {
                    return prev.map((notification) => ({
                        ...notification,
                        status: 'read',
                    }));
                }
                const ids = new Set(payload.notificationIds);
                return prev.map((notification) =>
                    ids.has(notification.id)
                        ? {
                              ...notification,
                              status: 'read',
                          }
                        : notification
                );
            });
            setUnreadCount(payload.unreadCount);
        },
        []
    );

    const handleRealtimeDeleted = React.useCallback(
        (payload: NotificationDeletedEventPayload) => {
            setNotifications((prev) => {
                if (!payload.notificationIds || payload.notificationIds.length === 0) {
                    return [];
                }
                const ids = new Set(payload.notificationIds);
                return prev.filter((notification) => !ids.has(notification.id));
            });

            setPendingDeletes((prev) => {
                if (!payload.notificationIds || payload.notificationIds.length === 0) {
                    return {};
                }
                const next = { ...prev };
                payload.notificationIds.forEach((id) => {
                    delete next[id];
                });
                return next;
            });

            setUnreadCount(payload.unreadCount);
        },
        []
    );

    const handleRealtimeUnreadSummary = React.useCallback(
        (payload: NotificationUnreadEventPayload) => {
            setUnreadCount(payload.unreadCount);
        },
        []
    );

    React.useEffect(() => {
        let cancelled = false;

        const detachSocket = () => {
            if (!socketRef.current) {
                return;
            }
            socketRef.current.off('notification:new', handleRealtimeNewNotification);
            socketRef.current.off('notification:read', handleRealtimeMarkedAsRead);
            socketRef.current.off('notification:deleted', handleRealtimeDeleted);
            socketRef.current.off('notification:unread', handleRealtimeUnreadSummary);
            socketRef.current.off('connect_error');
            socketRef.current.off('connect');
            socketRef.current.disconnect();
            socketRef.current = null;
        };

        const connectSocket = async () => {
            try {
                setRealtimeError(null);
                await fetch('/api/socket', { cache: 'no-store', credentials: 'include' });
                if (cancelled) return;
                const token = await fetchSocketToken();
                if (cancelled) return;
                const socketModule = (await import('socket.io-client')) as SocketModule;
                const { io, connect, default: defaultConnector } = socketModule;
                const socketConnector = io ?? connect ?? defaultConnector ?? null;
                if (!socketConnector) {
                    setRealtimeError('Socket.io client is unavailable');
                    return;
                }
                if (cancelled) return;
                const socketInstance = (socketConnector as SocketConnector)({
                    path: NOTIFICATIONS_SOCKET_PATH,
                    transports: ['websocket', 'polling'],
                    withCredentials: true,
                    auth: { token },
                }) as SocketClient;
                socketRef.current = socketInstance;

                socketInstance.on('notification:new', handleRealtimeNewNotification);
                socketInstance.on('notification:read', handleRealtimeMarkedAsRead);
                socketInstance.on('notification:deleted', handleRealtimeDeleted);
                socketInstance.on('notification:unread', handleRealtimeUnreadSummary);
                socketInstance.on('connect', () => setRealtimeError(null));
                let refreshing = false;
                socketInstance.on('connect_error', async (error: { message?: string }) => {
                    console.error('notifications socket connect_error', error);
                    const message = error?.message?.toUpperCase?.() ?? '';
                    if (refreshing || (!message.includes('UNAUTHORIZED') && !message.includes('AUTH_FAILED'))) {
                        setRealtimeError('Не удалось подключиться к уведомлениям.');
                        return;
                    }
                    refreshing = true;
                    const freshToken = await fetchSocketToken();
                    if (freshToken) {
                        socketInstance.auth = { token: freshToken };
                        socketInstance.connect();
                    }
                    refreshing = false;
                });
            } catch (error) {
                if (!cancelled) {
                    console.error('notifications socket init failed', error);
                    setRealtimeError('Не удалось подключиться к уведомлениям.');
                }
            }
        };

        connectSocket();

        return () => {
            cancelled = true;
            detachSocket();
        };
    }, [
        handleRealtimeDeleted,
        handleRealtimeMarkedAsRead,
        handleRealtimeNewNotification,
        handleRealtimeUnreadSummary,
    ]);

    return (
        <>
            <IconButton
                color='inherit'
                aria-label='Открыть уведомления'
                size='large'
                onClick={handleToggleMenu}
                sx={buttonSx}
            >
                <Badge
                    color='error'
                    badgeContent={unreadCount > 0 ? unreadCount : null}
                >
                    <NotificationsIcon fontSize='small' />
                </Badge>
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        width: 380,
                        maxHeight: 420,
                        p: 0,
                        backgroundColor: menuBg,
                        border: `1px solid ${menuBorder}`,
                        boxShadow: menuShadow,
                        backdropFilter: 'blur(10px)',
                    },
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant='h6'>Уведомления</Typography>
                </Box>
                <Divider />
                {(actionError || realtimeError) && (
                    <Box sx={{ px: 2, py: 1 }}>
                        {actionError && (
                            <Typography variant='caption' color='error'>
                                {actionError}
                            </Typography>
                        )}
                        {realtimeError && (
                            <Typography variant='caption' color='error'>
                                {realtimeError}
                            </Typography>
                        )}
                    </Box>
                )}
                <Box sx={{ minHeight: 200 }}>
                    {loading ? (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                py: 4,
                            }}
                        >
                            <CircularProgress size={24} />
                        </Box>
                    ) : error ? (
                        <Box sx={{ p: 2 }}>
                            <Typography color='error' variant='body2'>
                                {error}
                            </Typography>
                        </Box>
                    ) : notifications.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                Пока нет уведомлений
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <List dense disablePadding>
                                {notifications.map((notification) => {
                                    const resolvedLink = getNotificationLink(
                                        notification,
                                        userContext
                                    );
                                    return (
                                        <React.Fragment key={notification.id}>
                                        <ListItem
                                            alignItems='flex-start'
                                            sx={{
                                                alignItems: 'stretch',
                                                backgroundColor:
                                                    notification.status === 'unread' ? unreadBg : readBg,
                                                borderLeft: (theme) =>
                                                    notification.status === 'unread'
                                                        ? `4px solid ${theme.palette.primary.main}`
                                                        : '4px solid transparent',
                                                transition: 'background-color 0.2s ease',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    gap: 1,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        flexGrow: 1,
                                                        display: 'flex',
                                                        gap: 1,
                                                    }}
                                                >
                                                    {notification.status === 'unread' && (
                                                        <Box
                                                            component='span'
                                                            sx={{
                                                                width: 8,
                                                                height: 8,
                                                                borderRadius: '50%',
                                                                backgroundColor: 'primary.main',
                                                                mt: 0.75,
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    )}
                                                    <ListItemText
                                                        primary={
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: 0.5,
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant='subtitle2'
                                                                    sx={{
                                                                        fontWeight:
                                                                            notification.status ===
                                                                            'unread'
                                                                                ? 700
                                                                                : 600,
                                                                    }}
                                                                >
                                                                    {notification.title}
                                                                </Typography>
                                                                <Typography
                                                                    variant='body2'
                                                                    color={
                                                                        notification.status ===
                                                                        'unread'
                                                                            ? 'text.primary'
                                                                            : 'text.secondary'
                                                                    }
                                                                >
                                                                    {notification.message}
                                                                </Typography>
                                                                <Typography
                                                                    variant='caption'
                                                                    color='text.secondary'
                                                                >
                                                                    {formatTimestamp(
                                                                        notification.createdAt
                                                                    )}
                                                                </Typography>
                                                                {resolvedLink && (
                                                                    <Button
                                                                        component={Link}
                                                                        href={resolvedLink}
                                                                        onClick={handleClose}
                                                                        size='small'
                                                                        sx={{
                                                                            alignSelf:
                                                                                'flex-start',
                                                                            mt: 0.5,
                                                                        }}
                                                                    >
                                                                        Открыть
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                        }
                                                    />
                                                </Box>
                                                <IconButton
                                                    aria-label='Удалить уведомление'
                                                    edge='end'
                                                    size='small'
                                                    onClick={() =>
                                                        handleDeleteNotification(notification.id)
                                                    }
                                                    disabled={Boolean(
                                                        pendingDeletes[notification.id]
                                                    )}
                                                    sx={{ alignSelf: 'flex-start' }}
                                                >
                                                    {pendingDeletes[notification.id] ? (
                                                        <CircularProgress size={16} />
                                                    ) : (
                                                        <DeleteOutlineIcon fontSize='small' />
                                                    )}
                                                </IconButton>
                                            </Box>
                                        </ListItem>
                                        <Divider component='li' />
                                        </React.Fragment>
                                    );
                                })}
                            </List>
                            {hasMore && (
                                <>
                                    <Divider />
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            p: 1.5,
                                        }}
                                    >
                                        <Button
                                            variant='outlined'
                                            size='small'
                                            onClick={handleLoadMore}
                                            disabled={loadingMore}
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <CircularProgress size={16} sx={{ mr: 1 }} />
                                                    Загрузка...
                                                </>
                                            ) : (
                                                'Показать ещё'
                                            )}
                                        </Button>
                                    </Box>
                                </>
                            )}
                        </>
                    )}
                </Box>
            </Menu>
        </>
    );
}
