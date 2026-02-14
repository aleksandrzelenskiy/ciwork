import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
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

describe('sendPendingReportReviewReminders', () => {
    beforeEach(() => {
        mockedReportModel.find.mockReset();
        mockedTaskModel.find.mockReset();
        mockedProjectModel.find.mockReset();
        (sendEmail as jest.MockedFunction<typeof sendEmail>).mockReset();
    });

    it('sends reminders to manager and initiator with report link', async () => {
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
});
