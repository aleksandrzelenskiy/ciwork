import ReportModel from '@/server/models/ReportModel';
import { downloadBaseReportZip, downloadTaskReportsZip } from '@/server/reports/download';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';

jest.mock('@/server/models/ReportModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
    },
}));

jest.mock('@/server/models/TaskModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/utils/initiatorAccessToken', () => ({
    verifyInitiatorAccessToken: jest.fn(),
}));

const mockedReport = ReportModel as jest.Mocked<typeof ReportModel>;
const mockedVerify = verifyInitiatorAccessToken as jest.Mock;

describe('reports download service', () => {
    beforeEach(() => {
        mockedReport.findOne.mockReset();
        mockedReport.find.mockReset();
        mockedVerify.mockReset();
    });

    it('downloadBaseReportZip returns 400 for missing params', async () => {
        const result = await downloadBaseReportZip({
            taskId: '',
            baseId: '',
            token: undefined,
            user: null,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('downloadTaskReportsZip returns 401 when no user or token', async () => {
        mockedVerify.mockReturnValue(null);

        const result = await downloadTaskReportsZip({
            taskId: 'T1',
            token: undefined,
            user: null,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(401);
        }
    });

    it('downloadTaskReportsZip returns 400 when no files', async () => {
        mockedVerify.mockReturnValue(null);
        mockedReport.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                { baseId: 'B1', files: [], fixedFiles: [] },
            ]),
        } as never);

        const result = await downloadTaskReportsZip({
            taskId: 'T1',
            token: undefined,
            user: { id: 'u1' } as never,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });
});
