import ChatConversationModel from '@/server/models/ChatConversationModel';
import MembershipModel from '@/server/models/MembershipModel';
import dbConnect from '@/server/db/mongoose';
import {
    chatMessageToDTO,
    normalizeEmail,
    requireConversationAccess,
} from '@/server/messenger/helpers';

jest.mock('@/server/db/mongoose', () => jest.fn());

jest.mock('@/server/models/ChatConversationModel', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
    },
}));

jest.mock('@/server/models/MembershipModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
    },
}));

const mockedConversation = ChatConversationModel as jest.Mocked<typeof ChatConversationModel>;
const mockedMembership = MembershipModel as jest.Mocked<typeof MembershipModel>;
const mockedDbConnect = dbConnect as jest.Mock;

describe('messenger helpers', () => {
    beforeEach(() => {
        mockedConversation.findById.mockReset();
        mockedMembership.findOne.mockReset();
        mockedDbConnect.mockReset();
    });

    it('normalizeEmail trims and lowercases', () => {
        expect(normalizeEmail(' Test@Email.Com ')).toBe('test@email.com');
    });

    it('chatMessageToDTO fills defaults', () => {
        const dto = chatMessageToDTO({ _id: 'msg1' });
        expect(dto.id).toBe('msg1');
        expect(dto.text).toBe('');
        expect(dto.readBy).toEqual([]);
    });

    it('requireConversationAccess throws when conversation missing', async () => {
        mockedConversation.findById.mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
        } as never);

        await expect(
            requireConversationAccess('conv1', 'user@example.com', 'user1', false)
        ).rejects.toThrow('Чат не найден');
    });

    it('allows direct conversation when user is participant', async () => {
        mockedConversation.findById.mockReturnValue({
            exec: jest.fn().mockResolvedValue({
                _id: 'conv1',
                orgId: 'org1',
                type: 'direct',
                participants: ['user@example.com'],
            }),
        } as never);
        mockedMembership.findOne.mockReturnValue({
            lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            }),
        } as never);

        const access = await requireConversationAccess(
            'conv1',
            'user@example.com',
            'user1',
            false
        );

        expect(access.conversationId).toBe('conv1');
        expect(access.orgId).toBe('org1');
    });

    it('blocks non-direct conversation without membership', async () => {
        mockedConversation.findById.mockReturnValue({
            exec: jest.fn().mockResolvedValue({
                _id: 'conv1',
                orgId: 'org1',
                type: 'group',
                participants: [],
            }),
        } as never);
        mockedMembership.findOne.mockReturnValue({
            lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            }),
        } as never);

        await expect(
            requireConversationAccess('conv1', 'user@example.com', 'user1', false)
        ).rejects.toThrow('Нет доступа к организации');
    });
});
