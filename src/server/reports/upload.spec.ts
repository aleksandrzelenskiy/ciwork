import TaskModel from '@/server/models/TaskModel';
import { handleReportUpload } from '@/server/reports/upload';
import { assertWritableStorage } from '@/utils/storageUsage';

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/utils/storageUsage', () => ({
    assertWritableStorage: jest.fn(),
    recordStorageBytes: jest.fn(),
}));

jest.mock('@/utils/s3', () => ({
    uploadBuffer: jest.fn(),
}));

jest.mock('@/server-actions/reportService', () => ({
    appendReportFiles: jest.fn(),
    upsertReport: jest.fn(),
}));

jest.mock('@/app/api/reports/_shared', () => ({
    buildReportKey: jest.fn().mockReturnValue('key'),
    extractUploadPayload: jest.fn(),
    prepareImageBuffer: jest.fn(),
    resolveStorageScope: jest.fn().mockResolvedValue({}),
}));

const mockedTask = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedAssertStorage = assertWritableStorage as jest.Mock;

const shared = jest.requireMock('@/app/api/reports/_shared') as {
    extractUploadPayload: jest.Mock;
};

describe('handleReportUpload', () => {
    beforeEach(() => {
        mockedTask.findOne.mockReset();
        mockedAssertStorage.mockReset();
        shared.extractUploadPayload.mockReset();
    });

    it('rejects when user missing', async () => {
        const result = await handleReportUpload({} as Request, null);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });

    it('rejects missing taskId', async () => {
        shared.extractUploadPayload.mockResolvedValue({
            taskId: '',
            baseId: 'B1',
            files: [{ type: 'image/jpeg' }],
        });

        const result = await handleReportUpload({} as Request, { id: 'u1' } as never);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('rejects unsupported file type', async () => {
        shared.extractUploadPayload.mockResolvedValue({
            taskId: 'T1',
            baseId: 'B1',
            files: [{ type: 'text/plain' }],
        });

        const result = await handleReportUpload({} as Request, { id: 'u1' } as never);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('rejects when storage is read-only', async () => {
        shared.extractUploadPayload.mockResolvedValue({
            taskId: 'T1',
            baseId: 'B1',
            files: [{ type: 'image/jpeg' }],
        });
        mockedTask.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ orgId: 'org1' }),
        } as never);
        mockedAssertStorage.mockResolvedValue({
            ok: false,
            error: 'limit',
            access: { usedBytes: 1, limitBytes: 1 },
        });

        const result = await handleReportUpload({} as Request, { id: 'u1' } as never);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(402);
        }
    });
});
