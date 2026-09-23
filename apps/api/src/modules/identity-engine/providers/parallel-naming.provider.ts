export interface ClusterSummary {
  items: Array<{
    title: string;
    type: string;
    description: string;
    signalWeight: number;
  }>;
}

export interface ParallelIdentity {
  name: string;
  description: string;
}

export interface ParallelNamingProvider {
  generateParallelIdentity(
    clusterSummary: ClusterSummary,
  ): Promise<ParallelIdentity>;
}
