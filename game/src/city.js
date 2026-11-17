// buildCity — generates Solmar Bay: streets, blocks, buildings, parks, beach and props.
// The city is a deterministic grid so every playthrough (and every screenshot) shares the map.
import { WORLD, DISTRICTS, rand, pick } from './config.js';

const BUILDING_PALETTES = {
  DOWNTOWN: ['#8d99ae', '#6d7b8f', '#a8b2c1', '#5b6b7f', '#93a1b5'],
  MARINA: ['#e8e2d0', '#cfe0e8', '#f2ead8', '#b8d4de'],
  'OLD TOWN': ['#d9b380', '#c99a5e', '#e8cfa0', '#b98a52'],
  'PALM HEIGHTS': ['#c9d6a3', '#a9bd8a', '#e3e8c8', '#8fae7a'],
};

function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}

export function buildCity(seed = 20261117) {
  const s = { s: seed };
  const { width, height, street, cell } = WORLD;
  const roadsV = []; // vertical street centre lines
  const roadsH = [];
  for (let x = street / 2 + 0; x < width; x += cell) roadsV.push(x + street / 2 - street / 2 + 48);
  // centre lines sit in the middle of each street band
  roadsV.length = 0; roadsH.length = 0;
  for (let x = 0; x < width; x += cell) roadsV.push(x + street / 2);
  for (let y = 0; y < height; y += cell) roadsH.push(y + street / 2);

  const buildings = [];
  const trees = [];
  const parks = [];
  const lamps = [];

  for (let bx = 0; bx < width / cell; bx++) {
    for (let by = 0; by < height / cell; by++) {
      const x0 = bx * cell + street;
      const y0 = by * cell + street;
      const bw = cell - street;
      const bh = cell - street;
      const cx = x0 + bw / 2, cy = y0 + bh / 2;
      const d = districtAt(cx, cy);
      const r = rand(s);
      // beach strip on the east edge (Marina waterfront)
      if (bx >= 9) {
        if (r < 0.45) {
          parks.push({ x: x0, y: y0, w: bw, h: bh, kind: 'beach' });
        } else {
          buildings.push(makeBuilding(x0, y0, bw, bh, d, s, true));
        }
        continue;
      }
      if (r < 0.16) {
        parks.push({ x: x0, y: y0, w: bw, h: bh, kind: rand(s) < 0.5 ? 'park' : 'plaza' });
        for (let i = 0; i < 5; i++) trees.push({ x: x0 + 30 + rand(s) * (bw - 60), y: y0 + 30 + rand(s) * (bh - 60), palm: rand(s) < 0.6 });
      } else if (r < 0.24) {
        // parking lot with a few parked cars (spawn points are filled by the game)
        parks.push({ x: x0, y: y0, w: bw, h: bh, kind: 'lot' });
      } else {
        buildings.push(makeBuilding(x0, y0, bw, bh, d, s, false));
        if (rand(s) < 0.7) trees.push({ x: x0 + 14, y: y0 + 14, palm: rand(s) < 0.5 });
        if (rand(s) < 0.5) trees.push({ x: x0 + bw - 14, y: y0 + bh - 14, palm: true });
      }
      // street lamps at intersections
      if (bx < width / cell - 1 && by < height / cell - 1) {
        lamps.push({ x: bx * cell + street / 2, y: by * cell + street / 2 });
      }
    }
  }

  // 20 hidden smuggler packages scattered around the city (collectible side activity)
  const packages = [];
  for (let i = 0; i < 20; i++) {
    const bx = Math.floor(rand(s) * 9), by = Math.floor(rand(s) * 7);
    packages.push({
      x: bx * cell + street + 40 + rand(s) * (cell - street - 80),
      y: by * cell + street + 40 + rand(s) * (cell - street - 80),
      taken: false,
    });
  }

  // water: the bay along the east edge + a marina basin
  const water = [
    { x: width - 40, y: 0, w: 40, h: height },           // east shoreline
    { x: 3400, y: 300, w: 440, h: 260 },                 // marina basin
  ];

  return { roadsV, roadsH, buildings, trees, parks, lamps, packages, water, seed };
}

function makeBuilding(x0, y0, bw, bh, d, s, waterfront) {
  const downtown = d.name === 'DOWNTOWN';
  const tall = downtown && rand(s) < 0.55;
  const w = bw * (0.55 + rand(s) * 0.35);
  const h = bh * (0.55 + rand(s) * 0.35);
  const x = x0 + (bw - w) / 2 + (rand(s) - 0.5) * 20;
  const y = y0 + (bh - h) / 2 + (rand(s) - 0.5) * 20;
  const palette = BUILDING_PALETTES[d.name] || BUILDING_PALETTES.DOWNTOWN;
  return {
    x, y, w, h,
    color: pick(palette, rand(s)),
    roof: pick(['#3d4756', '#5a4632', '#2f3a45', '#6b7c5e'], rand(s)),
    height: tall ? 3 + Math.floor(rand(s) * 4) : 1 + Math.floor(rand(s) * 2),
    windows: Math.floor(rand(s) * 1000),
    waterfront,
  };
}

// Is this point inside a building (solid)? Used for collisions.
export function hitBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Nearest road centre line (for traffic AI and spawning)
export function nearestRoadPoint(city, x, y) {
  let best = null, bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function districtNameAt(x, y) {
  return districtAt(x, y).name;
}
