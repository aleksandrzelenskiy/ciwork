import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import UserModel from '@/server/models/UserModel';
import { sendEmail } from '@/server/email/mailer';
import { sendPendingReportReviewReminders } from '@/server/reports/review-reminders';

jest.mock('@/server/models/ReportModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/ProjectModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/UserModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server/email/mailer', () => ({
    sendEmail: jest.fn(),
}));

jest.mock('@/utils/initiatorAccessToken', () => ({
    signInitiatorAccessToken: jest.fn().mockReturnValue('initiator-token'),
}));

jest.mock('@/config/env', () => ({
    getServerEnv: () => ({ FRONTEND_URL: 'https://example.com' }),
}));

const mockedReportModel = ReportModel as jest.Mocked<typeof ReportModel>;
const mockedTaskModel = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedProjectModel = ProjectModel as jest.Mocked<typeof ProjectModel>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('sendPendingReportReviewReminders', () => {
    beforeEach(() => {
        mockedReportModel.find.mockReset();
        mockedTaskModel.find.mockReset();
        mockedProjectModel.find.mockReset();
        mockedUserModel.find.mockReset();
        (sendEmail as jest.MockedFunction<typeof sendEmail>).mockReset();
    });

    it('sends pending reminders to manager and initiator with report link', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        mockedReportModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([
                    {
                        taskId: 'T-1',
                        baseId: 'B-1',
                        status: 'Pending',
                        createdAt: new Date('2026-02-01T10:00:00.000Z'),
                        createdByName: 'Исполнитель Тест',
                        events: [
                            {
                                action: 'STATUS_CHANGED',
                                author: 'Исполнитель Тест',
                                date: new Date('2026-02-01T10:00:00.000Z'),
                                details: { newStatus: 'Pending' },
                            },
                        ],
                        save,
                    },
                ]),
            }),
        } as never);

        mockedTaskModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        {
                            taskId: 'T-1',
                            taskName: 'Проверка БС',
                            initiatorEmail: 'initiator@example.com',
                            authorEmail: 'author@example.com',
                            projectId: 'p1',
                        },
                    ]),
                }),
            }),
        } as never);

        mockedUserModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([]),
                }),
            }),
        } as never);

        mockedProjectModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { _id: 'p1', managers: ['manager@example.com'] },
                    ]),
                }),
            }),
        } as never);

        const result = await sendPendingReportReviewReminders(
            new Date('2026-02-06T10:00:00.000Z')
        );

        expect(result.scanned).toBe(1);
        expect(result.eligible).toBe(1);
        expect(result.reminded).toBe(1);
        expect(sendEmail).toHaveBeenCalledTimes(2);

        const calls = (sendEmail as jest.MockedFunction<typeof sendEmail>).mock.calls;
        const sentTo = calls.map((call) => call[0].to).sort();
        expect(sentTo).toEqual(['initiator@example.com', 'manager@example.com']);

        const initiatorCall = calls.find(
            (call) => call[0].to === 'initiator@example.com'
        );
        expect(initiatorCall?.[0].text).toContain('initiator-token');
        expect(initiatorCall?.[0].text).toContain(
            'Ссылка на фотоотчет: https://example.com/reports/T-1/B-1?token='
        );
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('sends fixed reminders with fixes text to manager and initiator', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        mockedReportModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([
                    {
                        taskId: 'T-2',
                        baseId: 'B-9',
                        status: 'Fixed',
                        createdAt: new Date('2026-02-01T10:00:00.000Z'),
                        createdByName: 'Исполнитель Тест',
                        events: [
                            {
                                action: 'STATUS_CHANGED',
                                author: 'Исполнитель Тест',
                                date: new Date('2026-02-01T10:00:00.000Z'),
                                details: { newStatus: 'Fixed' },
                            },
                        ],
                        save,
                    },
                ]),
            }),
        } as never);
        mockedTaskModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        {
                            taskId: 'T-2',
                            taskName: 'Замечания БС',
                            initiatorEmail: 'initiator@example.com',
                            authorEmail: 'author@example.com',
                            projectId: 'p1',
                        },
                    ]),
                }),
            }),
        } as never);
        mockedUserModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([]),
                }),
            }),
        } as never);
        mockedProjectModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { _id: 'p1', managers: ['manager@example.com'] },
                    ]),
                }),
            }),
        } as never);

        const result = await sendPendingReportReviewReminders(
            new Date('2026-02-06T10:00:00.000Z')
        );

        expect(result.reminded).toBe(1);
        expect(sendEmail).toHaveBeenCalledTimes(2);
        const managerCall = (
            sendEmail as jest.MockedFunction<typeof sendEmail>
        ).mock.calls.find((call) => call[0].to === 'manager@example.com');
        expect(managerCall?.[0].text).toContain('устранены замечания');
        expect(managerCall?.[0].text).toContain('загружены фотографии исправлений');
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('sends issues reminders to executor only', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        mockedReportModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([
                    {
                        taskId: 'T-3',
                        baseId: 'B-5',
                        status: 'Issues',
                        createdAt: new Date('2026-02-01T10:00:00.000Z'),
                        createdByName: 'Проверяющий',
                        events: [
                            {
                                action: 'STATUS_CHANGED',
                                author: 'Проверяющий',
                                date: new Date('2026-02-01T10:00:00.000Z'),
                                details: { newStatus: 'Issues' },
                            },
                        ],
                        save,
                    },
                ]),
            }),
        } as never);
        mockedTaskModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        {
                            taskId: 'T-3',
                            taskName: 'Задача с замечаниями',
                            executorEmail: 'executor@example.com',
                            executorId: 'executor-clerk-id',
                            initiatorEmail: 'initiator@example.com',
                            projectId: 'p1',
                        },
                    ]),
                }),
            }),
        } as never);
        mockedUserModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        {
                            clerkUserId: 'executor-clerk-id',
                            email: 'executor@example.com',
                        },
                    ]),
                }),
            }),
        } as never);
        mockedProjectModel.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { _id: 'p1', managers: ['manager@example.com'] },
                    ]),
                }),
            }),
        } as never);

        const result = await sendPendingReportReviewReminders(
            new Date('2026-02-06T10:00:00.000Z')
        );

        expect(result.reminded).toBe(1);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'executor@example.com' })
        );
        const call = (sendEmail as jest.MockedFunction<typeof sendEmail>).mock.calls[0];
        expect(call[0].subject).toContain('устраните замечания');
        expect(call[0].text).toContain('Необходимо устранить замечания');
        expect(save).toHaveBeenCalledTimes(1);
    });
});
