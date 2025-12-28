'use server';

import { NextResponse, type NextRequest } from 'next/server';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import {
    chatMessageToDTO,
    requireConversationAccess,
    type ChatMessageLike,
} from '@/server/messenger/helpers';

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ conversationId: string }> }
) {
    const params = await context.params;
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = currentUser.data.email?.toLowerCase();
    const userId = currentUser.data._id?.toString() ?? '';
    if (!userEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    try {
        await requireConversationAccess(params.conversationId, userEmail, userId);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }

    const messages = await ChatMessageModel.find({
        conversationId: params.conversationId,
    })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean()
        .exec();

    return NextResponse.json({
        ok: true,
        messages: messages.map((message) => chatMessageToDTO(message as ChatMessageLike)),
    });
}
