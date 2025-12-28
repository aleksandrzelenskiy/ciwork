import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';
import { GetUserContext } from '@/server-actions/user-context';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { listReportsForRequest } from '@/server/reports/service';

jest.mock('@/server/models/ReportModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/OrganizationModel', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/ProjectModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
    },
}));

jest.mock('@/server-actions/user-context', () => ({
    GetUserContext: jest.fn(),
}));

jest.mock('@/utils/initiatorAccessToken', () => ({
    verifyInitiatorAccessToken: jest.fn(),
}));

const mockedTaskModel = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedGetUserContext = GetUserContext as jest.Mock;
const mockedVerifyToken = verifyInitiatorAccessToken as jest.Mock;

describe('listReportsForRequest', () => {
    beforeEach(() => {
        mockedTaskModel.findOne.mockReset();
        mockedTaskModel.find.mockReset();
        (ReportModel as jest.Mocked<typeof ReportModel>).find.mockReset();
        (OrganizationModel as jest.Mocked<typeof OrganizationModel>).findById.mockReset();
        (OrganizationModel as jest.Mocked<typeof OrganizationModel>).find.mockReset();
        (ProjectModel as jest.Mocked<typeof ProjectModel>).find.mockReset();
        mockedGetUserContext.mockReset();
        mockedVerifyToken.mockReset();
    });

    it('rejects guest access with mismatched initiator email', async () => {
        mockedVerifyToken.mockReturnValue({ taskId: 'T-1', email: 'guest@example.com' });
        mockedTaskModel.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    taskId: 'T-1',
                    initiatorEmail: 'other@example.com',
                }),
            }),
        } as never);

        const result = await listReportsForRequest({ token: 'token' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(403);
        }
    });

    it('returns auth error when user context missing', async () => {
        mockedVerifyToken.mockReturnValue(null);
        mockedGetUserContext.mockResolvedValue({
            success: false,
            message: 'No session',
        });

        const result = await listReportsForRequest({});

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });
});
