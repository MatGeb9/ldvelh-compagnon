// Mind-map SVG des paragraphes — layout hiérarchique gauche-droite (Sugiyama-style).
// Chaque colonne = une "profondeur" BFS depuis le 1er § visité.
// Forward edges (col N → col N+1) : trait droit.
// Back edges (retour en arrière, boucle) : courbe rouge pointillée.
// Drag d'un nœud = épinglage manuel persisté dans game.mapLockedPositions.
import { el, escapeHtml } from './dom.js';
import { state } from './state.js';

const COL_W = 130;        // horizontal spacing between columns
const ROW_H = 75;         // vertical spacing between nodes in same column
const MARGIN_X = 60;
const MARGIN_Y = 50;
const NODE_R_DEFAULT = 18;
const NODE_R_CURRENT = 22;
const MIN_W = 400;
const MIN_H = 300;

// Natural (untransformed) viewBox dimensions of the current render — used by fitMap.
let currentDims = { width: MIN_W, height: MIN_H };

function buildGraph(game) {
  const nodeSet = new Set();
  const edgeMap = new Map(); // "a->b" → {a, b}

  Object.keys(game.paragraphs || {}).forEach(n => nodeSet.add(Number(n)));

  const history = game.paragraphHistory || [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1];
    const b = history[i];
    if (a === null || b === null) continue; // run boundary — no edge across runs
    if (a === b) continue;
    nodeSet.add(a);
    nodeSet.add(b);
    const key = `${a}->${b}`;
    if (!edgeMap.has(key)) edgeMap.set(key, { a, b });
  }
  history.forEach(n => { if (n !== null) nodeSet.add(n); });

  return { nodes: [...nodeSet], edges: [...edgeMap.values()] };
}

// Hierarchical layout: assign each node a depth (= BFS distance from start),
// group by depth into columns, sort within columns to minimise edge crossings
// using barycenter heuristic (5 sweeps both directions).
function computeHierarchicalLayout(nodes, edges, locked = {}) {
  if (nodes.length === 0) {
    return { pos: {}, width: MIN_W, height: MIN_H, depth: new Map() };
  }

  // Directed adjacency
  const outAdj = new Map();
  const inAdj = new Map();
  nodes.forEach(n => { outAdj.set(n, []); inAdj.set(n, []); });
  edges.forEach(({ a, b }) => {
    if (a === b) return;
    outAdj.get(a)?.push(b);
    inAdj.get(b)?.push(a);
  });

  // Pick the start node: first non-null entry in paragraphHistory, fallback to §1, else first node.
  const history = state.game?.paragraphHistory || [];
  const firstVisit = history.find(n => n != null);
  let start = nodes[0];
  if (firstVisit != null && nodes.includes(firstVisit)) start = firstVisit;
  else if (nodes.includes(1)) start = 1;

  // BFS depth assignment over outgoing edges
  const depth = new Map();
  depth.set(start, 0);
  const queue = [start];
  while (queue.length > 0) {
    const u = queue.shift();
    (outAdj.get(u) || []).forEach(v => {
      if (!depth.has(v)) {
        depth.set(v, depth.get(u) + 1);
        queue.push(v);
      }
    });
  }
  // Unreached nodes (orphans, e.g. "voir seulement" without path) → depth 0
  nodes.forEach(n => {
    if (!depth.has(n)) depth.set(n, 0);
  });

  // Group by depth
  const columns = new Map();
  nodes.forEach(n => {
    const d = depth.get(n);
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d).push(n);
  });
  const depths = [...columns.keys()].sort((a, b) => a - b);

  // Initial sort within each column: by paragraph number (deterministic seed)
  depths.forEach(d => columns.get(d).sort((a, b) => a - b));

  // Initial positions
  const pos = {};
  depths.forEach(d => {
    columns.get(d).forEach((n, i) => {
      pos[n] = { x: MARGIN_X + d * COL_W, y: MARGIN_Y + i * ROW_H };
    });
  });

  // Barycenter refinement: alternate forward/backward sweeps, reorder each column
  // by avg y of incoming (forward) or outgoing (backward) neighbours.
  for (let sweep = 0; sweep < 5; sweep++) {
    for (const d of depths) {
      if (d === depths[0]) continue;
      const col = columns.get(d);
      col.sort((a, b) => {
        const parA = inAdj.get(a) || [];
        const parB = inAdj.get(b) || [];
        const yA = parA.length
          ? parA.reduce((s, p) => s + (pos[p]?.y ?? 0), 0) / parA.length
          : pos[a].y;
        const yB = parB.length
          ? parB.reduce((s, p) => s + (pos[p]?.y ?? 0), 0) / parB.length
          : pos[b].y;
        return yA - yB || a - b; // tie-break by §number for stability
      });
      col.forEach((n, i) => { pos[n].y = MARGIN_Y + i * ROW_H; });
    }
    for (let i = depths.length - 1; i >= 0; i--) {
      const d = depths[i];
      if (d === depths[depths.length - 1]) continue;
      const col = columns.get(d);
      col.sort((a, b) => {
        const chA = outAdj.get(a) || [];
        const chB = outAdj.get(b) || [];
        const yA = chA.length
          ? chA.reduce((s, c) => s + (pos[c]?.y ?? 0), 0) / chA.length
          : pos[a].y;
        const yB = chB.length
          ? chB.reduce((s, c) => s + (pos[c]?.y ?? 0), 0) / chB.length
          : pos[b].y;
        return yA - yB || a - b;
      });
      col.forEach((n, idx) => { pos[n].y = MARGIN_Y + idx * ROW_H; });
    }
  }

  // Apply locked positions (user manual pinning) — overrides computed pos.
  // Keys come from Object.keys → strings; nodes are numbers, JS coerces same key.
  Object.entries(locked).forEach(([k, p]) => {
    const num = Number(k);
    if (pos[num]) pos[num] = { x: p.x, y: p.y };
  });

  // Compute SVG dimensions to fit everything
  let maxX = 0, maxY = 0;
  Object.values(pos).forEach(p => {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  const width = Math.max(MIN_W, maxX + MARGIN_X);
  const height = Math.max(MIN_H, maxY + MARGIN_Y);

  return { pos, width, height, depth };
}

// Cache positions to avoid recomputing on every render
let layoutCache = { key: '', layout: null };

function getLocked() {
  return state.game?.mapLockedPositions || {};
}

function getOrComputeLayout(nodes, edges) {
  const locked = getLocked();
  const lockedKey = Object.keys(locked).sort()
    .map(k => `${k}:${Math.round(locked[k].x)},${Math.round(locked[k].y)}`)
    .join(';');
  const key = nodes.slice().sort((a, b) => a - b).join(',') + '|' + edges.length + '|' + lockedKey;
  if (layoutCache.key === key && layoutCache.layout) return layoutCache.layout;
  layoutCache = { key, layout: computeHierarchicalLayout(nodes, edges, locked) };
  return layoutCache.layout;
}

export function invalidateMapLayout() {
  layoutCache = { key: '', layout: null };
}

export function unlockAllNodes() {
  if (!state.game) return;
  state.game.mapLockedPositions = {};
  invalidateMapLayout();
  renderMap();
}

export function renderMap() {
  const container = el('map-canvas');
  if (!container) return;
  const game = state.game;
  if (!game) { container.innerHTML = ''; return; }

  const { nodes, edges } = buildGraph(game);
  if (nodes.length === 0) {
    container.innerHTML = '<p class="map-empty">Aucun paragraphe à cartographier. Naviguez dans le livre pour construire la carte.</p>';
    return;
  }

  const { pos: positions, width, height, depth } = getOrComputeLayout(nodes, edges);
  currentDims = { width, height };

  // Edge classification:
  //   - forward (col A → col B with B > A) : straight line, brown
  //   - backward / horizontal (B <= A)     : curved path going up, red dashed
  const edgesSvg = edges.map(({ a, b }) => {
    const pa = positions[a], pb = positions[b];
    if (!pa || !pb) return '';
    const da = depth.get(a) ?? 0;
    const db = depth.get(b) ?? 0;
    if (db <= da) {
      const midX = (pa.x + pb.x) / 2;
      const arcHeight = Math.max(35, Math.abs(pb.y - pa.y) * 0.45 + 30);
      const ctrlY = Math.min(pa.y, pb.y) - arcHeight;
      return `<path d="M ${pa.x} ${pa.y} Q ${midX} ${ctrlY} ${pb.x} ${pb.y}" fill="none" stroke="#8b1a1a" stroke-width="1.6" marker-end="url(#arrow-back)" opacity="0.7" stroke-dasharray="5 3"/>`;
    }
    return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#5a3a28" stroke-width="1.6" marker-end="url(#arrow)" opacity="0.55"/>`;
  }).join('');

  const locked = getLocked();
  const nodesSvg = nodes.map(num => {
    const p = positions[num];
    if (!p) return '';
    const meta = game.paragraphs?.[num] || { sentiment: 'neutral', note: '' };
    const sentiment = meta.sentiment || 'neutral';
    const fill = sentiment === 'positive' ? '#27ae60' : sentiment === 'negative' ? '#c0392b' : '#b0a78f';
    const isCurrent = num === game.currentParagraph;
    const isLocked = locked[num] != null;
    const r = isCurrent ? NODE_R_CURRENT : NODE_R_DEFAULT;
    const stroke = isCurrent ? '#d4a017' : '#2c1810';
    const strokeW = isCurrent ? 3 : 2;
    const lockedClass = isLocked ? ' locked' : '';
    const titleAttr = `§${num}${meta.note ? ' — ' + escapeHtml(meta.note) : ''}${isLocked ? ' [position épinglée]' : ''}`;
    const pinMarker = isLocked
      ? `<circle r="4" cx="${r - 3}" cy="${-r + 3}" fill="#d4a017" stroke="#2c1810" stroke-width="1"/>`
      : '';
    return `<g class="map-node${lockedClass}" data-action="jump-to-paragraph" data-num="${num}" transform="translate(${p.x},${p.y})">
      <title>${titleAttr}</title>
      <circle r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <text text-anchor="middle" dominant-baseline="central" font-size="14" fill="white" style="pointer-events:none;user-select:none;font-weight:bold;">${num}</text>
      ${pinMarker}
    </g>`;
  }).join('');

  container.innerHTML = `<svg class="map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow" viewBox="0 -3 10 6" refX="22" refY="0" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0,-3 L 8,0 L 0,3 Z" fill="#5a3a28"/>
      </marker>
      <marker id="arrow-back" viewBox="0 -3 10 6" refX="22" refY="0" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0,-3 L 8,0 L 0,3 Z" fill="#8b1a1a"/>
      </marker>
    </defs>
    ${edgesSvg}
    ${nodesSvg}
  </svg>`;

  attachPanZoom(container.querySelector('.map-svg'));
}

// ──────────── Pan & pinch-zoom ────────────

function attachPanZoom(svg) {
  const pointers = new Map();
  let pinchDist = null;
  let dragDistance = 0;

  const getViewBox = () => {
    const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    return { x, y, w, h };
  };
  const setViewBox = (vb) => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

  const panBy = (dx, dy) => {
    const vb = getViewBox();
    const rect = svg.getBoundingClientRect();
    vb.x -= dx * vb.w / rect.width;
    vb.y -= dy * vb.h / rect.height;
    setViewBox(vb);
  };

  const zoomAround = (clientX, clientY, factor) => {
    const vb = getViewBox();
    const rect = svg.getBoundingClientRect();
    const sx = vb.x + (clientX - rect.left) * vb.w / rect.width;
    const sy = vb.y + (clientY - rect.top) * vb.h / rect.height;
    vb.w *= factor;
    vb.h *= factor;
    vb.x = sx - (clientX - rect.left) * vb.w / rect.width;
    vb.y = sy - (clientY - rect.top) * vb.h / rect.height;
    setViewBox(vb);
  };

  const clientDeltaToSvg = (dx, dy) => {
    const vb = getViewBox();
    const rect = svg.getBoundingClientRect();
    return { dx: dx * vb.w / rect.width, dy: dy * vb.h / rect.height };
  };

  svg.addEventListener('pointerdown', (e) => {
    const nodeEl = e.target.closest('.map-node');
    let nodeStart = null;
    if (nodeEl) {
      const match = nodeEl.getAttribute('transform')?.match(/translate\(([\d.-]+),\s*([\d.-]+)\)/);
      if (match) {
        nodeStart = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      }
    }
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      nodeEl,
      nodeNum: nodeEl ? parseInt(nodeEl.dataset.num) : null,
      nodeX: nodeStart?.x ?? null,
      nodeY: nodeStart?.y ?? null,
      moved: false,
    });
    pinchDist = null;
    dragDistance = 0;
  });

  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const ptr = pointers.get(e.pointerId);
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    const moveAmount = Math.hypot(dx, dy);
    if (moveAmount > 2) ptr.moved = true;

    if (pointers.size === 1) {
      dragDistance += moveAmount;
      if (ptr.nodeEl && ptr.nodeX != null) {
        const svgDelta = clientDeltaToSvg(dx, dy);
        ptr.nodeX += svgDelta.dx;
        ptr.nodeY += svgDelta.dy;
        ptr.nodeEl.setAttribute('transform', `translate(${ptr.nodeX},${ptr.nodeY})`);
      } else {
        panBy(dx, dy);
      }
    } else if (pointers.size === 2) {
      const arr = [...pointers.values()];
      const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      const cx = (arr[0].x + arr[1].x) / 2;
      const cy = (arr[0].y + arr[1].y) / 2;
      if (pinchDist) zoomAround(cx, cy, pinchDist / dist);
      pinchDist = dist;
    }
  });

  const release = (e) => {
    const ptr = pointers.get(e.pointerId);
    if (ptr && ptr.nodeEl && ptr.moved && ptr.nodeX != null && state.game) {
      if (!state.game.mapLockedPositions) state.game.mapLockedPositions = {};
      state.game.mapLockedPositions[ptr.nodeNum] = { x: ptr.nodeX, y: ptr.nodeY };
      invalidateMapLayout();
      renderMap();
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = null;
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  svg.addEventListener('pointerleave', release);

  svg.addEventListener('click', (e) => {
    if (dragDistance > 8) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragDistance = 0;
  }, true);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAround(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 0.89);
  }, { passive: false });
}

// ──────────── Controls (called by event handlers) ────────────

export function zoomMapBy(factor) {
  const svg = document.querySelector('.map-svg');
  if (!svg) return;
  const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const cx = x + w / 2, cy = y + h / 2;
  const newW = w * factor;
  const newH = h * factor;
  svg.setAttribute('viewBox', `${cx - newW / 2} ${cy - newH / 2} ${newW} ${newH}`);
}

export function fitMap() {
  const svg = document.querySelector('.map-svg');
  if (svg) svg.setAttribute('viewBox', `0 0 ${currentDims.width} ${currentDims.height}`);
}

export function relayoutMap() {
  invalidateMapLayout();
  renderMap();
}
