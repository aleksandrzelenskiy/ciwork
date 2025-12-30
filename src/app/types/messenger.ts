export type ConversationType = 'org' | 'project' | 'direct';

export type MessengerConversationDTO = {
    id: string;
    orgId: string;
    type: ConversationType;
    title: string;
    projectKey?: string | null;
    participants: string[];
    unreadCount: number;
    lastMessagePreview?: string;
    lastMessageAttachment?: MessengerAttachmentDTO;
    updatedAt?: string;
    counterpartName?: string;
    counterpartAvatar?: string;
    counterpartEmail?: string;
    counterpartIsOnline?: boolean;
    counterpartLastActive?: string;
};

export type MessengerMessageDTO = {
    id: string;
    conversationId: string;
    orgId: string;
    senderEmail: string;
    senderName?: string;
    text: string;
    readBy: string[];
    createdAt: string;
    attachments?: MessengerAttachmentDTO[];
};

export type MessengerAttachmentDTO = {
    url: string;
    kind: 'image' | 'video';
    contentType?: string;
    size?: number;
    width?: number;
    height?: number;
    posterUrl?: string;
    filename?: string;
};

export type ChatServerToClientEvents = {
    'chat:message:new': (payload: MessengerMessageDTO) => void;
    'chat:message:deleted': (payload: {
        conversationId: string;
        messageId: string;
        readBy?: string[];
        deletedBy?: string;
    }) => void;
    'chat:read': (payload: { conversationId: string; userEmail: string; messageIds: string[] }) => void;
    'chat:unread': (payload: { conversationId: string; unreadCount: number; userEmail?: string }) => void;
    'chat:typing': (payload: { conversationId: string; userEmail?: string; userName?: string; isTyping?: boolean }) => void;
    'chat:presence': (payload: { userId: string; email?: string; isOnline: boolean; lastActive?: string }) => void;
};

export type ChatClientToServerEvents = {
    'chat:join': (payload: { conversationId: string }) => void;
    'chat:leave': (payload: { conversationId: string }) => void;
    'chat:typing': (payload: { conversationId: string; userEmail?: string; userName?: string; isTyping?: boolean }) => void;
    'chat:presence': (payload: { email?: string; isOnline?: boolean }) => void;
};
