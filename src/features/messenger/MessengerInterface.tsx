'use client';

import React from 'react';
import {
    Avatar,
    Box,
    Button,
    Badge,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    ListItemIcon,
    Menu,
    MenuItem,
    OutlinedInput,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
    Fab,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import BusinessIcon from '@mui/icons-material/Business';
import FolderIcon from '@mui/icons-material/Folder';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import SearchIcon from '@mui/icons-material/Search';
import AddCommentIcon from '@mui/icons-material/AddComment';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ReplyIcon from '@mui/icons-material/Reply';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { MessengerConversationDTO, MessengerMessageDTO } from '@/app/types/messenger';
import getSocketClient from '@/app/lib/socketClient';
import { formatNameFromEmail, normalizeEmail } from '@/utils/email';

type MessengerInterfaceProps = {
    onUnreadChangeAction?: (count: number, unreadMap?: Record<string, number>) => void;
    defaultConversationId?: string;
    isOpen?: boolean;
    onCloseAction?: () => void;
    onToggleFullScreenAction?: () => void;
    isFullScreen?: boolean;
    directTargetRequest?: { email: string; nonce: number } | null;
};

const scopeIconMap: Record<'org' | 'project' | 'direct', React.ReactNode> = {
    org: <BusinessIcon fontSize='small' />,
    project: <FolderIcon fontSize='small' />,
    direct: <ChatBubbleIcon fontSize='small' />,
};

const formatTime = (iso: string) => {
    const date = new Date(iso);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const formatDateWithTime = (iso: string) => {
    const date = new Date(iso);
    const datePart = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    return `${datePart} ${formatTime(iso)}`;
};

const truncatePreview = (value?: string | null, maxLength = 70) => {
    if (!value) return '';
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

const MAX_MEDIA_COUNT = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

type ParticipantOption = {
    email: string;
    name?: string;
    role?: string;
};

type PendingMedia = {
    file: File;
    previewUrl: string;
    kind: 'image' | 'video';
};

export default function MessengerInterface({
    onUnreadChangeAction,
    defaultConversationId,
    isOpen = false,
    onCloseAction,
    onToggleFullScreenAction,
    isFullScreen,
    directTargetRequest,
}: MessengerInterfaceProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDark = theme.palette.mode === 'dark';
    const shellBg = isDark
        ? 'linear-gradient(180deg, rgba(10,13,20,0.95), rgba(15,20,32,0.9))'
        : 'rgba(255,255,255,0.86)';
    const listBg = isDark
        ? 'linear-gradient(180deg, rgba(16,21,32,0.9), rgba(12,18,30,0.9))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.58), rgba(238,244,255,0.92))';
    const listActiveBg = isDark ? 'rgba(59,130,246,0.16)' : 'rgba(232,240,255,0.9)';
    const listHoverBg = isDark ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.85)';
    const chatShellBg = isDark
        ? 'linear-gradient(145deg, rgba(12,16,26,0.95), rgba(18,24,36,0.92))'
        : 'linear-gradient(145deg, rgba(255,255,255,0.94), rgba(236,244,255,0.88))';
    const chatHeaderBg = isDark
        ? 'linear-gradient(145deg, rgba(14,18,28,0.98), rgba(16,23,35,0.95))'
        : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(236,244,255,0.94))';
    const messagesBg = isDark
        ? 'linear-gradient(180deg, rgba(16,21,32,0.94), rgba(13,18,30,0.92))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(237,243,255,0.88))';
    const messageOwnBg = isDark
        ? 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
        : 'linear-gradient(135deg, #0f8cff 0%, #4dabff 100%)';
    const messageOtherBg = isDark
        ? 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05))'
        : 'linear-gradient(135deg, rgba(255,255,255,0.82), rgba(236,242,255,0.85))';
    const composerBg = isDark ? 'rgba(22,28,42,0.9)' : 'rgba(244,246,249,0.92)';
    const composerBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.8)';
    const composerShadow = isDark
        ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
        : 'inset 0 1px 0 rgba(255,255,255,0.8)';
    const composerInputBg = isDark ? 'rgba(12,16,26,0.9)' : '#fff';
    const composerInputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    const [conversations, setConversations] = React.useState<MessengerConversationDTO[]>([]);
    const [messagesByConversation, setMessagesByConversation] = React.useState<
        Record<string, MessengerMessageDTO[]>
    >({});
    const [activeConversationId, setActiveConversationId] = React.useState<string>('');
    const [draftMessage, setDraftMessage] = React.useState('');
    const [userEmail, setUserEmail] = React.useState('');
    const [loadingConversations, setLoadingConversations] = React.useState(true);
    const [loadingMessages, setLoadingMessages] = React.useState(false);
    const [socketReady, setSocketReady] = React.useState(false);
    const [conversationSearch, setConversationSearch] = React.useState('');
    const [contactSearch, setContactSearch] = React.useState('');
    const [participants, setParticipants] = React.useState<ParticipantOption[]>([]);
    const [loadingParticipants, setLoadingParticipants] = React.useState(false);
    const [contactPickerOpen, setContactPickerOpen] = React.useState(false);
    const [participantsError, setParticipantsError] = React.useState<string | null>(null);
    const [creatingChatWith, setCreatingChatWith] = React.useState<string | null>(null);
    const [mobileView, setMobileView] = React.useState<'list' | 'chat'>('list');
    const [pendingMedia, setPendingMedia] = React.useState<PendingMedia[]>([]);
    const [sendingMessage, setSendingMessage] = React.useState(false);
    const [mediaError, setMediaError] = React.useState<string | null>(null);
    const [deletingMessageIds, setDeletingMessageIds] = React.useState<Record<string, boolean>>({});
    const [viewerState, setViewerState] = React.useState<{
        open: boolean;
        attachments: MessengerMessageDTO['attachments'];
        index: number;
        caption?: string;
        senderLabel?: string;
        createdAt?: string;
        messageId?: string;
        conversationId?: string;
        canDelete?: boolean;
    }>({ open: false, attachments: [], index: 0 });
    const [messageMenu, setMessageMenu] = React.useState<{
        mouseX: number;
        mouseY: number;
        message: MessengerMessageDTO;
    } | null>(null);
    const [replyingTo, setReplyingTo] = React.useState<MessengerMessageDTO | null>(null);
    const [editingMessage, setEditingMessage] = React.useState<MessengerMessageDTO | null>(null);
    const [typingByConversation, setTypingByConversation] = React.useState<
        Record<string, { userEmail: string; userName?: string }[]>
    >({});
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const draftInputRef = React.useRef<HTMLInputElement | null>(null);
    const pendingMediaRef = React.useRef<PendingMedia[]>([]);
    const socketRef = React.useRef<Awaited<ReturnType<typeof getSocketClient>> | null>(null);
    const chatContainerRef = React.useRef<HTMLDivElement | null>(null);
    const seenMessageIdsRef = React.useRef<Set<string>>(new Set());
    const typingTimeoutsRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const typingStopTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActiveRef = React.useRef(false);
    const typingConversationRef = React.useRef<string>('');
    const joinedConversationsRef = React.useRef<Set<string>>(new Set());
    const activeConversationIdRef = React.useRef<string>('');
    const deletedMessageIdsRef = React.useRef<Set<string>>(new Set());
    const lastScrollKeyRef = React.useRef<string>('');
    const showListPane = !isMobile || mobileView === 'list';
    const showChatPane = !isMobile || mobileView === 'chat';

    const clearPendingMedia = React.useCallback((items?: PendingMedia[]) => {
        const targets = items ?? pendingMedia;
        targets.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        if (!items) {
            setPendingMedia([]);
        }
    }, [pendingMedia]);

    React.useEffect(() => {
        pendingMediaRef.current = pendingMedia;
    }, [pendingMedia]);

    React.useEffect(() => () => {
        pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    }, []);

    const activeConversation = React.useMemo(
        () => conversations.find((c) => c.id === activeConversationId),
        [conversations, activeConversationId]
    );

    const activeMessages = React.useMemo(
        () => messagesByConversation[activeConversationId] ?? [],
        [messagesByConversation, activeConversationId]
    );

    const activeLastActivity = React.useMemo(() => {
        if (!activeConversation) return null;
        if (activeConversation.type === 'direct' && activeConversation.counterpartLastActive) {
            return activeConversation.counterpartLastActive;
        }
        const conversationMessages = messagesByConversation[activeConversation.id] ?? [];
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        if (lastMessage?.createdAt) {
            return lastMessage.createdAt;
        }
        return activeConversation.updatedAt ?? null;
    }, [activeConversation, messagesByConversation]);

    const activeTypingUsers = React.useMemo(
        () =>
            (typingByConversation[activeConversationId] ?? []).filter(
                (item) => normalizeEmail(item.userEmail) && normalizeEmail(item.userEmail) !== userEmail
            ),
        [activeConversationId, typingByConversation, userEmail]
    );

    const formatTypingLabel = React.useCallback((items: { userEmail: string; userName?: string }[]) => {
        const names = items
            .map((item) => item.userName?.trim() || formatNameFromEmail(item.userEmail) || item.userEmail)
            .filter(Boolean);
        if (names.length === 0) return 'Печатает...';
        if (names.length === 1) return `${names[0]} печатает...`;
        if (names.length === 2) return `${names[0]} и ${names[1]} печатают...`;
        return `${names[0]} и ещё ${names.length - 1} печатают...`;
    }, []);

    const totalUnread = React.useMemo(
        () => conversations.reduce((acc, item) => acc + item.unreadCount, 0),
        [conversations]
    );

    const unreadMap = React.useMemo(() => {
        const map: Record<string, number> = {};
        conversations.forEach((c) => {
            map[c.id] = c.unreadCount ?? 0;
        });
        return map;
    }, [conversations]);

    const filteredConversations = React.useMemo(() => {
        const query = conversationSearch.trim().toLowerCase();
        if (!query) return conversations;
        return conversations.filter((conversation) => {
            const titleMatch = conversation.title.toLowerCase().includes(query);
            const projectMatch = conversation.projectKey
                ? conversation.projectKey.toLowerCase().includes(query)
                : false;
            const participantsMatch = conversation.participants.some((participant) => {
                const normalized = participant.toLowerCase();
                const nameLike = formatNameFromEmail(participant).toLowerCase();
                return normalized.includes(query) || nameLike.includes(query);
            });
            const counterpartNameMatch = conversation.counterpartName
                ? conversation.counterpartName.toLowerCase().includes(query)
                : false;
            const counterpartEmailMatch = conversation.counterpartEmail
                ? conversation.counterpartEmail.toLowerCase().includes(query)
                : false;
            const lastPreviewMatch = conversation.lastMessagePreview
                ? conversation.lastMessagePreview.toLowerCase().includes(query)
                : false;
            const messageTextMatch = (messagesByConversation[conversation.id] ?? []).some((message) =>
                message.text.toLowerCase().includes(query)
            );
            return (
                titleMatch ||
                projectMatch ||
                participantsMatch ||
                counterpartNameMatch ||
                counterpartEmailMatch ||
                lastPreviewMatch ||
                messageTextMatch
            );
        });
    }, [conversationSearch, conversations, messagesByConversation]);

    const filteredContacts = React.useMemo(() => {
        const query = contactSearch.trim().toLowerCase();
        return participants
            .filter((participant) => normalizeEmail(participant.email) !== userEmail)
            .filter((participant) => {
                if (!query) return true;
                const emailMatch = participant.email.toLowerCase().includes(query);
                const nameMatch = participant.name?.toLowerCase().includes(query);
                const roleMatch = participant.role?.toLowerCase().includes(query);
                return Boolean(emailMatch || nameMatch || roleMatch);
            });
    }, [participants, contactSearch, userEmail]);

    const isConversationVisible = React.useCallback(
        (conversationId: string) => {
            if (!isOpen || !conversationId) return false;
            if (conversationId !== activeConversationId) return false;
            if (!isMobile) return true;
            return mobileView === 'chat';
        },
        [isOpen, activeConversationId, isMobile, mobileView]
    );

    const activeConversationVisible = React.useMemo(
        () => isConversationVisible(activeConversationId),
        [activeConversationId, isConversationVisible]
    );

    React.useEffect(() => {
        if (!isOpen) return;
        onUnreadChangeAction?.(totalUnread, unreadMap);
    }, [isOpen, totalUnread, unreadMap, onUnreadChangeAction]);

    const attachSocket = React.useCallback(async () => {
        try {
            socketRef.current = await getSocketClient();
            setSocketReady(true);
        } catch (error) {
            console.error('messenger: socket init failed', error);
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        void attachSocket();
        const retryTimer = setTimeout(() => {
            if (!cancelled && !socketRef.current) {
                void attachSocket();
            }
        }, 5000);
        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
        };
    }, [attachSocket]);

    const loadConversations = React.useCallback(
        async (options?: { preferActiveId?: string; preserveActive?: boolean }) => {
            setLoadingConversations(true);
            try {
                const preferActiveId = options?.preferActiveId;
                const preserveActive = options?.preserveActive ?? false;
                const res = await fetch('/api/messenger/conversations', { cache: 'no-store' });
                const payload = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    conversations?: MessengerConversationDTO[];
                    userEmail?: string;
                    error?: string;
                };
                if (!res.ok || payload.ok !== true || !payload.conversations) {
                    console.error('messenger: load conversations failed', payload.error);
                    return;
                }
                setUserEmail(normalizeEmail(payload.userEmail));
                setConversations(payload.conversations);
                const currentActiveId = activeConversationIdRef.current;
                const preserveCurrentActive =
                    preserveActive &&
                    currentActiveId &&
                    payload.conversations.some((c) => c.id === currentActiveId)
                        ? currentActiveId
                        : '';
                const initialActive = (() => {
                    if (preserveCurrentActive) return preserveCurrentActive;
                    if (preferActiveId && payload.conversations.some((c) => c.id === preferActiveId)) {
                        return preferActiveId;
                    }
                    if (
                        defaultConversationId &&
                        payload.conversations.some((c) => c.id === defaultConversationId)
                    ) {
                        return defaultConversationId;
                    }
                    return isMobile ? '' : payload.conversations[0]?.id ?? '';
                })();
                setActiveConversationId(initialActive);
            } catch (error) {
                console.error('messenger: load conversations failed', error);
            } finally {
                setLoadingConversations(false);
            }
        },
        [defaultConversationId, isMobile]
    );

    React.useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    React.useEffect(() => {
        if (!socketReady || !socketRef.current) return;
        if (!conversations.length) return;
        const socket = socketRef.current;
        conversations.forEach((conversation) => {
            if (joinedConversationsRef.current.has(conversation.id)) return;
            socket.emit('chat:join', { conversationId: conversation.id });
            joinedConversationsRef.current.add(conversation.id);
        });
    }, [socketReady, conversations]);

    React.useEffect(() => {
        if (!isMobile) {
            setMobileView('list');
            return;
        }
        if (isMobile && activeConversationId) {
            setMobileView('chat');
        }
    }, [isMobile, activeConversationId]);

    React.useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    const loadParticipants = React.useCallback(async () => {
        setParticipantsError(null);
        setLoadingParticipants(true);
        try {
            const res = await fetch('/api/messenger/participants', { cache: 'no-store' });
            const payload = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                participants?: ParticipantOption[];
                userEmail?: string;
                error?: string;
            };
            if (!res.ok || payload.ok !== true || !payload.participants) {
                console.error('messenger: load participants failed', payload.error);
                setParticipantsError('Не удалось загрузить участников');
                return;
            }
            setParticipants(payload.participants);
            if (payload.userEmail) {
                setUserEmail((prev) => prev || normalizeEmail(payload.userEmail));
            }
        } catch (error) {
            console.error('messenger: load participants failed', error);
            setParticipantsError('Не удалось загрузить участников');
        } finally {
            setLoadingParticipants(false);
        }
    }, []);

    const markConversationAsRead = React.useCallback(
        async (conversationId: string) => {
            if (!conversationId) return;
            if (!isConversationVisible(conversationId)) return;
            setConversations((prev) =>
                prev.map((item) =>
                    item.id === conversationId ? { ...item, unreadCount: 0 } : item
                )
            );
            setMessagesByConversation((prev) => {
                const messages = prev[conversationId] ?? [];
                const next = messages.map((m) =>
                    m.readBy.includes(userEmail) ? m : { ...m, readBy: [...m.readBy, userEmail] }
                );
                return { ...prev, [conversationId]: next };
            });
            try {
                await fetch('/api/messenger/messages/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId }),
                });
            } catch (error) {
                console.error('messenger: mark read failed', error);
            }
        },
        [isConversationVisible, userEmail]
    );

    const loadMessages = React.useCallback(
        async (conversationId: string) => {
            if (!conversationId) return;
            setLoadingMessages(true);
            try {
                const res = await fetch(`/api/messenger/conversations/${conversationId}/messages`, {
                    cache: 'no-store',
                });
                const payload = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    messages?: MessengerMessageDTO[];
                    error?: string;
                };
                if (!res.ok || payload.ok !== true || !payload.messages) {
                    console.error('messenger: load messages failed', payload.error);
                } else {
                    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: payload.messages ?? [] }));
                    await markConversationAsRead(conversationId);
                }
            } catch (error) {
                console.error('messenger: load messages failed', error);
            } finally {
                setLoadingMessages(false);
            }
        },
        [markConversationAsRead]
    );

    React.useEffect(() => {
        if (!activeConversationId) return;
        void loadMessages(activeConversationId);
    }, [activeConversationId, loadMessages]);

    React.useEffect(() => {
        if (!activeConversationId) return;
        if (!activeConversationVisible) return;
        void markConversationAsRead(activeConversationId);
    }, [activeConversationId, activeConversationVisible, markConversationAsRead]);

    const scrollMessagesToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        const container = chatContainerRef.current;
        if (!container) return;
        const scroll = () => {
            try {
                container.scrollTo({ top: container.scrollHeight, behavior });
            } catch {
                container.scrollTop = container.scrollHeight;
            }
        };
        requestAnimationFrame(scroll);
    }, []);

    const applyMessageDeletion = React.useCallback(
        (conversationId: string, messageId: string, readBy?: string[]) => {
            if (!conversationId || !messageId) return;
            if (deletedMessageIdsRef.current.has(messageId)) return;
            deletedMessageIdsRef.current.add(messageId);

            let removedUnread = false;
            setMessagesByConversation((prev) => {
                const existing = prev[conversationId] ?? [];
                if (!existing.length) return prev;
                const target = existing.find((msg) => msg.id === messageId);
                if (!target) return prev;
                if (userEmail && !target.readBy.includes(userEmail)) {
                    removedUnread = true;
                }
                const next = existing.filter((msg) => msg.id !== messageId);
                return { ...prev, [conversationId]: next };
            });

            const shouldDecrement =
                !!userEmail && (removedUnread || (Array.isArray(readBy) && !readBy.includes(userEmail)));
            if (shouldDecrement) {
                setConversations((prev) =>
                    prev.map((item) =>
                        item.id === conversationId
                            ? { ...item, unreadCount: Math.max(0, (item.unreadCount ?? 0) - 1) }
                            : item
                    )
                );
            }
        },
        [userEmail]
    );

    const openMediaViewer = React.useCallback(
        (
            attachments: MessengerMessageDTO['attachments'],
            index: number,
            meta?: {
                caption?: string;
                senderLabel?: string;
                createdAt?: string;
                messageId?: string;
                conversationId?: string;
                canDelete?: boolean;
            }
        ) => {
            if (!attachments?.length) return;
            setViewerState({
                open: true,
                attachments,
                index,
                caption: meta?.caption,
                senderLabel: meta?.senderLabel,
                createdAt: meta?.createdAt,
                messageId: meta?.messageId,
                conversationId: meta?.conversationId,
                canDelete: meta?.canDelete,
            });
        },
        []
    );

    const closeMediaViewer = React.useCallback(() => {
        setViewerState((prev) => ({ ...prev, open: false }));
    }, []);

    const removeTypingUser = React.useCallback((conversationId: string, email?: string) => {
        if (!conversationId) return;
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            // no email provided — clear all typing indicators for the conversation
            Object.keys(typingTimeoutsRef.current).forEach((key) => {
                if (key.startsWith(`${conversationId}:`)) {
                    clearTimeout(typingTimeoutsRef.current[key]);
                    delete typingTimeoutsRef.current[key];
                }
            });
            setTypingByConversation((prev) => {
                if (!prev[conversationId]) return prev;
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            return;
        }
        const timeoutKey = `${conversationId}:${normalizedEmail}`;
        const existingTimer = typingTimeoutsRef.current[timeoutKey];
        if (existingTimer) {
            clearTimeout(existingTimer);
            delete typingTimeoutsRef.current[timeoutKey];
        }
        setTypingByConversation((prev) => {
            const existing = prev[conversationId] ?? [];
            const next = existing.filter((item) => normalizeEmail(item.userEmail) !== normalizedEmail);
            if (next.length === existing.length) return prev;
            return { ...prev, [conversationId]: next };
        });
    }, []);

    const scheduleTypingCleanup = React.useCallback(
        (conversationId: string, email?: string) => {
            const normalizedEmail = normalizeEmail(email) || `unknown-${conversationId}`;
            if (!conversationId) return;
            const timeoutKey = `${conversationId}:${normalizedEmail}`;
            const existingTimer = typingTimeoutsRef.current[timeoutKey];
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            typingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
                removeTypingUser(conversationId, normalizedEmail);
            }, 3500);
        },
        [removeTypingUser]
    );

    const emitTypingStatus = React.useCallback(
        (isTyping: boolean, conversationId?: string) => {
            const targetConversationId = conversationId ?? activeConversationId;
            if (!socketReady || !socketRef.current || !targetConversationId) return;
            const email = userEmail || 'unknown';
            // ensure we are in the room before broadcasting typing
            socketRef.current.emit('chat:join', { conversationId: targetConversationId });
            socketRef.current.emit('chat:typing', {
                conversationId: targetConversationId,
                userEmail: email,
                userName: formatNameFromEmail(email),
                isTyping,
            });
        },
        [activeConversationId, socketReady, userEmail]
    );

    const notifyTyping = React.useCallback(() => {
        if (!activeConversationId) return;
        if (!typingActiveRef.current || typingConversationRef.current !== activeConversationId) {
            emitTypingStatus(true, activeConversationId);
        }
        typingActiveRef.current = true;
        typingConversationRef.current = activeConversationId;
        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
        }
        typingStopTimeoutRef.current = setTimeout(() => {
            typingActiveRef.current = false;
            emitTypingStatus(false, activeConversationId);
        }, 3200);
    }, [activeConversationId, emitTypingStatus]);

    const stopTyping = React.useCallback(() => {
        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }
        if (typingActiveRef.current && typingConversationRef.current) {
            emitTypingStatus(false, typingConversationRef.current);
        }
        typingActiveRef.current = false;
    }, [emitTypingStatus]);

    const buildMessagePreview = React.useCallback((message?: MessengerMessageDTO | null) => {
        if (!message) return '';
        const normalizedText = truncatePreview(message.text);
        if (normalizedText) return normalizedText;
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        if (!attachments.length) return '';
        const hasVideo = attachments.some((item) => item.kind === 'video');
        const hasImage = attachments.some((item) => item.kind === 'image');
        if (hasVideo && hasImage) return 'Фото и видео';
        if (hasVideo) return attachments.length > 1 ? 'Видео' : 'Видео';
        if (hasImage) return attachments.length > 1 ? 'Фото' : 'Фото';
        return attachments.length > 1 ? 'Медиафайлы' : 'Медиафайл';
    }, []);

    const handleTypingEvent = React.useCallback(
        (payload: { conversationId?: string; userEmail?: string; userName?: string; isTyping?: boolean }) => {
            const conversationId = payload.conversationId ?? '';
            if (!conversationId) return;
            const normalizedEmail = normalizeEmail(payload.userEmail) || `unknown-${conversationId}`;
            if (normalizedEmail === userEmail) return;
            if (payload.isTyping === false) {
                removeTypingUser(conversationId, normalizedEmail);
                return;
            }
            setTypingByConversation((prev) => {
                const existing = prev[conversationId] ?? [];
                const alreadyPresent = existing.some(
                    (item) => normalizeEmail(item.userEmail) === normalizedEmail
                );
                const next = alreadyPresent
                    ? existing
                    : [...existing, { userEmail: normalizedEmail, userName: payload.userName }];
                if (next === existing) return prev;
                return { ...prev, [conversationId]: next };
            });
            scheduleTypingCleanup(conversationId, normalizedEmail);
        },
        [removeTypingUser, scheduleTypingCleanup, userEmail]
    );

    React.useEffect(() => {
        const prevConversation = typingConversationRef.current;
        if (prevConversation && prevConversation !== activeConversationId) {
            stopTyping();
        }
        typingConversationRef.current = activeConversationId;
    }, [activeConversationId, stopTyping]);

    React.useEffect(() => {
        const timers = typingTimeoutsRef.current;
        return () => {
            stopTyping();
            Object.values(timers).forEach((timer) => clearTimeout(timer));
        };
    }, [stopTyping]);

    React.useEffect(() => {
        if (!socketReady || !socketRef.current) return;
        const socket = socketRef.current;
        const joinAll = () => {
            conversations.forEach((conversation) => {
                if (joinedConversationsRef.current.has(conversation.id)) return;
                socket.emit('chat:join', { conversationId: conversation.id });
                joinedConversationsRef.current.add(conversation.id);
            });
        };
        const handleConnect = () => {
            joinAll();
        };
        socket.on('connect', handleConnect);
        socket.io.on('reconnect', handleConnect);
        if (socket.connected) {
            joinAll();
        }
        return () => {
            socket.off('connect', handleConnect);
            socket.io.off('reconnect', handleConnect);
        };
    }, [socketReady, conversations]);

    React.useEffect(() => {
        if (!activeConversationVisible) return;
        scrollMessagesToBottom(activeMessages.length > 1 ? 'smooth' : 'auto');
    }, [activeConversationVisible, activeConversationId, activeMessages.length, scrollMessagesToBottom]);

    React.useEffect(() => {
        if (!activeConversationVisible || !activeConversationId) return;
        const key = `${activeConversationId}-${isOpen}-${mobileView}`;
        if (lastScrollKeyRef.current === key) return;
        lastScrollKeyRef.current = key;
        scrollMessagesToBottom('auto');
    }, [activeConversationVisible, activeConversationId, isOpen, mobileView, scrollMessagesToBottom]);

    React.useEffect(() => {
        if (!contactPickerOpen) return;
        if (participants.length) return;
        void loadParticipants();
    }, [contactPickerOpen, loadParticipants, participants.length]);

    React.useEffect(() => {
        if (!socketReady || !socketRef.current || !activeConversationId) return;
        const socket = socketRef.current;
        socket.emit('chat:join', { conversationId: activeConversationId });
    }, [socketReady, activeConversationId]);

    const upsertConversation = React.useCallback((conversation: MessengerConversationDTO) => {
        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === conversation.id);
            if (idx === -1) return [...prev, conversation];
            const next = [...prev];
            next[idx] = { ...next[idx], ...conversation };
            return next;
        });
    }, []);

    React.useEffect(() => {
        if (!socketReady || !socketRef.current) return;
        const socket = socketRef.current;

        const handleNewMessage = (message: MessengerMessageDTO) => {
            if (message.id && seenMessageIdsRef.current.has(message.id)) return;
            if (message.id) {
                seenMessageIdsRef.current.add(message.id);
            }
            removeTypingUser(message.conversationId, message.senderEmail);
            const knownConversation = conversations.some((c) => c.id === message.conversationId);
            if (!knownConversation) {
                void loadConversations({ preferActiveId: message.conversationId, preserveActive: true });
            }
            const isOwnMessage = message.senderEmail === userEmail;
            const isViewed = isConversationVisible(message.conversationId);
            let added = false;
            setMessagesByConversation((prev) => {
                const prevMessages = prev[message.conversationId] ?? [];
                if (prevMessages.some((m) => m.id === message.id)) return prev;
                added = true;
                return {
                    ...prev,
                    [message.conversationId]: [...prevMessages, message],
                };
            });
            if (!isOwnMessage) {
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === message.conversationId && c.type === 'direct'
                            ? {
                                  ...c,
                                  counterpartIsOnline: true,
                                  counterpartLastActive: message.createdAt,
                              }
                            : c
                    )
                );
            }
            if (added) {
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === message.conversationId
                            ? {
                                  ...c,
                                  unreadCount: isOwnMessage || isViewed ? 0 : (c.unreadCount ?? 0) + 1,
                                  lastMessagePreview: buildMessagePreview(message),
                                  lastMessageAttachment: message.attachments?.[0],
                              }
                            : c
                    )
                );
            }

            if (added && isViewed) {
                scrollMessagesToBottom();
            }
            if (isViewed && added) {
                void markConversationAsRead(message.conversationId);
            }
        };

        const handleRead = (payload: { conversationId: string; userEmail: string; messageIds: string[] }) => {
            setMessagesByConversation((prev) => {
                const existing = prev[payload.conversationId] ?? [];
                if (!existing.length) return prev;
                const next = existing.map((msg) =>
                    payload.messageIds.includes(msg.id) && !msg.readBy.includes(payload.userEmail)
                        ? { ...msg, readBy: [...msg.readBy, payload.userEmail] }
                        : msg
                );
                return { ...prev, [payload.conversationId]: next };
            });
        };

        const handleUnread = (payload: { conversationId: string; unreadCount: number; userEmail?: string }) => {
            const targetEmail = normalizeEmail(payload.userEmail);
            if (targetEmail && userEmail && targetEmail !== userEmail) return;
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === payload.conversationId
                        ? { ...c, unreadCount: payload.unreadCount }
                        : c
                    )
            );
        };

        const handleMessageDeleted = (payload: {
            conversationId: string;
            messageId: string;
            readBy?: string[];
            deletedBy?: string;
        }) => {
            applyMessageDeletion(payload.conversationId, payload.messageId, payload.readBy);
        };

        const handleMessageUpdated = (message: MessengerMessageDTO) => {
            setMessagesByConversation((prev) => {
                const existing = prev[message.conversationId] ?? [];
                if (!existing.length) return prev;
                const isLastMessage = existing[existing.length - 1]?.id === message.id;
                const next = existing.map((item) => (item.id === message.id ? { ...item, ...message } : item));
                if (isLastMessage) {
                    setConversations((prevConversations) =>
                        prevConversations.map((item) =>
                            item.id === message.conversationId
                                ? { ...item, lastMessagePreview: buildMessagePreview(message) }
                                : item
                        )
                    );
                }
                return { ...prev, [message.conversationId]: next };
            });
        };

        socket.on('chat:message:new', handleNewMessage);
        socket.on('chat:message:updated', handleMessageUpdated);
        socket.on('chat:message:deleted', handleMessageDeleted);
        socket.on('chat:read', handleRead);
        socket.on('chat:unread', handleUnread);
        socket.on('chat:typing', handleTypingEvent);

        return () => {
            socket.off('chat:message:new', handleNewMessage);
            socket.off('chat:message:updated', handleMessageUpdated);
            socket.off('chat:message:deleted', handleMessageDeleted);
            socket.off('chat:read', handleRead);
            socket.off('chat:unread', handleUnread);
            socket.off('chat:typing', handleTypingEvent);
        };
    }, [
        socketReady,
        activeConversationId,
        userEmail,
        markConversationAsRead,
        conversations,
        loadConversations,
        isConversationVisible,
        scrollMessagesToBottom,
        removeTypingUser,
        handleTypingEvent,
        applyMessageDeletion,
        buildMessagePreview,
    ]);

    React.useEffect(() => {
        if (!socketReady || !socketRef.current || !userEmail) return;
        const socket = socketRef.current;
        const sendHeartbeat = () => {
            socket.emit('chat:presence', { email: userEmail, isOnline: true });
        };
        sendHeartbeat();
        const intervalId = setInterval(sendHeartbeat, 25_000);

        const handlePresenceEvent = (payload: { userId: string; email?: string; isOnline: boolean; lastActive?: string }) => {
            const normalizedEmail = normalizeEmail(payload.email);
            if (!normalizedEmail) return;
            setConversations((prev) =>
                prev.map((conversation) => {
                    if (conversation.type !== 'direct') return conversation;
                    const counterpartEmail =
                        normalizeEmail(conversation.counterpartEmail) ||
                        normalizeEmail(
                            conversation.participants.find((participant) => normalizeEmail(participant) !== userEmail)
                        );
                    if (counterpartEmail && counterpartEmail === normalizedEmail) {
                        return {
                            ...conversation,
                            counterpartIsOnline: payload.isOnline,
                            counterpartLastActive: payload.lastActive ?? conversation.counterpartLastActive,
                        };
                    }
                    return conversation;
                })
            );
        };

        socket.on('chat:presence', handlePresenceEvent);

        return () => {
            clearInterval(intervalId);
            socket.off('chat:presence', handlePresenceEvent);
        };
    }, [socketReady, userEmail]);

    const handleSelectConversation = (conversationId: string) => {
        setActiveConversationId(conversationId);
        setReplyingTo(null);
        setEditingMessage(null);
        setMessageMenu(null);
        if (isMobile) {
            setMobileView('chat');
        }
    };

    const handleSendMessage = async () => {
        if (!activeConversationId) return;
        if (sendingMessage) return;
        const text = draftMessage.trim();

        if (editingMessage) {
            if (!text) return;
            if (editingMessage.conversationId !== activeConversationId) {
                setEditingMessage(null);
                return;
            }
            setSendingMessage(true);
            setMediaError(null);
            stopTyping();
            try {
                const res = await fetch(`/api/messenger/messages/${editingMessage.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                });
                const payload = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    message?: MessengerMessageDTO;
                    error?: string;
                };
                if (res.ok && payload.ok && payload.message) {
                    setMessagesByConversation((prev) => {
                        const prevMessages = prev[activeConversationId] ?? [];
                        const isLastMessage = prevMessages[prevMessages.length - 1]?.id === payload.message?.id;
                        const next = prevMessages.map((item) =>
                            item.id === payload.message?.id ? { ...item, ...payload.message } : item
                        );
                        if (isLastMessage) {
                            setConversations((prevConversations) =>
                                prevConversations.map((item) =>
                                    item.id === activeConversationId
                                        ? { ...item, lastMessagePreview: buildMessagePreview(payload.message) }
                                        : item
                                )
                            );
                        }
                        return { ...prev, [activeConversationId]: next };
                    });
                    setEditingMessage(null);
                    setDraftMessage('');
                    if (isConversationVisible(activeConversationId)) {
                        scrollMessagesToBottom();
                    }
                } else {
                    setMediaError(payload.error || 'Не удалось отредактировать сообщение.');
                }
            } catch (error) {
                console.error('messenger: edit failed', error);
                setMediaError('Не удалось отредактировать сообщение. Попробуйте ещё раз.');
            } finally {
                setSendingMessage(false);
            }
            return;
        }

        if (!text && pendingMedia.length === 0) return;

        const mediaToSend = pendingMedia;
        const replyTarget = replyingTo;
        setDraftMessage('');
        setSendingMessage(true);
        setMediaError(null);
        stopTyping();
        try {
            const res = mediaToSend.length
                ? await fetch('/api/messenger/messages', {
                      method: 'POST',
                      body: (() => {
                          const formData = new FormData();
                          formData.append('conversationId', activeConversationId);
                          if (text) formData.append('text', text);
                          if (replyTarget) {
                              formData.append(
                                  'replyTo',
                                  JSON.stringify({
                                      messageId: replyTarget.id,
                                      text: formatReplyPreview(replyTarget),
                                      senderEmail: replyTarget.senderEmail,
                                      senderName: replyTarget.senderName,
                                      createdAt: replyTarget.createdAt,
                                  })
                              );
                          }
                          mediaToSend.forEach((item) => formData.append('files', item.file));
                          return formData;
                      })(),
                  })
                : await fetch('/api/messenger/messages', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          conversationId: activeConversationId,
                          text,
                          replyTo: replyTarget
                              ? {
                                    messageId: replyTarget.id,
                                    text: formatReplyPreview(replyTarget),
                                    senderEmail: replyTarget.senderEmail,
                                    senderName: replyTarget.senderName,
                                    createdAt: replyTarget.createdAt,
                                }
                              : undefined,
                      }),
                  });
            const payload = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                message?: MessengerMessageDTO;
                error?: string;
            };
            if (res.ok && payload.ok && payload.message) {
                setMessagesByConversation((prev) => {
                    const prevMessages = prev[activeConversationId] ?? [];
                    const exists = prevMessages.some((m) => m.id === payload.message?.id);
                    if (exists) return prev;
                    return {
                        ...prev,
                        [activeConversationId]: [...prevMessages, payload.message as MessengerMessageDTO],
                    };
                });
                setConversations((prev) =>
                    prev.map((item) =>
                        item.id === activeConversationId
                            ? {
                                  ...item,
                                  unreadCount: 0,
                                  lastMessagePreview: buildMessagePreview(payload.message),
                                  lastMessageAttachment: payload.message?.attachments?.[0],
                              }
                            : item
                    )
                );
                if (isConversationVisible(activeConversationId)) {
                    scrollMessagesToBottom();
                }
                clearPendingMedia();
                setReplyingTo(null);
            } else {
                const errorMessage = payload.error || 'Не удалось отправить сообщение.';
                setDraftMessage(text);
                setPendingMedia(mediaToSend);
                setMediaError(errorMessage);
            }
        } catch (error) {
            console.error('messenger: send failed', error);
            setDraftMessage(text);
            setPendingMedia(mediaToSend);
            setMediaError('Не удалось отправить сообщение. Попробуйте ещё раз.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleDeleteMessage = async (messageId: string, conversationId: string) => {
        if (!messageId || !conversationId) return;
        if (deletingMessageIds[messageId]) return;
        const confirmed = window.confirm('Удалить сообщение?');
        if (!confirmed) return;
        setDeletingMessageIds((prev) => ({ ...prev, [messageId]: true }));
        try {
            const res = await fetch(`/api/messenger/messages/${messageId}`, { method: 'DELETE' });
            const payload = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                conversationId?: string;
                messageId?: string;
                readBy?: string[];
                error?: string;
            };
            if (!res.ok || !payload.ok) {
                console.error('messenger: delete message failed', payload.error);
                window.alert(payload.error || 'Не удалось удалить сообщение.');
                return;
            }
            applyMessageDeletion(payload.conversationId ?? conversationId, payload.messageId ?? messageId, payload.readBy);
        } catch (error) {
            console.error('messenger: delete message failed', error);
            window.alert('Не удалось удалить сообщение.');
        } finally {
            setDeletingMessageIds((prev) => {
                const next = { ...prev };
                delete next[messageId];
                return next;
            });
        }
    };

    const handleOpenMessageMenu = (event: React.MouseEvent, message: MessengerMessageDTO) => {
        event.preventDefault();
        setMessageMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
            message,
        });
    };

    const handleCloseMessageMenu = () => {
        setMessageMenu(null);
    };

    const handleReplyMessage = (message: MessengerMessageDTO) => {
        setReplyingTo(message);
        setEditingMessage(null);
        handleCloseMessageMenu();
        setTimeout(() => {
            draftInputRef.current?.focus();
        }, 0);
    };

    const handleEditMessage = (message: MessengerMessageDTO) => {
        setEditingMessage(message);
        setReplyingTo(null);
        setDraftMessage(message.text || '');
        clearPendingMedia();
        setMediaError(null);
        handleCloseMessageMenu();
        setTimeout(() => {
            draftInputRef.current?.focus();
        }, 0);
    };

    const handleCopyMessage = async (message: MessengerMessageDTO) => {
        if (!message.text) {
            handleCloseMessageMenu();
            return;
        }
        try {
            await navigator.clipboard.writeText(message.text);
        } catch (error) {
            console.error('messenger: copy failed', error);
        } finally {
            handleCloseMessageMenu();
        }
    };

    const createProjectChat = async () => {
        const projectKey = prompt('Введите ключ проекта (например, ALPHA):')?.trim();
        if (!projectKey) return;
        try {
            const res = await fetch('/api/messenger/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'project', projectKey }),
            });
            const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; conversation?: MessengerConversationDTO };
            if (res.ok && payload.ok && payload.conversation) {
                upsertConversation(payload.conversation);
                setActiveConversationId(payload.conversation.id);
            }
        } catch (error) {
            console.error('messenger: create project chat failed', error);
        }
    };

    const handleCreateProjectFromPicker = async () => {
        await createProjectChat();
        setContactPickerOpen(false);
    };

    const createDirectChat = React.useCallback(
        async (targetEmail: string) => {
            if (!targetEmail) return;
            setCreatingChatWith(targetEmail);
            try {
                const res = await fetch('/api/messenger/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'direct', targetEmail }),
                });
                const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; conversation?: MessengerConversationDTO };
                if (res.ok && payload.ok && payload.conversation) {
                    upsertConversation(payload.conversation);
                    setActiveConversationId(payload.conversation.id);
                    setContactPickerOpen(false);
                } else {
                    setParticipantsError('Не удалось создать чат');
                }
            } catch (error) {
                console.error('messenger: create direct chat failed', error);
                setParticipantsError('Не удалось создать чат');
            } finally {
                setCreatingChatWith(null);
            }
        },
        [upsertConversation]
    );

    React.useEffect(() => {
        if (!isOpen || !directTargetRequest?.email) return;
        void createDirectChat(directTargetRequest.email);
    }, [createDirectChat, directTargetRequest, isOpen]);

    const handleOpenContactPicker = () => {
        setContactPickerOpen(true);
        setContactSearch('');
        setParticipantsError(null);
        if (!participants.length && !loadingParticipants) {
            void loadParticipants();
        }
    };

    const handleCloseContactPicker = () => {
        setContactPickerOpen(false);
        setParticipantsError(null);
        setCreatingChatWith(null);
    };

    const handleBackToList = () => {
        setMobileView('list');
    };

    const formatReplyPreview = React.useCallback(
        (message?: MessengerMessageDTO | null) => {
            if (!message) return '';
            const preview = buildMessagePreview(message);
            return preview || 'Сообщение';
        },
        [buildMessagePreview]
    );

    const getLastMessagePreview = React.useCallback(
        (conversation: MessengerConversationDTO) => {
            const conversationMessages = messagesByConversation[conversation.id];
            const lastMessage = conversationMessages?.[conversationMessages.length - 1];
            const previewFromMessages = buildMessagePreview(lastMessage);
            if (previewFromMessages) return previewFromMessages;
            return conversation.lastMessagePreview ? truncatePreview(conversation.lastMessagePreview) : '';
        },
        [buildMessagePreview, messagesByConversation]
    );

    const getLastAttachmentPreview = React.useCallback(
        (conversation: MessengerConversationDTO) => {
            const cachedList = messagesByConversation[conversation.id] ?? [];
            const cachedMessage = cachedList[cachedList.length - 1];
            const cachedAttachment = cachedMessage?.attachments?.[0];
            return cachedAttachment ?? conversation.lastMessageAttachment;
        },
        [messagesByConversation]
    );

    const getDirectDisplayName = React.useCallback(
        (conversation: MessengerConversationDTO) => {
            if (conversation.type !== 'direct') return conversation.title;
            const counterpartName = conversation.counterpartName?.trim();
            const normalizedTitle = conversation.title?.trim();
            const isPlaceholder =
                normalizedTitle?.toLowerCase() === 'личный чат' || normalizedTitle?.toLowerCase() === 'personal chat';
            if (counterpartName) {
                return counterpartName;
            }
            if (normalizedTitle && !isPlaceholder) {
                return normalizedTitle.includes('@')
                    ? formatNameFromEmail(normalizedTitle)
                    : normalizedTitle;
            }
            const counterpart = conversation.participants.find(
                (participant) => normalizeEmail(participant) !== userEmail
            );
            const fallbackCounterpart = conversation.counterpartEmail || counterpart;
            if (fallbackCounterpart) {
                const normalizedCounterpart = fallbackCounterpart.trim();
                return normalizedCounterpart.includes('@')
                    ? formatNameFromEmail(normalizedCounterpart)
                    : normalizedCounterpart;
            }
            return normalizedTitle || conversation.title;
        },
        [userEmail]
    );

    const renderConversationTitle = (conversation: MessengerConversationDTO) => {
        const displayTitle = conversation.type === 'direct' ? getDirectDisplayName(conversation) : conversation.title;
        return (
            <Stack direction='row' spacing={1} alignItems='center'>
                {conversation.type !== 'direct' ? scopeIconMap[conversation.type] : null}
                <Typography variant='subtitle2' noWrap>
                    {displayTitle}
                </Typography>
            </Stack>
        );
    };

    const renderConversationSecondary = (conversation: MessengerConversationDTO) => {
        const typingUsers =
            (typingByConversation[conversation.id] ?? []).filter(
                (item) => normalizeEmail(item.userEmail) && normalizeEmail(item.userEmail) !== userEmail
            );
        const isTyping = typingUsers.length > 0;
        const lastText = getLastMessagePreview(conversation);
        if (conversation.type === 'direct') {
            return (
                <Stack spacing={0.25}>
                    {isTyping ? (
                        <Typography variant='body2' color='primary.main' noWrap>
                            {formatTypingLabel(typingUsers)}
                        </Typography>
                    ) : lastText ? (
                        <Typography variant='body2' color='text.secondary' noWrap>
                            {lastText}
                        </Typography>
                    ) : null}
                </Stack>
            );
        }

        return (
            <Stack spacing={0.5}>
                {isTyping ? (
                    <Typography variant='body2' color='primary.main' noWrap>
                        {formatTypingLabel(typingUsers)}
                    </Typography>
                ) : lastText ? (
                    <Typography
                        variant='body2'
                        color='text.secondary'
                        noWrap
                    >
                        {lastText}
                    </Typography>
                ) : null}
                {conversation.projectKey ? (
                    <Typography
                        variant='body2'
                        color='text.secondary'
                    >
                        Проект: {conversation.projectKey}
                    </Typography>
                ) : null}
                <Typography
                    variant='caption'
                    color='text.secondary'
                >
                    {conversation.participants.join(', ') || 'все в организации'}
                </Typography>
            </Stack>
        );
    };

    const activeConversationSubtitle = React.useMemo(() => {
        if (!activeConversation) {
            return 'Выберите или создайте чат, чтобы начать переписку.';
        }
        if (activeConversation.projectKey) {
            return `Проектный чат · ${activeConversation.projectKey}`;
        }
        if (activeConversation.type === 'direct') {
            const isOnline = activeConversation.counterpartIsOnline;
            const lastSeen = activeConversation.counterpartLastActive ?? activeLastActivity;
            if (isOnline === true) {
                return 'Online';
            }
            if (isOnline === false && lastSeen) {
                return `Был(а) в сети ${formatDateWithTime(lastSeen)}`;
            }
            if (lastSeen) {
                return `Был(а) в сети ${formatDateWithTime(lastSeen)}`;
            }
            return 'Статус недоступен';
        }
        return 'Организационный чат';
    }, [activeConversation, activeLastActivity]);

    const isActiveCounterpartOnline =
        activeConversation?.type === 'direct' && activeConversation.counterpartIsOnline;

    const showWindowActions = !isMobile && (onCloseAction || onToggleFullScreenAction);

    const activeConversationAvatar = React.useMemo(() => {
        if (!activeConversation) return null;
        if (activeConversation.type === 'direct') {
            const name = getDirectDisplayName(activeConversation);
            return {
                src: activeConversation.counterpartAvatar || undefined,
                label: name?.[0]?.toUpperCase() || 'U',
                color: 'info.main' as const,
            };
        }
        const label = activeConversation.title?.[0]?.toUpperCase() || 'C';
        const color = activeConversation.type === 'project' ? 'secondary.main' : 'primary.main';
        return { src: undefined, label, color };
    }, [activeConversation, getDirectDisplayName]);

    const viewerAttachments = viewerState.attachments ?? [];
    const viewerAttachment = viewerAttachments[viewerState.index];
    const viewerTitleParts = [
        viewerState.senderLabel,
        viewerState.createdAt ? formatDateWithTime(viewerState.createdAt) : null,
    ].filter(Boolean);
    const viewerTitle = viewerTitleParts.join(' · ');
    const messageMenuTarget = messageMenu?.message;
    const menuIsOwnMessage = normalizeEmail(messageMenuTarget?.senderEmail) === userEmail;

    return (
        <>
            <Paper
                variant='outlined'
                sx={{
                    display: 'grid',
                    gridTemplateColumns:
                        showListPane && showChatPane ? { xs: '1fr', sm: '320px 1fr' } : '1fr',
                    gap: { xs: 0, sm: 1 },
                    borderRadius: 0,
                    overflow: 'hidden',
                    borderColor: 'divider',
                    minHeight: isMobile ? '100dvh' : 420,
                    width: '100%',
                    maxWidth: '100%',
                    height: isMobile ? '100dvh' : '100%',
                    maxHeight: isMobile ? '100dvh' : '100%',
                    background: shellBg,
                    backdropFilter: 'blur(18px)',
                    boxShadow: isMobile
                        ? 'none'
                        : isDark
                            ? '0 25px 60px rgba(0,0,0,0.55)'
                            : '0 18px 45px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.45)',
                    boxSizing: 'border-box',
                }}
            >
                <Box
                    sx={{
                        display: showListPane ? 'flex' : 'none',
                        flexDirection: 'column',
                        borderRight: {
                            xs: 'none',
                            sm: (theme) => `1px solid ${theme.palette.divider}`,
                        },
                        background: listBg,
                        height: '100%',
                        maxHeight: '100%',
                        minHeight: 0,
                    }}
                >
                    <Stack spacing={1.5} p={2}>
                        <Stack
                            direction='row'
                            spacing={1}
                            alignItems='center'
                            sx={{ minWidth: 0 }}
                        >
                            <OutlinedInput
                                sx={{ flex: 1, minWidth: 0, width: 'auto' }}
                                size='small'
                                placeholder='Поиск по участникам и чатам'
                                value={conversationSearch}
                                onChange={(event) => setConversationSearch(event.target.value)}
                                startAdornment={
                                    <InputAdornment position='start'>
                                        <SearchIcon fontSize='small' />
                                    </InputAdornment>
                                }
                                endAdornment={
                                    conversationSearch ? (
                                        <InputAdornment position='end'>
                                            <IconButton
                                                size='small'
                                                edge='end'
                                                onClick={() => setConversationSearch('')}
                                                aria-label='Очистить поиск'
                                            >
                                                <ClearIcon fontSize='small' />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null
                                }
                            />
                            {!isMobile ? (
                                <Tooltip title='Новое сообщение'>
                                    <IconButton
                                        color='primary'
                                        onClick={handleOpenContactPicker}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        <AddCommentIcon />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            {isMobile && onCloseAction ? (
                                <Tooltip title='Закрыть'>
                                    <IconButton
                                        color='default'
                                        onClick={onCloseAction}
                                        sx={{ flexShrink: 0 }}
                                        aria-label='Закрыть мессенджер'
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </Stack>
                    </Stack>
                    <Divider />
                    {loadingConversations ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : filteredConversations.length === 0 ? (
                        <Box
                            sx={{
                                py: 4,
                                px: 2,
                                textAlign: 'center',
                                color: 'text.secondary',
                            }}
                        >
                            Нет чатов по запросу. Создайте новый диалог.
                        </Box>
                    ) : (
                        <List
                            sx={{
                                py: 0,
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                            }}
                        >
                            {filteredConversations.map((conversation) => {
                                const isActive = conversation.id === activeConversationId;
                                const displayTitle =
                                    conversation.type === 'direct'
                                        ? getDirectDisplayName(conversation)
                                        : conversation.title;
                                const avatarLetter =
                                    conversation.type === 'direct'
                                        ? displayTitle?.[0]?.toUpperCase() || 'U'
                                        : conversation.type === 'project'
                                            ? 'P'
                                            : 'O';
                                const avatarSrc =
                                    conversation.type === 'direct'
                                        ? conversation.counterpartAvatar || undefined
                                        : undefined;
                                const conversationMessages = messagesByConversation[conversation.id];
                                const derivedUnread =
                                    userEmail &&
                                    conversationMessages &&
                                    conversationMessages.length
                                        ? conversationMessages.filter((msg) => !msg.readBy.includes(userEmail)).length
                                        : conversation.unreadCount ?? 0;
                                const unreadCount = Math.max(0, Math.floor(derivedUnread));
                                const previewAttachment = getLastAttachmentPreview(conversation);
                                return (
                                    <ListItem
                                        key={conversation.id}
                                        alignItems='flex-start'
                                        disablePadding
                                        sx={{
                                            borderLeft: isActive
                                                ? (theme) => `4px solid ${theme.palette.primary.main}`
                                                : '4px solid transparent',
                                        }}
                                    >
                                        <ListItemButton
                                            onClick={() => handleSelectConversation(conversation.id)}
                                            sx={{
                                                alignItems: 'flex-start',
                                                gap: 1,
                                                backgroundColor: isActive ? listActiveBg : 'transparent',
                                                transition: 'background-color 0.2s ease, transform 0.15s ease',
                                                py: 1.25,
                                                '&:hover': {
                                                    backgroundColor: isActive ? listActiveBg : listHoverBg,
                                                    transform: 'translateX(2px)',
                                                },
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                                    <Avatar
                                                        src={avatarSrc}
                                                        sx={{
                                                            bgcolor:
                                                                conversation.type === 'project'
                                                                    ? 'secondary.main'
                                                                    : conversation.type === 'direct'
                                                                        ? 'info.main'
                                                                        : 'primary.main',
                                                            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                                                        }}
                                                    >
                                                        {avatarLetter}
                                                    </Avatar>
                                                    {conversation.type === 'direct' && conversation.counterpartIsOnline ? (
                                                        <Box
                                                            sx={{
                                                                position: 'absolute',
                                                                right: -2,
                                                                bottom: -2,
                                                                width: 12,
                                                                height: 12,
                                                                borderRadius: '50%',
                                                                backgroundColor: 'success.main',
                                                                border: '2px solid #fff',
                                                            }}
                                                        />
                                                    ) : null}
                                                </Box>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={renderConversationTitle(conversation)}
                                                secondary={renderConversationSecondary(conversation)}
                                            />
                                            {previewAttachment ? (
                                                <Box
                                                    sx={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 1.5,
                                                        overflow: 'hidden',
                                                        backgroundColor: 'rgba(15,23,42,0.08)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        mr: 1,
                                                    }}
                                                >
                                                    {previewAttachment.kind === 'image' ? (
                                                        <Box
                                                            component='img'
                                                            src={previewAttachment.url}
                                                            alt={previewAttachment.filename || 'preview'}
                                                            sx={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    ) : previewAttachment.posterUrl ? (
                                                        <Box
                                                            component='img'
                                                            src={previewAttachment.posterUrl}
                                                            alt={previewAttachment.filename || 'preview'}
                                                            sx={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    ) : (
                                                        <PlayArrowIcon fontSize='small' color='action' />
                                                    )}
                                                </Box>
                                            ) : null}
                                            <Badge
                                                color='secondary'
                                                badgeContent={unreadCount}
                                                invisible={unreadCount <= 0}
                                                sx={{
                                                    alignSelf: 'center',
                                                    ml: 1,
                                                    '& .MuiBadge-badge': {
                                                        fontSize: 12,
                                                        height: 20,
                                                        minWidth: 20,
                                                        right: 4,
                                                        top: 6,
                                                    },
                                                }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Box>
                <Box
                    p={{ xs: 1.5, sm: 2 }}
                    sx={{
                        display: showChatPane ? 'grid' : 'none',
                        gridTemplateRows: 'auto 1fr auto',
                        rowGap: 1.25,
                        background: chatShellBg,
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        height: '100%',
                        minHeight: { xs: 'calc(100dvh - 140px)', sm: 420 },
                        maxHeight: '100%',
                        minWidth: 0,
                    }}
                >
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                            background: chatHeaderBg,
                            pb: 1,
                        }}
                    >
                        <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={1}>
                            <Stack direction='row' alignItems='center' spacing={1.25} flex={1} minWidth={0}>
                                {isMobile && showChatPane ? (
                                    <IconButton size='small' onClick={handleBackToList}>
                                        <ArrowBackIosNewIcon fontSize='small' />
                                    </IconButton>
                                ) : null}
                                <Stack spacing={0.25} minWidth={0}>
                                    <Stack direction='row' spacing={0.75} alignItems='center' minWidth={0}>
                                        {isActiveCounterpartOnline ? (
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    backgroundColor: 'success.main',
                                                    boxShadow: '0 0 0 2px #fff',
                                                }}
                                            />
                                        ) : null}
                                        <Typography variant='subtitle1' fontWeight={700} noWrap>
                                            {activeConversation
                                                ? activeConversation.type === 'direct'
                                                    ? getDirectDisplayName(activeConversation)
                                                    : activeConversation.title
                                                : 'Выберите чат'}
                                        </Typography>
                                    </Stack>
                                    <Typography
                                        variant='caption'
                                        color='text.secondary'
                                        sx={{ pl: isActiveCounterpartOnline ? 2 : 0 }}
                                    >
                                        {activeConversationSubtitle}
                                    </Typography>
                                </Stack>
                            </Stack>
                            <Stack direction='row' alignItems='center' spacing={0.75} flexShrink={0}>
                                {activeConversationAvatar ? (
                                    <Avatar
                                        src={activeConversationAvatar.src}
                                        sx={{
                                            bgcolor: activeConversationAvatar.color,
                                            boxShadow: '0 10px 26px rgba(15,23,42,0.18)',
                                            width: 40,
                                            height: 40,
                                        }}
                                    >
                                        {activeConversationAvatar.label}
                                    </Avatar>
                                ) : null}
                                {showWindowActions ? (
                                    <Stack direction='row' spacing={0.5} alignItems='center'>
                                        {onToggleFullScreenAction ? (
                                            <Tooltip
                                                title={isFullScreen ? 'Свернуть' : 'На весь экран'}
                                            >
                                                <IconButton
                                                    onClick={onToggleFullScreenAction}
                                                    size='small'
                                                    aria-label='Переключить полноэкранный режим'
                                                >
                                                    {isFullScreen ? (
                                                        <FullscreenExitIcon fontSize='small' />
                                                    ) : (
                                                        <FullscreenIcon fontSize='small' />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        ) : null}
                                        {onCloseAction ? (
                                            <Tooltip title='Закрыть'>
                                                <IconButton
                                                    onClick={onCloseAction}
                                                    size='small'
                                                    aria-label='Закрыть мессенджер'
                                                >
                                                    <CloseIcon fontSize='small' />
                                                </IconButton>
                                            </Tooltip>
                                        ) : null}
                                    </Stack>
                                ) : null}
                            </Stack>
                        </Stack>
                        <Divider />
                    </Box>
                    <Box
                        sx={{
                            minHeight: 240,
                            height: '100%',
                            maxHeight: '100%',
                            minWidth: 0,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            px: { xs: 1, sm: 1.5 },
                            py: 1.25,
                            width: '100%',
                            borderRadius: 3,
                            background: messagesBg,
                            boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.75)',
                        }}
                        ref={chatContainerRef}
                    >
                        {loadingMessages && !activeMessages.length ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <CircularProgress size={22} />
                            </Box>
                        ) : activeMessages.length === 0 ? (
                            <Box
                                sx={{
                                    flexGrow: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'text.secondary',
                                    py: 4,
                                }}
                            >
                                {activeConversation ? 'Нет сообщений. Напишите первое!' : 'Чаты появятся здесь.'}
                            </Box>
                        ) : (
                            <Stack spacing={1.25}>
                                {activeMessages.map((message) => {
                                    const isOwn = message.senderEmail === userEmail;
                                    const align = isOwn ? 'flex-end' : 'flex-start';
                                    const bg = isOwn ? messageOwnBg : messageOtherBg;
                                    const isRead = message.readBy?.includes(userEmail);
                                    const attachments = Array.isArray(message.attachments)
                                        ? message.attachments
                                        : [];
                                    const senderLabel = message.senderName || message.senderEmail;
                                    const updatedAt = message.updatedAt;
                                    const isEdited =
                                        !!updatedAt &&
                                        Math.abs(new Date(updatedAt).getTime() - new Date(message.createdAt).getTime()) >
                                            1000;
                                    const metaLabel = `${senderLabel} · ${formatTime(message.createdAt)}${
                                        isEdited ? ` · изменено ${formatTime(updatedAt)}` : ''
                                    }`;
                                    return (
                                        <Stack
                                            key={message.id}
                                            alignItems={align}
                                            spacing={0.5}
                                            sx={{ width: '100%' }}
                                        >
                                            <Typography
                                                variant='caption'
                                                color='text.secondary'
                                                sx={{ pr: isOwn ? 1 : 0 }}
                                            >
                                                {metaLabel}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    maxWidth: { xs: '92%', sm: '80%' },
                                                    background: bg,
                                                    color: isOwn ? '#fff' : 'text.primary',
                                                    px: 1.6,
                                                    py: 1.1,
                                                    borderRadius: 3,
                                                    cursor: 'pointer',
                                                    boxShadow: isOwn
                                                        ? '0 18px 38px rgba(15,23,42,0.18)'
                                                        : isDark
                                                            ? '0 12px 24px rgba(0,0,0,0.4)'
                                                            : '0 6px 18px rgba(15,23,42,0.08)',
                                                    border: !isRead
                                                        ? '1px solid rgba(99,102,241,0.25)'
                                                        : '1px solid transparent',
                                                    backdropFilter: isOwn ? 'blur(0px)' : 'blur(6px)',
                                                    position: 'relative',
                                                }}
                                                onContextMenu={(event) => handleOpenMessageMenu(event, message)}
                                                onClick={(event) => {
                                                    if (!isMobile) return;
                                                    handleOpenMessageMenu(event, message);
                                                }}
                                            >
                                                {message.replyTo ? (
                                                    <Box
                                                        sx={{
                                                            borderLeft: isOwn ? '2px solid rgba(255,255,255,0.7)' : '2px solid rgba(59,130,246,0.7)',
                                                            pl: 1,
                                                            mb: 0.75,
                                                            opacity: 0.9,
                                                        }}
                                                    >
                                                        <Typography variant='caption' sx={{ fontWeight: 600 }}>
                                                            {message.replyTo.senderName || message.replyTo.senderEmail}
                                                        </Typography>
                                                        <Typography variant='caption' noWrap>
                                                            {message.replyTo.text || 'Сообщение'}
                                                        </Typography>
                                                    </Box>
                                                ) : null}
                                                {attachments.length ? (
                                                    <Stack spacing={1} sx={{ mb: message.text ? 1 : 0 }}>
                                                        {attachments.map((item, idx) => (
                                                            <Box
                                                                key={`${item.url}-${idx}`}
                                                                sx={{
                                                                    borderRadius: 2,
                                                                    overflow: 'hidden',
                                                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                                                    cursor: 'pointer',
                                                                }}
                                                                role='button'
                                                                tabIndex={0}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    openMediaViewer(attachments, idx, {
                                                                        caption: message.text || undefined,
                                                                        senderLabel,
                                                                        createdAt: message.createdAt,
                                                                        messageId: message.id,
                                                                        conversationId: message.conversationId,
                                                                        canDelete: isOwn,
                                                                    });
                                                                }}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter') {
                                                                        openMediaViewer(attachments, idx, {
                                                                            caption: message.text || undefined,
                                                                            senderLabel,
                                                                            createdAt: message.createdAt,
                                                                            messageId: message.id,
                                                                            conversationId: message.conversationId,
                                                                            canDelete: isOwn,
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                {item.kind === 'image' ? (
                                                                    <Box
                                                                        component='img'
                                                                        src={item.url}
                                                                        alt={item.filename || 'image'}
                                                                        sx={{
                                                                            display: 'block',
                                                                            width: '100%',
                                                                            maxHeight: 240,
                                                                            objectFit: 'cover',
                                                                        }}
                                                                    />
                                                                ) : (
                                                                <Box
                                                                    sx={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        maxHeight: 260,
                                                                        backgroundColor: '#000',
                                                                    }}
                                                                >
                                                                    {item.posterUrl ? (
                                                                        <Box
                                                                            component='img'
                                                                            src={item.posterUrl}
                                                                            alt={item.filename || 'video'}
                                                                            sx={{
                                                                                display: 'block',
                                                                                width: '100%',
                                                                                maxHeight: 260,
                                                                                objectFit: 'cover',
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <Box
                                                                            sx={{
                                                                                height: 180,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                color: '#fff',
                                                                                fontSize: 14,
                                                                            }}
                                                                        >
                                                                            Видео
                                                                        </Box>
                                                                    )}
                                                                    <Box
                                                                        sx={{
                                                                            position: 'absolute',
                                                                            inset: 0,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            backgroundColor: 'rgba(0,0,0,0.25)',
                                                                        }}
                                                                    >
                                                                        <PlayArrowIcon
                                                                            sx={{
                                                                                fontSize: 42,
                                                                                color: '#fff',
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                </Box>
                                                                )}
                                                            </Box>
                                                        ))}
                                                    </Stack>
                                                ) : null}
                                                {message.text ? (
                                                    <Typography variant='body2'>{message.text}</Typography>
                                                ) : null}
                                            </Box>
                                            {isOwn ? (
                                                <Typography variant='caption' color='text.secondary'>
                                                    {message.readBy.length > 1 ? 'Прочитано' : 'Отправлено'}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>
                    <Stack spacing={0.75} sx={{ pb: { xs: 'max(env(safe-area-inset-bottom, 0px), 10px)', sm: 0 } }}>
                        {activeTypingUsers.length ? (
                            <Stack direction='row' spacing={1} alignItems='center' sx={{ px: 1 }}>
                                <Box
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: 'success.main',
                                        animation: 'pulseDot 1.3s ease-in-out infinite',
                                        '@keyframes pulseDot': {
                                            '0%': { transform: 'scale(0.9)', opacity: 0.6 },
                                            '50%': { transform: 'scale(1.1)', opacity: 1 },
                                            '100%': { transform: 'scale(0.9)', opacity: 0.6 },
                                        },
                                    }}
                                />
                                <Typography variant='caption' color='text.secondary'>
                                    {formatTypingLabel(activeTypingUsers)}
                                </Typography>
                            </Stack>
                        ) : null}
                        {editingMessage ? (
                            <Stack
                                direction='row'
                                alignItems='center'
                                spacing={1}
                                sx={{
                                    mx: 1,
                                    px: 1.5,
                                    py: 0.75,
                                    borderRadius: 2,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                                }}
                            >
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant='caption' color='text.secondary'>
                                        Редактирование
                                    </Typography>
                                    <Typography variant='body2' noWrap>
                                        {formatReplyPreview(editingMessage)}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size='small'
                                    onClick={() => {
                                        setEditingMessage(null);
                                        setDraftMessage('');
                                    }}
                                    aria-label='Отменить редактирование'
                                >
                                    <CloseIcon fontSize='inherit' />
                                </IconButton>
                            </Stack>
                        ) : null}
                        {replyingTo ? (
                            <Stack
                                direction='row'
                                alignItems='center'
                                spacing={1}
                                sx={{
                                    mx: 1,
                                    px: 1.5,
                                    py: 0.75,
                                    borderRadius: 2,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                                }}
                            >
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant='caption' color='text.secondary'>
                                        Ответ {replyingTo.senderName || replyingTo.senderEmail}
                                    </Typography>
                                    <Typography variant='body2' noWrap>
                                        {formatReplyPreview(replyingTo)}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size='small'
                                    onClick={() => setReplyingTo(null)}
                                    aria-label='Отменить ответ'
                                >
                                    <CloseIcon fontSize='inherit' />
                                </IconButton>
                            </Stack>
                        ) : null}
                        {pendingMedia.length ? (
                            <Stack direction='row' spacing={1} sx={{ px: 1, overflowX: 'auto' }}>
                                {pendingMedia.map((item, index) => (
                                    <Box
                                        key={`${item.previewUrl}-${index}`}
                                        sx={{
                                            position: 'relative',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            width: 96,
                                            height: 96,
                                            flexShrink: 0,
                                            backgroundColor: 'rgba(15,23,42,0.08)',
                                        }}
                                    >
                                        {item.kind === 'image' ? (
                                            <Box
                                                component='img'
                                                src={item.previewUrl}
                                                alt={item.file.name}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                component='video'
                                                src={item.previewUrl}
                                                poster={item.previewUrl}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        )}
                                        <IconButton
                                            size='small'
                                            onClick={() => {
                                                const next = pendingMedia.filter((_, idx) => idx !== index);
                                                URL.revokeObjectURL(item.previewUrl);
                                                setPendingMedia(next);
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4,
                                                backgroundColor: 'rgba(0,0,0,0.55)',
                                                color: '#fff',
                                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                                            }}
                                        >
                                            <CloseIcon fontSize='inherit' />
                                        </IconButton>
                                    </Box>
                                ))}
                            </Stack>
                        ) : null}
                        {mediaError ? (
                            <Typography variant='caption' color='error' sx={{ px: 1 }}>
                                {mediaError}
                            </Typography>
                        ) : null}
                        <Stack
                            direction='row'
                            spacing={1}
                            alignItems='center'
                            sx={{
                                borderRadius: 999,
                                backgroundColor: composerBg,
                                px: 1,
                                py: 0.75,
                                boxShadow: composerShadow,
                                border: composerBorder,
                            }}
                        >
                            <IconButton
                                color='primary'
                                onClick={() => fileInputRef.current?.click()}
                                aria-label='Прикрепить файл'
                                disabled={sendingMessage || !!editingMessage}
                            >
                                <AttachFileIcon />
                            </IconButton>
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='image/*,video/*'
                                multiple
                                hidden
                                disabled={sendingMessage || !!editingMessage}
                                onChange={(event) => {
                                    const files = Array.from(event.target.files ?? []);
                                    event.target.value = '';
                                    setMediaError(null);
                                    const totalCount = pendingMediaRef.current.length + files.length;
                                    if (totalCount > MAX_MEDIA_COUNT) {
                                        setMediaError(`Можно прикрепить не более ${MAX_MEDIA_COUNT} файлов`);
                                        return;
                                    }
                                    const totalBytes = pendingMediaRef.current.reduce(
                                        (sum, item) => sum + (item.file.size || 0),
                                        0
                                    ) + files.reduce((sum, file) => sum + (file.size || 0), 0);
                                    if (totalBytes > MAX_TOTAL_BYTES) {
                                        setMediaError('Суммарный размер файлов превышает лимит 60 МБ');
                                        return;
                                    }
                                    const items = files
                                        .filter(
                                            (file) =>
                                                file.type.startsWith('image/') || file.type.startsWith('video/')
                                        )
                                        .filter((file) => {
                                            const limit = file.type.startsWith('video/')
                                                ? MAX_VIDEO_BYTES
                                                : MAX_IMAGE_BYTES;
                                            if (file.size <= limit) return true;
                                            setMediaError(
                                                file.type.startsWith('video/')
                                                    ? 'Видео превышает лимит 50 МБ'
                                                    : 'Фото превышает лимит 10 МБ'
                                            );
                                            return false;
                                        })
                                        .map((file) => ({
                                            file,
                                            previewUrl: URL.createObjectURL(file),
                                            kind: (file.type.startsWith('video/') ? 'video' : 'image') as 'video' | 'image',
                                        }));
                                    if (items.length) {
                                        setPendingMedia((prev) => [...prev, ...items]);
                                    }
                                }}
                            />
                            <TextField
                                fullWidth
                                size='small'
                                label={
                                    editingMessage
                                        ? 'Редактирование сообщения'
                                        : pendingMedia.length
                                            ? 'Добавить подпись'
                                            : undefined
                                }
                                placeholder={
                                    editingMessage
                                        ? 'Обновите текст сообщения...'
                                        : pendingMedia.length
                                            ? 'Добавить подпись...'
                                            : 'Напишите сообщение для коллег или проектной команды...'
                                }
                                value={draftMessage}
                                onChange={(event) => {
                                    setDraftMessage(event.target.value);
                                    notifyTyping();
                                }}
                                onBlur={stopTyping}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        void handleSendMessage();
                                    }
                                }}
                                disabled={sendingMessage}
                                inputRef={draftInputRef}
                                InputProps={{
                                    sx: {
                                        backgroundColor: composerInputBg,
                                        borderRadius: 2,
                                        '& input': {
                                            color: isDark ? 'common.white' : 'text.primary',
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: composerInputBorder,
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                        },
                                        '& .MuiInputBase-input::placeholder': {
                                            color: isDark ? 'rgba(255,255,255,0.6)' : undefined,
                                            opacity: 1,
                                        },
                                    },
                                }}
                            />
                            <IconButton
                                color='primary'
                                onClick={handleSendMessage}
                                aria-label='Отправить сообщение'
                                disabled={sendingMessage || (!draftMessage.trim() && pendingMedia.length === 0)}
                            >
                                <SendIcon />
                            </IconButton>
                        </Stack>
                    </Stack>
                </Box>
            </Paper>
            <Menu
                open={!!messageMenu}
                onClose={handleCloseMessageMenu}
                anchorReference='anchorPosition'
                anchorPosition={
                    messageMenu
                        ? { top: messageMenu.mouseY, left: messageMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem
                    onClick={() => {
                        if (messageMenuTarget) {
                            handleReplyMessage(messageMenuTarget);
                        }
                    }}
                >
                    <ListItemIcon>
                        <ReplyIcon fontSize='small' />
                    </ListItemIcon>
                    Ответить
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (messageMenuTarget) {
                            handleEditMessage(messageMenuTarget);
                        }
                    }}
                    disabled={!menuIsOwnMessage}
                >
                    <ListItemIcon>
                        <EditIcon fontSize='small' />
                    </ListItemIcon>
                    Редактировать
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (messageMenuTarget) {
                            void handleCopyMessage(messageMenuTarget);
                        }
                    }}
                    disabled={!messageMenuTarget?.text}
                >
                    <ListItemIcon>
                        <ContentCopyIcon fontSize='small' />
                    </ListItemIcon>
                    Скопировать текст
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (messageMenuTarget) {
                            void handleDeleteMessage(messageMenuTarget.id, messageMenuTarget.conversationId);
                            handleCloseMessageMenu();
                        }
                    }}
                    disabled={!menuIsOwnMessage || (messageMenuTarget ? deletingMessageIds[messageMenuTarget.id] : false)}
                >
                    <ListItemIcon>
                        <DeleteOutlineIcon fontSize='small' />
                    </ListItemIcon>
                    Удалить
                </MenuItem>
            </Menu>
            <Dialog
                open={viewerState.open}
                onClose={closeMediaViewer}
                fullScreen
                PaperProps={{
                    sx: {
                        backgroundColor: isDark ? 'rgba(10,12,18,0.98)' : 'rgba(255,255,255,0.98)',
                        backdropFilter: 'blur(12px)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        p: 1.5,
                        borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
                    }}
                >
                    <Stack direction='row' alignItems='center' spacing={1}>
                        <IconButton onClick={closeMediaViewer} aria-label='Назад'>
                            <ArrowBackIosNewIcon fontSize='small' />
                        </IconButton>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant='subtitle1' fontWeight={700} noWrap>
                                {viewerTitle || 'Просмотр медиа'}
                            </Typography>
                            {viewerState.caption ? (
                                <Typography variant='body2' color='text.secondary' noWrap>
                                    {viewerState.caption}
                                </Typography>
                            ) : null}
                        </Box>
                        {viewerState.canDelete ? (
                            <IconButton
                                onClick={() => {
                                    if (viewerState.messageId && viewerState.conversationId) {
                                        void handleDeleteMessage(viewerState.messageId, viewerState.conversationId);
                                        closeMediaViewer();
                                    }
                                }}
                                aria-label='Удалить сообщение'
                            >
                                <DeleteOutlineIcon />
                            </IconButton>
                        ) : null}
                    </Stack>
                </DialogTitle>
                <DialogContent
                    sx={{
                        p: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.04)',
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexGrow: 1,
                            minHeight: 0,
                            p: { xs: 2, sm: 3 },
                        }}
                    >
                        {viewerAttachment ? (
                            viewerAttachment.kind === 'image' ? (
                                <Box
                                    component='img'
                                    src={viewerAttachment.url}
                                    alt={viewerAttachment.filename || 'image'}
                                    sx={{
                                        maxWidth: '100%',
                                        maxHeight: '78vh',
                                        borderRadius: 2,
                                        boxShadow: isDark
                                            ? '0 24px 60px rgba(0,0,0,0.6)'
                                            : '0 18px 40px rgba(15,23,42,0.18)',
                                    }}
                                />
                            ) : (
                                <Box
                                    component='video'
                                    src={viewerAttachment.url}
                                    poster={viewerAttachment.posterUrl}
                                    controls
                                    sx={{
                                        width: '100%',
                                        maxHeight: '78vh',
                                        borderRadius: 2,
                                        backgroundColor: '#000',
                                    }}
                                />
                            )
                        ) : (
                            <Typography variant='body2' color='text.secondary'>
                                Медиафайл недоступен.
                            </Typography>
                        )}
                        {viewerAttachments.length > 1 ? (
                            <>
                                <IconButton
                                    onClick={() =>
                                        setViewerState((prev) => ({
                                            ...prev,
                                            index:
                                                prev.index <= 0
                                                    ? (prev.attachments ?? []).length - 1
                                                    : prev.index - 1,
                                        }))
                                    }
                                    sx={{
                                        position: 'absolute',
                                        left: 12,
                                        backgroundColor: 'rgba(0,0,0,0.45)',
                                        color: '#fff',
                                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.65)' },
                                    }}
                                    aria-label='Предыдущее медиа'
                                >
                                    <ChevronLeftIcon />
                                </IconButton>
                                <IconButton
                                    onClick={() =>
                                        setViewerState((prev) => ({
                                            ...prev,
                                            index:
                                                prev.index >= (prev.attachments ?? []).length - 1
                                                    ? 0
                                                    : prev.index + 1,
                                        }))
                                    }
                                    sx={{
                                        position: 'absolute',
                                        right: 12,
                                        backgroundColor: 'rgba(0,0,0,0.45)',
                                        color: '#fff',
                                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.65)' },
                                    }}
                                    aria-label='Следующее медиа'
                                >
                                    <ChevronRightIcon />
                                </IconButton>
                            </>
                        ) : null}
                    </Box>
                    {viewerAttachments.length > 1 ? (
                        <Stack
                            direction='row'
                            spacing={1}
                            sx={{
                                px: 2,
                                py: 1.5,
                                overflowX: 'auto',
                                borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
                                backgroundColor: isDark ? 'rgba(6,9,15,0.9)' : 'rgba(255,255,255,0.94)',
                            }}
                        >
                            {viewerAttachments.map((item, index) => (
                                <Box
                                    key={`${item.url}-${index}`}
                                    onClick={() =>
                                        setViewerState((prev) => ({
                                            ...prev,
                                            index,
                                        }))
                                    }
                                    sx={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 1.5,
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        cursor: 'pointer',
                                        border:
                                            index === viewerState.index
                                                ? '2px solid #3b82f6'
                                                : '2px solid transparent',
                                    }}
                                >
                                    {item.kind === 'image' ? (
                                        <Box
                                            component='img'
                                            src={item.url}
                                            alt={item.filename || 'preview'}
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : item.posterUrl ? (
                                        <Box
                                            component='img'
                                            src={item.posterUrl}
                                            alt={item.filename || 'preview'}
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Box
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#000',
                                                color: '#fff',
                                            }}
                                        >
                                            <PlayArrowIcon fontSize='small' />
                                        </Box>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    ) : null}
                </DialogContent>
            </Dialog>
            <Dialog open={contactPickerOpen} onClose={handleCloseContactPicker} fullWidth maxWidth='xs'>
                <DialogTitle>Новое сообщение</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <OutlinedInput
                            fullWidth
                            size='small'
                            placeholder='Найдите коллегу по имени, роли или email'
                            value={contactSearch}
                            onChange={(event) => setContactSearch(event.target.value)}
                            startAdornment={
                                <InputAdornment position='start'>
                                    <SearchIcon fontSize='small' />
                                </InputAdornment>
                            }
                        />
                        <Button
                            variant='text'
                            onClick={handleCreateProjectFromPicker}
                            startIcon={<GroupAddIcon />}
                            sx={{ justifyContent: 'flex-start' }}
                        >
                            Создать группу
                        </Button>
                        <Divider />
                        {loadingParticipants ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={22} />
                            </Box>
                        ) : participantsError ? (
                            <Typography color='error' variant='body2'>
                                {participantsError}
                            </Typography>
                        ) : filteredContacts.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                Коллеги не найдены.
                            </Typography>
                        ) : (
                            <List dense sx={{ maxHeight: 360, overflowY: 'auto', px: 0 }}>
                                {filteredContacts.map((participant) => {
                                    const isLoading = creatingChatWith === participant.email;
                                    return (
                                        <ListItem
                                            key={participant.email}
                                            disablePadding
                                            secondaryAction={
                                                isLoading ? <CircularProgress size={14} /> : null
                                            }
                                        >
                                            <ListItemButton
                                                onClick={() => createDirectChat(participant.email)}
                                                disabled={isLoading}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar>
                                                        {(participant.name || participant.email)[0]?.toUpperCase()}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={participant.name || participant.email}
                                                    secondary={
                                                        participant.role
                                                            ? `${participant.email} • ${participant.role}`
                                                            : participant.email
                                                    }
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        )}
                    </Stack>
                </DialogContent>
            </Dialog>
            {isMobile && mobileView === 'list' ? (
                <Fab
                    color='primary'
                    aria-label='Новое сообщение'
                    onClick={handleOpenContactPicker}
                    sx={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        boxShadow: '0 10px 24px rgba(15,23,42,0.2)',
                    }}
                >
                    <AddCommentIcon />
                </Fab>
            ) : null}
        </>
    );
}
