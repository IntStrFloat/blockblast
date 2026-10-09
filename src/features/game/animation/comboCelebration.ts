import { createSeedHasher, seededRandom } from './presentationMath';

export type ComboParticleKind = 'spark' | 'diamond' | 'confetti' | 'block';
export type ComboCelebrationTier = 'compact' | 'charged' | 'legendary';

export interface ComboRayPresentation {
  id: string;
  angleDeg: number;
  distance: number;
  length: number;
  thickness: number;
  opacity: number;
}

export interface ComboParticlePresentation {
  id: string;
  kind: ComboParticleKind;
  angleDeg: number;
  distance: number;
  travel: number;
  size: number;
  delayMs: number;
  rotationDeg: number;
  color: string;
}

export interface ComboCelebrationPresentation {
  tier: ComboCelebrationTier;
  intensity: number;
  labelScale: number;
  entranceScale: number;
  sweepStrength: number;
  rays: ComboRayPresentation[];
  particles: ComboParticlePresentation[];
}

const PARTICLE_KINDS: readonly ComboParticleKind[] = [
  'spark',
  'block',
  'block',
];

const PARTICLE_COLORS = ['#FFF4A8', '#FFD53D', '#58E8FF', '#FF7A45', '#FF75C7'] as const;

function clampCombo(combo: number): number {
  if (!Number.isFinite(combo)) return 2;
  return Math.max(2, Math.floor(combo));
}

export function comboCelebrationTierFor(combo: number): ComboCelebrationTier {
  const safeCombo = clampCombo(combo);
  if (safeCombo >= 10) return 'legendary';
  if (safeCombo >= 5) return 'charged';
  return 'compact';
}

/**
 * Presentation-only particles for the combo lettering. Their positions are radial and
 * board-relative; they never reuse cleared-cell coordinates or the destruction particle pool.
 */
export function comboCelebrationFor(
  combo: number,
  boardSize: number,
  reducedMotion: boolean,
): ComboCelebrationPresentation {
  const safeCombo = clampCombo(combo);
  const tier = comboCelebrationTierFor(safeCombo);
  if (reducedMotion) {
    return {
      tier,
      intensity: 0,
      labelScale: 1,
      entranceScale: 1,
      sweepStrength: 0,
      rays: [],
      particles: [],
    };
  }

  const safeBoardSize = Math.max(1, boardSize);
  const intensity = tier === 'legendary' ? 1 : tier === 'charged' ? 0.86 : 0.68;
  const labelScale = tier === 'legendary' ? 1.04 : tier === 'charged' ? 1.02 : 1;
  const entranceScale = tier === 'legendary' ? 1.12 : tier === 'charged' ? 1.1 : 1.08;
  const sweepStrength = tier === 'legendary' ? 0.25 : 0;
  const particleCount = tier === 'legendary' ? 12 : tier === 'charged' ? 9 : 6;
  const rayCount = tier === 'legendary' ? 4 : 0;
  const hasher = createSeedHasher();
  hasher.feedNumber(safeCombo);
  hasher.feedNumber(Math.round(safeBoardSize));
  const random = seededRandom(hasher.value());

  const rays = Array.from({ length: rayCount }, (_, index): ComboRayPresentation => {
    const angleDeg = index * (360 / rayCount) + (random() - 0.5) * 5;
    return {
      id: `combo-ray-${index}`,
      angleDeg,
      distance: safeBoardSize * (0.07 + random() * 0.025),
      length: safeBoardSize * (0.025 + random() * 0.025) * intensity,
      thickness: Math.max(2, safeBoardSize * (0.007 + random() * 0.004)),
      opacity: 0.24 + random() * 0.32,
    };
  });

  const particles = Array.from(
    { length: particleCount },
    (_, index): ComboParticlePresentation => {
      const kind = PARTICLE_KINDS[index % PARTICLE_KINDS.length]!;
      return {
        id: `combo-particle-${index}`,
        kind,
        angleDeg: (index / particleCount) * 360 + (random() - 0.5) * 18,
        distance: safeBoardSize * (0.09 + random() * 0.15),
        travel: safeBoardSize * (0.025 + random() * 0.045) * intensity,
        size: Math.max(3, safeBoardSize * (0.009 + random() * 0.008)),
        delayMs: Math.round(random() * 78),
        rotationDeg: Math.round((random() - 0.5) * 100),
        color: PARTICLE_COLORS[index % PARTICLE_COLORS.length]!,
      };
    },
  );

  return {
    tier,
    intensity,
    labelScale,
    entranceScale,
    sweepStrength,
    rays,
    particles,
  };
}
