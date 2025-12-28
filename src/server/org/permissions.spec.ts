import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';
import dbConnect from '@/server/db/mongoose';
import { getOrgBySlug, requireOrgRole } from '@/server/org/permissions';

jest.mock('@/server/db/mongoose', () => jest.fn());

jest.mock('@/server/models/OrganizationModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/server/models/MembershipModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
    OrgRole: {},
}));

const mockedOrg = Organization as jest.Mocked<typeof Organization>;
const mockedMembership = Membership as jest.Mocked<typeof Membership>;
const mockedDbConnect = dbConnect as jest.Mock;

describe('org permissions', () => {
    beforeEach(() => {
        mockedOrg.findOne.mockReset();
        mockedMembership.findOne.mockReset();
        mockedDbConnect.mockReset();
    });

    it('getOrgBySlug throws when org missing', async () => {
        mockedOrg.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        } as never);

        await expect(getOrgBySlug('missing')).rejects.toThrow('Организация не найдена');
    });

    it('requireOrgRole throws when membership missing', async () => {
        mockedOrg.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: 'org1', orgSlug: 'org' }),
        } as never);
        mockedMembership.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        } as never);

        await expect(
            requireOrgRole('org', 'user@example.com', ['owner'])
        ).rejects.toThrow('Нет членства в этой организации');
    });

    it('requireOrgRole returns org and membership when allowed', async () => {
        mockedOrg.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: 'org1', orgSlug: 'org' }),
        } as never);
        mockedMembership.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                _id: 'mem1',
                orgId: 'org1',
                userEmail: 'user@example.com',
                role: 'owner',
            }),
        } as never);

        const result = await requireOrgRole('org', 'user@example.com', ['owner']);

        expect(result.org.orgSlug).toBe('org');
        expect(result.membership.role).toBe('owner');
    });
});
