export function rollDie(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides = 6) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(rollDie(sides));
  return results;
}

export function rollStat(statDef) {
  const sides = statDef.diceType || 6;
  const rolls = rollDice(statDef.dice, sides);
  const total = rolls.reduce((s, v) => s + v, 0) + statDef.bonus;
  return { rolls, total };
}
