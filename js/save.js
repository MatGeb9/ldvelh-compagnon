import { modal } from './dom.js';

const KEY = 'ldvelh_saves';
const LAST_EXPORT_KEY = 'ldvelh_last_export';

export function getLastExportInfo() {
  const ts = parseInt(localStorage.getItem(LAST_EXPORT_KEY) || '0');
  if (!ts || isNaN(ts)) return { everExported: false, daysAgo: null, timestamp: null };
  const daysAgo = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  return { everExported: true, daysAgo, timestamp: ts };
}

function markExported() {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  } catch {
    /* ignore — banner just stays as-is */
  }
}

export function getSaves() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

async function putSaves(saves) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saves));
    return { ok: true };
  } catch (e) {
    let msg = `Erreur de sauvegarde : ${e.message}`;
    if (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) {
      msg = "Stockage plein. Supprimez d'anciennes sauvegardes pour libérer de l'espace.";
    } else if (e.name === 'SecurityError') {
      msg = 'Navigation privée détectée — la sauvegarde locale est désactivée par le navigateur.';
    }
    await modal.alert(msg, 'Sauvegarde impossible');
    return { ok: false };
  }
}

export async function persistGame(game) {
  // Strip non-persisted derived data — adventureConfig is rebuilt on load.
  const data = { ...game };
  delete data.adventureConfig;
  data.timestamp = Date.now();

  const saves = getSaves();
  const existingIdx = saves.findIndex(
    s => s.heroName === data.heroName && s.adventureType === data.adventureType
  );
  if (existingIdx >= 0) saves[existingIdx] = data;
  else saves.push(data);

  return putSaves(saves);
}

export async function removeSave(idx) {
  const saves = getSaves();
  if (idx < 0 || idx >= saves.length) return { ok: false };
  saves.splice(idx, 1);
  return putSaves(saves);
}

// ──────────── Export / Import ────────────

// Triggers a JSON download of all saves. Returns the number of saves exported.
export function exportSaves() {
  const saves = getSaves();
  const payload = {
    app: 'ldvelh-compagnon',
    version: 1,
    exportedAt: new Date().toISOString(),
    saves,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ldvelh-saves-${date}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  if (saves.length > 0) markExported();
  return saves.length;
}

// Validates that an imported entry has the minimum shape of a save.
function isValidSave(s) {
  return s
    && typeof s === 'object'
    && typeof s.heroName === 'string'
    && typeof s.adventureType === 'string';
}

// Imports parsed JSON. mode: 'replace' wipes existing | 'merge' dedupes by (hero, adventure) keeping newer timestamp.
// Returns { ok, imported, kept } counts (or { ok:false, error }).
export async function importSaves(parsedJson, mode = 'merge') {
  // Accept both raw arrays and {saves: [...]} wrapper formats
  const incoming = Array.isArray(parsedJson) ? parsedJson : parsedJson?.saves;
  if (!Array.isArray(incoming)) {
    await modal.alert("Format invalide : pas de tableau 'saves' trouvé.", 'Import échoué');
    return { ok: false };
  }
  const valid = incoming.filter(isValidSave);
  if (valid.length === 0) {
    await modal.alert("Aucune sauvegarde valide dans le fichier.", 'Import vide');
    return { ok: false };
  }

  let next;
  if (mode === 'replace') {
    next = valid;
  } else {
    const current = getSaves();
    const map = new Map();
    [...current, ...valid].forEach(s => {
      const key = `${s.heroName}|${s.adventureType}`;
      const prev = map.get(key);
      if (!prev || (s.timestamp || 0) > (prev.timestamp || 0)) {
        map.set(key, s);
      }
    });
    next = [...map.values()];
  }

  const result = await putSaves(next);
  if (!result.ok) return result;
  return { ok: true, imported: valid.length, kept: next.length };
}
