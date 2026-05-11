import { rollDice } from './dice.js';
import { el, modal } from './dom.js';
import { state, resolveConfig, resetCharCreate, createGameState, adjustStat } from './state.js';
import { getSaves, persistGame, removeSave } from './save.js';
import { getAdventureType } from './adventure-types.js';
import * as combat from './combat.js';
import * as render from './render.js';

// ───────────────────────────────────────────────
// Action handlers — one entry per data-action value
// ───────────────────────────────────────────────

const actions = {
  // Home
  'new-game': () => {
    render.showScreen('screen-adventure-select');
    render.renderAdventureGrid();
  },
  'load-game': () => {
    render.showScreen('screen-load');
    render.renderSavesList();
  },
  // Back navigation
  'back-home': () => render.showScreen('screen-home'),
  'back-home-load': () => render.showScreen('screen-home'),
  'back-adventure': () => render.showScreen('screen-adventure-select'),

  // Adventure / char-create
  'select-adventure': (target) => {
    const adv = getAdventureType(target.dataset.advId);
    if (!adv) return;
    state.selectedAdventure = adv;
    state.rolledStats = {};
    render.showScreen('screen-char-create');
    render.renderCharCreate(adv);
  },
  'roll-stat': (target) => rollOneStat(target.dataset.key),
  'roll-all': () => state.selectedAdventure.stats.forEach(s => rollOneStat(s.key)),
  'start-adventure': () => startAdventure(),

  // Tabs
  'tab': (target) => render.switchTab(target.dataset.tab),

  // Game header
  'save': () => doSave(),
  'menu': () => render.openGameMenu(),

  // Menu actions
  'menu-close': () => render.closeGameMenu(),
  'menu-save': () => { doSave(); render.closeGameMenu(); },
  'menu-dice': () => { render.closeGameMenu(); render.showDiceRoll(rollDice(2), 'Lancer libre : 2D6'); },
  'menu-test-luck': () => { render.closeGameMenu(); doTestLuck(); },
  'menu-quit': () => quitAdventure(),

  // Stats
  'stat-adjust': (target) => {
    const wasDeath = adjustStat(target.dataset.key, parseInt(target.dataset.delta));
    render.renderStats();
    if (wasDeath) modal.alert("Votre héros est mort ! Son endurance est tombée à 0.", 'Mort');
  },

  // Special section
  'special-counter': (target) => {
    const delta = parseInt(target.dataset.delta);
    state.game.special.value = Math.max(0, (state.game.special.value || 0) + delta);
    el('special-counter').value = state.game.special.value;
  },
  'toggle-checklist': (target) => {
    const item = target.dataset.item;
    const max = parseInt(target.dataset.max);
    if (!state.game.special.selected) state.game.special.selected = [];
    if (target.checked) {
      if (state.game.special.selected.length >= max) {
        modal.alert(`Vous ne pouvez choisir que ${max} éléments.`);
        render.renderSpecialSection();
        return;
      }
      state.game.special.selected.push(item);
    } else {
      state.game.special.selected = state.game.special.selected.filter(i => i !== item);
    }
    render.renderSpecialSection();
  },
  'add-spell': () => {
    const name = el('spell-name-input').value.trim();
    const cost = parseInt(el('spell-cost-input').value) || 0;
    if (!name) return;
    if (!state.game.special.spells) state.game.special.spells = [];
    state.game.special.spells.push({ name, cost });
    render.renderSpecialSection();
  },
  'remove-spell': (target) => {
    state.game.special.spells.splice(parseInt(target.dataset.idx), 1);
    render.renderSpecialSection();
  },
  'add-transform': () => {
    const name = el('form-name-input').value.trim();
    const effect = el('form-effect-input').value.trim();
    if (!name) return;
    if (!state.game.special.forms) state.game.special.forms = [];
    state.game.special.forms.push({ name, effect });
    render.renderSpecialSection();
  },
  'remove-transform': (target) => {
    state.game.special.forms.splice(parseInt(target.dataset.idx), 1);
    render.renderSpecialSection();
  },
  'set-form': (target) => {
    state.game.special.currentForm = target.dataset.name;
    render.renderSpecialSection();
  },

  // Alerts
  'add-alert': () => addAlertFromInput(),
  'remove-alert': (target) => {
    state.game.alerts.splice(parseInt(target.dataset.idx), 1);
    render.renderAlerts();
  },

  // Paragraph history → switch to notes tab
  'para-history': () => render.switchTab('tab-notes'),

  // Combat
  'add-adversary': () => addAdversaryFromInputs(),
  'attack': () => {
    const logs = combat.combatRound();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'test-luck-combat': () => {
    const logs = combat.testLuckCombat();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'flee': () => {
    const logs = combat.fleeCombat();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'clear-combat-log': () => render.clearCombatLog(),
  'adv-stamina': (target) => {
    const idx = parseInt(target.dataset.idx);
    const delta = parseInt(target.dataset.delta);
    const adv = state.game.adversaries[idx];
    if (!adv || adv.defeated) return;
    adv.stamina = Math.max(0, adv.stamina + delta);
    if (adv.stamina <= 0) {
      adv.defeated = true;
      adv.stamina = 0;
      render.appendCombatLog([{ text: `${adv.name} est vaincu !`, type: 'critical' }]);
    }
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'adv-remove': (target) => {
    state.game.adversaries.splice(parseInt(target.dataset.idx), 1);
    render.renderAdversaries();
    render.updateCombatButtons();
  },

  // Inventory
  'gold-adjust': (target) => {
    const delta = parseInt(target.dataset.delta);
    state.game.gold = Math.max(0, state.game.gold + delta);
    el('gold-amount').value = state.game.gold;
  },
  'prov-adjust': (target) => {
    const delta = parseInt(target.dataset.delta);
    state.game.provisions = Math.max(0, state.game.provisions + delta);
    el('provisions-amount').value = state.game.provisions;
  },
  'eat': () => eatMeal(),
  'use-potion': (target) => usePotion(parseInt(target.dataset.idx)),
  'add-object': () => addObjectFromInputs(),
  'remove-object': (target) => {
    state.game.objects.splice(parseInt(target.dataset.idx), 1);
    render.renderObjects();
  },
  'add-special-item': () => {
    const input = el('special-item-name');
    const name = input.value.trim();
    if (!name) return;
    if (!state.game.specialItems) state.game.specialItems = [];
    state.game.specialItems.push({ name });
    input.value = '';
    render.renderSpecialItems();
  },
  'remove-special-item': (target) => {
    state.game.specialItems.splice(parseInt(target.dataset.idx), 1);
    render.renderSpecialItems();
  },

  // Dice overlay
  'dice-close': () => render.closeDiceOverlay(),

  // Save list
  'load-save': (target) => loadGame(parseInt(target.dataset.idx)),
  'delete-save': async (target, ev) => {
    ev.stopPropagation();
    if (!(await modal.confirm('Supprimer cette sauvegarde ?'))) return;
    await removeSave(parseInt(target.dataset.idx));
    render.renderSavesList();
  },
};

// ───────────────────────────────────────────────
// Helpers used by action handlers
// ───────────────────────────────────────────────

function getEditableStatDef(key) {
  const stat = state.selectedAdventure.stats.find(s => s.key === key);
  if (!stat) return null;
  if (!stat.editable) return stat;

  const diceSelect = document.querySelector(`[data-dice-key="${key}"]`);
  const sidesSelect = document.querySelector(`[data-sides-key="${key}"]`);
  const bonusInput = document.querySelector(`[data-bonus-key="${key}"]`);
  const nameInput = document.querySelector(`[data-key="${key}"].stat-custom-name`);

  if (diceSelect && sidesSelect && bonusInput) {
    return {
      ...stat,
      name: nameInput ? nameInput.value : stat.name,
      dice: parseInt(diceSelect.value),
      diceType: parseInt(sidesSelect.value),
      bonus: parseInt(bonusInput.value) || 0,
    };
  }
  return stat;
}

function rollOneStat(key) {
  const statDef = getEditableStatDef(key);
  if (!statDef) return;
  const sides = statDef.diceType || 6;
  const rolls = rollDice(statDef.dice, sides);
  const total = rolls.reduce((s, v) => s + v, 0) + statDef.bonus;
  state.rolledStats[key] = { rolls, total };
  render.updateRolledStatDisplay(key, total);
}

async function startAdventure() {
  const adv = state.selectedAdventure;
  const allRolled = adv.stats.every(s => state.rolledStats[s.key]);
  if (!allRolled) {
    await modal.alert('Lancez tous les dés avant de commencer !');
    return;
  }
  const heroName = el('hero-name').value.trim() || 'Héros Sans Nom';
  const bookTitle = el('book-title').value.trim();
  const statDefs = adv.stats.map(s => getEditableStatDef(s.key));

  state.game = createGameState({
    adventure: adv,
    heroName,
    bookTitle,
    rolledStats: state.rolledStats,
    statDefs,
  });
  resetCharCreate();
  render.showScreen('screen-game');
  render.renderGameScreen();
}

async function doSave() {
  if (!state.game) return;
  // sync UI-edited fields into state first
  state.game.notes = el('game-notes').value;
  state.game.gold = parseInt(el('gold-amount').value) || 0;
  state.game.provisions = parseInt(el('provisions-amount').value) || 0;
  const result = await persistGame(state.game);
  if (result.ok) render.showSaveConfirmation();
}

async function quitAdventure() {
  if (!(await modal.confirm("Quitter l'aventure ? (Pensez à sauvegarder !)"))) return;
  state.game = null;
  render.showScreen('screen-home');
  render.closeGameMenu();
}

function doTestLuck() {
  const result = combat.testLuck();
  if (!result) {
    modal.alert('Pas de caractéristique Chance dans cette aventure.');
    return;
  }
  const txt = result.lucky
    ? `CHANCEUX ! (${result.total} ≤ ${result.currentLuck})`
    : `MALCHANCEUX ! (${result.total} > ${result.currentLuck})`;
  render.showDiceRoll(result.rolls, txt);
  render.renderStats();
}

function addAlertFromInput() {
  const input = el('alert-input');
  const type = el('alert-type').value;
  const text = input.value.trim();
  if (!text || !state.game) return;
  state.game.alerts.push({ text, type });
  input.value = '';
  render.renderAlerts();
}

async function addAdversaryFromInputs() {
  const name = el('adv-name').value.trim();
  const skill = parseInt(el('adv-skill').value);
  const stamina = parseInt(el('adv-stamina').value);
  if (!name || isNaN(skill) || isNaN(stamina)) {
    await modal.alert("Remplissez le nom, l'habileté et l'endurance de l'adversaire.");
    return;
  }
  if (!state.game) return;
  state.game.adversaries.push({
    name, skill, skillMax: skill, stamina, staminaMax: stamina, defeated: false,
  });
  el('adv-name').value = '';
  el('adv-skill').value = '';
  el('adv-stamina').value = '';
  render.renderAdversaries();
  render.updateCombatButtons();
}

function addObjectFromInputs() {
  const nameInput = el('object-name');
  const descInput = el('object-desc');
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  if (!name || !state.game) return;
  state.game.objects.push({ name, desc });
  nameInput.value = '';
  descInput.value = '';
  render.renderObjects();
}

async function eatMeal() {
  if (!state.game) return;
  if (state.game.provisions <= 0) {
    await modal.alert("Vous n'avez plus de provisions !");
    return;
  }
  const config = resolveConfig(state.game);
  const restore = config.mealRestore || 4;
  if (restore === 0) {
    await modal.alert("Les provisions ne restaurent pas d'endurance dans cette aventure. Gérez-les manuellement.");
    return;
  }
  state.game.provisions--;
  state.game.stats[config.combatStamina] = Math.min(
    state.game.statsMax[config.combatStamina],
    state.game.stats[config.combatStamina] + restore
  );
  el('provisions-amount').value = state.game.provisions;
  render.renderStats();
  await modal.alert(`Repas pris ! +${restore} Endurance`);
}

async function usePotion(idx) {
  if (!state.game) return;
  const potion = state.game.potions[idx];
  if (!potion || potion.used >= potion.doses) return;
  potion.used++;
  const stat = potion.stat;
  if (stat === 'chance') {
    state.game.stats[stat] = state.game.statsMax[stat] + 1;
    state.game.statsMax[stat] = state.game.stats[stat];
  } else {
    state.game.stats[stat] = state.game.statsMax[stat];
  }
  render.renderStats();
  render.renderPotions();
  await modal.alert(`${potion.name} bue ! ${potion.effect}`);
}

function loadGame(idx) {
  const saves = getSaves();
  if (idx < 0 || idx >= saves.length) return;
  // Deep clone + always re-derive adventureConfig from the canonical types
  state.game = JSON.parse(JSON.stringify(saves[idx]));
  const advType = getAdventureType(state.game.adventureType);
  if (advType) state.game.adventureConfig = advType;
  render.showScreen('screen-game');
  render.renderGameScreen();
}

// ───────────────────────────────────────────────
// Wiring
// ───────────────────────────────────────────────

export function attachEvents() {
  // Delegated click handler for all [data-action] elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const handler = actions[action];
    if (!handler) return;
    // Skip disabled buttons
    if (target.tagName === 'BUTTON' && target.disabled) return;
    handler(target, e);
  });

  // Delegated change handler for checkboxes that opt in via data-action
  document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.type === 'checkbox') {
      const handler = actions[target.dataset.action];
      if (handler) handler(target, e);
    }
  });

  // Static input listeners
  el('current-para').addEventListener('change', () => {
    if (!state.game) return;
    const val = parseInt(el('current-para').value) || 1;
    state.game.currentParagraph = val;
    if (!state.game.paragraphHistory.includes(val)) {
      state.game.paragraphHistory.push(val);
    }
    render.renderParagraphHistory();
  });
  el('gold-amount').addEventListener('change', () => {
    if (!state.game) return;
    state.game.gold = Math.max(0, parseInt(el('gold-amount').value) || 0);
  });
  el('provisions-amount').addEventListener('change', () => {
    if (!state.game) return;
    state.game.provisions = Math.max(0, parseInt(el('provisions-amount').value) || 0);
  });
  el('alert-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addAlertFromInput();
  });
  el('object-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addObjectFromInputs();
  });
  el('game-notes').addEventListener('input', () => {
    if (state.game) state.game.notes = el('game-notes').value;
  });
}
