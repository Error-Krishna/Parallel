// DEVELOPMENT ONLY — seeds six local test users who all share the same two Parallels,
// so the real Community detection job (CommunitiesService.detectEmergentCommunities,
// run via BullMQ) has something to detect. It deliberately does NOT create Community
// rows: the point is to exercise the real detection + recommendation flow.
//
// Run explicitly with: pnpm --filter api seed:communities
// Safe to re-run: users and UserParallel rows are upserted on their unique keys.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import configuration from '../src/config/configuration.js';

// Same as ConfigModule's envFilePath ('.env', relative to apps/api). Doesn't override
// variables that are already set in the environment.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file — fall back to whatever is already in the environment.
}

const DEV_PASSWORD = 'ParallelTest123!';
const DEV_PARALLEL_STRENGTH = 80;
const DEV_SUGGESTION_REASON = 'Development community seed';

const DEV_USERS = [
  { email: 'community-test-1@parallel.local', username: 'community_test_1' },
  { email: 'community-test-2@parallel.local', username: 'community_test_2' },
  { email: 'community-test-3@parallel.local', username: 'community_test_3' },
  { email: 'community-test-4@parallel.local', username: 'community_test_4' },
  { email: 'community-test-5@parallel.local', username: 'community_test_5' },
  { email: 'community-viewer@parallel.local', username: 'community_viewer' },
] as const;

async function main(): Promise<void> {
  const { nodeEnv, bcryptSaltRounds } = configuration().app;

  if (nodeEnv === 'production') {
    throw new Error('seed-communities is for local development only and will not run in production.');
  }

  const prisma = new PrismaClient();

  try {
    const parallelTypes = await prisma.parallelType.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2,
      select: { id: true, name: true },
    });

    if (parallelTypes.length < 2) {
      throw new Error(
        `At least two ParallelType records are required to seed communities, but found ${parallelTypes.length}. ` +
          'Seed or create your ParallelType records first, then re-run this script.',
      );
    }

    const passwordHash = await bcrypt.hash(DEV_PASSWORD, bcryptSaltRounds);

    for (const devUser of DEV_USERS) {
      // passwordHash is refreshed on re-runs so the credentials printed below always
      // work for these reserved *.parallel.local accounts.
      const user = await prisma.user.upsert({
        where: { email: devUser.email },
        create: {
          email: devUser.email,
          username: devUser.username,
          passwordHash,
        },
        update: { passwordHash },
        select: { id: true },
      });

      for (const parallelType of parallelTypes) {
        // discoveredAt is intentionally omitted so it keeps its default on create and
        // is left untouched on update. embedding is never set.
        await prisma.userParallel.upsert({
          where: {
            userId_parallelTypeId: {
              userId: user.id,
              parallelTypeId: parallelType.id,
            },
          },
          create: {
            userId: user.id,
            parallelTypeId: parallelType.id,
            strengthPct: DEV_PARALLEL_STRENGTH,
            momentum: 0,
            streakCount: 0,
            isGhost: false,
            isHidden: false,
            dismissedAt: null,
            suggestionReason: DEV_SUGGESTION_REASON,
          },
          update: {
            strengthPct: DEV_PARALLEL_STRENGTH,
            momentum: 0,
            streakCount: 0,
            isGhost: false,
            isHidden: false,
            dismissedAt: null,
            suggestionReason: DEV_SUGGESTION_REASON,
          },
        });
      }
    }

    console.log('Community seed complete.');
    console.log(`Parallels: ${parallelTypes.map(({ name }) => name).join(' + ')}`);
    console.log(`Test users: ${DEV_USERS.map(({ username }) => username).join(', ')}`);
    console.log('Development viewer login:');
    console.log('  username: community_viewer');
    console.log(`  password: ${DEV_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
