import Organization from '@/server/models/OrganizationModel';
import Project from '@/server/models/ProjectModel';
import { getOrgAndProjectByRef } from '@/server/org/project-ref';

jest.mock('@/server/models/OrganizationModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/server/models/ProjectModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

const mockedOrg = Organization as jest.Mocked<typeof Organization>;
const mockedProject = Project as jest.Mocked<typeof Project>;

describe('getOrgAndProjectByRef', () => {
    beforeEach(() => {
        mockedOrg.findOne.mockReset();
        mockedProject.findOne.mockReset();
    });

    it('returns error when org not found', async () => {
        mockedOrg.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            }),
        } as never);

        const result = await getOrgAndProjectByRef('missing', 'proj');

        expect(result).toEqual({ error: 'Org not found' });
    });

    it('returns error when project not found', async () => {
        mockedOrg.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: 'org1', orgSlug: 'org' }),
            }),
        } as never);
        mockedProject.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            }),
        } as never);

        const result = await getOrgAndProjectByRef('org', 'proj');

        expect(result).toEqual({ error: 'Project not found' });
    });

    it('returns org and project on success', async () => {
        mockedOrg.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: 'org1', orgSlug: 'org' }),
            }),
        } as never);
        mockedProject.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: 'proj1',
                    orgId: 'org1',
                    key: 'P1',
                }),
            }),
        } as never);

        const result = await getOrgAndProjectByRef('org', 'proj');

        expect(result).toEqual({
            orgDoc: { _id: 'org1', orgSlug: 'org' },
            projectDoc: { _id: 'proj1', orgId: 'org1', key: 'P1' },
        });
    });
});
