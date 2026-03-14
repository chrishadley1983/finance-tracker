'use client';

interface PetStatsProps {
  hunger: number;
  happiness: number;
  cleanliness: number;
  compact?: boolean;
}

function StatBar({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-600">{label}</span>
          <span className="text-slate-500 font-medium">{Math.round(value)}%</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${value}%`,
              backgroundColor: value > 60 ? color : value > 30 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MoodFace({ hunger, happiness, cleanliness }: { hunger: number; happiness: number; cleanliness: number }) {
  const avg = (hunger + happiness + cleanliness) / 3;
  let face: string;
  let label: string;

  if (avg > 75) { face = '😊'; label = 'Thriving!'; }
  else if (avg > 50) { face = '🙂'; label = 'Content'; }
  else if (avg > 30) { face = '😐'; label = 'Meh...'; }
  else if (avg > 15) { face = '😟'; label = 'Sad'; }
  else { face = '😢'; label = 'Miserable!'; }

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-2xl">{face}</span>
      <span className="text-sm text-slate-500 font-medium">{label}</span>
    </div>
  );
}

export function PetStats({ hunger, happiness, cleanliness, compact }: PetStatsProps) {
  if (compact) {
    // Simplified for widget view
    const avg = Math.round((hunger + happiness + cleanliness) / 3);
    const face = avg > 75 ? '😊' : avg > 50 ? '🙂' : avg > 30 ? '😐' : avg > 15 ? '😟' : '😢';
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm">{face}</span>
        <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${avg}%`,
              backgroundColor: avg > 60 ? '#22c55e' : avg > 30 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <MoodFace hunger={hunger} happiness={happiness} cleanliness={cleanliness} />
      <StatBar label="Hunger" value={hunger} color="#22c55e" emoji="🍕" />
      <StatBar label="Happiness" value={happiness} color="#8b5cf6" emoji="💜" />
      <StatBar label="Cleanliness" value={cleanliness} color="#06b6d4" emoji="✨" />
    </div>
  );
}
