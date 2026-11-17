export interface GeneratedChallenge {
  challengeTitle: string;
  challengeDescription: string;
  challengeContext: {
    theme: string;
    category: string;
    pairing: [string, string];
  };
}

interface CuratedTemplate {
  title: string;
  theme: string;
  category: string;
  description: string;
}

const CURATED_CHALLENGES: Record<string, CuratedTemplate> = {
  // Explorer + Foodie (Blueprint §4.7 signature pairing)
  'explorer:foodie': {
    title: 'Street Food Expedition',
    theme: 'Culinary Expedition',
    category: 'Exploration & Taste',
    description:
      'Venture to an unfamiliar neighborhood or street market neither of you usually visits. Discover a local culinary spot, try something unexpected, and compare your takes.',
  },
  // Gamer + Music Head (Blueprint §11 signature pairing)
  'gamer:music head': {
    title: 'Soundtrack Sync',
    theme: 'Audio Immersion',
    category: 'Media & Flow',
    description:
      'Trade 3 gaming soundtracks or high-focus music tracks that send you into a complete flow state. Listen or play through them and share what world they evoke.',
  },
  // Builder + Urbanist (Blueprint §11 signature pairing)
  'builder:urbanist': {
    title: 'Micro-City Blueprint',
    theme: 'Urban Architecture',
    category: 'Design & Public Space',
    description:
      'Pick an underutilized corner, street, or public space in your area. Brainstorm 3 rapid design interventions that would make it come alive.',
  },
  // Night Owl + Photographer (Blueprint §11 signature pairing)
  'night owl:photographer': {
    title: 'After-Hours Shutter Walk',
    theme: 'Nocturnal Exploration',
    category: 'Visual & Atmosphere',
    description:
      'Take a nocturnal stroll after dark and capture 3 striking photos highlighting neon reflections, deep shadows, or quiet late-night city corners.',
  },
  // Bookworm + Coffee Snob
  'bookworm:coffee snob': {
    title: 'Corner Table Chronicles',
    theme: 'Cozy Focus',
    category: 'Culture & Ritual',
    description:
      'Visit an independent cafe, order a drink you do not normally choose, and spend an hour reading a chapter with zero digital distractions.',
  },
};

function normalizeKey(nameA: string, nameB: string): string {
  const [first, second] = [nameA.trim().toLowerCase(), nameB.trim().toLowerCase()].sort();
  return `${first}:${second}`;
}

export function generateCollabChallenge(
  parallelNameA: string,
  parallelNameB: string,
): GeneratedChallenge {
  const key = normalizeKey(parallelNameA, parallelNameB);
  const curated = CURATED_CHALLENGES[key];

  if (curated) {
    return {
      challengeTitle: curated.title,
      challengeDescription: curated.description,
      challengeContext: {
        theme: curated.theme,
        category: curated.category,
        pairing: [parallelNameA, parallelNameB],
      },
    };
  }

  // Dynamic playful synthesis for any combination
  return {
    challengeTitle: `${parallelNameA} × ${parallelNameB}: Joint Discovery`,
    challengeDescription: `Fuse ${parallelNameA}'s curiosity with ${parallelNameB}'s distinct perspective. Design an hour-long joint micro-adventure exploring where both identities meet, and note your most surprising find.`,
    challengeContext: {
      theme: `${parallelNameA} + ${parallelNameB}`,
      category: 'Identity Intersection',
      pairing: [parallelNameA, parallelNameB],
    },
  };
}
