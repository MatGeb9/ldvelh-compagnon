import { getAdventureType } from './adventure-types.js';

// Singleton mutable state container. Modules import `state` and mutate fields.
export const state = {
  game: null,                 // active gameState
  selectedAdventure: null,    // during char-create flow
  rolledStats: {},            // during char-create flow
  lastCombatResult: null,     // combat → luck check chaining
};

export function resetCharCreate() {
  state.selectedAdventure = null;
  state.rolledStats = {};
}

export function resolveConfig(game = state.game) {
  if (!game) return null;
  return game.adventureConfig || getAdventureType(game.adventureType);
}

// Build a fresh gameState from char-create inputs.
export function createGameState({ adventure, heroName, bookTitle, rolledStats, statDefs }) {
  const stats = {};
  const statsMax = {};
  adventure.stats.forEach(s => {
    const total = rolledStats[s.key].total;
    stats[s.key] = total;
    statsMax[s.key] = total;
  });

  const potions = (adventure.potions || []).map(p => ({ ...p, used: 0 }));

  const game = {
    adventureType: adventure.id,
    statDefs,                                                // persisted — supports custom/renamed stats across reloads
    adventureConfig: { ...adventure, stats: statDefs },      // derived in-memory; stripped on save
    heroName,
    bookTitle,
    stats,
    statsMax,
    gold: 0,
    provisions: adventure.defaultProvisions,
    potions,
    objects: [],
    specialItems: [],
    alerts: [],
    notes: '',
    currentParagraph: 1,
    paragraphHistory: [1],
    paragraphs: { 1: { sentiment: 'neutral', note: '' } },
    adversaries: [],
    combatLog: [],
    special: {},
    timestamp: Date.now(),
  };

  if (adventure.special) {
    switch (adventure.special.type) {
      case 'counter':
      case 'power':
        game.special.value = adventure.special.initial || 0;
        break;
      case 'checklist':
        game.special.selected = [];
        break;
      case 'spells':
        game.special.spells = [];
        break;
      case 'transform':
        game.special.forms = [];
        game.special.currentForm = 'Humain';
        break;
    }
  }

  return game;
}

// Adjust a stat with bounds (0 .. statsMax[key]).
// Returns true if the stat reached 0 on the combatStamina key (= mort).
export function adjustStat(key, delta) {
  const game = state.game;
  if (!game) return false;
  const newVal = game.stats[key] + delta;
  if (newVal < 0) {
    game.stats[key] = 0;
  } else if (newVal > game.statsMax[key]) {
    game.stats[key] = game.statsMax[key];
  } else {
    game.stats[key] = newVal;
  }
  const config = resolveConfig(game);
  return key === config.combatStamina && game.stats[key] <= 0;
}
