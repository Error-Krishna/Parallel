import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;

  const communitiesService = {
    getCommunities: vi.fn(),
    joinCommunity: vi.fn(),
    skipCommunity: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CommunitiesController(communitiesService as CommunitiesService);
  });

  it('returns communities', async () => {
    const communities = [
      {
        id: 'community-1',
        name: 'Builders',
      },
    ];

    communitiesService.getCommunities.mockResolvedValue(communities);

    await expect(
      controller.getCommunities({ id: 'user-1' }),
    ).resolves.toEqual(communities);

    expect(communitiesService.getCommunities).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('joins a community for the authenticated user', async () => {
    communitiesService.joinCommunity.mockResolvedValue(undefined);

    await expect(
      controller.joinCommunity(
        { id: 'user-1' },
        'community-1',
      ),
    ).resolves.toBeUndefined();

    expect(communitiesService.joinCommunity).toHaveBeenCalledWith(
      'user-1',
      'community-1',
    );
  });

  it('skips a community for the authenticated user', async () => {
    communitiesService.skipCommunity.mockResolvedValue(undefined);

    await expect(
      controller.skipCommunity(
        { id: 'user-1' },
        'community-1',
      ),
    ).resolves.toBeUndefined();

    expect(communitiesService.skipCommunity).toHaveBeenCalledWith(
      'user-1',
      'community-1',
    );
  });
});
