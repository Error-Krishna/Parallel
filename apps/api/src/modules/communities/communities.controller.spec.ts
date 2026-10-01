import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;

  const communitiesService = {
    getCommunities: vi.fn(),
    joinCommunity: vi.fn(),
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

    await expect(controller.getCommunities()).resolves.toEqual(communities);
    expect(communitiesService.getCommunities).toHaveBeenCalledOnce();
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
});
