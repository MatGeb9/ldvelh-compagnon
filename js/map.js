// "Carte" des Zones — remplace l'ancien mind-map SVG (illisible au-delà de ~30 §).
// Chaque zone est une carte : nom (éditable), verdict cross-run, chips des § (cliquables
// → saut), résumé agrégé des events, et un dépliable "par run". Une pseudo-zone
// "Non classé" regroupe les § sans zone. Le but : voir d'un coup d'œil si une zone vaut
// le coup d'y retourner, en s'appuyant sur la mémoire des runs précédentes.
import { el, escapeHtml, html, raw } from './dom.js';
import { state, summarizeZone, VERDICT_META } from './state.js';

const SENTIMENT_FILL = { positive: '#27ae60', negative: '#c0392b', neutral: '#b0a78f' };

// Ligne de résumé compacte des events agrégés d'une zone.
function zoneSummaryLine(sum) {
  const parts = [];
  if (sum.items.length) {
    const names = [...new Set(sum.items.map(e => e.data?.name).filter(Boolean))];
    parts.push(`🎒 ${escapeHtml(names.join(', '))}`);
  }
  if (sum.enemies.length) {
    const names = [...new Set(sum.enemies.map(e => e.data?.name).filter(Boolean))];
    parts.push(`⚔️ ${escapeHtml(names.join(', '))}`);
  }
  if (sum.goldNet) parts.push(`💰 ${sum.goldNet > 0 ? '+' : ''}${sum.goldNet}`);
  if (sum.provNet) parts.push(`🍞 ${sum.provNet > 0 ? '+' : ''}${sum.provNet}`);
  if (sum.statNet) parts.push(`± ${sum.statNet > 0 ? '+' : ''}${sum.statNet} carac`);
  if (sum.deaths.length) {
    const where = [...new Set(sum.deaths.map(e => e.para))].map(n => `§${n}`).join(', ');
    parts.push(`💀 mort ${where}`);
  }
  if (sum.notes.length) parts.push(`📝 ${sum.notes.length} note${sum.notes.length > 1 ? 's' : ''}`);
  return parts.join(' &nbsp;·&nbsp; ');
}

// Dépliable "par run" : pour chaque run vue dans la zone, le détail des events.
function zoneRunBreakdown(sum) {
  if (sum.events.length === 0) return '';
  const byRun = new Map();
  sum.events.forEach(ev => {
    const r = ev.run ?? 1;
    if (!byRun.has(r)) byRun.set(r, []);
    byRun.get(r).push(ev);
  });
  const runs = [...byRun.keys()].sort((a, b) => a - b);
  const blocks = runs.map(r => {
    const lines = byRun.get(r).map(ev => {
      const icon = ({ death: '💀', enemy: '⚔️', item: '🎒', gold: '💰', prov: '🍞', stat: '±', note: '📝' })[ev.type] || '•';
      let txt;
      switch (ev.type) {
        case 'death': txt = 'Mort ici'; break;
        case 'enemy': txt = `${ev.data?.name || '?'} (HAB ${ev.data?.skill} · END ${ev.data?.stamina})`; break;
        case 'item': txt = `${ev.data?.name || '?'}${ev.data?.desc ? ' — ' + ev.data.desc : ''}`; break;
        case 'gold': txt = `${ev.data?.delta > 0 ? '+' : ''}${ev.data?.delta} or`; break;
        case 'prov': txt = `${ev.data?.delta > 0 ? '+' : ''}${ev.data?.delta} prov`; break;
        case 'stat': txt = `${ev.data?.delta > 0 ? '+' : ''}${ev.data?.delta} ${ev.data?.name || ''}`; break;
        case 'note': txt = ev.data?.text || ''; break;
        default: txt = '';
      }
      return `<div class="zone-run-line"><span class="zone-run-para">§${ev.para}</span> ${icon} ${escapeHtml(txt)}</div>`;
    }).join('');
    return `<div class="zone-run-block"><div class="zone-run-tag">Run ${r}</div>${lines}</div>`;
  }).join('');
  return `<details class="zone-runs"><summary>Détail par run (${runs.length})</summary>${blocks}</details>`;
}

// Chips des § d'une zone, colorés par sentiment, le § courant entouré.
function zoneChips(game, nums) {
  if (nums.length === 0) return '<div class="zone-chips-empty">Aucun paragraphe</div>';
  return '<div class="zone-paras">' + nums.map(n => {
    const meta = game.paragraphs?.[n] || {};
    const fill = SENTIMENT_FILL[meta.sentiment] || SENTIMENT_FILL.neutral;
    const isCurrent = n === game.currentParagraph;
    const note = meta.note ? ` — ${escapeHtml(meta.note)}` : '';
    return `<button class="zone-para${isCurrent ? ' is-current' : ''}" style="--s:${fill}"
        data-action="jump-to-paragraph" data-num="${n}" title="§${n}${note}">§${n}</button>`;
  }).join('') + '</div>';
}

function zoneCard(game, zone, sum) {
  const m = VERDICT_META[sum.verdict] || VERDICT_META.neutre;
  const isActive = zone && zone.id === game.activeZoneId;
  const color = zone ? zone.color : '#9a8f76';
  const runs = sum.runs.length ? `<span class="zone-card-runs" title="Runs où la zone a été vue">runs ${sum.runs.join(', ')}</span>` : '';

  // En-tête : nom (éditable si vraie zone) + verdict + actions
  let header;
  if (zone) {
    header = html`<div class="zone-card-head">
      <input class="zone-card-name" data-action="rename-zone" data-id="${zone.id}" value="${zone.name}" maxlength="40" aria-label="Nom de la zone">
      <span class="zone-verdict zone-verdict-${raw(m.cls)}" title="${m.label}">${raw(m.icon)} ${raw(m.label)}</span>
    </div>`;
  } else {
    header = html`<div class="zone-card-head">
      <span class="zone-card-name zone-card-name-static">Non classé</span>
      <span class="zone-verdict zone-verdict-${raw(m.cls)}" title="${m.label}">${raw(m.icon)} ${raw(m.label)}</span>
    </div>`;
  }

  const actions = zone
    ? html`<div class="zone-card-actions">
        <button class="btn btn-small ${raw(isActive ? 'btn-primary' : '')}" data-action="activate-zone" data-id="${zone.id}" ${raw(isActive ? 'disabled' : '')}>
          ${raw(isActive ? '✔ Active' : 'Reprendre')}
        </button>
        <button class="btn btn-small btn-danger" data-action="delete-zone" data-id="${zone.id}" title="Supprimer la zone (§ conservés)">✕</button>
      </div>`
    : '';

  return `<div class="zone-card${isActive ? ' is-active' : ''}" style="--zone-color:${color}">
    <div class="zone-card-bar"></div>
    <div class="zone-card-body">
      ${header}
      <div class="zone-card-meta"><span class="zone-card-count">${sum.nums.length} §</span>${runs}</div>
      ${zoneChips(game, sum.nums)}
      ${zoneSummaryLine(sum) ? `<div class="zone-card-summary">${zoneSummaryLine(sum)}</div>` : '<div class="zone-card-summary zone-card-summary-empty">Pas encore de souvenirs ici.</div>'}
      ${zoneRunBreakdown(sum)}
      ${actions}
    </div>
  </div>`;
}

export function renderMap() {
  const container = el('map-canvas');
  if (!container) return;
  const game = state.game;
  if (!game) { container.innerHTML = ''; return; }

  const zones = game.zones || [];
  const paragraphs = game.paragraphs || {};
  const totalParas = Object.keys(paragraphs).length;

  if (totalParas === 0) {
    container.innerHTML = '<p class="map-empty">Aucun paragraphe à cartographier. Crée une zone dans l\'onglet Personnage puis explore le livre.</p>';
    return;
  }

  // Pseudo-zone "Non classé" : seulement si des § n'ont pas de zone.
  const unclassified = summarizeZone(game, null);

  let cards = zones.map(z => zoneCard(game, z, summarizeZone(game, z.id))).join('');
  if (unclassified.nums.length > 0) {
    cards += zoneCard(game, null, unclassified);
  }

  if (!cards) {
    container.innerHTML = `<div class="zone-map-intro">Aucune zone créée. Va dans l'onglet <strong>Personnage</strong> → <em>Zones d'exploration</em> pour en créer une : tous les § que tu visites ensuite y seront rattachés.</div>`;
    return;
  }

  const legend = `<div class="zone-map-legend">
    <span class="zone-verdict zone-verdict-utile">✓ Utile</span>
    <span class="zone-verdict zone-verdict-mitige">≈ Mitigé</span>
    <span class="zone-verdict zone-verdict-danger">✕ Danger</span>
    <span class="zone-verdict zone-verdict-neutre">· Inexploré</span>
  </div>`;

  container.innerHTML = `${legend}<div class="zone-cards">${cards}</div>`;
}
