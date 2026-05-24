# LDVELH — Compagnon d'Aventure

App locale (PWA) pour accompagner la lecture de *Livres dont vous êtes le héros* sur iPad : feuille de perso, combats, inventaire, notes, mind-map des paragraphes visités, sauvegardes.

> ⚠️ **Priorité absolue avant toute modif touchant aux saves : exporter d'abord** (écran *Charger* → bouton *Exporter*). Les saves vivent dans `localStorage` du navigateur (clé `ldvelh_saves`), n'importe quelle migration ratée peut tout perdre.

---

## 1. Stack & fichiers

- HTML/CSS/JS vanilla, ES modules, **aucune dépendance**.
- PWA installable iPad (manifest + service worker, cache offline).
- Polices Google Fonts (MedievalSharp / Crimson Text).
- Stockage : `localStorage` uniquement (clés `ldvelh_saves` et `ldvelh_last_export`).

```
ldvelh_app/
├── index.html             ← un seul écran HTML, toutes les vues empilées (.screen + .tab-content)
├── style.css              ← thème parchemin/fantaisie, tout dans :root vars
├── manifest.json
├── service-worker.js      ← cache versionné (CACHE = 'ldvelh-vN') ⚠️ à bumper sur toute modif d'asset
├── apple-touch-icon.png · icon-192.png · icon-512.png
├── make_icons.py          ← script Python utilitaire pour régénérer les icônes (épée + dé)
└── js/
    ├── app.js             ← bootstrap : attachEvents() + register SW
    ├── events.js          ← gros fichier : table `actions` (data-action → handler) + délégation globale
    ├── state.js           ← singleton `state` mutable + createGameState / startNewRun / adjustStat / logDice
    ├── save.js            ← persistGame / getSaves / removeSave / exportSaves / importSaves
    ├── adventure-types.js ← catalogue des 7 types d'aventure (Défis Fantastiques, Sorcellerie, Loup Solitaire…)
    ├── dice.js            ← rollDie / rollDice / rollStat (purs)
    ├── combat.js          ← combatRound / testLuck(Combat) / fleeCombat (mute `state.game`)
    ├── render.js          ← toutes les fonctions render*() qui repeignent le DOM depuis `state`
    ├── map.js             ← "Carte des Zones" : cartes par zone (verdict cross-run, chips §, résumé) — export unique renderMap()
    └── dom.js             ← helpers : el(), escapeHtml(), html`` tag, modal (alert/confirm/choice), toast
```

---

## 2. Architecture

### Pattern global
Pas de framework. Le **state mute en place**, puis on appelle les `render*()` concernés. Pas de virtual-DOM, pas de réactivité automatique — **si tu modifies `state.game` quelque part, appelle le render qui va bien juste après**.

### Délégation d'événements
Tous les boutons/inputs déclarent un `data-action="xxx"`. `events.js` écoute `click`/`change`/`input` au niveau `document`, lit `target.dataset.action`, dispatche vers `actions[xxx]`. **Pour ajouter une action UI : ajouter une entrée à `actions` dans events.js + un `data-action` dans le HTML/render**. Pas besoin de toucher au câblage.

### Flux de jeu

```
Accueil ──┬─→ Nouvelle Partie → Choix Type → Création Perso → Écran Jeu
          └─→ Charger        → Liste Saves ─→ Écran Jeu
```

L'écran de jeu a 5 onglets : **Personnage** (stats + zones + paragraphe + dés log), **Combat**, **Inventaire**, **Notes** (notes libres + historique paragraphes filtrable), **Carte** (cartes de zones).

---

## 3. Schéma de la save (`state.game`)

⚠️ **Ce qui suit est le contrat sérialisé dans `localStorage`. Toute modif structurelle exige une migration dans `loadGame()` (events.js) pour ne pas casser ta partie en cours.**

```js
{
  adventureType: 'defis_fantastiques' | 'sorcellerie' | 'loup_solitaire' | 'quete_graal' | 'dragon_or' | 'loup_ardent' | 'custom',
  statDefs: [{ key, name, dice, diceType?, bonus, editable?, isCustom? }, ...],  // ⚡ persisté pour supporter les stats custom
  // adventureConfig : reconstruit au chargement, JAMAIS persisté (stripé dans persistGame)

  heroName, bookTitle,
  stats:    { habilete: 9, endurance: 22, chance: 8, ... },  // valeurs courantes
  statsMax: { habilete: 9, endurance: 22, chance: 8, ... },  // initiales (peuvent monter via bonus permanent)

  gold, provisions,
  potions:  [{ name, effect, doses, used, stat }],          // stat = clé de stats à restaurer quand bue
  objects:  [{ name, desc }],
  specialItems: [{ name }],

  // Loadout de DÉPART de CE perso (≠ defaults du type d'aventure) — utilisé par 'Nouvelle run'
  startingEquipment: { gold, provisions, potions, objects },

  // (champ `alerts` retiré en v27 — section "Alertes & Statuts" supprimée ; reste possible dans les vieilles saves, ignoré)
  notes: '...texte libre...',

  currentParagraph: 42,
  paragraphHistory: [1, 2, 5, 'RUN', 1, 3, 'BACK', 1, ...],  // 'RUN' = séparateur de run · 'BACK' = retour arrière (silencieux) · null = legacy, migré en 'RUN' au chargement
  paragraphs: { '1': { sentiment: 'neutral'|'positive'|'negative', note: '', events: [...], zone: 'z..'|null }, ... },

  // Zones d'exploration : regroupent des § (cross-run), affichées en "cartes" dans l'onglet Carte.
  zones: [{ id, name, color, createdRun, createdTs }],
  activeZoneId: null | 'z..',   // zone "stylo" : tague les § visités ; reset à null sur startNewRun

  diceLog: [{ rolls, modifier, modifierLabel, total, label, ts }, ...],  // borné à 10
  mapLockedPositions: { '42': { x, y } },  // ⚠️ DEPRECATED depuis v26 (ancienne carte SVG) — plus lu, gardé pour compat

  combatMode: 'simultaneous' | 'sequential',
  targetedAdversaryIdx: null | number,
  adversaries: [{ name, skill, skillMax, stamina, staminaMax, defeated }],
  combatLog: [{ text, type }],

  special: {                                  // forme dépend du type d'aventure :
    value?: 6,                                // counter / power
    selected?: ['Camouflage', ...],           // checklist (Disciplines Kaï)
    spells?: [{ name, cost }],                // spells (Sorcellerie!)
    forms?: [{ name, effect }],               // transform (Dragon d'Or)
    currentForm?: 'Humain',
  },

  runCount: 1,
  timestamp: 1234567890,  // mtime, réécrit à chaque persistGame
}
```

### Clé d'identité d'une save
`(heroName, adventureType)` — `persistGame` upsert sur ce couple. **Renommer un perso crée une nouvelle save** ; modifier le code pour changer cette clé invaliderait les saves existantes.

---

## 4. Sauvegarde — règles d'or pour ne rien casser

1. **Bannière export** : si > 7 jours sans export, bannière jaune sur l'écran *Charger*. Service worker met à jour l'app au prochain reload → un bug logique peut tout vider silencieusement. **Faire un export AVANT chaque session de modif.**
2. **Compat ascendante dans `loadGame()`** (`events.js` ~ligne 757) : déjà migré 2 fois (paragraphs map, statDefs). Pattern à suivre : tester `if (!save.foo) save.foo = default` — ne **jamais** supposer un champ obligatoire sur les saves d'avant un refactor.
3. **`startNewRun()`** (state.js) reset le perso mais **préserve** : `heroName`, `bookTitle`, `statDefs`, `notes`, `paragraphs` (sentiments+notes), `paragraphHistory` (+ push `null` comme marqueur de run). Si tu changes le reset, vérifier les 2 modes (`reroll: true|false`).
4. **`adventureConfig` est dérivé, jamais persisté** — `persistGame` le supprime ; `loadGame` le reconstruit depuis `adventureType + statDefs`. Si tu rajoutes des champs dérivés, fais pareil.
5. **Service worker** : à chaque modif d'un fichier dans `ASSETS`, **bumper la version** (`CACHE = 'ldvelh-vN'`) sinon iPad sert l'ancien cache. À ce jour : `v15`.

---

## 5. Mécaniques métier

### Stats & ajustements
- `adjustStat(key, delta)` (state.js) : clamp entre 0 et `statsMax[key]`, retourne `true` si l'END combat tombe à 0 (mort).
- **Bonus permanent** : dans `stat-delta-apply` (events.js), si delta positif pousse au-dessus du max → modal qui demande *plafonner* (soin classique) ou *bonus permanent* (augmente aussi `statsMax`). Important pour les épées magiques / armures qui boostent durablement.

### Combat
- `combat.combatRound()` : 2D6+HAB pour le héros vs 2D6+HAB de chaque adversaire. Touché = -2 END.
- Modes : **simultané** (par défaut, attaque tous d'un coup) | **séquentiel 1v1** (cible un adversaire). Le mode est dans `game.combatMode`, la cible dans `game.targetedAdversaryIdx`.
- `testLuckCombat()` : modifie le dernier round selon `state.lastCombatResult` (esquive/critique). Consomme 1 point de Chance.
- `flee()` : -2 END, vide la liste d'adversaires.

### Paragraphes, zones & carte
- Bouton **+ Ajouter** = visite (push dans `paragraphHistory`). Si une zone est active, le § y est rattaché (`tagParagraphWithActiveZone`).
- Sentiments : neutre (gris), positif (vert, bénéfique), négatif (rouge, piège). Cliquer le rond cycle.
- **Zones** (depuis v26) : on crée une zone nommée dans l'onglet Personnage (`#zone-control`). Elle devient le "stylo" actif et tague chaque § visité jusqu'à *Clôturer* ou création/reprise d'une autre zone. Les zones **persistent cross-run** ; `startNewRun` les garde et remet juste `activeZoneId = null`.
- **Carte des Zones** (`map.js`) : remplace l'ancien mind-map SVG (illisible). Une carte par zone + pseudo-zone "Non classé". Chaque carte affiche le **verdict** (`summarizeZone` agrège les `events[]` cross-run → utile / danger / mitigé / inexploré), les chips § (cliquables → saut), un résumé et un dépliable par run.
- Verdict & couleurs : `summarizeZone` + `VERDICT_META` + `ZONE_COLORS` dans `state.js` (réutilisés par render.js ET map.js, sans cycle d'import).

### Type d'aventure & "special"
Chaque type (`adventure-types.js`) déclare un `special` qui pilote la section dédiée :
- `counter` / `power` : compteur entier (Honneur, Pouvoir).
- `checklist` : choix dans une liste (Disciplines Kaï, max 5).
- `spells` : sorts + coût END (Sorcellerie!).
- `transform` : formes alternatives (Dragon d'Or).

Pour ajouter un type : éditer `ADVENTURE_TYPES`. Pour ajouter un nouveau `special.type` : étendre les `switch` dans `createGameState`, `startNewRun` (state.js) et `renderSpecialSection` (render.js).

---

## 6. Conventions à respecter

- **Tout texte UI en français.**
- HTML construit via le tag `` html`` `` (dom.js) qui auto-escape les valeurs ; utiliser `raw(htmlString)` pour injecter du HTML déjà construit, et `escapeHtml(x)` à la main si on bypasse le tag.
- Pas de jQuery, pas de React. Le DOM se reconstruit via `innerHTML` dans les `render*()` — c'est volontairement simple.
- Pas de tests automatisés à ce jour. La validation se fait manuellement sur iPad (Safari) + desktop.
- Pour les modals : **`modal.alert / modal.confirm / modal.choice` retournent une Promise** — toujours `await`. Ne **jamais** utiliser `window.alert/confirm` (bloquant + style natif moche).
- Pour les feedbacks transitoires : `toast(msg, type, duration)` (dom.js).

---

## 7. Pièges fréquents

- Ajouter un champ à `state.game` sans le gérer dans `loadGame()` → les saves existantes plantent silencieusement (champ `undefined`, render qui crashe).
- Modifier `service-worker.js` sans bumper le numéro de cache → iPad sert toujours l'ancien JS.
- Renommer une clé de stat (ex: `habilete` → `skill`) → casse toutes les saves : prévoir une migration dans `loadGame` qui renomme.
- Toucher à `paragraphHistory` sans gérer les **3 marqueurs** (`'RUN'` séparateur de run, `'BACK'` retour arrière, `null` legacy) → casse `renderParagraphs` et `getNeighborsFromHistory`. Toujours filtrer par `typeof x === 'number'` quand on cherche un vrai §.
- Ajouter une action qui crée/visite un § sans appeler `tagParagraphWithActiveZone` → le § échappe à la zone active (apparaît en "Non classé").
- Modifier `combat.combatRound` sans rejouer en sequential ET simultaneous.

---

## 8. Journal des évolutions

> Trace des modifs faites session par session, pour pouvoir reprendre le contexte plus tard.

### 2026-05-12 — Mémoire cross-run + autosave + form détails paragraphe (SW v16)

**Pourquoi** : à l'usage iPad, l'onglet Personnage manquait d'un endroit pour logger ce qu'on rencontre à chaque §, et la mémoire entre runs n'existait pas. Quand tu meurs en run 1 et que tu reprends en run 2, impossible de te rappeler "§252 = mort" sans relire toutes les notes.

**Modèle de données — ajout `events[]` cumulatif cross-run sur chaque paragraphe** :
```js
paragraphs[num] = {
  sentiment, note,
  events: [
    { run, type: 'death'|'enemy'|'item'|'gold'|'prov'|'stat', data: {...}, ts }
  ]
}
```
Le tableau `events` n'est PAS reset par `startNewRun()` (c'est tout l'intérêt). Le champ `run` permet de filtrer / afficher par run.

**Migrations dans `loadGame()`** :
- Chaque entrée `paragraphs[num]` reçoit `events: []` si absent → vieilles saves intactes, juste pas de souvenirs (normal).
- `runCount` défaut 1 si absent.
- Les entrées créées via `paragraphHistory.forEach` (vieux saves sans `paragraphs` map) ignorent maintenant les `null` markers.

**Nouvelles actions (events.js)** — `add-para-enemy`, `add-para-item`, `apply-para-gold`, `apply-para-prov`, `apply-para-stat`, `mark-para-death` :
- Chacune **applique** le changement (combat, inventaire, stats, gold…) ET **log un event** sur `currentParagraph` via `logParagraphEvent()` (state.js).
- `mark-para-death` ne touche PAS l'END — c'est juste une trace, l'user reste libre d'undo / new-run / continuer.
- `apply-para-stat` réutilise le dialogue "bonus permanent" déjà existant pour stat-delta-apply.

**Auto-sentiment** (logParagraphEvent) : sur premier event d'un §, si sentiment encore neutre → `death`/`stat<0` ne flip pas (laisse le manuel), mais `death` → négatif, `item` → positif. **Seulement au premier event** pour ne pas écraser un choix manuel ultérieur.

**Panneau "Souvenirs" (render.js → `renderParagraphMemory()`)** :
- Affiché au-dessus de "Paragraphe actuel" si le § courant a des events OU si des § ont été visités depuis lui dans une run précédente.
- Section "Ici" : events du § courant, triés par run puis ts. Tag `Run N` sur chacun.
- Section "Depuis ici, runs précédentes" : neighbors calculés via `getNeighborsFromHistory()` (state.js) — adjacence dans `paragraphHistory`, respecte les `null` markers (pas de neighbor cross-run). Chaque ligne = bouton § cliquable (jump-to-paragraph) + résumé compact des events qui y sont loggés.

**Form "Détails de ce paragraphe"** (index.html) : `<details>` repliable sous la zone d'ajout, contient ennemi / objet / or / provisions / stat / mort. Le `<select>` des stats est peuplé par `renderParagraphDetailsStatSelect()` depuis `resolveConfig().stats` (gère les stats custom).

**Autosave silencieux** :
- `persistGameSilent(game)` dans save.js — variante sans modal sur erreur, retourne `{ok, error?}`.
- `requestAutoSave()` dans events.js debounced 400ms ; toast d'erreur affiché 1× max par session si quota plein.
- **Dispatcher unifié** : le `click`/`change`/`input` listener appelle un wrapper `dispatch(action, target, e)` qui, après exécution du handler (await Promise.resolve pour les handlers async/modaux), schedule un autosave SAUF si l'action est dans `NO_AUTOSAVE_ACTIONS` (navigation, save explicite, char-create, UI pure).
- Les 3 inputs statiques (gold-amount, provisions-amount, game-notes) câblent aussi `requestAutoSave()` à la main.

**Service worker** bumped `v15 → v16` (fichiers JS/CSS/HTML modifiés).

**Garantie save** : aucune clé n'a été renommée/supprimée. Toutes les nouvelles lectures font `events ?? []`. Ta save existante est lue, migrée invisiblement (events vides partout) et tu commences à logger à partir de maintenant — les futures runs auront la mémoire.

### 2026-05-12 (suite) — Carte hiérarchique + provisions au choix (SW v18)

**Provisions par défaut à 0** (events.js + render.js) : `select-adventure` n'initialise plus `provisions` à `adv.defaultProvisions` ; `renderCharCreate` ne pré-remplit plus le champ avec 10. Le champ reste à 0 et l'user choisit explicitement, comme pour l'or. Les vieilles saves ne sont pas affectées (leur `startingEquipment` est figé à la création).

**Carte : nouveau layout hiérarchique gauche-droite** (map.js entièrement réécrit) :
- Remplace le force-directed Fruchterman-Reingold (devenait illisible au-delà de ~30 nœuds).
- Algorithme : BFS depth-assignment depuis le premier § visité → groupage en colonnes → ordering vertical par barycentre des parents/enfants (5 sweeps).
- Forward edges (col N → col N+1) : trait brun droit.
- Backward edges (boucles, retour en arrière) : courbe quadratique rouge pointillée, flèche rouge.
- Dimensions du viewBox calculées dynamiquement (`width = MIN_W + maxDepth * COL_W`).
- `mapLockedPositions` toujours respecté → l'user peut toujours drag pour épingler. "Tout libérer" remet en place.
- `fitMap` utilise désormais `currentDims` (module-level) au lieu des anciennes constantes VIEW_W/VIEW_H.
- Constantes : COL_W=130, ROW_H=75, MARGIN_X=60, MARGIN_Y=50. Ajustables sans toucher au reste.
- Orphans (§ ajoutés via "Voir seulement" sans path depuis le start) sont placés en colonne 0 avec le start.

**Tradeoff connu** : si une colonne contient 20+ § (très forte ramification depuis un même paragraphe), ça scrolle verticalement. C'est attendu — beaucoup plus lisible qu'un nuage emmêlé, mais pas magique pour les graphes très denses.

### 2026-05-14 — Réapplication des events + type d'event `note` (SW v23)

**Pourquoi** : sur un § déjà visité avec des events loggés (runs précédentes), il fallait pouvoir re-déclencher rapidement ce qu'on y avait rencontré au lieu de tout re-saisir à la main dans le form Détails.

**Bouton ↻ Réappliquer** dans le panneau Souvenirs, section "Ici (toutes runs)" :
- Chaque event ré-appliable (`enemy`, `item`, `gold`, `prov`, `stat`, `note` — voir `REAPPLIABLE` set dans render.js) reçoit un bouton ↻.
- `death` n'est pas ré-appliable (rien à refaire).
- Action `reapply-event` (events.js) : reproduit l'EFFET uniquement (ajoute l'ennemi au combat, l'or aux provisions, etc.). **Ne log PAS de nouvel event** — sinon liste mémoire infinie. Seul le form "Détails du paragraphe" enregistre une occurrence en mémoire.
- `stat` : si la carac n'existe pas sur le perso courant (save d'un autre type d'aventure), skip avec toast warn. Réutilise le dialogue bonus permanent.
- L'index passé est l'index original dans `paragraphs[cur].events` (pas l'index trié) — `renderParagraphMemory` mappe `(ev, idx)` avant de trier pour l'affichage.

**Nouveau type d'event `note`** :
- Ligne "📝 Note" ajoutée au form Détails du paragraphe → action `add-para-note`.
- Comportement "comme un objet" : log un event `note` sur le § courant ET append `§N : texte` aux notes globales (`game.notes` + textarea onglet Notes) via le helper `appendGlobalNote()`.
- `formatEvent` / `summarizeEvents` / `EVENT_ICON` gèrent le type `note`.
- Distinct du champ `new-para-note` du form d'ajout, qui reste le label cumulatif du § (affiché sur la carte et l'historique) — non touché.

**Garantie save** : `note` est juste un nouveau type dans `events[]` (déjà migré partout). Aucune clé renommée. Les saves sans events `note` fonctionnent identiquement.

### 2026-05-24 — Fix : les retours arrière devenaient de faux séparateurs « Run » (SW v25)

**Symptôme** : après quelques retours arrière puis un rechargement, des séparateurs `── Run N ──` fantômes apparaissaient dans l'historique des paragraphes.

**Cause racine** : le go-back (`go-back` dans events.js) poussait un marqueur `null` dans `paragraphHistory` (censé être silencieux). Mais la migration de `loadGame()` convertit **tout `null` en `'RUN'`** à **chaque** chargement (elle ne visait que les vieilles saves pré-v21). Donc : retour arrière → `null` → autosave → rechargement → `null` devient `'RUN'` → affiché comme nouvelle run → re-persisté. Chaque retour arrière se transformait en faux séparateur dès le rechargement suivant.

**Correctif** : le go-back pousse désormais un marqueur **distinct `'BACK'`** (au lieu de `null`). La migration `null → 'RUN'` reste et redevient correcte (un `null` ne peut plus venir que d'une vraie vieille boundary de run).

**Fichiers touchés** :
- `events.js` : `go-back` pousse `'BACK'` + reconstruction de pile lit `'BACK'` ; `undo-paragraph` skippe `'BACK'` ; commentaire migration clarifié.
- `render.js` : `renderParagraphs` masque `'BACK'` (comme `null`).
- `map.js` : `isBreak()` coupe l'arête sur `'BACK'` ; `firstVisit` ignore `'BACK'`.
- `state.js` : `getNeighborsFromHistory` ne retient que les successeurs `typeof === 'number'` (corrige aussi un bug latent où `'RUN'` pouvait être compté comme voisin).
- `service-worker.js` : `v24 → v25`.

**Limite connue** : les faux « Run » **déjà** présents dans une save (issus de retours arrière convertis lors de rechargements passés) ne sont **pas** distinguables des vraies runs → non nettoyés rétroactivement. Le fix empêche seulement les nouveaux.

**Garantie save** : aucune clé renommée. `'BACK'` est juste une nouvelle valeur sentinelle dans `paragraphHistory`, gérée partout où `'RUN'`/`null` l'étaient.

### 2026-05-24 (suite) — Refonte carte : "Zones d'exploration" (SW v26)

**Pourquoi** : l'ancien mind-map SVG (force-directed puis hiérarchique) était illisible/inutilisable au-delà de quelques dizaines de §. Remplacé par un système de **zones** nommées qui regroupent les § et donnent un **verdict cross-run** ("vaut-il le coup d'y retourner ?").

**Modèle de données (state.js)** :
- `game.zones = [{ id, name, color, createdRun, createdTs }]` — persiste cross-run.
- `game.activeZoneId` — zone "stylo" active. Reset à `null` par `startNewRun` (les zones, elles, sont gardées).
- `paragraphs[num].zone = zoneId | null` — `null` = "Non classé".
- Helpers : `createZone`, `getZone`, `tagParagraphWithActiveZone`, `summarizeZone` (agrège events → verdict utile/danger/mitigé/neutre), + `ZONE_COLORS`, `VERDICT_META`.

**Rattachement (auto)** : tant qu'une zone est active, `add-paragraph` / `jump-to-paragraph` appellent `tagParagraphWithActiveZone`. Revisiter un § sans zone active **ne le déclasse pas** (garde sa zone d'une run précédente).

**UI** :
- Onglet **Personnage** → bloc `#zone-control` (`renderZoneControl`) : zone active + *Clôturer*, création (`#new-zone-name`), puces des zones (reprise + mini-verdict). Tag de zone coloré sur chaque ligne d'historique.
- Onglet **Carte** → `map.js` réécrit : `renderMap()` produit des **cartes de zones** (verdict, chips § cliquables colorés par sentiment, résumé agrégé, dépliable par run) + carte "Non classé". Plus de SVG/pan/zoom.
- Actions events.js : `create-zone`, `close-zone`, `activate-zone`, `rename-zone` (input inline), `delete-zone` (modal confirm, § conservés en "Non classé").

**Nettoyage** : `map.js` n'exporte plus que `renderMap` (supprimé `zoomMapBy/fitMap/relayoutMap/unlockAllNodes/invalidateMapLayout` + handlers `map-*` + boutons HTML). `mapLockedPositions` devient du **dead data** (gardé pour compat, plus lu).

**Migrations `loadGame()`** : `zones = []`, `activeZoneId = null`, et chaque `paragraphs[num].zone = null` si absent. Aucune clé renommée → vieilles saves intactes, tous leurs § en "Non classé" tant qu'on ne crée pas de zones.

**À tester encore** (pas de tests auto) : créer/clôturer/reprendre/supprimer une zone, vérif auto-tag à l'ajout de §, verdict après mort/objet, persistance cross-run après *Nouvelle run*, rendu iPad Safari (le CSS utilise `color-mix()` — OK Safari ≥ 16.2 ; sinon dégradation gracieuse des fonds).

### 2026-05-24 (suite) — Suppression section "Alertes & Statuts" (SW v27)

Section jugée inutile → retirée entièrement : bloc HTML `.alerts-section`, actions `add-alert`/`remove-alert`, helper `addAlertFromInput`, listener `alert-input`, `renderAlerts` (render.js), écritures `alerts` (createGameState + startNewRun), et tout le CSS `.alert-*`. Champ `game.alerts` non migré : les vieilles saves peuvent encore le contenir, il est simplement ignoré (aucune lecture).

### Backlog
- _(à remplir au fil de l'eau)_
