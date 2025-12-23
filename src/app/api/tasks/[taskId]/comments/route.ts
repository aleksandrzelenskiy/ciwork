// app/api/tasks/[taskId]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import { currentUser } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadTaskFile } from '@/utils/s3';
import { createNotification } from '@/app/utils/notificationService';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params; // дождаться параметров
  const taskIdUpper = taskId ? taskId.toUpperCase() : '';

  try {
    await dbConnect();

    if (!taskId) {
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const authorEmail = user.emailAddresses?.[0]?.emailAddress;

    // данные пользователя (аватар)
    const dbUser = await UserModel.findOne({ clerkUserId: user.id });
    const profilePic = dbUser?.profilePic || '';

    const clerkFullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    const dbName = dbUser?.name?.trim();
    const fallbackEmail = authorEmail || '';
    const authorName =
        clerkFullName ||
        dbName ||
        user.username ||
        fallbackEmail ||
        'Unknown';

    const contentType = request.headers.get('content-type') || '';
    let commentText = '';
    let file: File | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      commentText = (body?.text ?? '').toString();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      commentText = formData.get('text')?.toString() || '';
      const photo = formData.get('photo');
      if (photo instanceof File) file = photo;
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    if (!commentText.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    // ===== Загрузка фото комментария (если есть) =====
    let photoUrl: string | undefined;
    if (file) {
      const mime = file.type || 'application/octet-stream';

      // базовая валидация без any
      const allowed: ReadonlyArray<string> = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
      ];
      const okType = allowed.includes(mime) || mime.startsWith('image/');
      if (!okType) {
        return NextResponse.json(
            { error: 'Unsupported file type for comment photo' },
            { status: 400 }
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
            { error: 'Comment photo too large (max 20 MB)' },
            { status: 413 }
        );
      }

      const taskIdUpper = taskId.toUpperCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      // сохраняем по принципу uploads/<taskId>/<taskId>-comments/<filename>
      photoUrl = await uploadTaskFile(
          buffer,
          taskIdUpper,
          'comments',
          `${Date.now()}-${file.name}`,
          mime
      );
    }

    // ===== Формируем комментарий и событие =====
    const newComment = {
      _id: uuidv4(),
      text: commentText,
      author: authorName,
      authorId: user.id,
      profilePic,
      createdAt: new Date(),
      photoUrl,
    };

    const commentEvent = {
      action: 'COMMENT_ADDED',
      author: authorName,
      authorId: user.id,
      date: new Date(),
      details: {
        comment: commentText,
        commentId: newComment._id,
      },
    };

    // ===== Обновляем задачу =====
    const updatedTask = await TaskModel.findOneAndUpdate(
        { taskId: taskIdUpper },
        { $push: { comments: newComment, events: commentEvent } },
        { new: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    try {
      notificationSocketGateway.emitTaskComment(taskIdUpper, newComment);
    } catch (socketError) {
      console.error('Failed to emit task comment socket event', socketError);
    }

    // ===== Уведомления через NotificationBell =====
    try {
      const executorClerkId = typeof updatedTask.executorId === 'string' ? updatedTask.executorId.trim() : '';
      const initiatorClerkId = typeof updatedTask.initiatorId === 'string' ? updatedTask.initiatorId.trim() : '';
      const authorClerkId = typeof updatedTask.authorId === 'string' ? updatedTask.authorId.trim() : '';

      const notifyUser = async (targetClerkId: string) => {
        const target = await UserModel.findOne({ clerkUserId: targetClerkId })
            .select('_id email name')
            .lean();

        if (!target?._id) {
          console.warn('Comment notification skipped: user not found', targetClerkId);
          return;
        }

        const shortText =
            commentText.length > 140 ? `${commentText.slice(0, 137).trimEnd()}...` : commentText;

        const link = `/tasks/${encodeURIComponent(taskId.toLowerCase())}`;
        const metadataEntries = Object.entries({
          taskId: updatedTask.taskId,
          bsNumber: updatedTask.bsNumber,
          commentId: newComment._id,
        }).filter(([, value]) => typeof value !== 'undefined' && value !== null);
        const metadata = metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;

        const bsInfo =
            typeof updatedTask.bsNumber === 'string' && updatedTask.bsNumber.trim()
                ? ` (БС ${updatedTask.bsNumber})`
                : '';

        const title =
            (updatedTask.taskName
                ? `Новый комментарий в задаче "${updatedTask.taskName}"${bsInfo}`
                : 'Новый комментарий в задаче') || 'Новый комментарий в задаче';

        const message = `${authorName} оставил комментарий${bsInfo ? ` по${bsInfo}` : ''}: ${shortText}`;

        await createNotification({
          recipientUserId: target._id,
          type: 'task_comment',
          title,
          message,
          link,
          orgId: updatedTask.orgId ?? undefined,
          senderName: authorName,
          senderEmail: authorEmail ?? undefined,
          metadata,
        });
      };

      // Исполнитель получает уведомление, если коммент оставил не он
      if (executorClerkId && executorClerkId !== user.id) {
        await notifyUser(executorClerkId);
      }

      // Менеджер (инициатор или автор) получает уведомление, когда коммент оставил исполнитель
      const commenterIsExecutor = executorClerkId && executorClerkId === user.id;
      const managerClerkId = commenterIsExecutor ? (initiatorClerkId || authorClerkId) : '';
      if (managerClerkId && managerClerkId !== user.id && managerClerkId !== executorClerkId) {
        await notifyUser(managerClerkId);
      }
    } catch (notifyErr) {
      console.error('Ошибка при создании уведомления о комментарии:', notifyErr);
    }

    return NextResponse.json({ comment: newComment, task: updatedTask });
  } catch (err) {
    console.error('Error adding comment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
