import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import { GetUserContext } from '@/server-actions/user-context';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { deleteReport, getReportDetails, updateReport } from '@/server/reports/base';

jest.mock('@/server/models/ReportModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        deleteOne: jest.fn(),
    },
}));

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/server/models/ProjectModel', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
    },
}));

jest.mock('@/server/models/OrganizationModel', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
    },
}));

jest.mock('@/server-actions/user-context', () => ({
    GetUserContext: jest.fn(),
}));

jest.mock('@/utils/initiatorAccessToken', () => ({
    verifyInitiatorAccessToken: jest.fn(),
}));

jest.mock('@/server/notifications/service', () => ({
    createNotification: jest.fn(),
}));

const mockedReport = ReportModel as jest.Mocked<typeof ReportModel>;
const mockedTask = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedGetUserContext = GetUserContext as jest.Mock;
const mockedVerifyToken = verifyInitiatorAccessToken as jest.Mock;

describe('reports base service', () => {
    beforeEach(() => {
        mockedReport.findOne.mockReset();
        mockedReport.deleteOne.mockReset();
        mockedTask.findOne.mockReset();
        (ProjectModel as jest.Mocked<typeof ProjectModel>).findById.mockReset();
        (OrganizationModel as jest.Mocked<typeof OrganizationModel>).findById.mockReset();
        mockedGetUserContext.mockReset();
        mockedVerifyToken.mockReset();
    });

    it('getReportDetails returns 401 when guest mismatch and no session', async () => {
        mockedVerifyToken.mockReturnValue({ taskId: 'T1', email: 'guest@example.com' });
        mockedReport.findOne.mockResolvedValue({
            taskId: 'T1',
            baseId: 'B1',
            files: [],
            fixedFiles: [],
        });
        mockedTask.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    taskId: 'T1',
                    initiatorEmail: 'other@example.com',
                }),
            }),
        } as never);
        mockedGetUserContext.mockResolvedValue({
            success: false,
            message: 'No session',
        });

        const result = await getReportDetails({
            taskId: 'T1',
            baseId: 'B1',
            token: 'token',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });

    it('updateReport returns 401 when user missing', async () => {
        mockedVerifyToken.mockReturnValue(null);
        mockedReport.findOne.mockResolvedValue({
            status: 'Pending',
            issues: [],
            save: jest.fn(),
        });

        const result = await updateReport({
            taskId: 'T1',
            baseId: 'B1',
            token: undefined,
            status: 'Agreed',
            issues: [],
            user: null,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });

    it('deleteReport returns 401 when no user context', async () => {
        mockedGetUserContext.mockResolvedValue({
            success: false,
            message: 'No session',
        });

        const result = await deleteReport({ taskId: 'T1', baseId: 'B1' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });
});
