import { rollDice } from './dice.js';
import { state, resolveConfig } from './state.js';

// ──────────── Pure helpers ────────────

export function combatAttackRoll(skill) {
  const rolls = rollDice(2);
  return { rolls, total: rolls[0] + rolls[1] + skill };
}

export function resolveAttack(heroTotal, advTotal) {
  if (heroTotal > advTotal) return 'hero';
  if (advTotal > heroTotal) return 'adversary';
  return 'tie';
}

export function rollLuck(currentLuck) {
  const rolls = rollDice(2);
  const total = rolls[0] + rolls[1];
  return { rolls, total, lucky: total <= currentLuck };
}

export function findLuckStatKey(adventureConfig) {
  const stat = adventureConfig.stats.find(s => s.name.toLowerCase().includes('chance'));
  return stat ? stat.key : null;
}

// ──────────── Orchestrators (mutate state, emit log entries) ────────────

// Returns an array of log entries {text, type}. Caller appends them to the UI.
export function combatRound() {
  const game = state.game;
  if (!game) return [];
  const config = resolveConfig(game);
  const log = [];

  const liveAdversaries = game.adversaries.filter(a => !a.defeated);
  if (liveAdversaries.length === 0) return log;

  liveAdversaries.forEach(adv => {
    const hero = combatAttackRoll(game.stats[config.combatSkill]);
    const enemy = combatAttackRoll(adv.skill);

    log.push({ text: `--- Tour contre ${adv.name} ---`, type: 'info' });
    log.push({
      text: `Vous : ${hero.rolls.join('+')}+${game.stats[config.combatSkill]} = ${hero.total}`,
      type: 'info',
    });
    log.push({
      text: `${adv.name} : ${enemy.rolls.join('+')}+${adv.skill} = ${enemy.total}`,
      type: 'info',
    });

    const outcome = resolveAttack(hero.total, enemy.total);
    if (outcome === 'hero') {
      adv.stamina -= 2;
      state.lastCombatResult = { hit: 'hero', adversary: adv };
      log.push({
        text: `Vous touchez ${adv.name} ! (-2 END, reste ${Math.max(0, adv.stamina)})`,
        type: 'miss',
      });
      if (adv.stamina <= 0) {
        adv.stamina = 0;
        adv.defeated = true;
        log.push({ text: `${adv.name} est vaincu !`, type: 'critical' });
      }
    } else if (outcome === 'adversary') {
      game.stats[config.combatStamina] -= 2;
      state.lastCombatResult = { hit: 'adversary', adversary: adv };
      log.push({
        text: `${adv.name} vous touche ! (-2 END, reste ${Math.max(0, game.stats[config.combatStamina])})`,
        type: 'hit',
      });
      if (game.stats[config.combatStamina] <= 0) {
        game.stats[config.combatStamina] = 0;
        log.push({ text: `Votre héros est mort au combat !`, type: 'critical' });
      }
    } else {
      state.lastCombatResult = null;
      log.push({ text: `Égalité ! Les lames s'entrechoquent sans résultat.`, type: 'info' });
    }
  });

  if (game.adversaries.every(a => a.defeated)) {
    log.push({
      text: '=== VICTOIRE ! Tous les adversaires sont vaincus ! ===',
      type: 'critical',
    });
  }

  return log;
}

// Test de chance pendant un combat. Modifie l'issue du dernier round.
export function testLuckCombat() {
  const game = state.game;
  if (!game || !state.lastCombatResult) {
    return [{ text: 'Tentez votre chance après un round de combat.', type: 'info' }];
  }
  const config = resolveConfig(game);
  const luckKey = findLuckStatKey(config);
  if (!luckKey) {
    return [{ text: 'Pas de caractéristique Chance dans cette aventure.', type: 'info' }];
  }

  const log = [];
  const result = rollLuck(game.stats[luckKey]);
  const currentLuck = game.stats[luckKey];
  game.stats[luckKey] = Math.max(0, game.stats[luckKey] - 1);

  const last = state.lastCombatResult;
  if (last.hit === 'hero') {
    if (result.lucky) {
      last.adversary.stamina -= 2;
      log.push({
        text: `Chanceux ! (${result.total} ≤ ${currentLuck}) Coup dévastateur ! (-2 END supplémentaires à ${last.adversary.name})`,
        type: 'miss',
      });
    } else {
      last.adversary.stamina += 1;
      log.push({
        text: `Malchanceux ! (${result.total} > ${currentLuck}) Coup amorti. (+1 END à ${last.adversary.name})`,
        type: 'hit',
      });
    }
  } else {
    if (result.lucky) {
      game.stats[config.combatStamina] += 1;
      log.push({
        text: `Chanceux ! (${result.total} ≤ ${currentLuck}) Vous esquivez partiellement. (+1 END)`,
        type: 'miss',
      });
    } else {
      game.stats[config.combatStamina] -= 1;
      log.push({
        text: `Malchanceux ! (${result.total} > ${currentLuck}) Le coup est plus grave ! (-1 END supplémentaire)`,
        type: 'hit',
      });
    }
  }

  if (last.adversary.stamina <= 0) {
    last.adversary.stamina = 0;
    last.adversary.defeated = true;
    log.push({ text: `${last.adversary.name} est vaincu !`, type: 'critical' });
  }
  if (game.stats[config.combatStamina] <= 0) {
    game.stats[config.combatStamina] = 0;
    log.push({ text: `Votre héros est mort au combat !`, type: 'critical' });
  }

  state.lastCombatResult = null;
  return log;
}

// Hors-combat. Renvoie { rolls, total, lucky, currentLuck } pour affichage,
// ou null si pas de stat Chance.
export function testLuck() {
  const game = state.game;
  if (!game) return null;
  const config = resolveConfig(game);
  const luckKey = findLuckStatKey(config);
  if (!luckKey) return null;

  const currentLuck = game.stats[luckKey];
  const result = rollLuck(currentLuck);
  game.stats[luckKey] = Math.max(0, currentLuck - 1);
  return { ...result, currentLuck };
}

// Renvoie une entrée de log pour la fuite.
export function fleeCombat() {
  const game = state.game;
  if (!game) return [];
  const config = resolveConfig(game);
  const log = [];

  game.stats[config.combatStamina] -= 2;
  log.push({
    text: `Vous prenez la fuite ! (-2 END pour la fuite, reste ${Math.max(0, game.stats[config.combatStamina])})`,
    type: 'hit',
  });

  if (game.stats[config.combatStamina] <= 0) {
    game.stats[config.combatStamina] = 0;
    log.push({ text: `Votre héros est mort en fuyant !`, type: 'critical' });
  }

  game.adversaries = [];
  return log;
}
