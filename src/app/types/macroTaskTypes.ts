import { PriorityLevel, CurrentStatus } from './taskTypes';

export interface MacroTaskEvent {
    _id?: string;
    action: string;
    author: string;
    authorId: string;
    date: Date;
    details?: {
        oldStatus?: CurrentStatus;
        newStatus?: CurrentStatus;
        comment?: string;
        commentId?: string;
    };
}

export interface MacroTaskComment {
    _id?: string;
    text: string;
    author: string;
    authorId: string;
    createdAt: Date;
    profilePic?: string;
}

export interface MacroTask {
    _id?: string;
    macroTaskId: string;
    macroTaskName: string;

    description?: string;

    // заказчик
    initiatorName: string;
    initiatorEmail: string;

    // куратор/ответственный
    curatorId?: string;
    curatorName?: string;
    curatorEmail?: string;

    // ключевая инфа по объекту
    bsNumber: string;
    bsAddress: string;
    bsLocation?: {
        name: string;
        coordinates: string;
        address?: string;
    };

    // даты и приоритет
    dueDate?: Date;
    priority: PriorityLevel;
    status: CurrentStatus;
    createdAt: Date;

    // Подзадачи (ID обычных задач)
    tasks: string[];

    // Для построения последовательности (workflow)
    workflow: {
        order: number; // шаг процесса
        task: string; // id подзадачи
        dependsOn?: string; // id предыдущей задачи
    }[];

    // согласование
    approvedBy?: string;
    approvedAt?: Date;

    events?: MacroTaskEvent[];
    comments?: MacroTaskComment[];
}

export type CreateMacroTaskPayload = Omit<MacroTask, '_id' | 'createdAt'>;
