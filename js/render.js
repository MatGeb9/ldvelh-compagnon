import { ADVENTURE_TYPES, getAdventureType } from './adventure-types.js';
import { el, escapeHtml, html, raw } from './dom.js';
import { state, resolveConfig } from './state.js';
import { getSaves } from './save.js';

// ──────────── Navigation ────────────

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(screenId).classList.add('active');
}

export function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
  el(tabId)?.classList.add('active');
}

// ──────────── Adventure grid ────────────

export function renderAdventureGrid() {
  const grid = el('adventure-grid');
  grid.innerHTML = '';
  ADVENTURE_TYPES.forEach(adv => {
    const card = document.createElement('div');
    card.className = 'adventure-card';
    card.dataset.action = 'select-adventure';
    card.dataset.advId = adv.id;
    card.innerHTML = html`
      <h3>${adv.name}</h3>
      <p>${adv.description}</p>
      <div class="stat-preview">${adv.statPreview}</div>
    `;
    grid.appendChild(card);
  });
}

// ──────────── Char create ────────────

export function renderCharCreate(adv) {
  el('char-create-title').textContent = adv.name;
  el('char-create-info').textContent = adv.description;
  el('hero-name').value = '';
  el('book-title').value = '';
  renderStatsCreation();
}

export function renderStatsCreation() {
  const container = el('stats-creation');
  const adv = state.selectedAdventure;
  container.innerHTML = '<h3 style="font-family:var(--font-title);margin-bottom:0.8rem;">Caractéristiques</h3>';

  adv.stats.forEach(stat => {
    const sides = stat.diceType || 6;
    const formula = `${stat.dice}D${sides}+${stat.bonus}`;
    const rolled = state.rolledStats[stat.key];
    const row = document.createElement('div');
    row.className = 'stat-roll-row';

    const valueInput = html`
      <input type="number" class="input-xs stat-value-input" data-stat-value-key="${stat.key}"
             value="${rolled ? rolled.total : ''}" placeholder="?" title="Valeur (modifiable)">
    `;
    const rollBtn = html`
      <button class="btn btn-small btn-primary" data-action="roll-stat" data-key="${stat.key}" title="Lancer les dés">
        ${raw('&#127922;')}
      </button>
    `;
    const removeBtn = stat.isCustom
      ? html`<button class="btn btn-small btn-danger" data-action="remove-custom-stat" data-key="${stat.key}" title="Supprimer">${raw('&#10006;')}</button>`
      : '';

    if (stat.editable) {
      row.innerHTML = html`
        <input type="text" class="input-sm stat-custom-name" data-key="${stat.key}"
               value="${stat.name}" placeholder="Nom">
        <span class="stat-formula">
          <select class="input-xs" data-dice-key="${stat.key}">
            <option value="1" ${raw(stat.dice === 1 ? 'selected' : '')}>1D</option>
            <option value="2" ${raw(stat.dice === 2 ? 'selected' : '')}>2D</option>
          </select>
          <select class="input-xs" data-sides-key="${stat.key}">
            <option value="6" ${raw(sides === 6 ? 'selected' : '')}>D6</option>
            <option value="10" ${raw(sides === 10 ? 'selected' : '')}>D10</option>
          </select>
          +<input type="number" class="input-xs" data-bonus-key="${stat.key}"
                  value="${stat.bonus}" min="0" max="30">
        </span>
        ${raw(valueInput)}
        ${raw(rollBtn)}
        ${raw(removeBtn)}
      `;
    } else {
      row.innerHTML = html`
        <span class="stat-label">${stat.name}</span>
        <span class="stat-formula">(${formula})</span>
        ${raw(valueInput)}
        ${raw(rollBtn)}
      `;
    }

    // Manual value entry → sync into rolledStats (treated as "rolled" with empty rolls array)
    row.querySelector('.stat-value-input').addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      if (Number.isNaN(v)) delete state.rolledStats[stat.key];
      else state.rolledStats[stat.key] = { rolls: [], total: v };
    });

    // For editable stats (custom adventure or user-added) — keep state synced on input
    // so re-renders don't blow away the user's typing.
    if (stat.editable) {
      row.querySelector(`.stat-custom-name[data-key="${stat.key}"]`)?.addEventListener('input', (e) => {
        stat.name = e.target.value;
      });
      row.querySelector(`[data-dice-key="${stat.key}"]`)?.addEventListener('change', (e) => {
        stat.dice = parseInt(e.target.value);
      });
      row.querySelector(`[data-sides-key="${stat.key}"]`)?.addEventListener('change', (e) => {
        stat.diceType = parseInt(e.target.value);
      });
      row.querySelector(`[data-bonus-key="${stat.key}"]`)?.addEventListener('input', (e) => {
        stat.bonus = parseInt(e.target.value) || 0;
      });
    }

    container.appendChild(row);
  });

  // "Tout Lancer" + "Ajouter caractéristique" — wrapped in a flex row
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;';
  actionsRow.innerHTML = `
    <button class="btn btn-secondary" data-action="roll-all">&#127922; Tout Lancer</button>
    <button class="btn btn-back" data-action="add-custom-stat" title="Ajouter une caractéristique personnalisée">+ Caractéristique</button>
  `;
  container.appendChild(actionsRow);
}

export function updateRolledStatDisplay(key, total) {
  const input = document.querySelector(`.stat-value-input[data-stat-value-key="${key}"]`);
  if (!input) return;
  input.value = total;
  input.style.animation = 'none';
  void input.offsetHeight;
  input.style.animation = 'diceRoll 0.4s ease-out';
}

// ──────────── Game screen ────────────

export function renderGameScreen() {
  const game = state.game;
  if (!game) return;
  el('game-hero-name').textContent = game.heroName;
  el('game-book-title').textContent = game.bookTitle || '';
  renderStats();
  renderSpecialSection();
  renderAlerts();
  renderAdversaries();
  renderInventory();
  renderParagraphs();
  el('current-para').value = game.currentParagraph;
  el('game-notes').value = game.notes || '';
  el('gold-amount').value = game.gold;
  el('provisions-amount').value = game.provisions;
  updateCombatButtons();
}

export function renderStats() {
  const game = state.game;
  const panel = el('game-stats-panel');
  panel.innerHTML = '';
  const config = resolveConfig(game);
  config.stats.forEach(statDef => {
    const current = game.stats[statDef.key];
    const max = game.statsMax[statDef.key];
    const ratio = current / max;
    const card = document.createElement('div');
    card.className = 'stat-card';
    if (ratio <= 0.25) card.classList.add('stat-danger');
    else if (ratio <= 0.5) card.classList.add('stat-warning');
    card.innerHTML = html`
      <div class="stat-name">${statDef.name}</div>
      <div class="stat-current" id="stat-val-${statDef.key}">${current}</div>
      <div class="stat-max">/ ${max}</div>
      <div class="stat-controls">
        <button class="btn btn-small" data-action="stat-adjust" data-key="${statDef.key}" data-delta="-1">-</button>
        <button class="btn btn-small" data-action="stat-adjust" data-key="${statDef.key}" data-delta="1">+</button>
      </div>
    `;
    panel.appendChild(card);
  });
}

// ──────────── Special section ────────────

export function renderSpecialSection() {
  const game = state.game;
  const section = el('special-section');
  const config = resolveConfig(game);

  if (!config.special) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  section.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = config.special.title;
  section.appendChild(title);

  const desc = document.createElement('p');
  desc.style.cssText = 'font-size:0.85rem;color:var(--ink-light);font-style:italic;margin-bottom:0.5rem;';
  desc.textContent = config.special.description;
  section.appendChild(desc);

  switch (config.special.type) {
    case 'counter':
    case 'power': {
      const row = document.createElement('div');
      row.className = 'special-stat-row';
      row.innerHTML = html`
        <label>${config.special.title}</label>
        <button class="btn btn-small" data-action="special-counter" data-delta="-1">-</button>
        <input type="number" id="special-counter" value="${game.special.value || 0}">
        <button class="btn btn-small" data-action="special-counter" data-delta="1">+</button>
      `;
      row.querySelector('#special-counter').addEventListener('change', (e) => {
        game.special.value = parseInt(e.target.value) || 0;
      });
      section.appendChild(row);
      break;
    }
    case 'checklist': {
      const maxC = config.special.maxChoices || config.special.items.length;
      const selected = game.special.selected || [];
      const info = document.createElement('div');
      info.style.cssText = 'font-size:0.85rem;margin-bottom:0.5rem;';
      info.textContent = `Sélectionnées : ${selected.length} / ${maxC}`;
      section.appendChild(info);

      config.special.items.forEach(item => {
        const isSelected = selected.includes(item);
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;cursor:pointer;';
        label.innerHTML = html`
          <input type="checkbox" data-action="toggle-checklist" data-item="${item}" data-max="${maxC}" ${raw(isSelected ? 'checked' : '')}>
          <span>${item}</span>
        `;
        section.appendChild(label);
      });
      break;
    }
    case 'spells': {
      const list = document.createElement('div');
      (game.special.spells || []).forEach((spell, i) => {
        const item = document.createElement('div');
        item.className = 'object-item';
        item.innerHTML = html`
          <span class="obj-name">${spell.name}</span>
          <span class="obj-desc">Coût: ${spell.cost ?? '?'} END</span>
          <button class="obj-remove" data-action="remove-spell" data-idx="${i}">${raw('&#10006;')}</button>
        `;
        list.appendChild(item);
      });
      section.appendChild(list);

      const addRow = document.createElement('div');
      addRow.className = 'add-object';
      addRow.innerHTML = `
        <input type="text" id="spell-name-input" placeholder="Nom du sort" class="input-md">
        <input type="number" id="spell-cost-input" placeholder="Coût" class="input-xs" min="1">
        <button class="btn btn-small btn-primary" data-action="add-spell">+ Sort</button>
      `;
      section.appendChild(addRow);
      break;
    }
    case 'transform': {
      const formRow = document.createElement('div');
      formRow.className = 'special-stat-row';
      formRow.innerHTML = html`
        <label>Forme actuelle :</label>
        <input type="text" id="current-form" value="${game.special.currentForm || 'Humain'}" class="input-sm">
      `;
      formRow.querySelector('#current-form').addEventListener('change', (e) => {
        game.special.currentForm = e.target.value;
      });
      section.appendChild(formRow);

      const formsList = document.createElement('div');
      formsList.style.marginTop = '0.5rem';
      (game.special.forms || []).forEach((form, i) => {
        const item = document.createElement('div');
        item.className = 'object-item';
        item.innerHTML = html`
          <span class="obj-name">${form.name}</span>
          <span class="obj-desc">${form.effect || ''}</span>
          <button class="btn btn-small" data-action="set-form" data-name="${form.name}">Activer</button>
          <button class="obj-remove" data-action="remove-transform" data-idx="${i}">${raw('&#10006;')}</button>
        `;
        formsList.appendChild(item);
      });
      section.appendChild(formsList);

      const addRow = document.createElement('div');
      addRow.className = 'add-object';
      addRow.innerHTML = `
        <input type="text" id="form-name-input" placeholder="Nom de la forme" class="input-sm">
        <input type="text" id="form-effect-input" placeholder="Effet" class="input-md">
        <button class="btn btn-small btn-primary" data-action="add-transform">+ Forme</button>
      `;
      section.appendChild(addRow);
      break;
    }
  }
}

// ──────────── Alerts ────────────

export function renderAlerts() {
  const list = el('alerts-list');
  list.innerHTML = '';
  (state.game?.alerts || []).forEach((alert, i) => {
    const item = document.createElement('div');
    item.className = `alert-item ${alert.type}`;
    item.innerHTML = html`
      <span>${alert.text}</span>
      <button class="alert-remove" data-action="remove-alert" data-idx="${i}">${raw('&#10006;')}</button>
    `;
    list.appendChild(item);
  });
}

// ──────────── Paragraph history (rich) ────────────

export function renderParagraphs() {
  const container = el('para-history');
  container.innerHTML = '';
  const history = state.game?.paragraphHistory || [];
  const paragraphs = state.game?.paragraphs || {};

  if (history.length === 0) {
    container.innerHTML = '<p class="para-empty">Aucun paragraphe visité.</p>';
    return;
  }

  // Count run boundaries to label them
  let runNumber = 1;
  history.forEach((num, i) => {
    if (num === null) {
      runNumber++;
      const sep = document.createElement('div');
      sep.className = 'para-run-separator';
      sep.innerHTML = html`<span>── Run ${runNumber} ──</span>`;
      container.appendChild(sep);
      return;
    }
    const meta = paragraphs[num] || { sentiment: 'neutral', note: '' };
    const sentiment = meta.sentiment || 'neutral';
    const row = document.createElement('div');
    row.className = 'para-row';
    row.dataset.num = num;
    row.innerHTML = html`
      <span class="para-num">§${num}</span>
      <button class="sentiment-dot ${sentiment}" data-action="cycle-sentiment" data-num="${num}"
              title="Sentiment (clic pour changer)" aria-label="Changer sentiment"></button>
      <input type="text" class="para-note" data-action="set-para-note" data-num="${num}"
             placeholder="Note rapide…" value="${meta.note || ''}">
      <button class="para-remove" data-action="remove-para-visit" data-idx="${i}"
              title="Retirer cette visite">${raw('&#10006;')}</button>
    `;
    container.appendChild(row);
  });
}

// Backwards compat alias — some old call sites might still use the old name.
export const renderParagraphHistory = renderParagraphs;

// ──────────── Adversaries ────────────

export function renderAdversaries() {
  const list = el('adversaries-list');
  list.innerHTML = '';
  (state.game?.adversaries || []).forEach((adv, i) => {
    const card = document.createElement('div');
    card.className = `adversary-card ${adv.defeated ? 'defeated' : ''}`;
    card.innerHTML = html`
      <span class="adv-name">${adv.name}</span>
      <span class="adv-stat">HAB ${adv.skill}</span>
      <span class="adv-stat">END ${adv.stamina}/${adv.staminaMax}</span>
      <div class="adv-controls">
        <button class="btn btn-small" data-action="adv-stamina" data-idx="${i}" data-delta="-2" title="-2 END">-2</button>
        <button class="btn btn-small" data-action="adv-stamina" data-idx="${i}" data-delta="2" title="+2 END">+2</button>
        <button class="btn btn-small btn-danger" data-action="adv-remove" data-idx="${i}" title="Retirer">${raw('&#10006;')}</button>
      </div>
    `;
    list.appendChild(card);
  });
}

export function updateCombatButtons() {
  const hasLive = (state.game?.adversaries || []).some(a => !a.defeated);
  el('btn-attack').disabled = !hasLive;
  el('btn-test-luck-combat').disabled = !hasLive;
  el('btn-flee').disabled = !hasLive;
}

// ──────────── Combat log ────────────

export function appendCombatLog(entries) {
  const log = el('combat-log');
  entries.forEach(entry => {
    const div = document.createElement('div');
    div.className = `combat-log-entry ${entry.type || 'info'}`;
    div.textContent = entry.text;
    log.appendChild(div);
    if (state.game) state.game.combatLog.push({ text: entry.text, type: entry.type || 'info' });
  });
  log.scrollTop = log.scrollHeight;
}

export function clearCombatLog() {
  el('combat-log').innerHTML = '';
}

// ──────────── Inventory ────────────

export function renderInventory() {
  renderPotions();
  renderObjects();
  renderSpecialItems();
}

export function renderPotions() {
  const list = el('potions-list');
  list.innerHTML = '';
  const potions = state.game?.potions || [];
  if (potions.length === 0) {
    list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucune potion</p>';
    return;
  }
  potions.forEach((potion, i) => {
    const remaining = potion.doses - potion.used;
    const item = document.createElement('div');
    item.className = 'potion-item';
    item.innerHTML = html`
      <span class="obj-name">${potion.name}</span>
      <span class="obj-desc">${potion.effect} (${remaining} dose${raw(remaining > 1 ? 's' : '')})</span>
      <button class="potion-use btn btn-small ${raw(remaining <= 0 ? 'disabled' : 'btn-primary')}"
              data-action="use-potion" data-idx="${i}" ${raw(remaining <= 0 ? 'disabled' : '')}>
        Boire
      </button>
    `;
    list.appendChild(item);
  });
}

export function renderObjects() {
  const list = el('objects-list');
  list.innerHTML = '';
  const objects = state.game?.objects || [];
  if (objects.length === 0) {
    list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucun objet</p>';
    return;
  }
  objects.forEach((obj, i) => {
    const item = document.createElement('div');
    item.className = 'object-item';
    item.innerHTML = html`
      <span class="obj-name">${obj.name}</span>
      ${obj.desc ? raw(`<span class="obj-desc">${escapeHtml(obj.desc)}</span>`) : ''}
      <button class="obj-remove" data-action="remove-object" data-idx="${i}">${raw('&#10006;')}</button>
    `;
    list.appendChild(item);
  });
}

export function renderSpecialItems() {
  const section = el('special-items-section');
  const config = resolveConfig(state.game);
  if (!config?.special) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  el('special-items-title').textContent = 'Objets Spéciaux';
  const list = el('special-items-list');
  list.innerHTML = '';
  const items = state.game?.specialItems || [];
  if (items.length === 0) {
    list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucun objet spécial</p>';
    return;
  }
  items.forEach((item, i) => {
    const el2 = document.createElement('div');
    el2.className = 'object-item';
    el2.innerHTML = html`
      <span class="obj-name">${item.name}</span>
      <button class="obj-remove" data-action="remove-special-item" data-idx="${i}">${raw('&#10006;')}</button>
    `;
    list.appendChild(el2);
  });
}

// ──────────── Dice overlay ────────────

export function showDiceRoll(rolls, text) {
  const overlay = el('dice-overlay');
  const display = el('dice-display');
  const resultText = el('dice-result-text');

  display.innerHTML = '';
  rolls.forEach(val => {
    const die = document.createElement('div');
    die.className = 'die';
    die.textContent = val;
    display.appendChild(die);
  });

  const total = rolls.reduce((s, v) => s + v, 0);
  resultText.innerHTML = html`<div style="font-size:1.4rem;margin-bottom:0.5rem;">Total : ${total}</div>${text}`;
  overlay.classList.remove('hidden');
}

export function closeDiceOverlay() {
  el('dice-overlay').classList.add('hidden');
}

// ──────────── Game menu ────────────

export function openGameMenu() {
  el('game-menu-overlay').classList.remove('hidden');
}

export function closeGameMenu() {
  el('game-menu-overlay').classList.add('hidden');
}

// ──────────── Save confirmation flash ────────────

export function showSaveConfirmation() {
  const btn = el('btn-save');
  const original = btn.innerHTML;
  btn.innerHTML = '&#10004; Sauvé !';
  btn.style.background = 'var(--success)';
  setTimeout(() => {
    btn.innerHTML = original;
    btn.style.background = '';
  }, 1500);
}

// ──────────── Saves list ────────────

export function renderSavesList() {
  const saves = getSaves();
  const list = el('saves-list');
  const noSaves = el('no-saves');
  list.innerHTML = '';

  if (saves.length === 0) {
    noSaves.classList.remove('hidden');
    return;
  }
  noSaves.classList.add('hidden');

  const sorted = [...saves].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  sorted.forEach((save) => {
    const originalIdx = saves.indexOf(save);
    const date = save.timestamp ? new Date(save.timestamp).toLocaleString('fr-FR') : 'Date inconnue';
    const advType = getAdventureType(save.adventureType);
    const advName = advType ? advType.name : save.adventureType;

    const runBadge = save.runCount && save.runCount > 1
      ? raw(` <span class="save-run-badge" title="Numéro de run">Run ${save.runCount}</span>`)
      : '';

    const card = document.createElement('div');
    card.className = 'save-card';
    card.dataset.action = 'load-save';
    card.dataset.idx = originalIdx;
    card.innerHTML = html`
      <div class="save-info">
        <div class="save-hero">${save.heroName}${runBadge}</div>
        <div class="save-detail">${advName}${raw(save.bookTitle ? ' - ' + escapeHtml(save.bookTitle) : '')}</div>
        <div class="save-detail">§${save.currentParagraph} · ${date}</div>
      </div>
      <div class="save-actions">
        <button class="btn btn-small save-new-run" data-action="new-run-from-save" data-idx="${originalIdx}" title="Nouvelle run (reset perso, garde la carte)">${raw('&#x21BB;')} New run</button>
        <button class="save-delete" data-action="delete-save" data-idx="${originalIdx}" title="Supprimer">${raw('&#128465;')}</button>
      </div>
    `;
    list.appendChild(card);
  });
}
