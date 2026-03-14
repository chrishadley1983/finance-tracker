'use client';

import { useState } from 'react';
import type { PetOwner } from '@/lib/types/pet';
import { FOODS } from '@/lib/types/pet';

interface PetActionsProps {
  petId: PetOwner;
  poopCount: number;
  sleeping: boolean;
  onAction: (action: Record<string, unknown>) => Promise<void>;
}

export function PetActions({ petId, poopCount, sleeping, onAction }: PetActionsProps) {
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function doAction(action: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      await onAction(action);
    } finally {
      setBusy(null);
    }
  }

  if (sleeping) {
    return (
      <div className="text-center py-4 text-slate-400">
        <span className="text-3xl">😴</span>
        <p className="text-sm mt-1">Shhh... sleeping until 7am!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setShowFoodPicker(!showFoodPicker)}
          disabled={busy !== null}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 hover:bg-green-100 active:scale-95 transition-all border border-green-200 disabled:opacity-50"
        >
          <span className="text-2xl">🍕</span>
          <span className="text-xs font-medium text-green-700">Feed</span>
        </button>

        <button
          onClick={() => doAction({ action: 'pet', petId }, 'pet')}
          disabled={busy !== null}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 active:scale-95 transition-all border border-purple-200 disabled:opacity-50"
        >
          <span className="text-2xl">{busy === 'pet' ? '💕' : '💜'}</span>
          <span className="text-xs font-medium text-purple-700">Pet</span>
        </button>

        <button
          onClick={() => doAction({ action: 'clean', petId }, 'clean')}
          disabled={busy !== null || poopCount === 0}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 active:scale-95 transition-all border border-cyan-200 disabled:opacity-50 relative"
        >
          <span className="text-2xl">🧹</span>
          <span className="text-xs font-medium text-cyan-700">Clean</span>
          {poopCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {poopCount}
            </span>
          )}
        </button>
      </div>

      {/* Food picker */}
      {showFoodPicker && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-lg">
          <p className="text-xs text-slate-500 mb-2 font-medium">Pick a snack:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FOODS).map(([id, food]) => (
              <button
                key={id}
                onClick={() => {
                  doAction({ action: 'feed', petId, foodId: id }, 'feed');
                  setShowFoodPicker(false);
                }}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-green-50 active:scale-95 transition-all border border-slate-200 hover:border-green-300"
              >
                <span className="text-lg">{food.emoji}</span>
                <span className="text-xs font-medium text-slate-600">{food.name}</span>
                <span className="text-[10px] text-green-600">+{food.hungerBoost}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Poop indicators */}
      {poopCount > 0 && (
        <div className="flex items-center gap-1 justify-center">
          {Array.from({ length: Math.min(poopCount, 5) }).map((_, i) => (
            <span key={i} className="text-lg pet-wobble" style={{ animationDelay: `${i * 0.15}s` }}>💩</span>
          ))}
          {poopCount > 5 && (
            <span className="text-xs text-slate-400 ml-1">+{poopCount - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}
