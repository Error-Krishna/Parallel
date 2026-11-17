import { ConfigService } from '@nestjs/config';
import { GroqParallelNamingProvider } from './groq-parallel-naming.provider.js';
import type { ClusterSummary } from './parallel-naming.provider.js';

const mockCreate = vi.fn();

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(function MockGroq() {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }),
}));

describe('GroqParallelNamingProvider', () => {
  const sampleCluster: ClusterSummary = {
    clusterSize: 3,
    items: [
      {
        title: 'Brutalist Transit Stations',
        summary: 'Photo essay on urban concrete geometry',
        tags: ['architecture', 'urban'],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads app.groqApiKey from ConfigService and returns parsed Groq identity', async () => {
    const get = vi.fn((key: string) =>
      key === 'app.groqApiKey' ? 'gsk_test_key_123' : undefined,
    );
    const configService = { get } as unknown as ConfigService;

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              name: 'City Alchemist',
              description: 'You gravitate toward bold urban spaces and transit design.',
            }),
          },
        },
      ],
    });

    const provider = new GroqParallelNamingProvider(configService);
    const identity = await provider.generateParallelIdentity(sampleCluster);

    expect(get).toHaveBeenCalledWith('app.groqApiKey');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(identity).toEqual({
      name: 'City Alchemist',
      description: 'You gravitate toward bold urban spaces and transit design.',
    });
  });

  it('falls back cleanly without calling Groq when app.groqApiKey is unset', async () => {
    const configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const provider = new GroqParallelNamingProvider(configService);
    const identity = await provider.generateParallelIdentity(sampleCluster);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(identity).toEqual({
      name: 'Emerging Interest',
      description:
        'Your recent activity shows a recurring interest in brutalist transit stations.',
    });
  });

  it('falls back cleanly when Groq returns malformed JSON or throws', async () => {
    const configService = {
      get: vi.fn((key: string) =>
        key === 'app.groqApiKey' ? 'gsk_test_key_123' : undefined,
      ),
    } as unknown as ConfigService;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    const provider = new GroqParallelNamingProvider(configService);
    const identity = await provider.generateParallelIdentity(sampleCluster);

    expect(identity.name).toBe('Emerging Interest');
    expect(identity.description).toContain('brutalist transit stations');

    errorSpy.mockRestore();
  });
});
