'use client';

import { useMemo } from 'react';
import type { PetSpecies, PetStage, PetMood } from '@/lib/types/pet';
import { SPECIES_INFO } from '@/lib/types/pet';

interface PetSpriteProps {
  species: PetSpecies;
  stage: PetStage;
  mood: PetMood;
  size?: number; // px, default 128
  className?: string;
}

// Placeholder pixel art as inline SVG patterns
// Each species+stage gets a unique look via color + shape
function getPlaceholderSprite(species: PetSpecies, stage: PetStage, mood: PetMood): {
  bodyColor: string;
  eyeStyle: 'dots' | 'wide' | 'closed' | 'hearts' | 'zzz';
  mouthStyle: 'smile' | 'open' | 'frown' | 'nom' | 'none';
  bodyScale: number;
  hasSparkle: boolean;
} {
  const color = SPECIES_INFO[species].color;

  const stageScale: Record<PetStage, number> = {
    egg: 0.5,
    baby: 0.6,
    kid: 0.75,
    teen: 0.85,
    adult: 1,
    mythical: 1.1,
  };

  const moodToEyes: Record<PetMood, 'dots' | 'wide' | 'closed' | 'hearts' | 'zzz'> = {
    idle: 'dots',
    happy: 'wide',
    sad: 'dots',
    eating: 'closed',
    sleeping: 'zzz',
    startled: 'wide',
  };

  const moodToMouth: Record<PetMood, 'smile' | 'open' | 'frown' | 'nom' | 'none'> = {
    idle: 'smile',
    happy: 'open',
    sad: 'frown',
    eating: 'nom',
    sleeping: 'none',
    startled: 'open',
  };

  return {
    bodyColor: color,
    eyeStyle: moodToEyes[mood],
    mouthStyle: moodToMouth[mood],
    bodyScale: stageScale[stage],
    hasSparkle: stage === 'mythical',
  };
}

// Body shapes per species
function BodyShape({ species, color, scale }: { species: PetSpecies; color: string; scale: number }) {
  const s = 64 * scale;
  const cx = 32;
  const cy = 34;

  switch (species) {
    case 'blob':
      return (
        <ellipse cx={cx} cy={cy} rx={s * 0.4} ry={s * 0.35}
          fill={color} className="pet-bounce" />
      );
    case 'cat':
      return (
        <g className="pet-bounce">
          <ellipse cx={cx} cy={cy} rx={s * 0.32} ry={s * 0.3} fill={color} />
          {/* Ears */}
          <polygon points={`${cx - s * 0.25},${cy - s * 0.22} ${cx - s * 0.12},${cy - s * 0.4} ${cx - s * 0.05},${cy - s * 0.2}`}
            fill={color} />
          <polygon points={`${cx + s * 0.25},${cy - s * 0.22} ${cx + s * 0.12},${cy - s * 0.4} ${cx + s * 0.05},${cy - s * 0.2}`}
            fill={color} />
        </g>
      );
    case 'fox':
      return (
        <g className="pet-bounce">
          <ellipse cx={cx} cy={cy} rx={s * 0.33} ry={s * 0.28} fill={color} />
          {/* Pointy ears */}
          <polygon points={`${cx - s * 0.28},${cy - s * 0.18} ${cx - s * 0.18},${cy - s * 0.45} ${cx - s * 0.08},${cy - s * 0.18}`}
            fill={color} />
          <polygon points={`${cx + s * 0.28},${cy - s * 0.18} ${cx + s * 0.18},${cy - s * 0.45} ${cx + s * 0.08},${cy - s * 0.18}`}
            fill={color} />
          {/* White belly */}
          <ellipse cx={cx} cy={cy + s * 0.08} rx={s * 0.18} ry={s * 0.15} fill="white" opacity={0.6} />
        </g>
      );
    case 'dragon':
      return (
        <g className="pet-bounce">
          <ellipse cx={cx} cy={cy} rx={s * 0.3} ry={s * 0.32} fill={color} />
          {/* Horns */}
          <polygon points={`${cx - s * 0.15},${cy - s * 0.28} ${cx - s * 0.1},${cy - s * 0.48} ${cx - s * 0.02},${cy - s * 0.25}`}
            fill={color} opacity={0.8} />
          <polygon points={`${cx + s * 0.15},${cy - s * 0.28} ${cx + s * 0.1},${cy - s * 0.48} ${cx + s * 0.02},${cy - s * 0.25}`}
            fill={color} opacity={0.8} />
          {/* Wings stub */}
          <ellipse cx={cx - s * 0.35} cy={cy - s * 0.05} rx={s * 0.12} ry={s * 0.18}
            fill={color} opacity={0.5} />
          <ellipse cx={cx + s * 0.35} cy={cy - s * 0.05} rx={s * 0.12} ry={s * 0.18}
            fill={color} opacity={0.5} />
        </g>
      );
    case 'robot':
      return (
        <g className="pet-bounce">
          <rect x={cx - s * 0.28} y={cy - s * 0.3} width={s * 0.56} height={s * 0.55}
            rx={4} fill={color} />
          {/* Antenna */}
          <line x1={cx} y1={cy - s * 0.3} x2={cx} y2={cy - s * 0.45}
            stroke={color} strokeWidth={2} />
          <circle cx={cx} cy={cy - s * 0.47} r={3} fill={color} />
        </g>
      );
  }
}

function Eyes({ style, cx, cy }: { style: string; cx: number; cy: number }) {
  const gap = 8;
  switch (style) {
    case 'dots':
      return (
        <>
          <circle cx={cx - gap} cy={cy} r={2.5} fill="#1a1a2e" />
          <circle cx={cx + gap} cy={cy} r={2.5} fill="#1a1a2e" />
        </>
      );
    case 'wide':
      return (
        <>
          <circle cx={cx - gap} cy={cy} r={3.5} fill="#1a1a2e" />
          <circle cx={cx + gap} cy={cy} r={3.5} fill="#1a1a2e" />
          <circle cx={cx - gap + 1} cy={cy - 1} r={1.2} fill="white" />
          <circle cx={cx + gap + 1} cy={cy - 1} r={1.2} fill="white" />
        </>
      );
    case 'closed':
      return (
        <>
          <line x1={cx - gap - 3} y1={cy} x2={cx - gap + 3} y2={cy} stroke="#1a1a2e" strokeWidth={2} strokeLinecap="round" />
          <line x1={cx + gap - 3} y1={cy} x2={cx + gap + 3} y2={cy} stroke="#1a1a2e" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'hearts':
      return (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12}>❤️ ❤️</text>
      );
    case 'zzz':
      return (
        <>
          <line x1={cx - gap - 3} y1={cy} x2={cx - gap + 3} y2={cy} stroke="#1a1a2e" strokeWidth={2} strokeLinecap="round" />
          <line x1={cx + gap - 3} y1={cy} x2={cx + gap + 3} y2={cy} stroke="#1a1a2e" strokeWidth={2} strokeLinecap="round" />
          <text x={cx + 18} y={cy - 8} fontSize={10} fill="#6366f1" className="pet-float">z</text>
          <text x={cx + 24} y={cy - 16} fontSize={8} fill="#6366f1" className="pet-float" style={{ animationDelay: '0.3s' }}>z</text>
        </>
      );
    default:
      return null;
  }
}

function Mouth({ style, cx, cy }: { style: string; cx: number; cy: number }) {
  switch (style) {
    case 'smile':
      return (
        <path d={`M${cx - 5},${cy} Q${cx},${cy + 5} ${cx + 5},${cy}`}
          fill="none" stroke="#1a1a2e" strokeWidth={1.5} strokeLinecap="round" />
      );
    case 'open':
      return (
        <ellipse cx={cx} cy={cy + 2} rx={4} ry={3} fill="#1a1a2e" />
      );
    case 'frown':
      return (
        <path d={`M${cx - 5},${cy + 3} Q${cx},${cy - 2} ${cx + 5},${cy + 3}`}
          fill="none" stroke="#1a1a2e" strokeWidth={1.5} strokeLinecap="round" />
      );
    case 'nom':
      return (
        <>
          <ellipse cx={cx} cy={cy + 2} rx={5} ry={4} fill="#1a1a2e" />
          <ellipse cx={cx} cy={cy + 1} rx={3} ry={1} fill="#ff6b6b" />
        </>
      );
    default:
      return null;
  }
}

export function PetSprite({ species, stage, mood, size = 128, className = '' }: PetSpriteProps) {
  const sprite = useMemo(
    () => getPlaceholderSprite(species, stage, mood),
    [species, stage, mood]
  );

  if (stage === 'egg') {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width={size} height={size} className="pet-wobble">
          <ellipse cx={32} cy={36} rx={16} ry={20} fill={sprite.bodyColor} />
          <ellipse cx={32} cy={36} rx={16} ry={20} fill="white" opacity={0.15} />
          {/* Crack lines */}
          <path d="M24,32 L28,28 L26,24" fill="none" stroke="white" strokeWidth={1} opacity={0.4} />
          <path d="M38,34 L40,30 L37,27" fill="none" stroke="white" strokeWidth={1} opacity={0.4} />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <BodyShape species={species} color={sprite.bodyColor} scale={sprite.bodyScale} />
        <Eyes style={sprite.eyeStyle} cx={32} cy={30} />
        <Mouth style={sprite.mouthStyle} cx={32} cy={38} />
      </svg>

      {/* Sparkle overlay for mythical stage */}
      {sprite.hasSparkle && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="pet-sparkle" style={{ left: '20%', top: '15%' }}>✨</div>
          <div className="pet-sparkle" style={{ left: '70%', top: '25%', animationDelay: '0.5s' }}>✨</div>
          <div className="pet-sparkle" style={{ left: '45%', top: '10%', animationDelay: '1s' }}>✨</div>
        </div>
      )}
    </div>
  );
}
