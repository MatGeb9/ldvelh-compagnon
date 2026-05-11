import { modal } from './dom.js';

const KEY = 'ldvelh_saves';

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
