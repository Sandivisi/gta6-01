// SOLMAR BAY — shared tuning and world constants.
// Original open-world crime game. All names, places and characters are invented.
export const WORLD = {
  width: 3840,
  height: 2880,
  block: 300,      // city block size (px)
  street: 96,      // street width (px)
  cell: 396,       // block + street pitch
};

export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 0, y: 0, w: 1900, h: 1400, tint: '#c8ccd4' },
  { name: 'MARINA', x: 1900, y: 0, w: 1940, h: 1400, tint: '#bfe3ea' },
  { name: 'OLD TOWN', x: 0, y: 1400, w: 1900, h: 1480, tint: '#e3d3a8' },
  { name: 'PALM HEIGHTS', x: 1900, y: 1400, w: 1940, h: 1480, tint: '#d8e8c0' },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  armor: 0,
};

export const CAR_TYPES = [
  { name: 'Solano', color: '#d94f3d', top: 150, accel: 420, grip: 3.4, len: 52, wid: 26 },
  { name: 'Vesper', color: '#3d7bd9', top: 185, accel: 500, grip: 3.8, len: 54, wid: 26 },
  { name: 'Kestrel GT', color: '#f2b705', top: 235, accel: 640, grip: 4.4, len: 56, wid: 27 },
  { name: 'Bramble Van', color: '#7a8a99', top: 130, accel: 330, grip: 2.8, len: 62, wid: 28 },
  { name: 'Comet Taxi', color: '#f2c200', top: 175, accel: 470, grip: 3.6, len: 53, wid: 26 },
  { name: 'Aurora', color: '#8e44ad', top: 200, accel: 560, grip: 4.0, len: 55, wid: 26 },
];

export const POLICE_COLORS = ['#1c2733', '#ffffff'];

export const WANTED_DECAY_SECONDS = 26;
export const SAVE_KEY = 'solmar-bay-save-v1';

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function rand(seedObj) {
  // tiny deterministic PRNG so the city layout is stable per seed
  seedObj.s = (seedObj.s * 1664525 + 1013904223) >>> 0;
  return seedObj.s / 4294967296;
}
export function pick(arr, r) { return arr[Math.floor(r * arr.length)]; }
