import TaskModel from '@/server/models/TaskModel';
import ReportModel from '@/server/models/ReportModel';
import UserModel from '@/server/models/UserModel';
import { submitReport } from '@/server/reports/submit';

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        updateOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
    },
}));

jest.mock('@/server/models/ReportModel', () => ({
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

jest.mock('@/server/notifications/service', () => ({
    createNotification: jest.fn(),
}));

jest.mock('@/server/email/mailer', () => ({
    sendEmail: jest.fn(),
}));

jest.mock('@/utils/initiatorAccessToken', () => ({
    signInitiatorAccessToken: jest.fn().mockReturnValue('token'),
}));

jest.mock('@/config/env', () => ({
    getServerEnv: () => ({ FRONTEND_URL: 'https://example.com' }),
}));

const mockedTaskModel = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedReportModel = ReportModel as jest.Mocked<typeof ReportModel>;

describe('submitReport', () => {
    beforeEach(() => {
        mockedTaskModel.findOne.mockReset();
        mockedReportModel.find.mockReset();
        (UserModel as jest.Mocked<typeof UserModel>).find.mockReset();
    });

    it('rejects missing taskId', async () => {
        const result = await submitReport(
            { baseIds: ['B1'] },
            { clerkUserId: 'u1', name: 'User' }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('rejects missing baseIds', async () => {
        const result = await submitReport(
            { taskId: 'T1', baseIds: [] },
            { clerkUserId: 'u1', name: 'User' }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('returns not found when task missing', async () => {
        mockedTaskModel.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        } as never);

        const result = await submitReport(
            { taskId: 'T1', baseIds: ['B1'] },
            { clerkUserId: 'u1', name: 'User' }
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(404);
        }
    });
});
