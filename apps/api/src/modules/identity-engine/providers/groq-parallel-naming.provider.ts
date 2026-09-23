import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  ClusterSummary,
  ParallelIdentity,
  ParallelNamingProvider,
} from './parallel-naming.provider.js';

@Injectable()
export class GroqParallelNamingProvider
  implements ParallelNamingProvider
{
  private readonly client: Groq | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('groqApiKey');

    this.client = apiKey
      ? new Groq({ apiKey })
      : null;
  }

  async generateParallelIdentity(
    clusterSummary: ClusterSummary,
  ): Promise<ParallelIdentity> {
    if (!this.client) {
      return this.fallbackIdentity(clusterSummary);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        temperature: 0.4,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content:
              'You create concise identity names for a personal identity discovery product. Return only valid JSON with exactly two fields: name and description. The name should be 2 to 4 words. The description should be one clear sentence explaining the shared interest pattern. Do not make psychological, medical, or personality diagnoses.',
          },
          {
            role: 'user',
            content: JSON.stringify(clusterSummary),
          },
        ],
      });

      const content =
        response.choices[0]?.message?.content;

      if (!content) {
        return this.fallbackIdentity(clusterSummary);
      }

      const parsed = JSON.parse(content) as Partial<ParallelIdentity>;

      if (
        typeof parsed.name !== 'string' ||
        typeof parsed.description !== 'string' ||
        !parsed.name.trim() ||
        !parsed.description.trim()
      ) {
        return this.fallbackIdentity(clusterSummary);
      }

      return {
        name: parsed.name.trim(),
        description: parsed.description.trim(),
      };
    } catch {
      return this.fallbackIdentity(clusterSummary);
    }
  }

  private fallbackIdentity(
    clusterSummary: ClusterSummary,
  ): ParallelIdentity {
    const firstItem = clusterSummary.items[0];

    return {
      name: 'Emerging Interest',
      description: firstItem
        ? `Your recent activity shows a recurring interest in ${firstItem.title.toLowerCase()}.`
        : 'Your recent activity shows a recurring interest pattern.',
    };
  }
}
