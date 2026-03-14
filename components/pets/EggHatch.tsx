'use client';

import { useState } from 'react';
import type { PetOwner, PetSpecies } from '@/lib/types/pet';
import { SPECIES_INFO } from '@/lib/types/pet';
import { PetSprite } from './PetSprite';

interface EggHatchProps {
  petId: PetOwner;
  onHatch: (name: string, species: PetSpecies) => Promise<void>;
}

type Step = 'name' | 'species' | 'hatching';

export function EggHatch({ petId, onHatch }: EggHatchProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<PetSpecies | null>(null);
  const [hatching, setHatching] = useState(false);

  const ownerName = petId === 'max' ? 'Max' : 'Emmie';

  async function handleHatch() {
    if (!selectedSpecies || !name.trim()) return;
    setStep('hatching');
    setHatching(true);
    // Brief hatching animation delay
    await new Promise(r => setTimeout(r, 1500));
    await onHatch(name.trim(), selectedSpecies);
    setHatching(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      {step === 'name' && (
        <div className="text-center space-y-6 max-w-sm">
          <div className="pet-wobble inline-block">
            <PetSprite species="blob" stage="egg" mood="idle" size={96} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {ownerName}&apos;s New Pet!
          </h2>
          <p className="text-slate-500">What will you name your pet?</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name..."
            maxLength={20}
            className="w-full px-4 py-3 text-lg text-center rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
            autoFocus
          />
          <button
            onClick={() => name.trim() && setStep('species')}
            disabled={!name.trim()}
            className="w-full py-3 px-6 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-lg"
          >
            Next →
          </button>
        </div>
      )}

      {step === 'species' && (
        <div className="text-center space-y-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-800">
            Choose {name}&apos;s species!
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {(Object.entries(SPECIES_INFO) as [PetSpecies, typeof SPECIES_INFO[PetSpecies]][]).map(([id, info]) => (
              <button
                key={id}
                onClick={() => setSelectedSpecies(id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95 ${
                  selectedSpecies === id
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <PetSprite species={id} stage="baby" mood="happy" size={56} />
                <span className="text-xs font-medium text-slate-600">{info.name}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('name')}
              className="flex-1 py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95"
            >
              ← Back
            </button>
            <button
              onClick={handleHatch}
              disabled={!selectedSpecies}
              className="flex-1 py-3 px-6 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-lg"
            >
              Hatch! 🥚
            </button>
          </div>
        </div>
      )}

      {step === 'hatching' && hatching && (
        <div className="text-center space-y-6">
          <div className="pet-hatch-shake inline-block">
            <PetSprite species={selectedSpecies!} stage="egg" mood="idle" size={128} />
          </div>
          <p className="text-xl font-bold text-purple-600 pet-pulse">
            Hatching...
          </p>
        </div>
      )}
    </div>
  );
}
