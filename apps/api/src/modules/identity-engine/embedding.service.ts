import { Injectable } from '@nestjs/common';
import { pipeline } from '@huggingface/transformers';
import { PrismaService } from '../../database/prisma.service.js';

type FeatureExtractor = (
  text: string,
  options: {
    pooling: 'mean';
    normalize: boolean;
  },
) => Promise<{
  data: Float32Array;
}>;

interface InterestSignalInput {
  signalType: string;
  weight: number;
}

@Injectable()
export class EmbeddingService {
  private extractorPromise: Promise<FeatureExtractor> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getExtractor(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      this.extractorPromise = pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      ) as unknown as Promise<FeatureExtractor>;
    }

    return this.extractorPromise;
  }

  buildInterestSignature(
    parallelName: string,
    parallelDescription: string,
    signals: InterestSignalInput[],
  ): string {
    const signalSummary = signals
      .map((signal) => `${signal.signalType} (${signal.weight})`)
      .join(', ');

    return [
      `Parallel: ${parallelName}`,
      `Description: ${parallelDescription}`,
      `Recent user activity: ${signalSummary || 'none'}`,
    ].join('. ');
  }

  async generate(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();

    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }

  async saveUserParallelEmbedding(
    userParallelId: string,
    embedding: number[],
  ): Promise<void> {
    const vector = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      UPDATE user_parallels
      SET embedding = ${vector}::vector(384)
      WHERE id = ${userParallelId}
    `;
  }
}
