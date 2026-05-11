import { getAdventureType } from './adventure-types.js';
import { rollStat } from './dice.js';

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

// Reset stats/inventory/combat/special for a new run on an existing save.
// Keeps: heroName, bookTitle, statDefs, notes, paragraphs (sentiments + notes), paragraphHistory.
// Adds a null marker in paragraphHistory to separate runs on the map.
// options.reroll = true → fresh dice rolls for stats; false → reset to statsMax (heal full).
export function startNewRun(game, { reroll = false } = {}) {
  const config = resolveConfig(game);
  if (!config) return;

  // Stats: reroll or refill
  if (reroll) {
    const newStats = {}, newMax = {};
    (game.statDefs || config.stats || []).forEach(def => {
      const { total } = rollStat(def);
      newStats[def.key] = total;
      newMax[def.key] = total;
    });
    game.stats = newStats;
    game.statsMax = newMax;
  } else {
    Object.keys(game.statsMax || {}).forEach(k => {
      game.stats[k] = game.statsMax[k];
    });
  }

  // Equipment
  game.gold = 0;
  game.objects = [];
  game.specialItems = [];
  game.alerts = [];
  game.provisions = config.defaultProvisions || 0;
  // Refresh all potion doses to original
  if (Array.isArray(config.potions) && config.potions.length > 0) {
    game.potions = config.potions.map(p => ({ ...p, used: 0 }));
  } else {
    game.potions = [];
  }

  // Combat
  game.adversaries = [];
  game.combatLog = [];

  // Special section — full reset to initial config
  game.special = {};
  if (config.special) {
    switch (config.special.type) {
      case 'counter':
      case 'power':
        game.special.value = config.special.initial || 0;
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

  // Paragraph position back to §1, but PRESERVE map & notes.
  // Push a null marker before §1 so the new run's first edge doesn't connect
  // to the previous run's last visited paragraph in the map.
  game.currentParagraph = 1;
  if (!Array.isArray(game.paragraphHistory)) game.paragraphHistory = [];
  if (game.paragraphHistory.length > 0) {
    game.paragraphHistory.push(null);
  }
  game.paragraphHistory.push(1);
  if (!game.paragraphs) game.paragraphs = {};
  if (!game.paragraphs[1]) game.paragraphs[1] = { sentiment: 'neutral', note: '' };

  // Run counter for UX
  game.runCount = (game.runCount || 1) + 1;
  game.timestamp = Date.now();
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
