/* ============================================
   LDVELH - Compagnon d'Aventure
   Moteur JavaScript
   ============================================ */

// ---- Définitions des types d'aventures ----
const ADVENTURE_TYPES = [
    {
        id: 'defis_fantastiques',
        name: 'Défis Fantastiques',
        description: 'La série classique (Le Sorcier de la Montagne de Feu, La Citadelle du Chaos, etc.)',
        statPreview: 'HABILETÉ (1D6+6) · ENDURANCE (2D6+12) · CHANCE (1D6+6)',
        stats: [
            { key: 'habilete', name: 'Habileté', dice: 1, bonus: 6 },
            { key: 'endurance', name: 'Endurance', dice: 2, bonus: 12 },
            { key: 'chance', name: 'Chance', dice: 1, bonus: 6 }
        ],
        combatSkill: 'habilete',
        combatStamina: 'endurance',
        hasProvisions: true,
        defaultProvisions: 10,
        potions: [
            { name: 'Potion d\'Adresse', effect: 'Restaure Habileté initiale', stat: 'habilete', doses: 2 },
            { name: 'Potion de Vigueur', effect: 'Restaure Endurance initiale', stat: 'endurance', doses: 2 },
            { name: 'Potion de Bonne Fortune', effect: 'Restaure Chance initiale + 1', stat: 'chance', doses: 2 }
        ],
        mealRestore: 4,
        special: null
    },
    {
        id: 'sorcellerie',
        name: 'Sorcellerie!',
        description: 'La saga épique de Steve Jackson (Les Collines Maléfiques, La Cité des Pièges, etc.)',
        statPreview: 'HABILETÉ (1D6+6) · ENDURANCE (2D6+12) · CHANCE (1D6+6) · MAGIE',
        stats: [
            { key: 'habilete', name: 'Habileté', dice: 1, bonus: 6 },
            { key: 'endurance', name: 'Endurance', dice: 2, bonus: 12 },
            { key: 'chance', name: 'Chance', dice: 1, bonus: 6 }
        ],
        combatSkill: 'habilete',
        combatStamina: 'endurance',
        hasProvisions: true,
        defaultProvisions: 10,
        potions: [],
        mealRestore: 4,
        special: {
            title: 'Magie',
            type: 'spells',
            description: 'Notez vos sorts connus et leurs coûts en ENDURANCE'
        }
    },
    {
        id: 'loup_solitaire',
        name: 'Loup Solitaire',
        description: 'Les aventures du dernier des Seigneurs Kaï (Les Maîtres des Ténèbres, etc.)',
        statPreview: 'COMBAT (1D10+10) · ENDURANCE (20+1D10) · Disciplines Kaï',
        stats: [
            { key: 'combat', name: 'Habileté au Combat', dice: 1, bonus: 10, diceType: 10 },
            { key: 'endurance', name: 'Endurance', dice: 1, bonus: 20, diceType: 10 }
        ],
        combatSkill: 'combat',
        combatStamina: 'endurance',
        hasProvisions: true,
        defaultProvisions: 3,
        potions: [],
        mealRestore: 0,
        special: {
            title: 'Disciplines Kaï',
            type: 'checklist',
            items: ['Camouflage', 'Chasse', 'Sixième Sens', 'Orientation', 'Guérison',
                     'Maîtrise des Armes', 'Bouclier Psychique', 'Puissance Psychique',
                     'Communication Animale', 'Maîtrise du Corps'],
            maxChoices: 5,
            description: 'Choisissez 5 Disciplines Kaï'
        }
    },
    {
        id: 'quete_graal',
        name: 'Quête du Graal',
        description: 'Aventures arthuriennes (Le Château des Ténèbres, etc.)',
        statPreview: 'HABILETÉ (1D6+6) · ENDURANCE (2D6+12) · CHANCE (1D6+6) · HONNEUR',
        stats: [
            { key: 'habilete', name: 'Habileté', dice: 1, bonus: 6 },
            { key: 'endurance', name: 'Endurance', dice: 2, bonus: 12 },
            { key: 'chance', name: 'Chance', dice: 1, bonus: 6 }
        ],
        combatSkill: 'habilete',
        combatStamina: 'endurance',
        hasProvisions: true,
        defaultProvisions: 10,
        potions: [],
        mealRestore: 4,
        special: {
            title: 'Honneur',
            type: 'counter',
            initial: 6,
            description: 'Points d\'Honneur du chevalier'
        }
    },
    {
        id: 'dragon_or',
        name: 'Dragon d\'Or',
        description: 'Série héroïque-fantasy avec métamorphoses (Le Fléau de la Plaine Ardente, etc.)',
        statPreview: 'VIGUEUR (2D6+12) · PSY (2D6+6) · AGILITÉ (1D6+6)',
        stats: [
            { key: 'vigueur', name: 'Vigueur', dice: 2, bonus: 12 },
            { key: 'psy', name: 'Psy', dice: 2, bonus: 6 },
            { key: 'agilite', name: 'Agilité', dice: 1, bonus: 6 }
        ],
        combatSkill: 'agilite',
        combatStamina: 'vigueur',
        hasProvisions: false,
        defaultProvisions: 0,
        potions: [],
        mealRestore: 0,
        special: {
            title: 'Métamorphose',
            type: 'transform',
            description: 'Formes alternatives et pouvoirs de transformation'
        }
    },
    {
        id: 'loup_ardent',
        name: 'Loup* Ardent / Chroniques Crétoises',
        description: 'Aventures mythologiques et autres séries',
        statPreview: 'HABILETÉ (1D6+6) · ENDURANCE (2D6+12) · CHANCE (1D6+6) · POUVOIR',
        stats: [
            { key: 'habilete', name: 'Habileté', dice: 1, bonus: 6 },
            { key: 'endurance', name: 'Endurance', dice: 2, bonus: 12 },
            { key: 'chance', name: 'Chance', dice: 1, bonus: 6 }
        ],
        combatSkill: 'habilete',
        combatStamina: 'endurance',
        hasProvisions: true,
        defaultProvisions: 10,
        potions: [],
        mealRestore: 4,
        special: {
            title: 'Pouvoir Spécial',
            type: 'power',
            description: 'Points de pouvoir magique ou divin'
        }
    },
    {
        id: 'custom',
        name: 'Personnalisé',
        description: 'Configurez vos propres caractéristiques pour n\'importe quel livre-jeu',
        statPreview: 'Caractéristiques libres',
        stats: [
            { key: 'stat1', name: 'Caractéristique 1', dice: 1, bonus: 6, editable: true },
            { key: 'stat2', name: 'Caractéristique 2', dice: 2, bonus: 12, editable: true },
            { key: 'stat3', name: 'Caractéristique 3', dice: 1, bonus: 6, editable: true }
        ],
        combatSkill: 'stat1',
        combatStamina: 'stat2',
        hasProvisions: true,
        defaultProvisions: 10,
        potions: [],
        mealRestore: 4,
        special: {
            title: 'Spécial',
            type: 'counter',
            initial: 0,
            description: 'Compteur spécial personnalisable'
        }
    }
];

// ---- État du jeu ----
let gameState = null;

// ---- Utilitaires Dés ----
function rollDie(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

function rollDice(count, sides = 6) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(rollDie(sides));
    }
    return results;
}

function rollStat(statDef) {
    const sides = statDef.diceType || 6;
    const rolls = rollDice(statDef.dice, sides);
    const total = rolls.reduce((s, v) => s + v, 0) + statDef.bonus;
    return { rolls, total };
}

// ---- Navigation écrans ----
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ---- Initialisation ----
document.addEventListener('DOMContentLoaded', () => {
    // Boutons écran d'accueil
    document.getElementById('btn-new-game').addEventListener('click', () => {
        showScreen('screen-adventure-select');
        renderAdventureGrid();
    });

    document.getElementById('btn-load-game').addEventListener('click', () => {
        showScreen('screen-load');
        renderSavesList();
    });

    document.getElementById('btn-back-home').addEventListener('click', () => showScreen('screen-home'));
    document.getElementById('btn-back-home-load').addEventListener('click', () => showScreen('screen-home'));
    document.getElementById('btn-back-adventure').addEventListener('click', () => showScreen('screen-adventure-select'));

    // Onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Sauvegarde
    document.getElementById('btn-save').addEventListener('click', saveGame);
    document.getElementById('btn-menu-save').addEventListener('click', () => { saveGame(); closeGameMenu(); });

    // Menu
    document.getElementById('btn-game-menu').addEventListener('click', openGameMenu);
    document.getElementById('btn-menu-close').addEventListener('click', closeGameMenu);
    document.getElementById('btn-menu-quit').addEventListener('click', () => {
        if (confirm('Quitter l\'aventure ? (Pensez à sauvegarder !)')) {
            gameState = null;
            showScreen('screen-home');
            closeGameMenu();
        }
    });

    // Dés depuis menu
    document.getElementById('btn-menu-dice').addEventListener('click', () => {
        closeGameMenu();
        showDiceRoll(rollDice(2), 'Lancer libre : 2D6');
    });

    document.getElementById('btn-menu-test-luck').addEventListener('click', () => {
        closeGameMenu();
        testLuck();
    });

    document.getElementById('btn-dice-close').addEventListener('click', closeDiceOverlay);

    // Alertes
    document.getElementById('btn-add-alert').addEventListener('click', addAlert);
    document.getElementById('alert-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') addAlert();
    });

    // Paragraphe
    document.getElementById('current-para').addEventListener('change', onParagraphChange);
    document.getElementById('btn-para-history').addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="tab-notes"]').classList.add('active');
        document.getElementById('tab-notes').classList.add('active');
    });

    // Combat
    document.getElementById('btn-add-adversary').addEventListener('click', addAdversary);
    document.getElementById('btn-attack').addEventListener('click', combatRound);
    document.getElementById('btn-test-luck-combat').addEventListener('click', testLuckCombat);
    document.getElementById('btn-flee').addEventListener('click', fleeCombat);
    document.getElementById('btn-clear-combat-log').addEventListener('click', () => {
        document.getElementById('combat-log').innerHTML = '';
    });

    // Inventaire
    document.getElementById('btn-gold-plus').addEventListener('click', () => adjustGold(1));
    document.getElementById('btn-gold-minus').addEventListener('click', () => adjustGold(-1));
    document.getElementById('gold-amount').addEventListener('change', onGoldChange);

    document.getElementById('btn-prov-plus').addEventListener('click', () => adjustProvisions(1));
    document.getElementById('btn-prov-minus').addEventListener('click', () => adjustProvisions(-1));
    document.getElementById('btn-eat').addEventListener('click', eatMeal);
    document.getElementById('provisions-amount').addEventListener('change', onProvisionsChange);

    document.getElementById('btn-add-object').addEventListener('click', addObject);
    document.getElementById('object-name').addEventListener('keypress', e => {
        if (e.key === 'Enter') addObject();
    });

    document.getElementById('btn-add-special-item').addEventListener('click', addSpecialItem);

    // Notes auto-save
    document.getElementById('game-notes').addEventListener('input', () => {
        if (gameState) gameState.notes = document.getElementById('game-notes').value;
    });

    // Démarrer aventure
    document.getElementById('btn-start-adventure').addEventListener('click', startAdventure);
});

// ---- Grille des aventures ----
function renderAdventureGrid() {
    const grid = document.getElementById('adventure-grid');
    grid.innerHTML = '';
    ADVENTURE_TYPES.forEach(adv => {
        const card = document.createElement('div');
        card.className = 'adventure-card';
        card.innerHTML = `
            <h3>${adv.name}</h3>
            <p>${adv.description}</p>
            <div class="stat-preview">${adv.statPreview}</div>
        `;
        card.addEventListener('click', () => selectAdventure(adv));
        grid.appendChild(card);
    });
}

// ---- Sélection aventure → Création perso ----
let selectedAdventure = null;
let rolledStats = {};

function selectAdventure(adv) {
    selectedAdventure = adv;
    rolledStats = {};
    showScreen('screen-char-create');

    document.getElementById('char-create-title').textContent = adv.name;
    document.getElementById('char-create-info').textContent = adv.description;
    document.getElementById('hero-name').value = '';
    document.getElementById('book-title').value = '';

    renderStatsCreation();
}

function renderStatsCreation() {
    const container = document.getElementById('stats-creation');
    container.innerHTML = '<h3 style="font-family:var(--font-title);margin-bottom:0.8rem;">Caractéristiques</h3>';

    selectedAdventure.stats.forEach(stat => {
        const sides = stat.diceType || 6;
        const formula = `${stat.dice}D${sides}+${stat.bonus}`;
        const rolled = rolledStats[stat.key];

        const row = document.createElement('div');
        row.className = 'stat-roll-row';

        if (stat.editable) {
            row.innerHTML = `
                <input type="text" class="input-sm stat-custom-name" data-key="${stat.key}"
                       value="${stat.name}" placeholder="Nom">
                <span class="stat-formula">
                    <select class="input-xs" data-dice-key="${stat.key}">
                        <option value="1" ${stat.dice===1?'selected':''}>1D</option>
                        <option value="2" ${stat.dice===2?'selected':''}>2D</option>
                    </select>
                    <select class="input-xs" data-sides-key="${stat.key}">
                        <option value="6" ${sides===6?'selected':''}>D6</option>
                        <option value="10" ${sides===10?'selected':''}>D10</option>
                    </select>
                    +<input type="number" class="input-xs" data-bonus-key="${stat.key}"
                            value="${stat.bonus}" min="0" max="30">
                </span>
                <span class="stat-value">${rolled ? rolled.total : '?'}</span>
                <button class="btn btn-small btn-primary btn-roll-stat" data-key="${stat.key}">
                    &#127922; Lancer
                </button>
            `;
        } else {
            row.innerHTML = `
                <span class="stat-label">${stat.name}</span>
                <span class="stat-formula">(${formula})</span>
                <span class="stat-value">${rolled ? rolled.total : '?'}</span>
                <button class="btn btn-small btn-primary btn-roll-stat" data-key="${stat.key}">
                    &#127922; Lancer
                </button>
            `;
        }

        container.appendChild(row);
    });

    // Bouton tout lancer
    const allBtn = document.createElement('button');
    allBtn.className = 'btn btn-secondary';
    allBtn.style.marginTop = '0.5rem';
    allBtn.innerHTML = '&#127922; Tout Lancer';
    allBtn.addEventListener('click', rollAllStats);
    container.appendChild(allBtn);

    // Event listeners pour les boutons de lancer individuels
    container.querySelectorAll('.btn-roll-stat').forEach(btn => {
        btn.addEventListener('click', () => rollOneStat(btn.dataset.key));
    });
}

function getStatDef(key) {
    const stat = selectedAdventure.stats.find(s => s.key === key);
    if (!stat) return null;

    if (stat.editable) {
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
                bonus: parseInt(bonusInput.value) || 0
            };
        }
    }
    return stat;
}

function rollOneStat(key) {
    const statDef = getStatDef(key);
    if (!statDef) return;
    const result = rollStat(statDef);
    rolledStats[key] = result;

    // Mise à jour de l'affichage
    const rows = document.querySelectorAll('.stat-roll-row');
    rows.forEach(row => {
        const btn = row.querySelector(`.btn-roll-stat[data-key="${key}"]`);
        if (btn) {
            row.querySelector('.stat-value').textContent = result.total;
            row.querySelector('.stat-value').style.animation = 'none';
            void row.querySelector('.stat-value').offsetHeight;
            row.querySelector('.stat-value').style.animation = 'diceRoll 0.4s ease-out';
        }
    });
}

function rollAllStats() {
    selectedAdventure.stats.forEach(stat => {
        rollOneStat(stat.key);
    });
}

// ---- Démarrer l'aventure ----
function startAdventure() {
    // Vérifier que tous les stats sont lancés
    const allRolled = selectedAdventure.stats.every(s => rolledStats[s.key]);
    if (!allRolled) {
        alert('Lancez tous les dés avant de commencer !');
        return;
    }

    const heroName = document.getElementById('hero-name').value.trim() || 'Héros Sans Nom';
    const bookTitle = document.getElementById('book-title').value.trim();

    // Construire les stats avec noms personnalisés
    const stats = {};
    const statsMax = {};
    const statDefs = [];

    selectedAdventure.stats.forEach(s => {
        const def = getStatDef(s.key);
        stats[s.key] = rolledStats[s.key].total;
        statsMax[s.key] = rolledStats[s.key].total;
        statDefs.push(def);
    });

    // Préparer les potions (choix d'une potion pour Défis Fantastiques)
    let potions = [];
    if (selectedAdventure.potions && selectedAdventure.potions.length > 0) {
        potions = selectedAdventure.potions.map(p => ({ ...p, used: 0 }));
    }

    // État initial du jeu
    gameState = {
        adventureType: selectedAdventure.id,
        adventureConfig: { ...selectedAdventure, stats: statDefs },
        heroName,
        bookTitle,
        stats,
        statsMax,
        gold: 0,
        provisions: selectedAdventure.defaultProvisions,
        potions,
        objects: [],
        specialItems: [],
        alerts: [],
        notes: '',
        currentParagraph: 1,
        paragraphHistory: [1],
        adversaries: [],
        combatLog: [],
        special: {},
        timestamp: Date.now()
    };

    // Initialiser les données spéciales
    if (selectedAdventure.special) {
        switch (selectedAdventure.special.type) {
            case 'counter':
                gameState.special.value = selectedAdventure.special.initial || 0;
                break;
            case 'checklist':
                gameState.special.selected = [];
                break;
            case 'spells':
                gameState.special.spells = [];
                break;
            case 'transform':
                gameState.special.forms = [];
                gameState.special.currentForm = 'Humain';
                break;
            case 'power':
                gameState.special.value = 0;
                break;
        }
    }

    showScreen('screen-game');
    renderGameScreen();
}

// ---- Rendu écran de jeu ----
function renderGameScreen() {
    if (!gameState) return;

    document.getElementById('game-hero-name').textContent = gameState.heroName;
    document.getElementById('game-book-title').textContent = gameState.bookTitle || '';

    renderStats();
    renderSpecialSection();
    renderAlerts();
    renderAdversaries();
    renderInventory();
    renderParagraphHistory();

    document.getElementById('current-para').value = gameState.currentParagraph;
    document.getElementById('game-notes').value = gameState.notes || '';
    document.getElementById('gold-amount').value = gameState.gold;
    document.getElementById('provisions-amount').value = gameState.provisions;

    updateCombatButtons();
}

function renderStats() {
    const panel = document.getElementById('game-stats-panel');
    panel.innerHTML = '';

    const config = gameState.adventureConfig;
    config.stats.forEach(statDef => {
        const current = gameState.stats[statDef.key];
        const max = gameState.statsMax[statDef.key];
        const ratio = current / max;

        const card = document.createElement('div');
        card.className = 'stat-card';
        if (ratio <= 0.25) card.classList.add('stat-danger');
        else if (ratio <= 0.5) card.classList.add('stat-warning');

        card.innerHTML = `
            <div class="stat-name">${statDef.name}</div>
            <div class="stat-current" id="stat-val-${statDef.key}">${current}</div>
            <div class="stat-max">/ ${max}</div>
            <div class="stat-controls">
                <button class="btn btn-small" onclick="adjustStat('${statDef.key}', -1)">-</button>
                <button class="btn btn-small" onclick="adjustStat('${statDef.key}', 1)">+</button>
            </div>
        `;
        panel.appendChild(card);
    });
}

function adjustStat(key, delta) {
    if (!gameState) return;
    const newVal = gameState.stats[key] + delta;
    if (newVal < 0) return;
    if (newVal > gameState.statsMax[key]) {
        gameState.stats[key] = gameState.statsMax[key];
    } else {
        gameState.stats[key] = newVal;
    }

    // Vérifier la mort
    const config = gameState.adventureConfig;
    if (key === config.combatStamina && gameState.stats[key] <= 0) {
        gameState.stats[key] = 0;
        alert('Votre héros est mort ! Son endurance est tombée à 0.');
    }

    renderStats();
}

// ---- Section spéciale ----
function renderSpecialSection() {
    const section = document.getElementById('special-section');
    const config = gameState.adventureConfig;

    if (!config.special) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    section.innerHTML = `<h3>${config.special.title}</h3>`;

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:0.85rem;color:var(--ink-light);font-style:italic;margin-bottom:0.5rem;';
    desc.textContent = config.special.description;
    section.appendChild(desc);

    switch (config.special.type) {
        case 'counter':
        case 'power': {
            const row = document.createElement('div');
            row.className = 'special-stat-row';
            row.innerHTML = `
                <label>${config.special.title}</label>
                <button class="btn btn-small" onclick="adjustSpecialCounter(-1)">-</button>
                <input type="number" id="special-counter" value="${gameState.special.value || 0}"
                       onchange="gameState.special.value = parseInt(this.value) || 0">
                <button class="btn btn-small" onclick="adjustSpecialCounter(1)">+</button>
            `;
            section.appendChild(row);
            break;
        }
        case 'checklist': {
            const maxC = config.special.maxChoices || config.special.items.length;
            const info = document.createElement('div');
            info.style.cssText = 'font-size:0.85rem;margin-bottom:0.5rem;';
            info.textContent = `Sélectionnées : ${(gameState.special.selected || []).length} / ${maxC}`;
            section.appendChild(info);

            config.special.items.forEach(item => {
                const isSelected = (gameState.special.selected || []).includes(item);
                const label = document.createElement('label');
                label.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;cursor:pointer;';
                label.innerHTML = `
                    <input type="checkbox" ${isSelected ? 'checked' : ''}
                           onchange="toggleChecklistItem('${item}', this.checked, ${maxC})">
                    <span>${item}</span>
                `;
                section.appendChild(label);
            });
            break;
        }
        case 'spells': {
            const list = document.createElement('div');
            (gameState.special.spells || []).forEach((spell, i) => {
                const item = document.createElement('div');
                item.className = 'object-item';
                item.innerHTML = `
                    <span class="obj-name">${spell.name}</span>
                    <span class="obj-desc">Coût: ${spell.cost || '?'} END</span>
                    <button class="obj-remove" onclick="removeSpell(${i})">&#10006;</button>
                `;
                list.appendChild(item);
            });
            section.appendChild(list);

            const addRow = document.createElement('div');
            addRow.className = 'add-object';
            addRow.innerHTML = `
                <input type="text" id="spell-name-input" placeholder="Nom du sort" class="input-md">
                <input type="number" id="spell-cost-input" placeholder="Coût" class="input-xs" min="1">
                <button class="btn btn-small btn-primary" onclick="addSpell()">+ Sort</button>
            `;
            section.appendChild(addRow);
            break;
        }
        case 'transform': {
            const formRow = document.createElement('div');
            formRow.className = 'special-stat-row';
            formRow.innerHTML = `
                <label>Forme actuelle :</label>
                <input type="text" id="current-form" value="${gameState.special.currentForm || 'Humain'}"
                       onchange="gameState.special.currentForm = this.value" class="input-sm">
            `;
            section.appendChild(formRow);

            const formsList = document.createElement('div');
            formsList.style.marginTop = '0.5rem';
            (gameState.special.forms || []).forEach((form, i) => {
                const item = document.createElement('div');
                item.className = 'object-item';
                item.innerHTML = `
                    <span class="obj-name">${form.name}</span>
                    <span class="obj-desc">${form.effect || ''}</span>
                    <button class="btn btn-small" onclick="gameState.special.currentForm='${form.name}';renderSpecialSection();">Activer</button>
                    <button class="obj-remove" onclick="removeTransform(${i})">&#10006;</button>
                `;
                formsList.appendChild(item);
            });
            section.appendChild(formsList);

            const addRow = document.createElement('div');
            addRow.className = 'add-object';
            addRow.innerHTML = `
                <input type="text" id="form-name-input" placeholder="Nom de la forme" class="input-sm">
                <input type="text" id="form-effect-input" placeholder="Effet" class="input-md">
                <button class="btn btn-small btn-primary" onclick="addTransformForm()">+ Forme</button>
            `;
            section.appendChild(addRow);
            break;
        }
    }
}

function adjustSpecialCounter(delta) {
    if (!gameState) return;
    gameState.special.value = (gameState.special.value || 0) + delta;
    if (gameState.special.value < 0) gameState.special.value = 0;
    document.getElementById('special-counter').value = gameState.special.value;
}

function toggleChecklistItem(item, checked, max) {
    if (!gameState.special.selected) gameState.special.selected = [];
    if (checked) {
        if (gameState.special.selected.length >= max) {
            alert(`Vous ne pouvez choisir que ${max} éléments.`);
            renderSpecialSection();
            return;
        }
        gameState.special.selected.push(item);
    } else {
        gameState.special.selected = gameState.special.selected.filter(i => i !== item);
    }
    renderSpecialSection();
}

function addSpell() {
    const name = document.getElementById('spell-name-input').value.trim();
    const cost = parseInt(document.getElementById('spell-cost-input').value) || 0;
    if (!name) return;
    if (!gameState.special.spells) gameState.special.spells = [];
    gameState.special.spells.push({ name, cost });
    renderSpecialSection();
}

function removeSpell(idx) {
    gameState.special.spells.splice(idx, 1);
    renderSpecialSection();
}

function addTransformForm() {
    const name = document.getElementById('form-name-input').value.trim();
    const effect = document.getElementById('form-effect-input').value.trim();
    if (!name) return;
    if (!gameState.special.forms) gameState.special.forms = [];
    gameState.special.forms.push({ name, effect });
    renderSpecialSection();
}

function removeTransform(idx) {
    gameState.special.forms.splice(idx, 1);
    renderSpecialSection();
}

// ---- Alertes ----
function renderAlerts() {
    const list = document.getElementById('alerts-list');
    list.innerHTML = '';
    (gameState.alerts || []).forEach((alert, i) => {
        const item = document.createElement('div');
        item.className = `alert-item ${alert.type}`;
        item.innerHTML = `
            <span>${alert.text}</span>
            <button class="alert-remove" onclick="removeAlert(${i})">&#10006;</button>
        `;
        list.appendChild(item);
    });
}

function addAlert() {
    const input = document.getElementById('alert-input');
    const type = document.getElementById('alert-type').value;
    const text = input.value.trim();
    if (!text || !gameState) return;

    gameState.alerts.push({ text, type });
    input.value = '';
    renderAlerts();
}

function removeAlert(idx) {
    gameState.alerts.splice(idx, 1);
    renderAlerts();
}

// ---- Paragraphe ----
function onParagraphChange() {
    if (!gameState) return;
    const val = parseInt(document.getElementById('current-para').value) || 1;
    gameState.currentParagraph = val;
    if (!gameState.paragraphHistory.includes(val)) {
        gameState.paragraphHistory.push(val);
    }
    renderParagraphHistory();
}

function renderParagraphHistory() {
    const container = document.getElementById('para-history');
    container.innerHTML = '';
    (gameState.paragraphHistory || []).forEach(p => {
        const entry = document.createElement('span');
        entry.className = 'para-entry';
        entry.textContent = `§${p}`;
        container.appendChild(entry);
    });
}

// ---- Combat ----
function addAdversary() {
    const name = document.getElementById('adv-name').value.trim();
    const skill = parseInt(document.getElementById('adv-skill').value);
    const stamina = parseInt(document.getElementById('adv-stamina').value);

    if (!name || isNaN(skill) || isNaN(stamina)) {
        alert('Remplissez le nom, l\'habileté et l\'endurance de l\'adversaire.');
        return;
    }

    if (!gameState) return;

    gameState.adversaries.push({
        name,
        skill,
        skillMax: skill,
        stamina,
        staminaMax: stamina,
        defeated: false
    });

    document.getElementById('adv-name').value = '';
    document.getElementById('adv-skill').value = '';
    document.getElementById('adv-stamina').value = '';

    renderAdversaries();
    updateCombatButtons();
}

function renderAdversaries() {
    const list = document.getElementById('adversaries-list');
    list.innerHTML = '';

    (gameState.adversaries || []).forEach((adv, i) => {
        const card = document.createElement('div');
        card.className = `adversary-card ${adv.defeated ? 'defeated' : ''}`;
        card.innerHTML = `
            <span class="adv-name">${adv.name}</span>
            <span class="adv-stat">HAB ${adv.skill}</span>
            <span class="adv-stat">END ${adv.stamina}/${adv.staminaMax}</span>
            <div class="adv-controls">
                <button class="btn btn-small" onclick="adjustAdvStamina(${i}, -2)" title="-2 END">-2</button>
                <button class="btn btn-small" onclick="adjustAdvStamina(${i}, 2)" title="+2 END">+2</button>
                <button class="btn btn-small btn-danger" onclick="removeAdversary(${i})" title="Retirer">&#10006;</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function adjustAdvStamina(idx, delta) {
    const adv = gameState.adversaries[idx];
    if (!adv || adv.defeated) return;
    adv.stamina = Math.max(0, adv.stamina + delta);
    if (adv.stamina <= 0) {
        adv.defeated = true;
        adv.stamina = 0;
        addCombatLog(`${adv.name} est vaincu !`, 'critical');
    }
    renderAdversaries();
    updateCombatButtons();
}

function removeAdversary(idx) {
    gameState.adversaries.splice(idx, 1);
    renderAdversaries();
    updateCombatButtons();
}

function updateCombatButtons() {
    const hasLiveAdv = (gameState.adversaries || []).some(a => !a.defeated);
    document.getElementById('btn-attack').disabled = !hasLiveAdv;
    document.getElementById('btn-test-luck-combat').disabled = !hasLiveAdv;
    document.getElementById('btn-flee').disabled = !hasLiveAdv;
}

function addCombatLog(text, type = 'info') {
    const log = document.getElementById('combat-log');
    const entry = document.createElement('div');
    entry.className = `combat-log-entry ${type}`;
    entry.textContent = text;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    if (gameState) {
        gameState.combatLog.push({ text, type });
    }
}

let lastCombatResult = null;

function combatRound() {
    if (!gameState) return;
    const config = gameState.adventureConfig;

    const liveAdversaries = gameState.adversaries.filter(a => !a.defeated);
    if (liveAdversaries.length === 0) return;

    // Contre chaque adversaire vivant
    liveAdversaries.forEach(adv => {
        const heroRolls = rollDice(2);
        const heroTotal = heroRolls[0] + heroRolls[1] + gameState.stats[config.combatSkill];
        const advRolls = rollDice(2);
        const advTotal = advRolls[0] + advRolls[1] + adv.skill;

        addCombatLog(`--- Tour contre ${adv.name} ---`, 'info');
        addCombatLog(`Vous : ${heroRolls.join('+')}+${gameState.stats[config.combatSkill]} = ${heroTotal}`, 'info');
        addCombatLog(`${adv.name} : ${advRolls.join('+')}+${adv.skill} = ${advTotal}`, 'info');

        if (heroTotal > advTotal) {
            adv.stamina -= 2;
            lastCombatResult = { hit: 'hero', adversary: adv };
            addCombatLog(`Vous touchez ${adv.name} ! (-2 END, reste ${Math.max(0, adv.stamina)})`, 'miss');
            if (adv.stamina <= 0) {
                adv.stamina = 0;
                adv.defeated = true;
                addCombatLog(`${adv.name} est vaincu !`, 'critical');
            }
        } else if (advTotal > heroTotal) {
            gameState.stats[config.combatStamina] -= 2;
            lastCombatResult = { hit: 'adversary', adversary: adv };
            addCombatLog(`${adv.name} vous touche ! (-2 END, reste ${Math.max(0, gameState.stats[config.combatStamina])})`, 'hit');
            if (gameState.stats[config.combatStamina] <= 0) {
                gameState.stats[config.combatStamina] = 0;
                addCombatLog(`Votre héros est mort au combat !`, 'critical');
            }
        } else {
            lastCombatResult = null;
            addCombatLog(`Égalité ! Les lames s'entrechoquent sans résultat.`, 'info');
        }
    });

    renderStats();
    renderAdversaries();
    updateCombatButtons();

    // Vérifier si tous les adversaires sont vaincus
    if (gameState.adversaries.every(a => a.defeated)) {
        addCombatLog('=== VICTOIRE ! Tous les adversaires sont vaincus ! ===', 'critical');
    }
}

function testLuckCombat() {
    if (!gameState || !lastCombatResult) {
        addCombatLog('Tentez votre chance après un round de combat.', 'info');
        return;
    }

    const config = gameState.adventureConfig;
    const luckKey = config.stats.find(s => s.name.toLowerCase().includes('chance'));
    if (!luckKey) {
        addCombatLog('Pas de caractéristique Chance dans cette aventure.', 'info');
        return;
    }

    const luckStat = luckKey.key;
    const currentLuck = gameState.stats[luckStat];
    const rolls = rollDice(2);
    const total = rolls[0] + rolls[1];
    const lucky = total <= currentLuck;

    // Diminuer la chance
    gameState.stats[luckStat] = Math.max(0, gameState.stats[luckStat] - 1);

    if (lastCombatResult.hit === 'hero') {
        // Héros a touché
        if (lucky) {
            lastCombatResult.adversary.stamina -= 2; // 2 dégâts supplémentaires
            addCombatLog(`Chanceux ! (${total} ≤ ${currentLuck}) Coup dévastateur ! (-2 END supplémentaires à ${lastCombatResult.adversary.name})`, 'miss');
        } else {
            lastCombatResult.adversary.stamina += 1; // réduit les dégâts
            addCombatLog(`Malchanceux ! (${total} > ${currentLuck}) Coup amorti. (+1 END à ${lastCombatResult.adversary.name})`, 'hit');
        }
    } else {
        // Adversaire a touché
        if (lucky) {
            gameState.stats[config.combatStamina] += 1; // réduit les dégâts
            addCombatLog(`Chanceux ! (${total} ≤ ${currentLuck}) Vous esquivez partiellement. (+1 END)`, 'miss');
        } else {
            gameState.stats[config.combatStamina] -= 1; // dégâts supplémentaires
            addCombatLog(`Malchanceux ! (${total} > ${currentLuck}) Le coup est plus grave ! (-1 END supplémentaire)`, 'hit');
        }
    }

    // Vérifier défaite
    if (lastCombatResult.adversary.stamina <= 0) {
        lastCombatResult.adversary.stamina = 0;
        lastCombatResult.adversary.defeated = true;
        addCombatLog(`${lastCombatResult.adversary.name} est vaincu !`, 'critical');
    }
    if (gameState.stats[config.combatStamina] <= 0) {
        gameState.stats[config.combatStamina] = 0;
        addCombatLog(`Votre héros est mort au combat !`, 'critical');
    }

    lastCombatResult = null;
    renderStats();
    renderAdversaries();
    updateCombatButtons();
}

function fleeCombat() {
    if (!gameState) return;
    const config = gameState.adventureConfig;

    // Le héros subit 2 points de dégâts en fuyant
    gameState.stats[config.combatStamina] -= 2;
    addCombatLog(`Vous prenez la fuite ! (-2 END pour la fuite, reste ${Math.max(0, gameState.stats[config.combatStamina])})`, 'hit');

    if (gameState.stats[config.combatStamina] <= 0) {
        gameState.stats[config.combatStamina] = 0;
        addCombatLog(`Votre héros est mort en fuyant !`, 'critical');
    }

    // Retirer tous les adversaires
    gameState.adversaries = [];
    renderStats();
    renderAdversaries();
    updateCombatButtons();
}

// ---- Test de Chance (hors combat) ----
function testLuck() {
    if (!gameState) return;
    const config = gameState.adventureConfig;
    const luckStat = config.stats.find(s => s.name.toLowerCase().includes('chance'));
    if (!luckStat) {
        alert('Pas de caractéristique Chance dans cette aventure.');
        return;
    }

    const currentLuck = gameState.stats[luckStat.key];
    const rolls = rollDice(2);
    const total = rolls[0] + rolls[1];
    const lucky = total <= currentLuck;

    // Diminuer la chance
    gameState.stats[luckStat.key] = Math.max(0, gameState.stats[luckStat.key] - 1);

    const resultText = lucky
        ? `CHANCEUX ! (${total} ≤ ${currentLuck})`
        : `MALCHANCEUX ! (${total} > ${currentLuck})`;

    showDiceRoll(rolls, resultText);
    renderStats();
}

// ---- Affichage dés ----
function showDiceRoll(rolls, text) {
    const overlay = document.getElementById('dice-overlay');
    const display = document.getElementById('dice-display');
    const resultText = document.getElementById('dice-result-text');

    display.innerHTML = '';
    rolls.forEach(val => {
        const die = document.createElement('div');
        die.className = 'die';
        die.textContent = val;
        display.appendChild(die);
    });

    const total = rolls.reduce((s, v) => s + v, 0);
    resultText.innerHTML = `<div style="font-size:1.4rem;margin-bottom:0.5rem;">Total : ${total}</div>${text}`;

    overlay.classList.remove('hidden');
}

function closeDiceOverlay() {
    document.getElementById('dice-overlay').classList.add('hidden');
}

// ---- Inventaire ----
function adjustGold(delta) {
    if (!gameState) return;
    gameState.gold = Math.max(0, gameState.gold + delta);
    document.getElementById('gold-amount').value = gameState.gold;
}

function onGoldChange() {
    if (!gameState) return;
    gameState.gold = Math.max(0, parseInt(document.getElementById('gold-amount').value) || 0);
}

function adjustProvisions(delta) {
    if (!gameState) return;
    gameState.provisions = Math.max(0, gameState.provisions + delta);
    document.getElementById('provisions-amount').value = gameState.provisions;
}

function onProvisionsChange() {
    if (!gameState) return;
    gameState.provisions = Math.max(0, parseInt(document.getElementById('provisions-amount').value) || 0);
}

function eatMeal() {
    if (!gameState) return;
    if (gameState.provisions <= 0) {
        alert('Vous n\'avez plus de provisions !');
        return;
    }

    const config = gameState.adventureConfig;
    const restore = config.mealRestore || 4;

    if (restore === 0) {
        alert('Les provisions ne restaurent pas d\'endurance dans cette aventure. Gérez-les manuellement.');
        return;
    }

    gameState.provisions--;
    gameState.stats[config.combatStamina] = Math.min(
        gameState.statsMax[config.combatStamina],
        gameState.stats[config.combatStamina] + restore
    );

    document.getElementById('provisions-amount').value = gameState.provisions;
    renderStats();
    alert(`Repas pris ! +${restore} Endurance`);
}

function renderInventory() {
    renderPotions();
    renderObjects();
    renderSpecialItems();
}

function renderPotions() {
    const list = document.getElementById('potions-list');
    list.innerHTML = '';

    (gameState.potions || []).forEach((potion, i) => {
        const remaining = potion.doses - potion.used;
        const item = document.createElement('div');
        item.className = 'potion-item';
        item.innerHTML = `
            <span class="obj-name">${potion.name}</span>
            <span class="obj-desc">${potion.effect} (${remaining} dose${remaining > 1 ? 's' : ''})</span>
            <button class="potion-use btn btn-small ${remaining <= 0 ? 'disabled' : 'btn-primary'}"
                    onclick="usePotion(${i})" ${remaining <= 0 ? 'disabled' : ''}>
                Boire
            </button>
        `;
        list.appendChild(item);
    });

    if (!gameState.potions || gameState.potions.length === 0) {
        list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucune potion</p>';
    }
}

function usePotion(idx) {
    if (!gameState) return;
    const potion = gameState.potions[idx];
    if (!potion || potion.used >= potion.doses) return;

    potion.used++;
    const stat = potion.stat;

    if (stat === 'chance') {
        // Chance : restaure initial + 1
        gameState.stats[stat] = gameState.statsMax[stat] + 1;
        gameState.statsMax[stat] = gameState.stats[stat];
    } else {
        gameState.stats[stat] = gameState.statsMax[stat];
    }

    renderStats();
    renderPotions();
    alert(`${potion.name} bue ! ${potion.effect}`);
}

function renderObjects() {
    const list = document.getElementById('objects-list');
    list.innerHTML = '';

    (gameState.objects || []).forEach((obj, i) => {
        const item = document.createElement('div');
        item.className = 'object-item';
        item.innerHTML = `
            <span class="obj-name">${obj.name}</span>
            ${obj.desc ? `<span class="obj-desc">${obj.desc}</span>` : ''}
            <button class="obj-remove" onclick="removeObject(${i})">&#10006;</button>
        `;
        list.appendChild(item);
    });

    if (!gameState.objects || gameState.objects.length === 0) {
        list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucun objet</p>';
    }
}

function addObject() {
    const nameInput = document.getElementById('object-name');
    const descInput = document.getElementById('object-desc');
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (!name || !gameState) return;

    gameState.objects.push({ name, desc });
    nameInput.value = '';
    descInput.value = '';
    renderObjects();
}

function removeObject(idx) {
    gameState.objects.splice(idx, 1);
    renderObjects();
}

function renderSpecialItems() {
    const section = document.getElementById('special-items-section');
    const config = gameState.adventureConfig;

    if (!config.special) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    document.getElementById('special-items-title').textContent = 'Objets Spéciaux';

    const list = document.getElementById('special-items-list');
    list.innerHTML = '';

    (gameState.specialItems || []).forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'object-item';
        el.innerHTML = `
            <span class="obj-name">${item.name}</span>
            <button class="obj-remove" onclick="removeSpecialItem(${i})">&#10006;</button>
        `;
        list.appendChild(el);
    });

    if (!gameState.specialItems || gameState.specialItems.length === 0) {
        list.innerHTML = '<p style="font-style:italic;color:var(--ink-light);font-size:0.9rem;">Aucun objet spécial</p>';
    }
}

function addSpecialItem() {
    const input = document.getElementById('special-item-name');
    const name = input.value.trim();
    if (!name || !gameState) return;
    if (!gameState.specialItems) gameState.specialItems = [];
    gameState.specialItems.push({ name });
    input.value = '';
    renderSpecialItems();
}

function removeSpecialItem(idx) {
    gameState.specialItems.splice(idx, 1);
    renderSpecialItems();
}

// ---- Menu ----
function openGameMenu() {
    document.getElementById('game-menu-overlay').classList.remove('hidden');
}

function closeGameMenu() {
    document.getElementById('game-menu-overlay').classList.add('hidden');
}

// ---- Sauvegarde / Chargement ----
function getSaves() {
    try {
        return JSON.parse(localStorage.getItem('ldvelh_saves') || '[]');
    } catch {
        return [];
    }
}

function saveSaves(saves) {
    localStorage.setItem('ldvelh_saves', JSON.stringify(saves));
}

function saveGame() {
    if (!gameState) return;

    // Synchroniser les notes
    gameState.notes = document.getElementById('game-notes').value;
    gameState.gold = parseInt(document.getElementById('gold-amount').value) || 0;
    gameState.provisions = parseInt(document.getElementById('provisions-amount').value) || 0;
    gameState.timestamp = Date.now();

    const saves = getSaves();
    // Chercher une sauvegarde existante pour ce héros
    const existingIdx = saves.findIndex(s =>
        s.heroName === gameState.heroName && s.adventureType === gameState.adventureType
    );

    const saveData = JSON.parse(JSON.stringify(gameState));

    if (existingIdx >= 0) {
        saves[existingIdx] = saveData;
    } else {
        saves.push(saveData);
    }

    saveSaves(saves);
    showSaveConfirmation();
}

function showSaveConfirmation() {
    const btn = document.getElementById('btn-save');
    const original = btn.innerHTML;
    btn.innerHTML = '&#10004; Sauvé !';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
    }, 1500);
}

function renderSavesList() {
    const saves = getSaves();
    const list = document.getElementById('saves-list');
    const noSaves = document.getElementById('no-saves');

    list.innerHTML = '';

    if (saves.length === 0) {
        noSaves.classList.remove('hidden');
        return;
    }

    noSaves.classList.add('hidden');

    saves.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    saves.forEach((save, i) => {
        const date = save.timestamp ? new Date(save.timestamp).toLocaleString('fr-FR') : 'Date inconnue';
        const advType = ADVENTURE_TYPES.find(a => a.id === save.adventureType);
        const advName = advType ? advType.name : save.adventureType;

        const card = document.createElement('div');
        card.className = 'save-card';
        card.innerHTML = `
            <div class="save-info">
                <div class="save-hero">${save.heroName}</div>
                <div class="save-detail">${advName} ${save.bookTitle ? '- ' + save.bookTitle : ''}</div>
                <div class="save-detail">§${save.currentParagraph} · ${date}</div>
            </div>
            <button class="save-delete" onclick="event.stopPropagation(); deleteSave(${i})" title="Supprimer">&#128465;</button>
        `;
        card.addEventListener('click', () => loadGame(i));
        list.appendChild(card);
    });
}

function loadGame(idx) {
    const saves = getSaves();
    if (idx < 0 || idx >= saves.length) return;

    gameState = JSON.parse(JSON.stringify(saves[idx]));

    // Reconstituer la config d'aventure si nécessaire
    if (!gameState.adventureConfig) {
        const advType = ADVENTURE_TYPES.find(a => a.id === gameState.adventureType);
        if (advType) gameState.adventureConfig = advType;
    }

    showScreen('screen-game');
    renderGameScreen();
}

function deleteSave(idx) {
    if (!confirm('Supprimer cette sauvegarde ?')) return;
    const saves = getSaves();
    saves.splice(idx, 1);
    saveSaves(saves);
    renderSavesList();
}
