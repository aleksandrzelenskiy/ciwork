// app/api/addTasks/route.ts
import { NextResponse } from 'next/server';
import Task from '@/server/models/TaskModel';
import { getDefaultBsCoordinateModel, normalizeBsNumber as normalizeBsNumberModel } from '@/server/models/BsCoordinateModel';
import dbConnect from '@/server/db/mongoose';
import { PriorityLevel, WorkItem } from '@/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '@/server/email/mailer';
import { uploadTaskFile } from '@/utils/s3';

/**
 * Приведение номера БС к нормальному виду
 */
function normalizeBsNumber(bsNumber: string): string {
  const matches = bsNumber.match(/IR\d+/gi);
  if (!matches) return '';
  return matches
      .map((part) => {
        const regionCode = part.substring(0, 2).toUpperCase();
        const rawDigits = part.substring(2).replace(/^0+/, '');
        const digits = rawDigits === '' ? '0' : rawDigits;
        const padded = digits.padStart(4, '0');
        return `${regionCode}${padded}`;
      })
      .join('-');
}

/**
 * POST — создание новой задачи
 */
export async function POST(request: Request) {
  await dbConnect();

  try {
    const formData = await request.formData();

    // === Основные поля ===
    const bsNumber = normalizeBsNumber((formData.get('bsNumber') as string) || '');
    const bsNames = bsNumber.split('-').filter(Boolean);

    const bsLocation = await Promise.all(
        bsNames.map(async (name) => {
          const normalized = normalizeBsNumberModel(name);
          const station = await getDefaultBsCoordinateModel().findOne({
            name: normalized,
          }).lean();
          const coordinates =
            (station?.coordinates && station.coordinates.trim()) ||
            (typeof station?.lat === 'number' && typeof station?.lon === 'number'
              ? `${station.lat} ${station.lon}`
              : '');
          if (!station || !coordinates) {
            throw new Error(`Базовая станция ${normalized} не найдена`);
          }
          return { name: normalized, coordinates };
        })
    );

    const taskData = {
      taskId: (formData.get('taskId') as string)?.trim() || '',
      taskName: (formData.get('taskName') as string)?.trim() || '',
      bsNumber,
      bsLocation,
      bsAddress: (formData.get('bsAddress') as string) || '',
      totalCost: parseFloat((formData.get('totalCost') as string) || '0') || 0,
      priority: (formData.get('priority') as PriorityLevel) || 'medium',
      dueDate: new Date((formData.get('dueDate') as string) || Date.now()),
      taskDescription: (formData.get('taskDescription') as string) || '',
      authorId: (formData.get('authorId') as string) || '',
      authorName: (formData.get('authorName') as string) || '',
      authorEmail: (formData.get('authorEmail') as string) || '',
      initiatorName: (formData.get('initiatorName') as string) || '',
      initiatorEmail: (formData.get('initiatorEmail') as string) || '',
      executorId: (formData.get('executorId') as string) || '',
      executorName: (formData.get('executorName') as string) || '',
      executorEmail: (formData.get('executorEmail') as string) || '',
      workItems: JSON.parse((formData.get('workItems') as string) || '[]').map(
          (item: Omit<WorkItem, 'id'>) => ({ ...item, id: uuidv4() })
      ) as WorkItem[],
    };

    // === Валидация ===
    const cleanTaskId = (taskData.taskId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!cleanTaskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    if (!taskData.taskName || !taskData.bsNumber) {
      return NextResponse.json(
          { error: 'taskName and bsNumber are required' },
          { status: 400 }
      );
    }
    const initiatorNameValue = (taskData.initiatorName || '').trim();
    const initiatorEmailValue = (taskData.initiatorEmail || '').trim();
    const hasInitiatorName = Boolean(initiatorNameValue);
    const hasInitiatorEmail = Boolean(initiatorEmailValue);
    if (hasInitiatorName !== hasInitiatorEmail) {
      return NextResponse.json(
          { error: 'initiatorName and initiatorEmail are required' },
          { status: 400 }
      );
    }

    // === Файлы ===
    const excelFile = formData.get('excelFile') as File | null;
    if (!excelFile) {
      return NextResponse.json(
          { error: 'Excel estimate file is required' },
          { status: 400 }
      );
    }

    const attachments: File[] = [];
    for (let i = 0; formData.has(`attachments_${i}`); i++) {
      const f = formData.get(`attachments_${i}`) as File;
      if (f) attachments.push(f);
    }

    // === Загрузка estimate ===
    const estimateUrl = await uploadTaskFile(
        Buffer.from(await excelFile.arrayBuffer()),
        cleanTaskId,
        'documents',
        `${Date.now()}-${excelFile.name}`,
        excelFile.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    // === Загрузка attachments ===
    const attachmentsUrls = await Promise.all(
        attachments.map(async (file, idx) =>
            uploadTaskFile(
                Buffer.from(await file.arrayBuffer()),
                cleanTaskId,
                'attachments',
                `${idx}-${Date.now()}-${file.name}`,
                file.type || 'application/octet-stream'
            )
        )
    );

    const documents = [estimateUrl];

    // === Создание задачи ===
    const taskStatus = taskData.executorId ? 'Assigned' : 'To do';
    const events = [
      {
        action: 'TASK_CREATED',
        author: taskData.authorName,
        authorId: taskData.authorId,
        date: new Date(),
        details: { comment: 'The task was created successfully', initialStatus: taskStatus },
      },
    ];

    if (taskData.executorId) {
      events.push({
        action: 'TASK_ASSIGNED',
        author: taskData.authorName,
        authorId: taskData.authorId,
        date: new Date(),
        details: {
          comment: `The task is assigned to the executor: ${taskData.executorName}`,
          initialStatus: '',
        },
      });
    }

    const newTask = new Task({
      ...taskData,
      status: taskStatus,
      attachments: attachmentsUrls,
      documents,
      createdAt: new Date(),
      events,
    });

    await newTask.save();

    // === Фоновая отправка почты ===
    void (async () => {
      try {
        const recipients = [
          newTask.authorEmail,
          newTask.initiatorEmail,
          newTask.executorEmail,
        ]
            .filter((email): email is string => Boolean(email && email.trim()))
            .filter((v, i, self) => self.indexOf(v) === i);

        if (recipients.length === 0) return;

        const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
        const taskLink = `${frontendUrl}/tasks/${newTask.taskId}`;
        const dueDateStr = newTask.dueDate
            ? new Date(newTask.dueDate).toLocaleString('ru-RU')
            : '—';
        const priority = newTask.priority || '—';
        const description = newTask.taskDescription || '—';

        const text = `
Новая задача создана!

ID задачи: ${newTask.taskId}
Название: ${newTask.taskName}
Базовые станции: ${newTask.bsNumber}
Автор: ${newTask.authorName}
Срок выполнения: ${dueDateStr}
Приоритет: ${priority}
Описание: ${description}
Ссылка: ${taskLink}
        `.trim();

        const html = `
<p><strong>Новая задача создана!</strong></p>
<p>ID задачи: <b>${newTask.taskId}</b></p>
<p>Название: ${newTask.taskName}</p>
<p>Базовые станции: ${newTask.bsNumber}</p>
<p>Автор: ${newTask.authorName}</p>
<p>Срок выполнения: ${dueDateStr}</p>
<p>Приоритет: ${priority}</p>
<p>Описание: ${description}</p>
<p><a href="${taskLink}">Перейти к задаче</a></p>
        `.trim();

        for (const email of recipients) {
          await sendEmail({
            to: email,
            subject: `Новая задача ${newTask.taskName} (${newTask.taskId})`,
            text,
            html,
          });
        }
      } catch (err) {
        console.error('Ошибка при фоновой отправке email:', err);
      }
    })();

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
        { error: 'Error creating task' },
        { status: 500 }
    );
  }
}
