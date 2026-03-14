export type PetSpecies = 'dragon' | 'cat' | 'fox' | 'blob' | 'robot';
export type PetStage = 'egg' | 'baby' | 'kid' | 'teen' | 'adult' | 'mythical';
export type PetMood = 'idle' | 'happy' | 'sad' | 'eating' | 'sleeping' | 'startled';
export type PetOwner = 'max' | 'emmie';

export interface PetState {
  id: PetOwner;
  name: string;
  species: PetSpecies;
  stage: PetStage;
  bornAt: string;
  lastUpdated: string;
  hunger: number;       // 0-100
  happiness: number;    // 0-100
  cleanliness: number;  // 0-100
  poopCount: number;
  lastPoopAt: string;
  careHistory: number[];          // Last 50 average-stat snapshots
  accessories: string[];          // Earned accessory IDs
  equippedAccessories: string[];  // Currently worn
  roomTheme: string;
  unlockedBackgrounds: string[];
  gameScores: Record<string, number>;
  personalitySeed: number;
}

export interface PetStore {
  pets: Record<PetOwner, PetState | null>;
}

// API action types
export type PetAction =
  | { action: 'create'; petId: PetOwner; name: string; species: PetSpecies }
  | { action: 'feed'; petId: PetOwner; foodId?: string }
  | { action: 'pet'; petId: PetOwner }
  | { action: 'clean'; petId: PetOwner }
  | { action: 'play_result'; petId: PetOwner; game: string; score: number }
  | { action: 'equip'; petId: PetOwner; accessoryId: string }
  | { action: 'unequip'; petId: PetOwner; accessoryId: string }
  | { action: 'set_room'; petId: PetOwner; roomTheme: string }
  | { action: 'interact'; petId: PetOwner; type: 'playdate' | 'fart' };

// Evolution thresholds
export const EVOLUTION_RULES: Record<PetStage, { nextStage: PetStage; daysRequired: number; minCareAvg: number } | null> = {
  egg: { nextStage: 'baby', daysRequired: 0, minCareAvg: 0 },
  baby: { nextStage: 'kid', daysRequired: 3, minCareAvg: 30 },
  kid: { nextStage: 'teen', daysRequired: 7, minCareAvg: 40 },
  teen: { nextStage: 'adult', daysRequired: 14, minCareAvg: 50 },
  adult: { nextStage: 'mythical', daysRequired: 30, minCareAvg: 70 },
  mythical: null,
};

// Stat decay rates per hour
export const DECAY_RATES = {
  hunger: 5,
  happiness: 3,
  cleanliness: 2,
};

// Sleep hours (8pm - 7am)
export const SLEEP_START = 20; // 8pm
export const SLEEP_END = 7;   // 7am

// Food items and their hunger restoration
export const FOODS: Record<string, { name: string; emoji: string; hungerBoost: number }> = {
  apple: { name: 'Apple', emoji: '🍎', hungerBoost: 15 },
  pizza: { name: 'Pizza', emoji: '🍕', hungerBoost: 25 },
  cake: { name: 'Cake', emoji: '🎂', hungerBoost: 20 },
  carrot: { name: 'Carrot', emoji: '🥕', hungerBoost: 15 },
  icecream: { name: 'Ice Cream', emoji: '🍦', hungerBoost: 18 },
};

// Species display info
export const SPECIES_INFO: Record<PetSpecies, { name: string; emoji: string; color: string }> = {
  dragon: { name: 'Dragon', emoji: '🐉', color: '#e74c3c' },
  cat: { name: 'Cat', emoji: '🐱', color: '#f39c12' },
  fox: { name: 'Fox', emoji: '🦊', color: '#e67e22' },
  blob: { name: 'Blob', emoji: '🫧', color: '#9b59b6' },
  robot: { name: 'Robot', emoji: '🤖', color: '#3498db' },
};
