// Mind-map SVG des paragraphes : layout force-directed + pan/pinch-zoom iPad
import { el, escapeHtml } from './dom.js';
import { state } from './state.js';

const VIEW_W = 800;
const VIEW_H = 600;

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
  // Add any standalone nodes from non-null entries (in case some appear only at the start of a run)
  history.forEach(n => { if (n !== null) nodeSet.add(n); });

  return { nodes: [...nodeSet], edges: [...edgeMap.values()] };
}

// Fruchterman-Reingold (simplifié) — converge en ~250 itérations pour ~100 nœuds
// `locked` est une map { nodeId: {x, y} } pour les positions épinglées (drag manuel utilisateur).
function computeLayout(nodes, edges, width, height, iterations = 250, locked = {}) {
  if (nodes.length === 0) return {};
  if (nodes.length === 1) {
    const only = nodes[0];
    return { [only]: locked[only] ? { ...locked[only] } : { x: width / 2, y: height / 2 } };
  }

  const pos = {};
  const vel = {};
  const cx = width / 2, cy = height / 2;
  const initR = Math.min(width, height) / 3;
  nodes.forEach((n, i) => {
    if (locked[n]) {
      pos[n] = { x: locked[n].x, y: locked[n].y };
    } else {
      const angle = (i / nodes.length) * Math.PI * 2;
      pos[n] = { x: cx + Math.cos(angle) * initR, y: cy + Math.sin(angle) * initR };
    }
    vel[n] = { x: 0, y: 0 };
  });

  const area = width * height;
  const k = Math.sqrt(area / nodes.length) * 0.55;
  const kRep = k * k;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion (every pair) — O(n²)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); dist = 1; }
        const force = kRep / dist;
        vel[a].x += (dx / dist) * force;
        vel[a].y += (dy / dist) * force;
        vel[b].x -= (dx / dist) * force;
        vel[b].y -= (dy / dist) * force;
      }
    }

    // Attraction along edges
    edges.forEach(({ a, b }) => {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist * dist) / k;
      vel[a].x -= (dx / dist) * force;
      vel[a].y -= (dy / dist) * force;
      vel[b].x += (dx / dist) * force;
      vel[b].y += (dy / dist) * force;
    });

    // Apply velocities with cooling + damping (skip locked nodes — they stay pinned)
    const maxV = 30 * cooling;
    nodes.forEach(n => {
      if (locked[n]) {
        pos[n].x = locked[n].x;
        pos[n].y = locked[n].y;
        return;
      }
      let vx = vel[n].x * 0.04;
      let vy = vel[n].y * 0.04;
      vx = Math.max(-maxV, Math.min(maxV, vx));
      vy = Math.max(-maxV, Math.min(maxV, vy));
      pos[n].x += vx;
      pos[n].y += vy;
      vel[n].x *= 0.85;
      vel[n].y *= 0.85;
      // Clamp to bounds
      pos[n].x = Math.max(35, Math.min(width - 35, pos[n].x));
      pos[n].y = Math.max(35, Math.min(height - 35, pos[n].y));
    });
  }
  return pos;
}

// Cache positions to avoid re-shuffling on every render
let layoutCache = { key: '', positions: {} };

function getLocked() {
  return state.game?.mapLockedPositions || {};
}

function getOrComputeLayout(nodes, edges) {
  const locked = getLocked();
  const lockedKey = Object.keys(locked).sort().map(k => `${k}:${Math.round(locked[k].x)},${Math.round(locked[k].y)}`).join(';');
  const key = nodes.slice().sort((a, b) => a - b).join(',') + '|' + edges.length + '|' + lockedKey;
  if (layoutCache.key === key) return layoutCache.positions;
  layoutCache = { key, positions: computeLayout(nodes, edges, VIEW_W, VIEW_H, 250, locked) };
  return layoutCache.positions;
}

export function invalidateMapLayout() {
  layoutCache = { key: '', positions: {} };
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

  const positions = getOrComputeLayout(nodes, edges);

  const edgesSvg = edges.map(({ a, b }) => {
    const pa = positions[a], pb = positions[b];
    if (!pa || !pb) return '';
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
    const r = isCurrent ? 22 : 18;
    const stroke = isCurrent ? '#d4a017' : '#2c1810';
    const strokeW = isCurrent ? 3 : 2;
    const lockedClass = isLocked ? ' locked' : '';
    const titleAttr = `§${num}${meta.note ? ' — ' + escapeHtml(meta.note) : ''}${isLocked ? ' [position épinglée]' : ''}`;
    // Tiny pin marker for locked nodes
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

  container.innerHTML = `<svg class="map-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow" viewBox="0 -3 10 6" refX="22" refY="0" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0,-3 L 8,0 L 0,3 Z" fill="#5a3a28"/>
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
        // Drag this node only
        const svgDelta = clientDeltaToSvg(dx, dy);
        ptr.nodeX += svgDelta.dx;
        ptr.nodeY += svgDelta.dy;
        ptr.nodeEl.setAttribute('transform', `translate(${ptr.nodeX},${ptr.nodeY})`);
      } else {
        // Pan the viewBox
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
      // Persist node's new position and re-render edges
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

  // Suppress click after a drag (don't accidentally jump to paragraph)
  svg.addEventListener('click', (e) => {
    if (dragDistance > 8) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragDistance = 0;
  }, true);

  // Desktop wheel zoom
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
  if (svg) svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
}

export function relayoutMap() {
  invalidateMapLayout();
  renderMap();
}
