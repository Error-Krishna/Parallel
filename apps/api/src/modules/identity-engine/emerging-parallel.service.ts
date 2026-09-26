import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { EmbeddingService } from './embedding.service.js';
import type {
  ClusterSummary,
  ParallelNamingProvider,
} from './providers/parallel-naming.provider.js';

@Injectable()
export class EmergingParallelService {
  private readonly logger = new Logger(
    EmergingParallelService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('ParallelNamingProvider')
    private readonly namingProvider: ParallelNamingProvider,
    private readonly embeddingService: EmbeddingService,
  ) {}

  private getNoveltyRules(): {
    minimumClusterSize: number;
    minimumCoherence: number;
    maximumExistingSimilarity: number;
  } {
    return {
      minimumClusterSize:
        this.configService.get<number>(
          'app.emergingParallel.minimumClusterSize',
        ) ?? 3,
      minimumCoherence:
        this.configService.get<number>(
          'app.emergingParallel.minimumCoherence',
        ) ?? 0.7,
      maximumExistingSimilarity:
        this.configService.get<number>(
          'app.emergingParallel.maximumExistingSimilarity',
        ) ?? 0.2,
    };
  }

  getClusterSimilarityThreshold(): number {
    return (
      this.configService.get<number>(
        'app.emergingParallel.clusterSimilarityThreshold',
      ) ?? 0.7
    );
  }

  evaluateNovelty(
    candidate: {
      size: number;
      coherence: number;
      strongestExistingSimilarity: number | null;
    },
    rules?: {
      minimumClusterSize: number;
      minimumCoherence: number;
      maximumExistingSimilarity: number;
    },
  ): boolean {
    const effectiveRules = rules ?? this.getNoveltyRules();

    if (candidate.size < effectiveRules.minimumClusterSize) {
      return false;
    }

    if (candidate.coherence < effectiveRules.minimumCoherence) {
      return false;
    }

    if (
      candidate.strongestExistingSimilarity !== null &&
      candidate.strongestExistingSimilarity >
        effectiveRules.maximumExistingSimilarity
    ) {
      return false;
    }

    return true;
  }

  async prepareEmergingParallel(
    userId: string,
    threshold: number,
  ): Promise<
    Array<{
      contentIds: string[];
      size: number;
      coherence: number;
      strongestExistingParallel: string | null;
      strongestExistingSimilarity: number | null;
      embedding: number[];
      clusterSummary: ClusterSummary;
      identity: {
        name: string;
        description: string;
      };
      suggestionReason: string;
    }>
  > {
    const candidates =
      await this.analyzeEmergingCandidates(
        userId,
        threshold,
      );

    const novelCandidates = candidates.filter(
      (candidate) =>
        this.evaluateNovelty(candidate),
    );

    const prepared = [];

    for (const candidate of novelCandidates) {
      const identity =
        await this.generateIdentityForCandidate(
          candidate,
        );

      prepared.push({
        ...candidate,
        identity,
        suggestionReason:
          this.buildSuggestionReason(
            candidate.clusterSummary,
          ),
      });
    }

    return prepared;
  }

  private buildSuggestionReason(
    clusterSummary: ClusterSummary,
  ): string {
    const titles = clusterSummary.items
      .sort((a, b) => b.signalWeight - a.signalWeight)
      .slice(0, 3)
      .map((item) => item.title);

    if (titles.length === 0) {
      return 'Suggested from a newly detected interest pattern.';
    }

    if (titles.length === 1) {
      return `Suggested because you showed strong interest in ${titles[0]}.`;
    }

    return `Suggested because your recent activity repeatedly connects with ${titles.join(', ')}.`;
  }

  async createEmergingParallel(
    userId: string,
    input: {
      name: string;
      description: string;
      icon?: string;
      strengthPct: number;
      suggestionReason: string;
      embedding: number[];
    },
  ): Promise<{
    parallelTypeId: string;
    userParallelId: string;
  }> {
    const parallelType = await this.prisma.parallelType.upsert({
      where: {
        name: input.name,
      },
      update: {
        description: input.description,
        icon: input.icon,
      },
      create: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        isSystemGenerated: true,
      },
    });

    const existingUserParallel = await this.prisma.userParallel.findUnique({
      where: {
        userId_parallelTypeId: {
          userId,
          parallelTypeId: parallelType.id,
        },
      },
    });

    if (existingUserParallel) {
      return {
        parallelTypeId: parallelType.id,
        userParallelId: existingUserParallel.id,
      };
    }

    const userParallel = await this.prisma.userParallel.create({
      data: {
        userId,
        parallelTypeId: parallelType.id,
        strengthPct: input.strengthPct,
        isGhost: true,
        isHidden: false,
        suggestionReason: input.suggestionReason,
      },
    });

    await this.embeddingService.saveUserParallelEmbedding(
      userParallel.id,
      input.embedding,
    );

    return {
      parallelTypeId: parallelType.id,
      userParallelId: userParallel.id,
    };
  }

  async analyzeEmergingCandidates(
    userId: string,
    threshold: number,
  ): Promise<
    Array<{
      contentIds: string[];
      size: number;
      coherence: number;
      strongestExistingParallel: string | null;
      strongestExistingSimilarity: number | null;
      embedding: number[];
      clusterSummary: ClusterSummary;
    }>
  > {
    const signals = await this.prisma.interestSignal.findMany({
      where: {
        userId,
        targetType: 'content',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        targetId: true,
        weight: true,
      },
    });

    const contentIds = [
      ...new Set(signals.map((signal) => signal.targetId)),
    ];

    const contentItems = await this.prisma.contentItem.findMany({
      where: {
        id: {
          in: contentIds,
        },
      },
      select: {
        id: true,
        type: true,
        payload: true,
      },
    });

    const contentById = new Map(
      contentItems.map((content) => [
        content.id,
        content,
      ]),
    );

    const items: Array<{
      id: string;
      embedding: number[];
      weight: number;
    }> = [];

    for (const signal of signals) {
      const embedding = await this.getContentEmbedding(
        signal.targetId,
      );

      if (!embedding) {
        continue;
      }

      items.push({
        id: signal.targetId,
        embedding,
        weight: signal.weight,
      });
    }

    const clusters = this.buildSimilarityClusters(
      items,
      threshold,
    );

    const parallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isHidden: false,
        dismissedAt: null,
      },
      select: {
        id: true,
        parallelType: {
          select: {
            name: true,
          },
        },
      },
    });

    const candidates = [];

    for (const cluster of clusters) {
      if (cluster.length < 2) {
        continue;
      }

      const clusterItems = items.filter((item) =>
        cluster.includes(item.id),
      );

      const embedding =
        this.buildWeightedInterestEmbedding(clusterItems);

      if (!embedding) {
        continue;
      }

      let totalSimilarity = 0;
      let pairCount = 0;

      for (let i = 0; i < clusterItems.length; i += 1) {
        for (
          let j = i + 1;
          j < clusterItems.length;
          j += 1
        ) {
          totalSimilarity += this.cosineSimilarity(
            clusterItems[i].embedding,
            clusterItems[j].embedding,
          );

          pairCount += 1;
        }
      }

      const coherence =
        pairCount > 0
          ? totalSimilarity / pairCount
          : 0;

      let strongestExistingParallel: string | null = null;
      let strongestExistingSimilarity: number | null = null;

      for (const parallel of parallels) {
        const similarity =
          await this.getSimilarityToUserParallel(
            parallel.id,
            embedding,
          );

        if (
          similarity !== null &&
          (strongestExistingSimilarity === null ||
            similarity > strongestExistingSimilarity)
        ) {
          strongestExistingSimilarity = similarity;
          strongestExistingParallel =
            parallel.parallelType.name;
        }
      }

      const novelty = this.evaluateNovelty({
        size: cluster.length,
        coherence,
        strongestExistingSimilarity,
      });

      this.logger.log(
        `Emerging Parallel cluster analyzed: ${JSON.stringify({
          userId,
          clusterSize: cluster.length,
          coherence,
          strongestExistingParallel,
          strongestExistingSimilarity,
          isNovel: novelty,
        })}`,
      );

      candidates.push({
        contentIds: cluster,
        size: cluster.length,
        coherence,
        strongestExistingParallel,
        strongestExistingSimilarity,
        embedding,
        clusterSummary: {
          items: cluster.flatMap((contentId) => {
            const content = contentById.get(contentId);

            if (!content) {
              return [];
            }

            const payload =
              content.payload &&
              typeof content.payload === 'object' &&
              !Array.isArray(content.payload)
                ? (content.payload as Record<string, unknown>)
                : {};

            return [
              {
                title:
                  typeof payload.title === 'string'
                    ? payload.title
                    : 'Untitled content',
                type: content.type,
                description:
                  typeof payload.body === 'string'
                    ? payload.body
                    : '',
                signalWeight:
                  items.find((item) => item.id === contentId)
                    ?.weight ?? 1,
              },
            ];
          }),
        },
      });
    }

    return candidates;
  }

  private cosineSimilarity(
    a: number[],
    b: number[],
  ): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  buildSimilarityClusters(
    items: Array<{
      id: string;
      embedding: number[];
      weight: number;
    }>,
    threshold: number,
  ): Array<string[]> {
    const clusters: string[][] = [];
    const visited = new Set<string>();

    const similarity = (
      a: number[],
      b: number[],
    ): number => {
      let dot = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }

      if (normA === 0 || normB === 0) {
        return 0;
      }

      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    for (const item of items) {
      if (visited.has(item.id)) {
        continue;
      }

      const cluster: string[] = [item.id];
      const queue: string[] = [item.id];

      visited.add(item.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const current = items.find(
          (candidate) => candidate.id === currentId,
        );

        if (!current) {
          continue;
        }

        for (const candidate of items) {
          if (visited.has(candidate.id)) {
            continue;
          }

          if (
            similarity(
              current.embedding,
              candidate.embedding,
            ) >= threshold
          ) {
            visited.add(candidate.id);
            cluster.push(candidate.id);
            queue.push(candidate.id);
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  async buildUserInterestEmbedding(
    userId: string,
  ): Promise<number[] | null> {
    const signals = await this.prisma.interestSignal.findMany({
      where: {
        userId,
        targetType: 'content',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        targetId: true,
        weight: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const embeddings: Array<{
      embedding: number[];
      weight: number;
    }> = [];

    for (const signal of signals) {
      const embedding = await this.getContentEmbedding(signal.targetId);

      if (!embedding) {
        continue;
      }

      embeddings.push({
        embedding,
        weight: signal.weight,
      });
    }

    return this.buildWeightedInterestEmbedding(embeddings);
  }

  buildWeightedInterestEmbedding(
    embeddings: Array<{
      embedding: number[];
      weight: number;
    }>,
  ): number[] | null {
    if (embeddings.length === 0) {
      return null;
    }

    const dimensions = embeddings[0].embedding.length;

    const weightedVector = Array.from(
      { length: dimensions },
      () => 0,
    );

    let totalWeight = 0;

    for (const item of embeddings) {
      if (item.embedding.length !== dimensions) {
        throw new Error('Embedding dimensions do not match');
      }

      for (let i = 0; i < dimensions; i += 1) {
        weightedVector[i] += item.embedding[i] * item.weight;
      }

      totalWeight += item.weight;
    }

    if (totalWeight === 0) {
      return null;
    }

    return weightedVector.map(
      (value) => value / totalWeight,
    );
  }

  async getContentEmbedding(
    contentItemId: string,
  ): Promise<number[] | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ embedding: string }>
    >`
      SELECT embedding::text AS embedding
      FROM content_items
      WHERE id = ${contentItemId}
        AND embedding IS NOT NULL
      LIMIT 1
    `;

    const embeddingText = rows[0]?.embedding;

    if (!embeddingText) {
      return null;
    }

    return embeddingText
      .slice(1, -1)
      .split(',')
      .map(Number);
  }

  async generateIdentityForCandidate(
    candidate: {
      clusterSummary: ClusterSummary;
    },
  ): Promise<{
    name: string;
    description: string;
  }> {
    return this.namingProvider.generateParallelIdentity(
      candidate.clusterSummary,
    );
  }

  async getSimilarityToUserParallel(
    userParallelId: string,
    candidateEmbedding: number[],
  ): Promise<number | null> {
    const vector = `[${candidateEmbedding.join(',')}]`;

    const rows = await this.prisma.$queryRaw<
      Array<{ similarity: number }>
    >`
      SELECT
        1 - (embedding <=> ${vector}::vector(384)) AS similarity
      FROM user_parallels
      WHERE id = ${userParallelId}
        AND embedding IS NOT NULL
      LIMIT 1
    `;

    return rows[0]?.similarity ?? null;
  }
}
