// src/server/socket/notificationSocket.ts

import 'server-only';

import { Server as SocketIOServer, type Socket } from 'socket.io';
import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import type {
    NotificationDeletedEventPayload,
    NotificationNewEventPayload,
    NotificationReadEventPayload,
    NotificationServerToClientEvents,
    NotificationUnreadEventPayload,
} from '@/app/types/notifications';
import { verifySocketToken } from '@/server/socket/token';
import UserModel from '@/server/models/UserModel';
import dbConnect from '@/server/db/mongoose';

const USER_ROOM_PREFIX = 'notification:user:';
const TASK_ROOM_PREFIX = 'task:';
const CHAT_ROOM_PREFIX = 'chat:conversation:';
const PRESENCE_SWEEP_INTERVAL_MS = 20_000;
const PRESENCE_OFFLINE_THRESHOLD_MS = 60_000;

type TaskCommentPayload = {
    _id: string;
    text: string;
    author: string;
    authorId: string;
    createdAt: string | Date;
    photoUrl?: string;
    profilePic?: string;
};

export class NotificationSocketGateway {
    private io?: SocketIOServer;
    private configured = false;
    private presenceSweepTimer?: ReturnType<typeof setInterval>;
    private presenceByUser = new Map<
        string,
        { lastHeartbeat: number; email?: string; isOnline: boolean; lastActive?: Date | null }
    >();
    private userEmailCache = new Map<string, { email?: string; lastActive?: Date | null }>();

    public get path() {
        return NOTIFICATIONS_SOCKET_PATH;
    }

    public bindServer(io: SocketIOServer) {
        if (this.configured && this.io) {
            return this.io;
        }
        this.io = io;
        this.attachAuth(io);
        this.registerConnectionHandler(io);
        this.startPresenceSweep();
        this.configured = true;
        return io;
    }

    public async getPresence(userId: string) {
        const record = this.presenceByUser.get(userId);
        if (record) {
            return {
                isOnline: record.isOnline,
                lastActive: record.lastActive ?? (record.lastHeartbeat ? new Date(record.lastHeartbeat) : undefined),
                email: record.email,
            };
        }
        const cached = this.userEmailCache.get(userId) ?? (await this.hydrateUserMeta(userId));
        return {
            isOnline: false,
            lastActive: cached?.lastActive,
            email: cached?.email,
        };
    }

    private attachAuth(io: SocketIOServer) {
        io.use((socket, next) => {
            try {
                const tokenCandidate = socket.handshake.auth?.token ?? socket.handshake.headers?.token;
                if (typeof tokenCandidate !== 'string' || tokenCandidate.length === 0) {
                    next(new Error('UNAUTHORIZED'));
                    return;
                }
                const userId = verifySocketToken(tokenCandidate);
                if (!userId) {
                    next(new Error('UNAUTHORIZED'));
                    return;
                }
                socket.data.userId = userId;
                next();
            } catch (error) {
                console.error('[notifications socket] auth error', error);
                next(new Error('AUTH_FAILED'));
            }
        });
    }

    private registerConnectionHandler(io: SocketIOServer) {
        io.on('connection', (socket: Socket) => {
            const userId = socket.data?.userId;
            if (!userId) {
                socket.disconnect(true);
                return;
            }
            socket.join(this.roomName(userId));
            void this.markOnline(userId);

            socket.on('task:join', ({ taskId }: { taskId?: string }) => {
                const normalized = this.taskRoomName(taskId);
                if (normalized) socket.join(normalized);
            });

            socket.on('task:leave', ({ taskId }: { taskId?: string }) => {
                const normalized = this.taskRoomName(taskId);
                if (normalized) socket.leave(normalized);
            });

            socket.on('chat:join', ({ conversationId }: { conversationId?: string }) => {
                const room = this.chatRoomName(conversationId);
                if (room) socket.join(room);
            });

            socket.on('chat:leave', ({ conversationId }: { conversationId?: string }) => {
                const room = this.chatRoomName(conversationId);
                if (room) socket.leave(room);
            });

            socket.on(
                'chat:typing',
                ({
                    conversationId,
                    userEmail,
                    userName,
                    isTyping,
                }: { conversationId?: string; userEmail?: string; userName?: string; isTyping?: boolean }) => {
                    const room = this.chatRoomName(conversationId);
                    if (!room) return;
                    socket.join(room);
                    socket.to(room).emit('chat:typing', {
                        conversationId,
                        userEmail,
                        userName,
                        isTyping: isTyping ?? true,
                    });
                }
            );

            socket.on('chat:presence', ({ email, isOnline }: { email?: string; isOnline?: boolean }) => {
                const shouldBeOnline = isOnline ?? true;
                if (shouldBeOnline) {
                    void this.markOnline(userId, email);
                    return;
                }
                void this.markOffline(userId, new Date());
            });

            socket.on('disconnect', () => {
                void this.markOffline(userId, new Date());
            });
        });
    }

    private startPresenceSweep() {
        if (this.presenceSweepTimer) return;
        this.presenceSweepTimer = setInterval(() => {
            const now = Date.now();
            this.presenceByUser.forEach((info, userId) => {
                if (info.isOnline && now - info.lastHeartbeat > PRESENCE_OFFLINE_THRESHOLD_MS) {
                    void this.markOffline(userId, new Date(info.lastHeartbeat || now));
                }
            });
        }, PRESENCE_SWEEP_INTERVAL_MS);
    }

    private roomName(userId: string) {
        return `${USER_ROOM_PREFIX}${userId}`;
    }

    private taskRoomName(taskIdInput?: unknown) {
        if (typeof taskIdInput !== 'string') return '';
        const cleaned = taskIdInput.trim();
        if (!cleaned) return '';
        return `${TASK_ROOM_PREFIX}${cleaned.toUpperCase()}`;
    }

    private emit<E extends keyof NotificationServerToClientEvents>(
        userId: string,
        event: E,
        payload: Parameters<NotificationServerToClientEvents[E]>[0]
    ) {
        if (!this.io) return;
        this.io.to(this.roomName(userId)).emit(event, payload);
    }

    public emitNewNotification(userId: string, payload: NotificationNewEventPayload) {
        this.emit(userId, 'notification:new', payload);
    }

    public emitNotificationsMarkedAsRead(
        userId: string,
        payload: NotificationReadEventPayload
    ) {
        this.emit(userId, 'notification:read', payload);
    }

    public emitNotificationsDeleted(
        userId: string,
        payload: NotificationDeletedEventPayload
    ) {
        this.emit(userId, 'notification:deleted', payload);
    }

    public emitUnreadCount(userId: string, payload: NotificationUnreadEventPayload) {
        this.emit(userId, 'notification:unread', payload);
    }

    public emitTaskComment(taskId: string, payload: TaskCommentPayload) {
        if (!this.io) return;
        const room = this.taskRoomName(taskId);
        if (!room) return;
        this.io.to(room).emit('task:comment:new', payload);
    }

    private chatRoomName(conversationIdInput?: unknown) {
        if (typeof conversationIdInput !== 'string') return '';
        const cleaned = conversationIdInput.trim();
        if (!cleaned) return '';
        return `${CHAT_ROOM_PREFIX}${cleaned}`;
    }

    private emitPresenceEvent(userId: string, email: string | undefined, isOnline: boolean, lastActive?: Date) {
        if (!this.io) return;
        this.io.emit('chat:presence', {
            userId,
            email,
            isOnline,
            lastActive: lastActive?.toISOString(),
        });
    }

    private async hydrateUserMeta(userId: string) {
        if (this.userEmailCache.has(userId)) {
            return this.userEmailCache.get(userId);
        }
        try {
            await dbConnect();
            const user = await UserModel.findById(userId, { email: 1, lastActive: 1 }).lean().exec();
            const meta = { email: user?.email, lastActive: user?.lastActive ?? null };
            this.userEmailCache.set(userId, meta);
            return meta;
        } catch (error) {
            console.error('[notifications socket] hydrateUserMeta failed', error);
            return { email: undefined, lastActive: null };
        }
    }

    private async markOnline(userId: string, emailFromEvent?: string) {
        const now = Date.now();
        const existing = this.presenceByUser.get(userId);
        const cachedMeta = await this.hydrateUserMeta(userId);
        const email = emailFromEvent || existing?.email || cachedMeta?.email;

        this.presenceByUser.set(userId, {
            lastHeartbeat: now,
            email,
            isOnline: true,
            lastActive: existing?.lastActive ?? cachedMeta?.lastActive ?? null,
        });

        if (!existing?.isOnline) {
            this.emitPresenceEvent(userId, email, true);
        }
    }

    private async markOffline(userId: string, lastActiveDate?: Date) {
        const existing = this.presenceByUser.get(userId);
        if (!existing?.isOnline) {
            return;
        }
        const effectiveLastActive = lastActiveDate || new Date(existing.lastHeartbeat || Date.now());
        const next = {
            ...existing,
            isOnline: false,
            lastHeartbeat: effectiveLastActive.getTime(),
            lastActive: effectiveLastActive,
        };
        this.presenceByUser.set(userId, next);
        this.emitPresenceEvent(userId, next.email, false, effectiveLastActive);
        await this.persistLastActive(userId, effectiveLastActive);
    }

    private async persistLastActive(userId: string, lastActive: Date) {
        try {
            await dbConnect();
            await UserModel.findByIdAndUpdate(
                userId,
                { lastActive },
                { new: false, upsert: false }
            )
                .lean()
                .exec();
            const cached = this.userEmailCache.get(userId) ?? {};
            this.userEmailCache.set(userId, { ...cached, lastActive });
        } catch (error) {
            console.error('[notifications socket] persistLastActive failed', error);
        }
    }

    public emitChatMessage(
        conversationId: string,
        payload: unknown,
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:message:new', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:message:new', payload);
        });
    }

    public emitChatRead(
        conversationId: string,
        payload: { conversationId: string; userEmail: string; messageIds: string[] },
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:read', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:read', payload);
        });
    }

    public emitChatUnread(
        conversationId: string,
        payload: { conversationId: string; unreadCount: number; userEmail?: string },
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:unread', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:unread', payload);
        });
    }
}

const globalForSocket = globalThis as typeof globalThis & {
    notificationSocketGateway?: NotificationSocketGateway;
};

const createGateway = () => new NotificationSocketGateway();
const existingGateway = globalForSocket.notificationSocketGateway;
const isGatewayCompatible =
    existingGateway &&
    typeof existingGateway.emitChatMessage === 'function' &&
    typeof existingGateway.emitChatRead === 'function' &&
    typeof existingGateway.emitChatUnread === 'function';

export const notificationSocketGateway = isGatewayCompatible
    ? existingGateway
    : createGateway();

if (!globalForSocket.notificationSocketGateway || !isGatewayCompatible) {
    globalForSocket.notificationSocketGateway = notificationSocketGateway;
}
