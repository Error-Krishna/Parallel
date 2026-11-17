import type {
  IdentityCardMetadataDto,
  IdentityCardType,
} from '@parallel/shared-types';

const SAFE_HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length === maxLines) {
          return lines;
        }
      }
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

export function renderIdentityCardSvg(input: {
  cardId: string;
  cardType: IdentityCardType;
  metadata: IdentityCardMetadataDto;
}): string {
  const accent = SAFE_HEX_PATTERN.test(input.metadata.accentHex)
    ? input.metadata.accentHex
    : '#7C5CFF';
  const eyebrow = escapeXml(input.metadata.eyebrow.toUpperCase());
  const username = escapeXml(
    input.metadata.username.startsWith('@')
      ? input.metadata.username
      : `@${input.metadata.username}`,
  );
  const titleLines = wrapLines(input.metadata.title, 20, 3).map(escapeXml);
  const subtitleLines = wrapLines(input.metadata.subtitle, 38, 3).map(escapeXml);
  const stats = input.metadata.stats.slice(0, 3);

  const titleTspans = titleLines
    .map(
      (line, index) =>
        `<tspan x="96" dy="${index === 0 ? 0 : 96}">${line}</tspan>`,
    )
    .join('');

  const subtitleStartY = 660 + Math.max(1, titleLines.length) * 96 + 44;
  const subtitleTspans = subtitleLines
    .map(
      (line, index) =>
        `<tspan x="96" dy="${index === 0 ? 0 : 48}">${line}</tspan>`,
    )
    .join('');

  const statCards = stats
    .map((stat, index) => {
      const cardWidth = 276;
      const gap = 30;
      const x = 96 + index * (cardWidth + gap);
      const y = 1320;
      const label = escapeXml(stat.label.toUpperCase().slice(0, 20));
      const value = escapeXml(stat.value.slice(0, 18));

      return `
  <g>
    <rect x="${x}" y="${y}" width="${cardWidth}" height="168" rx="28" fill="#151520" stroke="#28283C" stroke-width="2" />
    <text x="${x + 28}" y="${y + 56}" fill="#9A9AB4" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" letter-spacing="2">${label}</text>
    <text x="${x + 28}" y="${y + 124}" fill="#F8F8FF" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="44" font-weight="700">${value}</text>
  </g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="${escapeXml(input.metadata.title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0B12" />
      <stop offset="55%" stop-color="#111122" />
      <stop offset="100%" stop-color="#08080F" />
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="22%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.42" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)" />
  <rect width="1080" height="1920" fill="url(#glow)" />

  <circle cx="840" cy="360" r="240" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="3" />
  <circle cx="840" cy="360" r="340" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="2" />
  <circle cx="840" cy="360" r="120" fill="${accent}" fill-opacity="0.14" />

  <rect x="96" y="136" width="380" height="58" rx="29" fill="#171726" stroke="${accent}" stroke-opacity="0.55" stroke-width="2" />
  <text x="128" y="173" fill="${accent}" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" letter-spacing="3">${eyebrow}</text>

  <text x="96" y="540" fill="#B4B4CE" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="36" font-weight="600">${username}</text>

  <text x="96" y="660" fill="#FFFFFF" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="82" font-weight="800">${titleTspans}</text>

  <text x="96" y="${subtitleStartY}" fill="#C2C2D9" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="34" font-weight="400">${subtitleTspans}</text>

  ${statCards}

  <line x1="96" y1="1680" x2="984" y2="1680" stroke="#26263A" stroke-width="2" />
  <text x="96" y="1768" fill="#FFFFFF" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="36" font-weight="800" letter-spacing="6">PARALLEL</text>
  <text x="984" y="1768" text-anchor="end" fill="#8C8CA8" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="26" font-weight="500">Discover every side of you</text>
</svg>`;
}
