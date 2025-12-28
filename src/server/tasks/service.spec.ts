import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import { GetUserContext } from '@/server-actions/user-context';
import { listTasksForCurrentUser } from '@/server/tasks/service';

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        aggregate: jest.fn(),
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

const mockedTaskModel = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedProjectModel = ProjectModel as jest.Mocked<typeof ProjectModel>;
const mockedGetUserContext = GetUserContext as jest.Mock;

describe('listTasksForCurrentUser', () => {
    beforeEach(() => {
        mockedTaskModel.aggregate.mockReset();
        mockedProjectModel.find.mockReset();
        mockedGetUserContext.mockReset();
    });

    it('returns error when user context fails', async () => {
        mockedGetUserContext.mockResolvedValue({
            success: false,
            message: 'No session',
        });

        const result = await listTasksForCurrentUser();

        expect(result.ok).toBe(false);
        expect(result.error).toBe('Failed to fetch user data');
        expect(mockedTaskModel.aggregate).not.toHaveBeenCalled();
    });

    it('returns filtered tasks for executor', async () => {
        mockedGetUserContext.mockResolvedValue({
            success: true,
            data: {
                user: { clerkUserId: 'user-1', email: 'exec@example.com' },
                effectiveOrgRole: 'executor',
                isSuperAdmin: false,
                activeOrgId: 'org-1',
            },
        });

        mockedTaskModel.aggregate.mockResolvedValue([
            {
                taskId: 'T-1',
                bsLocation: [{ coordinates: [1, 2] }],
                attachments: ['file-1'],
                documents: [],
            },
            {
                taskId: 'T-2',
                bsLocation: [],
            },
        ]);

        const result = await listTasksForCurrentUser();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.tasks).toHaveLength(1);
            expect(result.tasks[0].taskId).toBe('T-1');
            expect(result.tasks[0].attachments).toEqual(['file-1']);
            expect(result.tasks[0].documents).toBeUndefined();
        }
        expect(mockedTaskModel.aggregate).toHaveBeenCalledTimes(1);
        expect(mockedProjectModel.find).not.toHaveBeenCalled();
    });
});
