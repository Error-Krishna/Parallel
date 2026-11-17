import { ContentType, PrismaClient, QuestRewardType } from '@prisma/client';

try {
  process.loadEnvFile('.env');
} catch {
  // Environment variables may already be provided by the host/CI.
}

const prisma = new PrismaClient();

interface SeedParallelCatalog {
  name: string;
  description: string;
  icon: string;
  content: Array<{
    type: ContentType;
    payload: {
      title: string;
      body: string;
      tags: string[];
    };
  }>;
  quests: Array<{
    title: string;
    description: string;
    season: string;
    rewardType: QuestRewardType;
    rewardValue: string;
    steps: Array<{ title: string; description: string }>;
  }>;
}

const STARTER_CATALOG: SeedParallelCatalog[] = [
  {
    name: 'Builder',
    description: 'You like turning ideas into something real.',
    icon: 'plus',
    content: [
      {
        type: ContentType.CHALLENGE_PROMPT,
        payload: {
          title: 'Build something tiny in 45 minutes',
          body: 'Pick one friction in your daily routine and sketch or prototype the smallest possible fix — ugly first drafts win.',
          tags: ['prototype', 'making', 'sprint'],
        },
      },
      {
        type: ContentType.ARTICLE,
        payload: {
          title: 'Why side projects die at 80% — and how to ship anyway',
          body: 'Cutting scope in half turns perpetual drafts into finished artifacts you can actually share.',
          tags: ['shipping', 'craft', 'systems'],
        },
      },
      {
        type: ContentType.POST,
        payload: {
          title: 'Show your favorite tool nobody talks about',
          body: 'From notebook layouts to obscure CLI utilities, share the quiet tool that speeds up your workflow.',
          tags: ['tools', 'workflow'],
        },
      },
    ],
    quests: [
      {
        title: '48-Hour Micro-Ship',
        description: 'Turn one half-baked note into a real thing you can point to.',
        season: 'Season 1',
        rewardType: QuestRewardType.BADGE,
        rewardValue: 'micro-shipper',
        steps: [
          { title: 'Pick the spark', description: 'Choose one tiny idea you can scope down to an afternoon.' },
          { title: 'Build the rough version', description: 'Make an imperfect working version without polishing.' },
          { title: 'Share the artifact', description: 'Show one person or log what surprised you while building it.' },
        ],
      },
      {
        title: 'Reverse-Engineer Something You Love',
        description: 'Deconstruct a product, song, or physical object to see how it ticks.',
        season: 'Season 1',
        rewardType: QuestRewardType.HIDDEN_PARALLEL_HINT,
        rewardValue: 'systems-architect-hint',
        steps: [
          { title: 'Choose an object', description: 'Pick something you use every day and admire.' },
          { title: 'Map its trade-offs', description: 'Write down 3 clever decisions its makers got right.' },
        ],
      },
    ],
  },
  {
    name: 'Music Head',
    description: 'Music and creative energy pull you in.',
    icon: 'music',
    content: [
      {
        type: ContentType.CHALLENGE_PROMPT,
        payload: {
          title: 'Three-track midnight playlist swap',
          body: 'Pick three songs that sound like walking home after rain — no obvious hits allowed.',
          tags: ['playlists', 'discovery', 'late-night'],
        },
      },
      {
        type: ContentType.ARTICLE,
        payload: {
          title: 'How drum machines shaped modern bedroom production',
          body: 'A quick listen through lo-fi samplers, tape hiss, and why constraints create signature sound.',
          tags: ['production', 'synths', 'history'],
        },
      },
      {
        type: ContentType.EVENT,
        payload: {
          title: 'Listening room: full album, front to back',
          body: 'Put your phone face-down for 40 minutes and experience an album in the sequence the artist intended.',
          tags: ['albums', 'listening'],
        },
      },
    ],
    quests: [
      {
        title: 'Genre Detour',
        description: 'Step outside your usual rotation and find one track that surprises you.',
        season: 'Season 1',
        rewardType: QuestRewardType.BADGE,
        rewardValue: 'sonic-wanderer',
        steps: [
          { title: 'Pick an unfamiliar scene', description: 'Choose a genre or decade you rarely queue up.' },
          { title: 'Deep listen', description: 'Listen to three tracks all the way through without skipping.' },
          { title: 'Save your favorite', description: 'Bookmark the one sound or texture you want to revisit.' },
        ],
      },
      {
        title: 'Soundtrack a Moment',
        description: 'Curate a 5-track mini-set for a specific time of day or place.',
        season: 'Season 1',
        rewardType: QuestRewardType.COSMETIC_FRAME,
        rewardValue: 'vinyl-glow-frame',
        steps: [
          { title: 'Set the scene', description: 'Choose a mood — sunrise coffee, rainy commute, or midnight focus.' },
          { title: 'Sequence the arc', description: 'Order five songs so the energy flows naturally.' },
        ],
      },
    ],
  },
  {
    name: 'Gamer',
    description: 'You enjoy systems, challenges and figuring things out.',
    icon: 'gamepad',
    content: [
      {
        type: ContentType.ARTICLE,
        payload: {
          title: 'What great level design teaches without a single tutorial',
          body: 'How lighting, sightlines, and tiny safe failures invite curiosity better than pop-up hints.',
          tags: ['game-design', 'systems', 'mechanics'],
        },
      },
      {
        type: ContentType.CHALLENGE_PROMPT,
        payload: {
          title: 'Play an indie game with zero guides',
          body: 'Spend 30 minutes exploring a compact puzzle or roguelike completely blind and note what clicked.',
          tags: ['indie', 'puzzles', 'exploration'],
        },
      },
      {
        type: ContentType.POST,
        payload: {
          title: 'Best emergent moment you never expected',
          body: 'When two game systems collided in a way the developers probably never scripted.',
          tags: ['emergent', 'stories'],
        },
      },
    ],
    quests: [
      {
        title: 'System Breaker',
        description: 'Experiment with an unconventional playstyle or self-imposed rule.',
        season: 'Season 1',
        rewardType: QuestRewardType.BADGE,
        rewardValue: 'system-breaker',
        steps: [
          { title: 'Invent a constraint', description: 'Pick a playful rule (no fast travel, starter gear only, pacifist run).' },
          { title: 'Play one session', description: 'See what new strategies emerge under the constraint.' },
        ],
      },
      {
        title: 'Co-op Strategy Sync',
        description: 'Team up with someone new and solve a problem together.',
        season: 'Season 1',
        rewardType: QuestRewardType.COSMETIC_FRAME,
        rewardValue: 'arcade-grid-frame',
        steps: [
          { title: 'Pick a co-op challenge', description: 'Choose a puzzle, board game, or co-op level.' },
          { title: 'Reflect on roles', description: 'Notice who naturally strategized vs improvised.' },
        ],
      },
    ],
  },
  {
    name: 'Explorer',
    description: 'You are drawn toward new places, ideas and experiences.',
    icon: 'compass',
    content: [
      {
        type: ContentType.CHALLENGE_PROMPT,
        payload: {
          title: 'Take a street you have walked past 50 times',
          body: 'Turn down one unfamiliar side street near you and notice three details you never spotted before.',
          tags: ['neighborhood', 'walking', 'curiosity'],
        },
      },
      {
        type: ContentType.POST,
        payload: {
          title: 'Hidden third places worth knowing',
          body: 'Quiet libraries, late-night diners, indie bookshops, or rooftops that spark good thinking.',
          tags: ['third-places', 'city', 'culture'],
        },
      },
      {
        type: ContentType.ARTICLE,
        payload: {
          title: 'The art of micro-adventures in your own city',
          body: 'You do not need a plane ticket to break routine — novelty starts two transit stops away.',
          tags: ['micro-adventure', 'urban'],
        },
      },
    ],
    quests: [
      {
        title: 'Uncharted Corner',
        description: 'Discover a spot within 20 minutes of home you have never visited.',
        season: 'Season 1',
        rewardType: QuestRewardType.BADGE,
        rewardValue: 'uncharted-scout',
        steps: [
          { title: 'Pick a spot on the map', description: 'Choose a park, cafe, museum, or street you have never stepped into.' },
          { title: 'Spend 20 minutes observing', description: 'Leave headphones off and take in the vibe.' },
          { title: 'Capture one memory', description: 'Note one surprising detail or photo from the visit.' },
        ],
      },
      {
        title: 'Curiosity Rabbit Hole',
        description: 'Follow one weird question across three totally different fields.',
        season: 'Season 1',
        rewardType: QuestRewardType.HIDDEN_PARALLEL_HINT,
        rewardValue: 'polymath-hint',
        steps: [
          { title: 'Start with one question', description: 'Pick something random you wondered about this week.' },
          { title: 'Connect two worlds', description: 'Read or watch one piece from a completely unexpected angle.' },
        ],
      },
    ],
  },
];

async function main() {
  console.log('Seeding curated starter Parallel content and quests...');

  let createdContent = 0;
  let createdQuests = 0;

  for (const entry of STARTER_CATALOG) {
    const parallelType = await prisma.parallelType.upsert({
      where: { name: entry.name },
      update: {
        description: entry.description,
        icon: entry.icon,
      },
      create: {
        name: entry.name,
        description: entry.description,
        icon: entry.icon,
        isSystemGenerated: true,
      },
    });

    const existingItems = await prisma.contentItem.findMany({
      where: { parallelTypeId: parallelType.id },
      select: { payload: true },
    });
    const existingTitles = new Set(
      existingItems
        .map((item) =>
          item.payload &&
          typeof item.payload === 'object' &&
          'title' in item.payload
            ? String((item.payload as { title?: unknown }).title ?? '')
            : '',
        )
        .filter(Boolean),
    );

    for (const content of entry.content) {
      if (!existingTitles.has(content.payload.title)) {
        await prisma.contentItem.create({
          data: {
            parallelTypeId: parallelType.id,
            type: content.type,
            payload: content.payload,
          },
        });
        createdContent += 1;
      }
    }

    const existingQuests = await prisma.quest.findMany({
      where: { parallelTypeId: parallelType.id },
      select: { title: true },
    });
    const existingQuestTitles = new Set(existingQuests.map((q) => q.title));

    for (const quest of entry.quests) {
      if (!existingQuestTitles.has(quest.title)) {
        await prisma.quest.create({
          data: {
            parallelTypeId: parallelType.id,
            title: quest.title,
            description: quest.description,
            steps: quest.steps,
            rewardType: quest.rewardType,
            rewardValue: quest.rewardValue,
            season: quest.season,
            isAiGenerated: false,
          },
        });
        createdQuests += 1;
      }
    }
  }

  console.log(
    `Done. Created ${createdContent} content item(s) and ${createdQuests} quest(s).`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to seed starter content:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
