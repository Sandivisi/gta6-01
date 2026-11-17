// Save — localStorage save/load for Solmar Bay progress.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      money: state.money,
      missionIndex: state.missionIndex,
      missionStep: state.missionStep,
      health: state.player.health,
      armor: state.player.armor,
      ammo: state.player.ammo,
      x: state.player.x,
      y: state.player.y,
      packages: state.city.packages.filter((p) => p.taken).length,
      packageTaken: state.city.packages.map((p) => p.taken),
      kills: state.stats.kills,
      carsStolen: state.stats.carsStolen,
      fares: state.stats.fares,
      playSeconds: state.stats.playSeconds,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch { return null; }
}

export function hasSave() { return loadSave() !== null; }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
