import UserModel from '@/app/models/UserModel';
import { createNotification } from '@/app/utils/notificationService';
import { notifyTaskStatusChange } from '@/app/utils/taskNotifications';

jest.mock('@/app/models/UserModel', () => ({
    __esModule: true,
    default: { find: jest.fn() },
}));

jest.mock('@/app/utils/notificationService', () => ({
    createNotification: jest.fn().mockResolvedValue({}),
}));

const createUserFindMock = (users: Array<Record<string, unknown>>) =>
    jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(users),
        }),
    });

describe('notifyTaskStatusChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses Russian status labels in the notification message', async () => {
        (UserModel.find as jest.Mock).mockImplementation(
            createUserFindMock([
                { _id: 'user-1', clerkUserId: 'clerk-1', email: 'manager@example.com' },
            ])
        );

        await notifyTaskStatusChange({
            taskId: 'TASK-1',
            taskName: 'Строительство РРЛ (e-band)',
            bsNumber: 'IR002063-IR002064',
            previousStatus: 'To do',
            newStatus: 'At work',
            authorClerkId: 'clerk-1',
            triggeredByClerkId: 'executor-1',
        });

        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Статус задачи обновлён',
                message:
                    'Статус задачи «Строительство РРЛ (e-band)» (БС IR002063-IR002064) изменён с К выполнению на В работе.',
            })
        );
    });

    it('falls back to "не указан" when previous status is missing', async () => {
        (UserModel.find as jest.Mock).mockImplementation(
            createUserFindMock([
                { _id: 'user-2', clerkUserId: 'clerk-2', email: 'manager@example.com' },
            ])
        );

        await notifyTaskStatusChange({
            taskId: 'TASK-2',
            taskName: 'Монтаж оборудования',
            newStatus: 'Assigned',
            authorClerkId: 'clerk-2',
            triggeredByClerkId: 'executor-2',
        });

        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                message:
                    'Статус задачи «Монтаж оборудования» изменён с не указан на Назначена.',
            })
        );
    });
});
