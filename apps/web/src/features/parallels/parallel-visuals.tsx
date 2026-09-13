// Shared between the Parallel Map and any screen showing an individual Parallel
// (this Parallel's detail/feed page, etc.) — kept in one place so the color/icon
// mapping for a given Parallel type never drifts between screens. See
// apps/web/src/app/globals.css for the actual --parallel-* CSS variables these
// names resolve to, and UI_DESIGN.md §2 for the reasoning (distinct accent + motion
// signature per Parallel, blueprint §14).
import {
  Compass,
  Gamepad2,
  Music2,
  Plus,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

const COLOR_BY_NAME: Record<string, string> = {
  Builder: 'var(--parallel-builder)',
  'Music Head': 'var(--parallel-music-head)',
  Gamer: 'var(--parallel-gamer)',
  Explorer: 'var(--parallel-explorer)',
};

export function getParallelColor(name: string): string {
  return COLOR_BY_NAME[name] ?? 'var(--parallel-urbanist)';
}

const ICON_BY_NAME: Record<string, LucideIcon> = {
  compass: Compass,
  gamepad: Gamepad2,
  music: Music2,
  plus: Plus,
  sparkles: Sparkles,
  users: Users,
};

export function ParallelIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  const Icon = ICON_BY_NAME[iconName] ?? Compass;
  return <Icon className={className} />;
}
