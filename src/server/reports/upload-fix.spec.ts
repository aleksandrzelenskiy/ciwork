import TaskModel from '@/server/models/TaskModel';
import { handleFixUpload } from '@/server/reports/upload-fix';
import { FIX_REMARKS_FOLDER_NAME } from '@/utils/photoReportFolders';
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
    deleteTaskFile: jest.fn(),
    uploadBuffer: jest.fn(),
}));

jest.mock('@/server-actions/reportService', () => ({
    appendReportFiles: jest.fn(),
    syncTaskStatus: jest.fn(),
    upsertReport: jest.fn(),
}));

jest.mock('@/app/api/reports/_shared', () => ({
    buildReportKey: jest.fn().mockReturnValue('key'),
    extractUploadPayload: jest.fn(),
    isSupportedImage: jest.fn((file: { type?: string }) =>
        String(file?.type ?? '').startsWith('image/')
    ),
    validateUploadFiles: jest.fn().mockReturnValue({ ok: true }),
    parseBsCoordinates: jest.fn().mockReturnValue(null),
    prepareImageBuffer: jest.fn(),
    resolveStorageScope: jest.fn().mockResolvedValue({}),
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

const mockedTask = TaskModel as jest.Mocked<typeof TaskModel>;
const mockedAssertStorage = assertWritableStorage as jest.Mock;

const shared = jest.requireMock('@/app/api/reports/_shared') as {
    buildReportKey: jest.Mock;
    extractUploadPayload: jest.Mock;
    isSupportedImage: jest.Mock;
    prepareImageBuffer: jest.Mock;
};
const s3 = jest.requireMock('@/utils/s3') as { uploadBuffer: jest.Mock };
const reportService = jest.requireMock('@/server-actions/reportService') as {
    appendReportFiles: jest.Mock;
    syncTaskStatus: jest.Mock;
    upsertReport: jest.Mock;
};

describe('handleFixUpload', () => {
    beforeEach(() => {
        mockedTask.findOne.mockReset();
        mockedAssertStorage.mockReset();
        s3.uploadBuffer.mockReset();
        reportService.appendReportFiles.mockReset();
        reportService.syncTaskStatus.mockReset();
        reportService.upsertReport.mockReset();
        shared.buildReportKey.mockClear();
        shared.extractUploadPayload.mockReset();
        shared.isSupportedImage.mockImplementation((file: { type?: string }) =>
            String(file?.type ?? '').startsWith('image/')
        );
        shared.prepareImageBuffer.mockReset();
    });

    it('rejects when user missing', async () => {
        const result = await handleFixUpload({} as Request, null);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });

    it('rejects missing baseId', async () => {
        shared.extractUploadPayload.mockResolvedValue({
            taskId: 'T1',
            baseId: '',
            files: [{ type: 'image/jpeg' }],
        });

        const result = await handleFixUpload({} as Request, { id: 'u1' } as never);
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

        const result = await handleFixUpload({} as Request, { id: 'u1' } as never);
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

        const result = await handleFixUpload({} as Request, { id: 'u1' } as never);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(402);
        }
    });

    it('uploads fixes to the dedicated folder path', async () => {
        shared.extractUploadPayload.mockResolvedValue({
            taskId: 'T1',
            baseId: 'B1',
            files: [{ type: 'image/jpeg', name: 'fix.jpg', size: 1024 }],
        });
        mockedTask.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                orgId: 'org1',
                taskId: 'T1',
                taskName: 'Task',
                bsLocation: [],
            }),
        } as never);
        mockedAssertStorage.mockResolvedValue({ ok: true });
        shared.prepareImageBuffer.mockResolvedValue({
            buffer: Buffer.from('file'),
            contentType: 'image/jpeg',
            filename: 'fix.jpg',
            size: 1024,
        });
        s3.uploadBuffer.mockResolvedValue('https://example.com/fix.jpg');
        reportService.upsertReport.mockResolvedValue({
            _id: 'report-1',
            events: [],
            status: 'Draft',
        });
        reportService.appendReportFiles.mockResolvedValue(undefined);
        reportService.syncTaskStatus.mockResolvedValue(undefined);

        const result = await handleFixUpload(
            {} as Request,
            {
                id: 'u1',
                firstName: 'Test',
                lastName: 'User',
                emailAddresses: [],
            } as never
        );

        expect(result.ok).toBe(true);
        expect(shared.buildReportKey).toHaveBeenCalledWith(
            expect.objectContaining({
                taskId: 'T1',
                baseId: 'B1',
                subpath: FIX_REMARKS_FOLDER_NAME,
                isFix: true,
            })
        );
    });
});
