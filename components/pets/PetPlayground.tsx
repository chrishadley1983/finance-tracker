'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PetState, PetOwner, PetSpecies, PetMood } from '@/lib/types/pet';
import { PetSprite } from './PetSprite';
import { PetStats } from './PetStats';
import { PetActions } from './PetActions';
import { EggHatch } from './EggHatch';

interface PetPlaygroundProps {
  isOverlay?: boolean;
  onClose?: () => void;
}

function deriveMood(pet: PetState, sleeping: boolean): PetMood {
  if (sleeping) return 'sleeping';
  const avg = (pet.hunger + pet.happiness + pet.cleanliness) / 3;
  if (avg > 70) return 'happy';
  if (avg > 40) return 'idle';
  return 'sad';
}

export function PetPlayground({ isOverlay, onClose }: PetPlaygroundProps) {
  const [pets, setPets] = useState<Record<PetOwner, PetState | null>>({ max: null, emmie: null });
  const [sleeping, setSleeping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePet, setActivePet] = useState<PetOwner>('max');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchPets = useCallback(async () => {
    try {
      const res = await fetch('/api/pets');
      const data = await res.json();
      setPets(data.pets);
      setSleeping(data.sleeping);
    } catch (error) {
      console.error('Failed to fetch pets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPets();
    // Refresh every 60s for decay
    const interval = setInterval(fetchPets, 60000);
    return () => clearInterval(interval);
  }, [fetchPets]);

  async function handleAction(action: Record<string, unknown>) {
    try {
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (res.ok && data.pet) {
        setPets(prev => ({ ...prev, [data.pet.id]: data.pet }));
        // Show feedback
        const feedbacks: Record<string, string> = {
          feed: '😋 Yum!',
          pet: '💕 Happy!',
          clean: '✨ Sparkly!',
        };
        const fb = feedbacks[action.action as string];
        if (fb) {
          setActionFeedback(fb);
          setTimeout(() => setActionFeedback(null), 1200);
        }
      }
    } catch (error) {
      console.error('Pet action failed:', error);
    }
  }

  async function handleHatch(petId: PetOwner, name: string, species: PetSpecies) {
    await handleAction({ action: 'create', petId, name, species });
    await fetchPets();
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${isOverlay ? 'min-h-screen' : 'min-h-[400px]'}`}>
        <div className="text-center space-y-3">
          <div className="text-4xl pet-bounce inline-block">🥚</div>
          <p className="text-slate-400">Loading pets...</p>
        </div>
      </div>
    );
  }

  const currentPet = pets[activePet];

  const content = (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header with pet selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['max', 'emmie'] as PetOwner[]).map(id => (
            <button
              key={id}
              onClick={() => setActivePet(id)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                activePet === id
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {id === 'max' ? '🦖 Max' : '🦄 Emmie'}
            </button>
          ))}
        </div>
        {isOverlay && onClose && (
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all active:scale-95"
          >
            ✕
          </button>
        )}
      </div>

      {/* Pet display area */}
      {!currentPet ? (
        <EggHatch
          petId={activePet}
          onHatch={(name, species) => handleHatch(activePet, name, species)}
        />
      ) : (
        <div className="space-y-4">
          {/* Pet name and stage */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800">{currentPet.name}</h2>
            <p className="text-sm text-slate-400 capitalize">{currentPet.species} · {currentPet.stage}</p>
          </div>

          {/* Pet sprite with action feedback */}
          <div className="flex justify-center relative">
            <PetSprite
              species={currentPet.species}
              stage={currentPet.stage}
              mood={deriveMood(currentPet, sleeping)}
              size={160}
            />
            {actionFeedback && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl font-bold pet-float-up">
                {actionFeedback}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <PetStats
              hunger={currentPet.hunger}
              happiness={currentPet.happiness}
              cleanliness={currentPet.cleanliness}
            />
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <PetActions
              petId={activePet}
              poopCount={currentPet.poopCount}
              sleeping={sleeping}
              onAction={handleAction}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-purple-50 to-pink-50 overflow-y-auto">
        {content}
      </div>
    );
  }

  return content;
}
