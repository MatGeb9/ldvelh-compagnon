import { getAdventureType } from './adventure-types.js';
import { rollStat } from './dice.js';

// Singleton mutable state container. Modules import `state` and mutate fields.
export const state = {
  game: null,                 // active gameState
  selectedAdventure: null,    // during char-create flow
  rolledStats: {},            // during char-create flow
  startingEquipment: {        // during char-create flow
    gold: 0,
    provisions: 0,
    potions: [],
    objects: [],
  },
  pendingSentiment: 'neutral', // for the in-game "Ajouter un paragraphe" form
  paragraphFilter: '',         // live search filter on the Notes tab
  lastCombatResult: null,      // combat → luck check chaining
};

export function resetCharCreate() {
  state.selectedAdventure = null;
  state.rolledStats = {};
  state.startingEquipment = { gold: 0, provisions: 0, potions: [], objects: [] };
}

// Verdict d'une zone → présentation (icône + libellé + classe CSS).
export const VERDICT_META = {
  utile:  { icon: '✓', label: 'Utile',      cls: 'utile' },
  danger: { icon: '✕', label: 'Danger',     cls: 'danger' },
  mitige: { icon: '≈', label: 'Mitigé',     cls: 'mitige' },
  neutre: { icon: '·', label: 'Inexploré',  cls: 'neutre' },
};

// Palette de couleurs des zones (cyclée à la création). Pensée pour le thème parchemin.
export const ZONE_COLORS = [
  '#7c4a2d', '#3d6b4f', '#5a4a78', '#8a5a1f',
  '#2f6b78', '#8a3a52', '#566b2f', '#6b4a8a',
];

let _zoneSeq = 0;
function nextZoneId() {
  _zoneSeq += 1;
  return `z${Date.now().toString(36)}_${_zoneSeq}`;
}

// Crée une zone, l'ajoute à game.zones et la rend active. Retourne la zone.
export function createZone(game, name) {
  if (!Array.isArray(game.zones)) game.zones = [];
  const color = ZONE_COLORS[game.zones.length % ZONE_COLORS.length];
  const zone = {
    id: nextZoneId(),
    name: (name || '').trim() || `Zone ${game.zones.length + 1}`,
    color,
    createdRun: game.runCount || 1,
    createdTs: Date.now(),
  };
  game.zones.push(zone);
  game.activeZoneId = zone.id;
  return zone;
}

export function getZone(game, id) {
  if (!id || !Array.isArray(game?.zones)) return null;
  return game.zones.find(z => z.id === id) || null;
}

// Rattache le § `num` à la zone active (si une zone est active). No-op sinon :
// on NE déclasse jamais un § déjà rangé quand aucune zone n'est active (revisite cross-run).
export function tagParagraphWithActiveZone(game, num) {
  if (!game || num == null || !game.activeZoneId) return;
  if (!game.paragraphs) game.paragraphs = {};
  if (!game.paragraphs[num]) {
    game.paragraphs[num] = { sentiment: 'neutral', note: '', events: [], zone: null };
  }
  game.paragraphs[num].zone = game.activeZoneId;
}

// Agrège la mémoire cross-run d'une zone → verdict ("utile d'y retourner ?").
// zoneId === null → pseudo-zone "Non classé" (§ sans zone).
export function summarizeZone(game, zoneId) {
  const paragraphs = game?.paragraphs || {};
  const nums = Object.keys(paragraphs)
    .filter(k => (paragraphs[k].zone ?? null) === zoneId)
    .map(Number)
    .sort((a, b) => a - b);

  const events = [];
  nums.forEach(n => (paragraphs[n].events || []).forEach(ev => events.push({ ...ev, para: n })));

  const enemies = [], items = [], notes = [], deaths = [];
  let goldNet = 0, provNet = 0, statNet = 0;
  const runs = new Set();
  events.forEach(ev => {
    if (ev.run != null) runs.add(ev.run);
    switch (ev.type) {
      case 'enemy': enemies.push(ev); break;
      case 'item': items.push(ev); break;
      case 'note': notes.push(ev); break;
      case 'death': deaths.push(ev); break;
      case 'gold': goldNet += ev.data?.delta || 0; break;
      case 'prov': provNet += ev.data?.delta || 0; break;
      case 'stat': statNet += ev.data?.delta || 0; break;
    }
  });

  // Sentiments des § de la zone
  let pos = 0, neg = 0;
  nums.forEach(n => {
    const s = paragraphs[n].sentiment;
    if (s === 'positive') pos++;
    else if (s === 'negative') neg++;
  });

  const good = items.length + (goldNet > 0 ? 1 : 0) + (provNet > 0 ? 1 : 0) + (statNet > 0 ? 1 : 0) + pos;
  const bad = deaths.length * 2 + (goldNet < 0 ? 1 : 0) + (statNet < 0 ? 1 : 0) + neg;

  let verdict;
  if (good === 0 && bad === 0) verdict = 'neutre';
  else if (deaths.length > 0 && good === 0) verdict = 'danger';
  else if (good > bad) verdict = 'utile';
  else if (bad > good) verdict = 'danger';
  else verdict = 'mitige';

  return {
    zoneId, nums, events, enemies, items, notes, deaths,
    goldNet, provNet, statNet, pos, neg,
    runs: [...runs].sort((a, b) => a - b),
    good, bad, verdict,
  };
}

export function resolveConfig(game = state.game) {
  if (!game) return null;
  return game.adventureConfig || getAdventureType(game.adventureType);
}

// Build a fresh gameState from char-create inputs.
// `equipment` overrides default starting gold/provisions/potions/objects when provided.
export function createGameState({ adventure, heroName, bookTitle, rolledStats, statDefs, equipment }) {
  const stats = {};
  const statsMax = {};
  adventure.stats.forEach(s => {
    const total = rolledStats[s.key].total;
    stats[s.key] = total;
    statsMax[s.key] = total;
  });

  const eq = equipment || {};
  const potions = (eq.potions ?? []).map(p => ({ ...p, used: p.used || 0 }));
  const objects = (eq.objects ?? []).map(o => ({ ...o }));

  const game = {
    adventureType: adventure.id,
    statDefs,                                                // persisted — supports custom/renamed stats across reloads
    adventureConfig: { ...adventure, stats: statDefs },      // derived in-memory; stripped on save
    heroName,
    bookTitle,
    stats,
    statsMax,
    gold: eq.gold ?? 0,
    provisions: eq.provisions ?? (adventure.defaultProvisions || 0),
    potions,
    objects,
    // Persist the starting choices so 'Nouvelle run' can restore THIS character's
    // initial loadout (not the adventure's defaults).
    startingEquipment: {
      gold: eq.gold ?? 0,
      provisions: eq.provisions ?? (adventure.defaultProvisions || 0),
      potions: potions.map(p => ({ ...p, used: 0 })),
      objects: objects.map(o => ({ ...o })),
    },
    specialItems: [],
    notes: '',
    currentParagraph: 1,
    paragraphHistory: [1],
    paragraphs: { 1: { sentiment: 'neutral', note: '', events: [], zone: null } },
    zones: [],                    // [{ id, name, color, createdRun, createdTs }] — persiste cross-run
    activeZoneId: null,           // zone "stylo" : tague les § visités tant qu'elle est active
    runCount: 1,
    diceLog: [],                  // [{ rolls, modifier, modifierLabel, total, label, ts }] — bounded to 10
    mapLockedPositions: {},       // { num: { x, y } } — manual node placements on the map
    combatMode: 'simultaneous',   // 'simultaneous' (default, attacks all adversaries) | 'sequential' (one at a time, by target)
    targetedAdversaryIdx: null,   // index in adversaries[] for sequential mode
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
// Keeps: heroName, bookTitle, statDefs, notes, paragraphs (sentiments + notes + zone), paragraphHistory, zones.
// Adds a 'RUN' marker in paragraphHistory to separate runs on the map.
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

  // Equipment — restore THIS character's starting choices (set at char-create).
  // Fallback to adventure defaults for old saves without startingEquipment.
  const starting = game.startingEquipment;
  game.gold = starting?.gold ?? 0;
  game.provisions = starting?.provisions ?? (config.defaultProvisions || 0);
  game.objects = (starting?.objects || []).map(o => ({ ...o }));
  game.specialItems = [];
  if (starting?.potions && Array.isArray(starting.potions)) {
    game.potions = starting.potions.map(p => ({ ...p, used: 0 }));
  } else if (Array.isArray(config.potions) && config.potions.length > 0) {
    // Backward compat: old saves before startingEquipment existed
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
    // 'RUN' = boundary de vraie nouvelle run (distinct du marqueur 'BACK' des go-back)
    game.paragraphHistory.push('RUN');
  }
  game.paragraphHistory.push(1);
  if (!game.paragraphs) game.paragraphs = {};
  if (!game.paragraphs[1]) game.paragraphs[1] = { sentiment: 'neutral', note: '', events: [] };
  if (!Array.isArray(game.paragraphs[1].events)) game.paragraphs[1].events = [];

  // Zones : PRÉSERVÉES (cross-run) — c'est tout l'intérêt du verdict cumulatif.
  // On referme juste le "stylo" : la nouvelle run repart sans zone active, l'user
  // réactive une zone (ou en crée une) au fil de l'exploration.
  if (!Array.isArray(game.zones)) game.zones = [];
  game.activeZoneId = null;

  // Run counter for UX
  game.runCount = (game.runCount || 1) + 1;
  game.timestamp = Date.now();
}

// Append a dice roll entry to the game's diceLog (capped at 10 most recent).
export function logDice({ rolls, modifier = 0, modifierLabel = '', total, label }) {
  if (!state.game) return;
  if (!Array.isArray(state.game.diceLog)) state.game.diceLog = [];
  state.game.diceLog.push({ rolls, modifier, modifierLabel, total, label, ts: Date.now() });
  if (state.game.diceLog.length > 10) {
    state.game.diceLog = state.game.diceLog.slice(-10);
  }
}

// Append an event to a paragraph's cross-run memory. Returns the event.
// Auto-suggests sentiment for first-time logs (death → negative, item → positive)
// only when current sentiment is the default 'neutral' AND no prior events exist.
export function logParagraphEvent(num, type, data = {}) {
  const game = state.game;
  if (!game || num == null) return null;
  if (!game.paragraphs) game.paragraphs = {};
  if (!game.paragraphs[num]) {
    game.paragraphs[num] = { sentiment: 'neutral', note: '', events: [] };
  }
  const p = game.paragraphs[num];
  if (!Array.isArray(p.events)) p.events = [];
  const wasEmpty = p.events.length === 0;
  const event = {
    run: game.runCount || 1,
    type,
    data,
    ts: Date.now(),
  };
  p.events.push(event);
  // Auto-sentiment only when neutral AND first event — don't override later decisions
  if (wasEmpty && (p.sentiment === 'neutral' || !p.sentiment)) {
    if (type === 'death') p.sentiment = 'negative';
    else if (type === 'item') p.sentiment = 'positive';
  }
  return event;
}

// Returns the set of paragraph numbers visited DIRECTLY AFTER `num` in any past traversal.
// Respects run/back boundaries: 'RUN', 'BACK' (and legacy null) markers break the adjacency
// — only a numeric successor counts as a real neighbor.
export function getNeighborsFromHistory(num) {
  const history = state.game?.paragraphHistory || [];
  const set = new Set();
  for (let i = 0; i < history.length - 1; i++) {
    const next = history[i + 1];
    if (history[i] === num && typeof next === 'number' && next !== num) {
      set.add(next);
    }
  }
  return [...set].sort((a, b) => a - b);
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
