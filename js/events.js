import { rollDice } from './dice.js';
import { el, modal, toast } from './dom.js';
import { state, resolveConfig, resetCharCreate, createGameState, adjustStat, startNewRun, logDice } from './state.js';
import { getSaves, persistGame, removeSave, exportSaves, importSaves } from './save.js';
import { getAdventureType } from './adventure-types.js';
import * as combat from './combat.js';
import * as render from './render.js';
import { renderMap, zoomMapBy, fitMap, relayoutMap, unlockAllNodes } from './map.js';

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
    // Deep-clone stats so user customisations don't pollute the shared ADVENTURE_TYPES.
    state.selectedAdventure = { ...adv, stats: adv.stats.map(s => ({ ...s })) };
    state.rolledStats = {};
    // Initial equipment defaults: empty potions/objects (let user opt in), provisions from adventure default
    state.startingEquipment = {
      gold: 0,
      provisions: adv.defaultProvisions || 0,
      potions: [],
      objects: [],
    };
    render.showScreen('screen-char-create');
    render.renderCharCreate(state.selectedAdventure);
  },
  'roll-stat': (target) => rollOneStat(target.dataset.key),
  'roll-all': () => state.selectedAdventure.stats.forEach(s => rollOneStat(s.key)),
  'start-adventure': () => startAdventure(),
  'add-custom-stat': () => {
    const key = `custom_${Date.now()}`;
    state.selectedAdventure.stats.push({
      key,
      name: 'Nouvelle caractéristique',
      dice: 1, diceType: 6, bonus: 0,
      editable: true, isCustom: true,
    });
    render.renderStatsCreation();
  },
  'remove-custom-stat': (target) => {
    const key = target.dataset.key;
    state.selectedAdventure.stats = state.selectedAdventure.stats.filter(s => s.key !== key);
    delete state.rolledStats[key];
    render.renderStatsCreation();
  },
  'add-starting-potion': () => {
    const nameInp = el('new-potion-name');
    const effInp = el('new-potion-effect');
    const dosesInp = el('new-potion-doses');
    const statSel = el('new-potion-stat');
    const name = nameInp.value.trim();
    if (!name) return;
    const effect = effInp.value.trim();
    const doses = Math.max(1, parseInt(dosesInp.value) || 1);
    const stat = statSel.value || '';
    state.startingEquipment.potions.push({ name, effect, doses, stat, used: 0 });
    nameInp.value = ''; effInp.value = ''; dosesInp.value = '1'; statSel.value = '';
    render.renderStartingEquipment();
  },
  'remove-starting-potion': (target) => {
    state.startingEquipment.potions.splice(parseInt(target.dataset.idx), 1);
    render.renderStartingEquipment();
  },
  'add-starting-object': () => {
    const nameInp = el('new-startobj-name');
    const descInp = el('new-startobj-desc');
    const name = nameInp.value.trim();
    if (!name) return;
    state.startingEquipment.objects.push({ name, desc: descInp.value.trim() });
    nameInp.value = ''; descInp.value = '';
    render.renderStartingEquipment();
  },
  'remove-starting-object': (target) => {
    state.startingEquipment.objects.splice(parseInt(target.dataset.idx), 1);
    render.renderStartingEquipment();
  },

  // Tabs
  'tab': (target) => {
    render.switchTab(target.dataset.tab);
    if (target.dataset.tab === 'tab-map') renderMap();
  },

  // Map controls
  'map-zoom-in': () => zoomMapBy(0.85),
  'map-zoom-out': () => zoomMapBy(1.18),
  'map-fit': () => fitMap(),
  'map-relayout': () => relayoutMap(),
  'map-unlock-all': () => {
    unlockAllNodes();
    toast('Toutes les positions libérées', 'info', 1500);
  },
  'jump-to-paragraph': (target) => {
    if (!state.game) return;
    const num = parseInt(target.dataset.num);
    state.game.currentParagraph = num;
    el('current-para').value = num;
    if (!state.game.paragraphHistory) state.game.paragraphHistory = [];
    state.game.paragraphHistory.push(num);
    if (!state.game.paragraphs) state.game.paragraphs = {};
    if (!state.game.paragraphs[num]) {
      state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
    }
    render.renderParagraphs();
    renderMap();
  },

  // Game header
  'save': () => doSave(),
  'menu': () => render.openGameMenu(),

  // Menu actions
  'menu-close': () => render.closeGameMenu(),
  'menu-save': () => { doSave(); render.closeGameMenu(); },
  'menu-dice': () => {
    render.closeGameMenu();
    const rolls = rollDice(2);
    const total = rolls.reduce((s, v) => s + v, 0);
    logDice({ rolls, modifier: 0, modifierLabel: '', total, label: 'Lancer libre' });
    render.showDiceRoll(rolls, 'Lancer libre : 2D6');
    render.renderDiceLog();
  },
  'menu-test-luck': () => { render.closeGameMenu(); doTestLuck(); },
  'menu-quit': () => quitAdventure(),
  'new-run': () => doNewRunFromActiveGame(),

  // Stats
  'stat-adjust': (target) => {
    const wasDeath = adjustStat(target.dataset.key, parseInt(target.dataset.delta));
    render.renderStats();
    if (wasDeath) modal.alert("Votre héros est mort ! Son endurance est tombée à 0.", 'Mort');
  },
  'stat-delta-apply': (target) => {
    const key = target.dataset.key;
    const input = document.querySelector(`.stat-delta-input[data-stat-key="${key}"]`);
    if (!input) return;
    const delta = parseInt(input.value);
    if (!Number.isFinite(delta) || delta === 0) {
      input.focus();
      return;
    }
    const wasDeath = adjustStat(key, delta);
    input.value = '';
    render.renderStats();
    if (wasDeath) {
      modal.alert("Votre héros est mort ! Son endurance est tombée à 0.", 'Mort');
    } else {
      const config = resolveConfig(state.game);
      const statName = config.stats.find(s => s.key === key)?.name || key;
      toast(`${statName} : ${delta > 0 ? '+' : ''}${delta}`, delta < 0 ? 'warn' : 'success', 1500);
    }
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

  // ─── Ajout de paragraphe (formulaire en onglet Personnage) ───
  'pick-sentiment': (target) => {
    state.pendingSentiment = target.dataset.value;
    document.querySelectorAll('.sentiment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === state.pendingSentiment);
    });
  },
  'add-paragraph': () => {
    if (!state.game) return;
    const numInp = el('new-para-num');
    const noteInp = el('new-para-note');
    const num = parseInt(numInp.value);
    if (!Number.isFinite(num) || num <= 0) {
      numInp.focus();
      return;
    }
    const sentiment = state.pendingSentiment;
    const note = noteInp.value.trim();

    if (!state.game.paragraphs) state.game.paragraphs = {};
    if (!state.game.paragraphs[num]) {
      state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
    }
    // Apply sentiment only if user explicitly picked something other than neutral
    if (sentiment && sentiment !== 'neutral') {
      state.game.paragraphs[num].sentiment = sentiment;
    }
    // Apply note only if non-empty (don't blank out existing note on revisit)
    if (note) state.game.paragraphs[num].note = note;

    state.game.currentParagraph = num;
    if (!Array.isArray(state.game.paragraphHistory)) state.game.paragraphHistory = [];
    state.game.paragraphHistory.push(num);

    // Reset form
    numInp.value = '';
    noteInp.value = '';
    state.pendingSentiment = 'neutral';
    document.querySelectorAll('.sentiment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'neutral');
    });

    // Update displays
    el('current-para').value = num;
    render.renderParagraphs();
    renderMap(); // refresh map even if tab not visible — keeps it in sync

    // Return focus to number input for fast sequential entry
    numInp.focus();
  },
  'reset-para-input': () => {
    el('new-para-num').value = '';
    el('new-para-note').value = '';
    state.pendingSentiment = 'neutral';
    document.querySelectorAll('.sentiment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'neutral');
    });
    el('new-para-num').focus();
  },
  'see-only-paragraph': () => {
    if (!state.game) return;
    const numInp = el('new-para-num');
    const noteInp = el('new-para-note');
    const num = parseInt(numInp.value);
    if (!Number.isFinite(num) || num <= 0) {
      numInp.focus();
      return;
    }
    const sentiment = state.pendingSentiment;
    const note = noteInp.value.trim();
    if (!state.game.paragraphs) state.game.paragraphs = {};
    const isNew = !state.game.paragraphs[num];
    if (isNew) state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
    if (sentiment && sentiment !== 'neutral') state.game.paragraphs[num].sentiment = sentiment;
    if (note) state.game.paragraphs[num].note = note;
    // No paragraphHistory.push → pas de visite, pas d'arête sur la carte
    // Reset form
    numInp.value = '';
    noteInp.value = '';
    state.pendingSentiment = 'neutral';
    document.querySelectorAll('.sentiment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'neutral');
    });
    render.renderParagraphs();
    renderMap();
    numInp.focus();
    toast(`§${num} ajouté à la carte (sans visite)`, 'info', 1800);
  },
  'undo-paragraph': () => {
    if (!state.game || !Array.isArray(state.game.paragraphHistory)) return;
    const history = state.game.paragraphHistory;
    if (history.length <= 1) {
      toast("Rien à annuler", 'warn', 1500);
      return;
    }
    const removed = history.pop();
    // Skip null markers (run boundaries) — they shouldn't be removable
    if (removed === null) {
      history.push(null); // put it back
      toast("Pas de visite à annuler dans cette run", 'warn', 1500);
      return;
    }
    // Update currentParagraph to previous non-null entry
    let i = history.length - 1;
    while (i >= 0 && history[i] === null) i--;
    state.game.currentParagraph = i >= 0 ? history[i] : 1;
    el('current-para').value = state.game.currentParagraph;
    render.renderParagraphs();
    renderMap();
    toast(`§${removed} retiré de l'historique`, 'info', 1800);
  },
  'cycle-sentiment': (target) => {
    const num = parseInt(target.dataset.num);
    if (!state.game.paragraphs) state.game.paragraphs = {};
    if (!state.game.paragraphs[num]) {
      state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
    }
    const order = ['neutral', 'positive', 'negative'];
    const cur = state.game.paragraphs[num].sentiment || 'neutral';
    state.game.paragraphs[num].sentiment = order[(order.indexOf(cur) + 1) % order.length];
    render.renderParagraphs();
  },
  'filter-paragraphs': (target) => {
    state.paragraphFilter = target.value || '';
    render.renderParagraphs();
  },
  'set-para-note': (target) => {
    const num = parseInt(target.dataset.num);
    if (!state.game.paragraphs) state.game.paragraphs = {};
    if (!state.game.paragraphs[num]) {
      state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
    }
    state.game.paragraphs[num].note = target.value;
  },
  'remove-para-visit': (target) => {
    const idx = parseInt(target.dataset.idx);
    if (!state.game.paragraphHistory) return;
    state.game.paragraphHistory.splice(idx, 1);
    render.renderParagraphs();
  },

  // Combat
  'add-adversary': () => addAdversaryFromInputs(),
  'attack': () => {
    const logs = combat.combatRound();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
    render.renderDiceLog();
  },
  'test-luck-combat': () => {
    const logs = combat.testLuckCombat();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
    render.renderDiceLog();
  },
  'flee': () => {
    const logs = combat.fleeCombat();
    render.appendCombatLog(logs);
    render.renderStats();
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'clear-combat-log': () => render.clearCombatLog(),
  'clear-dice-log': () => {
    if (state.game) state.game.diceLog = [];
    render.renderDiceLog();
  },
  'toggle-combat-mode': (target) => {
    if (!state.game) return;
    state.game.combatMode = target.checked ? 'sequential' : 'simultaneous';
    if (state.game.combatMode === 'simultaneous') state.game.targetedAdversaryIdx = null;
    render.renderAdversaries();
    render.updateCombatButtons();
  },
  'target-adversary': (target) => {
    if (!state.game) return;
    const idx = parseInt(target.dataset.idx);
    state.game.targetedAdversaryIdx = idx;
    render.renderAdversaries();
  },
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
  'export-saves': async () => {
    const count = exportSaves();
    if (count === 0) {
      await modal.alert("Aucune sauvegarde à exporter.");
    } else {
      render.renderSavesList(); // refresh banner to "aujourd'hui"
    }
  },
  'import-saves-trigger': () => {
    el('import-file').click();
  },
  'new-run-from-save': async (target, ev) => {
    ev.stopPropagation();
    const idx = parseInt(target.dataset.idx);
    const saves = getSaves();
    if (idx < 0 || idx >= saves.length) return;
    // Load first (so we know heroName + can resolve config), then prompt
    loadGame(idx);
    if (!state.game) return;
    const reroll = await promptNewRunChoice(state.game.heroName);
    if (reroll === null) return; // cancelled
    startNewRun(state.game, { reroll });
    render.renderGameScreen();
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
  // Read starting gold/provisions live from inputs (rest already in state.startingEquipment)
  const goldInp = el('starting-gold');
  const provInp = el('starting-provisions');
  const equipment = {
    gold: parseInt(goldInp?.value) || 0,
    provisions: parseInt(provInp?.value) || (adv.defaultProvisions || 0),
    potions: state.startingEquipment.potions,
    objects: state.startingEquipment.objects,
  };

  state.game = createGameState({
    adventure: adv,
    heroName,
    bookTitle,
    rolledStats: state.rolledStats,
    statDefs,
    equipment,
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
  if (result.ok) {
    render.showSaveConfirmation();
    toast('Sauvegardé', 'success', 1800);
  }
}

async function quitAdventure() {
  if (!(await modal.confirm("Quitter l'aventure ? (Pensez à sauvegarder !)"))) return;
  state.game = null;
  render.showScreen('screen-home');
  render.closeGameMenu();
}

// Returns true (reroll), false (keep stats), or null (cancelled)
function promptNewRunChoice(heroName) {
  return modal.choice(
    `Nouvelle run pour ${heroName}.\n\n` +
    `Reset : stats à fond, équipement de départ, paragraphe §1, combat vide.\n` +
    `Gardés : notes, sentiments des paragraphes, carte explorée.`,
    [
      { label: 'Annuler', value: null, class: 'btn-back' },
      { label: 'Re-roll des dés', value: true, class: 'btn-secondary' },
      { label: 'Garder mes stats', value: false, class: 'btn-primary' },
    ],
    'Nouvelle run'
  );
}

async function doNewRunFromActiveGame() {
  if (!state.game) return;
  render.closeGameMenu();
  const reroll = await promptNewRunChoice(state.game.heroName);
  if (reroll === null) return;
  startNewRun(state.game, { reroll });
  render.renderGameScreen();
  renderMap(); // refresh map to show the run boundary marker
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
  render.renderDiceLog();
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
  toast(`Repas pris : +${restore} Endurance`, 'success');
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
  toast(`${potion.name} bue${potion.effect ? ' — ' + potion.effect : ''}`, 'success');
}

function loadGame(idx) {
  const saves = getSaves();
  if (idx < 0 || idx >= saves.length) return;
  state.game = JSON.parse(JSON.stringify(saves[idx]));
  // Rebuild adventureConfig from the canonical type + persisted statDefs.
  // Backwards compat: old saves embedded full adventureConfig (pre-refactor).
  const advType = getAdventureType(state.game.adventureType);
  const statDefs = state.game.statDefs
    || (state.game.adventureConfig && state.game.adventureConfig.stats)
    || (advType && advType.stats)
    || [];
  state.game.statDefs = statDefs;
  state.game.adventureConfig = advType ? { ...advType, stats: statDefs } : { stats: statDefs };
  // Migration: old saves only had paragraphHistory (flat array). Build paragraphs map.
  if (!state.game.paragraphs) {
    state.game.paragraphs = {};
    (state.game.paragraphHistory || []).forEach(num => {
      if (!state.game.paragraphs[num]) {
        state.game.paragraphs[num] = { sentiment: 'neutral', note: '' };
      }
    });
  }
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

  // Delegated input handler for text inputs (used for live note editing on paragraphs)
  document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.tagName === 'INPUT' && target.type !== 'checkbox') {
      const handler = actions[target.dataset.action];
      if (handler) handler(target, e);
    }
  });

  // Static input listeners
  // #current-para is now a read-only display (changement de paradigme : on
  // ajoute via le formulaire "+ Ajouter" qui contrôle sentiment + note d'un coup).
  // Submit-on-Enter pour les inputs du formulaire d'ajout :
  ['new-para-num', 'new-para-note'].forEach(id => {
    const inp = el(id);
    if (inp) inp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const handler = actions['add-paragraph'];
        if (handler) handler();
      }
    });
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

  // Import file picker — handled here because it's a 'change' on a file input
  const importInput = el('import-file');
  if (importInput) {
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch (err) {
        await modal.alert(`Fichier JSON invalide : ${err.message}`, 'Import échoué');
        e.target.value = '';
        return;
      }
      const count = Array.isArray(parsed) ? parsed.length : parsed?.saves?.length ?? 0;
      const choice = await modal.choice(
        `${count} sauvegarde(s) trouvée(s) dans le fichier.\n\n` +
        `Fusionner = garde les tiennes et ajoute les nouvelles (le plus récent gagne sur conflit).\n` +
        `Remplacer = écrase toutes tes saves locales.`,
        [
          { label: 'Annuler', value: null, class: 'btn-back' },
          { label: 'Remplacer tout', value: 'replace', class: 'btn-danger' },
          { label: 'Fusionner', value: 'merge', class: 'btn-primary' },
        ],
        'Importer des sauvegardes'
      );
      if (!choice) { e.target.value = ''; return; }
      const result = await importSaves(parsed, choice);
      e.target.value = '';
      if (result.ok) {
        await modal.alert(`Import réussi : ${result.imported} importée(s), ${result.kept} sauvegardes au total.`, 'Import OK');
        render.renderSavesList();
      }
    });
  }
}
